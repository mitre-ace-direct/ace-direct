let ua;
let currentSession;
let remoteStream = document.getElementById('remoteView');
let selfStream = document.getElementById('selfView');
const callOptionButtons = document.getElementById('call-option-buttons');
const muteAudioButton = document.getElementById('mute-audio');
const hideVideoButton = document.getElementById('hide-video');
const muteAudioIcon = document.getElementById('mute-audio-icon');
const muteCaptionsOffIcon = document.getElementById('mute-captions-off-icon');
const transcriptOverlay = document.getElementById('transcriptoverlay');
const hideVideoIcon = document.getElementById('mute-camera-off-icon');
const holdButton = document.getElementById('hold-call');
let maxRecordingSeconds = 90;
let callTerminated = false;
// const privacyVideoUrl = window.location.origin + '/' + nginxPath + '/media/videoPrivacy.webm';
const privacyVideoUrl = `${window.location.origin}/${nginxPath}/media/videoPrivacy.webm`;
let monitorExt;

// VIDEOMAIL recording progress bar
let recordId = null;

function startRecordProgress() {
  let secremain = maxRecordingSeconds;
  let seconds = 0;
  let percentage;

  if ($('#record-progress-bar').css('display') === 'none') {
    return;
  }
  if (recordId) {
    return;
  }
  $('#vmsent').hide();
  $('#vmwait').hide();
  $('#callbutton').prop('disabled', true);
  $('#videomailbutton').prop('disabled', true);
  $('#userformbtn').prop('disabled', true);
  recordId = setInterval(myFunc, 1000);
  seconds = 0;

  function myFunc() {
    if (seconds >= maxRecordingSeconds) {
      terminate_call();
      stopRecordProgress();
    } else {
      seconds += 1;
      secremain -= 1;
      percentage = (seconds / maxRecordingSeconds) * 100;
      $('#record-progress-bar').css('width', `${percentage.toFixed(0)}%`);
      $('#secsremain').html(`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${secremain} seconds remaining`);
      $('#recordicon').show();
    }
  }
}

function stopRecordProgress() {
  $('#record-progress-bar').hide();
  $('#secsremain').html('');
  $('#recordicon').hide();
  $('#record-progress-bar').css('width', '0%');
  $('#record-progress-bar').hide();
  $('#userformbtn').prop('disabled', false);
  $('#vmsent').hide();
  $('#vmwait').hide();

  if (recordId) {
    clearInterval(recordId);
    recordId = null;
    $('#vmsent').show();
    if (complaintRedirectActive || isOpen) {
      $('#redirecttag').attr('href', complaintRedirectUrl);
      $('#redirectdesc').text(`Redirecting to ${complaintRedirectDesc} ...`);
      $('#callEndedModal').modal('show');
      setTimeout(function () {
        window.location = complaintRedirectUrl;
      }, 5000);
    }
  }
}

// setup for the call. creates and starts the User Agent (UA) and registers event handlers
// This uses the new ACE Kurento object rather than JsSIP
function register_jssip(myExtension, myPassword) {
  console.log(`Registering...`);

  var eventHandlers = {
    connected: function (e) {
      console.log(`--- WV: Connected ---\n${e}`);
      callTerminated = false;
    },
    accepted: function (e) {
      console.log(`--- WV: UA accepted ---\n${e}`);
    },
    newMessage: function (e) {
      console.log(`--- WV: New Message ---\n`);
      let consumerLanguage = sessionStorage.consumerLanguage;

      console.log(`Consumer's selected language is ${consumerLanguage}`);

      try {
        if (e.msg === 'STARTRECORDING') {
          startRecordProgress();
          enable_video_privacy();
          setTimeout(function () {
            disable_video_privacy();
          }, 1000);
        } else {
          const transcripts = JSON.parse(e.msg);
          if (transcripts.transcript && !acekurento.isMultiparty) {
            // Acedirect will skip translation service if languages are the same
            console.log('sending caption:', transcripts.transcript, myExtension);
            socket.emit('translate-caption', {
              transcripts: transcripts,
              callerNumber: myExtension
            });
            // acedirect.js is listening for 'caption-translated' and will call
            // updateConsumerCaptions directly with the translation
          }
        }
      } catch (err) {
        console.log(err);
      }
    },
    registerResponse: function (error) {
      console.log('--- WV: Register response:', error || 'Success ---');
      if (!error) {
      }
    },
    pausedQueue: function (e) {
      console.log(`--- WV: Paused Agent Member in Queue ---\n${e}`);
    },
    unpausedQueue: function (e) {
      console.log(`--- WV: Unpaused Agent Member in Queue ---\n${e}`);
    },
    callResponse: function (e) {
      console.log(`--- WV: Call response ---\n${e}`);
    },
    incomingCall: function (call) {
      console.log(`--- WV: Incoming call ---\n${call}`);
    },
    progress: function (e) {
      console.log(`--- WV: Calling... ---\n${e}`);
    },
    startedRecording: function (e) {
      console.log('--- WV: Started Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
      }
    },
    stoppedRecording: function (e) {
      console.log('--- WV: Stopped Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
      }
    },
    failed: function(e) {
      console.log(`--- WV: Failed ---\n${e}`);
    },
    restartCallResponse: function (e) {
      console.log(`--- WV: restartCallResponse ---\n${JSON.stringify(e)}`);
      if (selfStream && selfStream.srcObject) {
        selfStream.srcObject.getVideoTracks()[0].onended = function () {
          console.log('screensharing ended self');
          $('#startScreenshare').hide();

          if (monitorExt) {
            // force monitor to leave the session first
            socket.emit('force-monitor-leave', { monitorExt: monitorExt, reinvite: true });

            setTimeout(() => {
              screenShareEnabled = false;
              if (acekurento) acekurento.screenshare(false);
            }, 500);
          } else {
            if (acekurento) {
              acekurento.screenshare(false);
            }
          }
        };
      }
      if (remoteStream && remoteStream.srcObject) {
        remoteStream.srcObject.getVideoTracks()[0].onended = function () {
          console.log('screensharing ended remote');
          $('#startScreenshare').hide();
        };
      }

      if (monitorExt) {
        // bring the monitor back to the session
        socket.emit('reinvite-monitor', { monitorExt: monitorExt });
      }
    },
    ended: function (e) {
      console.log('--- WV: Call ended ---\n');

      $('#startScreenshare').hide();

      terminate_call();
      clearScreen();
      disable_chat_buttons();
      enable_initial_buttons();
      $('#start-call-buttons').show();
      $('#agent-name-box').hide();
      $('#agent-name').text('');
      $('#end-call').attr('onclick', 'terminate_call()');

    },
    participantsUpdate: function (e) {
      console.log('--- WV: Participants Update ---\n');
      console.log(`--- WV: ${JSON.stringify(e)}`);
      console.log(`--- WV: e.participants.length: ${e.participants.length}`);
      var partCount = e.participants.filter(t => t.type === 'participant:webrtc').length;

      console.log(`--- WV: partCount: ${partCount}`);

      for (var i = 0; i < e.participants.length; i += 1) {
        if (e.participants[i].isMonitor) {
          monitorExt = e.participants[i].ext;
        }
      }

      if (partCount >= 2 || videomailflag) {
        console.log('--- WV: CONNECTED');
        $('#queueModal').modal('hide');

        toggle_incall_buttons(true);
        start_self_video();
        $('#start-call-buttons').hide();
      }

    }

  };
  acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
  acekurento.register(myExtension, myPassword, false);
}

// makes a call
/*
* Use acekurento object to make the call. Not sure about the extension
*/
function start_call(otherSipUri, myExtension) {
  console.log(`start_call: ${otherSipUri}`);
  selfStream.removeAttribute('hidden');
  if (!captionsMuted()) {
    show_captions();
  }

  $('#screenshareButton').removeAttr('disabled');
  $('#fileInput').removeAttr('disabled');
  $('#shareFileConsumer').removeAttr('disabled');
  // acekurento.call(globalData.queues_complaint_number, false);
  acekurento.call(otherSipUri, false);
}

function toggleSelfview() {
  setTimeout(function () {
    hide_video();
    setTimeout(function () {
      unhide_video();
    }, 1000);
  }, 3000);
}

// starts the local streaming video. Works with some older browsers,
// if it is incompatible it logs an error message,
// and the selfStream html box stays hidden
function start_self_video() {
  // not needed?
}

// toggles showing the call option buttons at the bottom of the video window (ie end call, mute, etc).
// The buttons themselves are in acedirect and the complaint_form, this simply un-hides them
// @param make_visible: boolean whether or not to show the call option buttons
function toggle_incall_buttons(make_visible) {
  if (make_visible) callOptionButtons.style.display = 'block';
  else callOptionButtons.style.display = 'none';
}

function transfer_to_videomail() {
  if (currentSession) {
    currentSession.sendDTMF(1);

    $('#vmwait').show();
    swap_video();
    $('#vmsent').hide();
    videomailflag = true;
    $('#record-progress-bar').show();
    $('#callbutton').prop('disabled', true);
    $('#userformbtn').prop('disabled', true);
    $('#videomailbutton').prop('disabled', true);
  }
}

function monitorHangup() {
  socket.emit('force-monitor-leave', { monitorExt: monitorExt, reinvite: false });
  setTimeout(() => {
    terminate_call();
  }, 500);
}

// handles cleanup from jssip call. removes the session if it is active and removes video.
function terminate_call() {
  if (acekurento !== null) {
    acekurento.stop(false);
    acekurento = null;
  }
  callTerminated = true;
  monitorExt = null;

  document.getElementById('screenshareButton').disabled = true;
  $('#screenshareButton').prop('disabled', true);
  $('#fileInput').prop('disabled', true);
  $('#shareFileConsumer').prop('disabled', true);
  $('#screenshareButtonGroup').hide();
  clearScreen();
  remove_video();
  disable_chat_buttons();
  enable_initial_buttons();
  $('#start-call-buttons').show();
  $('#agent-name-box').hide();
  $('#agent-name').text('');
  exitFullscreen();
  $('#transcriptoverlay').html('');
  hide_captions();

  // reset the incall mute button
  muteAudioButton.setAttribute('onclick', 'javascript: mute_audio();');
  muteAudioIcon.classList.add('fa-microphone');
  muteAudioIcon.classList.remove('fa-microphone-slash');

  // remove file sharing
  socket.emit('call-ended', { agentExt: '' });

  stopRecordProgress();
}

// terminates the call (if present) and unregisters the ua
function unregister_jssip() {
  terminate_call();
  if (ua) {
    ua.unregister();
    ua.terminateSessions();
    ua.stop();
  }
  localStorage.clear();
  sessionStorage.clear();
}

// removes both the remote and self video streams and replaces it with default image.
// stops allowing camera to be active. also hides callOptionsButtons.
function remove_video() {
  selfStream.setAttribute('hidden', true);
  selfStream.pause();
  remoteStream.pause();
  selfStream.src = '';
  remoteView.src = '';

  console.log('Disabling video privacy button');
  hideVideoButton.setAttribute('onclick', 'javascript: enable_video_privacy();');
  hideVideoIcon.style.display = 'none';

  // stops remote track
  if (remoteView.srcObject) {
    if (remoteView.srcObject.getTracks()) {
      if (remoteView.srcObject.getTracks()[0]) {
        remoteView.srcObject.getTracks()[0].stop();
      }
      if (remoteView.srcObject.getTracks()[1]) {
        remoteView.srcObject.getTracks()[1].stop();
      }
    }
  }

  // stops the camera from being active
  if (window.self_stream) {
    if (window.self_stream.getVideoTracks()) {
      if (window.self_stream.getVideoTracks()[0]) {
        window.self_stream.getVideoTracks()[0].stop();
        console.log('consumer removed camera');
      }
    }
  }
  removeElement('selfView');
  removeElement('remoteView');
  addElement('consumer-webcam', 'video', 'remoteView');
  remoteView.setAttribute('autoplay', 'autoplay');
  remoteView.setAttribute('poster', 'images/acedirect-logo-trim.png');
  addElement('consumer-webcam', 'video', 'selfView');
  selfView.setAttribute('style', 'right: 11px');
  selfView.setAttribute('autoplay', 'autoplay');
  selfView.setAttribute('muted', true);
  selfView.classList.add('mirror-mode');

  selfView.muted = true;
  selfView.setAttribute('hidden', true);
  remoteStream = document.getElementById('remoteView');
  selfStream = document.getElementById('selfView');

  toggle_incall_buttons(false);
  if (acekurento !== null) {
    acekurento.remoteStream = document.getElementById('remoteView');
    acekurento.selfStream = document.getElementById('selfView');
  }
}

// swaps remote and local videos for videomail recording
// puts Consumer's own video in the big video
function swap_video() {
  // local becomes remote and remote becomes local
  $('#remoteView').attr('id', 'tempView');
  $('#selfView').attr('id', 'remoteView');
  $('#tempView').attr('id', 'selfView');

  $('#selfView').attr('width', 0);
  $('#selfView').attr('height', 0);
  $('#selfView').attr('muted', true);
  $('#selfView').attr('hidden', true);
}

// Adds an element to the document
function addElement(parentId, elementTag, elementId, html) {
  var p = document.getElementById(parentId);
  var newElement = document.createElement(elementTag);
  newElement.setAttribute('id', elementId);
  newElement.setAttribute('class', elementId);
  newElement.innerHTML = html;
  p.appendChild(newElement);
}

// Removes an element from the document
function removeElement(elementId) {
  var element = document.getElementById(elementId);
  element.parentNode.removeChild(element);
}

// mutes self audio so remote cannot hear you
function mute_audio() {
  console.log('here mute');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, true); // mute audio
    muteAudioButton.setAttribute('onclick', 'javascript: unmute_audio();');
    muteAudioIcon.classList.add('fa-microphone-slash');
    muteAudioIcon.classList.remove('fa-microphone');
    console.log('here mute2');
  }
}

// unmutes self audio so remote can hear you
function unmute_audio() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, true); // unmute audio
    muteAudioButton.setAttribute('onclick', 'javascript: mute_audio();');
    muteAudioIcon.classList.add('fa-microphone');
    muteAudioIcon.classList.remove('fa-microphone-slash');
  }
}

function show_captions() {
  $('#consumer-webcam').css('height', '70%');
  $('#consumer-captions').show();
  $('#consumer-divider').show();
}

function hide_captions() {
  $('#consumer-webcam').css('height', '100%');
  $('#consumer-captions').hide();
  $('#consumer-divider').hide();
}

function captionsMuted() {
  return muteCaptionsOffIcon.style.display === 'block';
}

// hide/unhide captions
function toggle_captions() {
  if (!captionsMuted()) {
    muteCaptionsOffIcon.style.display = 'block';
    transcriptOverlay.style.display = 'none';
    hide_captions();
  } else {
    muteCaptionsOffIcon.style.display = 'none';
    transcriptOverlay.style.display = 'block';
    show_captions();
  }
}

// hides self video so remote cannot see you
function hide_video() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, false); // mute video
    selfStream.setAttribute('hidden', true);
  }
}

// unhides self video so remote can see you
function unhide_video() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, false); // unmute video
    selfStream.removeAttribute('hidden');
  }
}

function enable_video_privacy() {
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt: monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.remove('mirror-mode');
        acekurento.enableDisableTrack(false, false); // mute video
        hideVideoButton.setAttribute('onclick', 'javascript: disable_video_privacy();');
        hideVideoIcon.style.display = 'block';
        acekurento.privateMode(true, privacyVideoUrl);
        socket.emit('reinvite-monitor', { monitorExt: monitorExt });
      }, 500);
    } else {
      selfStream.classList.remove('mirror-mode');
      acekurento.enableDisableTrack(false, false); // mute video
      hideVideoButton.setAttribute('onclick', 'javascript: disable_video_privacy();');
      hideVideoIcon.style.display = 'block';
      acekurento.privateMode(true, privacyVideoUrl);
    }
  }
}

function disable_video_privacy() {
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt: monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.add('mirror-mode');
        acekurento.enableDisableTrack(true, false); // unmute video
        hideVideoButton.setAttribute('onclick', 'javascript: enable_video_privacy();');
        hideVideoIcon.style.display = 'none';
        acekurento.privateMode(false);
        hideVideoIcon.style.display = 'none';
        socket.emit('reinvite-monitor', { monitorExt: monitorExt });
      }, 500);
    } else {
      selfStream.classList.add('mirror-mode');
      acekurento.enableDisableTrack(true, false); // unmute video
      hideVideoButton.setAttribute('onclick', 'javascript: enable_video_privacy();');
      hideVideoIcon.style.display = 'none';
      acekurento.privateMode(false);
      hideVideoIcon.style.display = 'none';
    }
  }
}
// times out and ends call after 30 or so seconds.
// agent gets event 'ended' with cause 'RTP Timeout'.
// puts session on hold
function hold() {
  if (currentSession) {
    var options = {
      useUpdate: true
    };
    currentSession.hold(options);
    holdButton.setAttribute('onclick', 'javascript: unhold();');
    holdButton.innerHTML = 'Unhold';
  }
}

// resumes session
function unhold() {
  if (currentSession) {
    currentSession.unhold();
    holdButton.setAttribute('onclick', 'javascript: hold();');
    holdButton.innerHTML = 'Hold';
  }
}

// Used to exit fullscreen if active when call is teminated
function exitFullscreen() {
  if (document.fullscreen) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Change the style of the video captions
function changeCaption(id) {
  var value = id.split('-')[1];
  var target = id.split('-')[0];

  // change css variable value
  if (target === 'bg') {
    var alpha = $('#opacity-slider-consumer').val();
    if (alpha === 0 ) {
      alpha = 1;
      $('#opacity-slider-consumer').val(1);
    }
    var color;
    switch (value) {
      case 'black':
        color = `rgba(0,0,0,${alpha})`;
        break;
      case 'grey':
        color = `rgba(128,128,128,${alpha})`;
        break;
      case 'white':
        color = `rgba(255,255,255,${alpha})`;
        break;
    }
    document.documentElement.style.setProperty('--caption-bg-color', color);
  } else if (target === 'font') {
    document.documentElement.style.setProperty('--caption-font-color', value);
  } else {
    document.documentElement.style.setProperty('--caption-font-size', `${id}rem`);
  }
}

$('#bg-transparent').click(function () {
  $('#opacity-slider-consumer').val(0);
  $('#opacity-slider-consumer').trigger('mousemove');
});

$('#opacity-slider-consumer').on('change mousemove', function () {
  var alpha = $(this).val();
  var current = document.documentElement.style.getPropertyValue('--caption-bg-color');
  if (current === '') {
    current = 'rgba(128,128,128,0';
  }
  var color = `${current.substring(0, current.lastIndexOf(',') + 1)}${alpha})`;
  document.documentElement.style.setProperty('--caption-bg-color', color);
});

function createCaptionHtml(displayName, transcripts) {
  console.log(displayName, transcripts);
  let caption = transcripts.transcript;
  if (!transcripts.final) {
    caption += '...';
  }
  let timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<span class="timestamp">${timestamp}</span><strong>${displayName}:</strong> ${caption}`;
}

function updateConsumerCaptions(transcripts) {
  console.log('--- WV: transcripts.transcript ---\n');
  console.log('consumer uc: ', transcripts);

  var tDiv = document.getElementById(transcripts.msgid);
  const displayName = `CSR ${$('#agent-name').text()}`;
  let caption = createCaptionHtml(displayName, transcripts);
  if (!tDiv) {
    const temp = document.createElement('div');
    temp.id = transcripts.msgid;
    temp.innerHTML = caption;
    temp.classList.add('transcripttext');
    document.getElementById('transcriptoverlay').prepend(temp);
    // let elem = $('#consumer-captions');
    // elem.scrollTop(elem.prop('scrollHeight')); // Scroll to bottom
  } else {
    tDiv.innerHTML = caption;
    if (transcripts.final || callTerminated) {
      // setTimeout(function(){tDiv.remove();},5000);

      // var captionBubble = '<div><b>' +transcripts.timestamp + ':</b>&nbsp;'+transcripts.transcript+'<br/><div>';
      // $(captionBubble).appendTo($('#caption-messages'));
      $('#caption-messages').append(`<div class=\'agent-scripts\'><div class=\'direct-chat-text\'>${transcripts.transcript}</div></div>`);
      $('#caption-messages').scrollTop($('#caption-messages')[0].scrollHeight);
    }
  }
}

// Default to English
sessionStorage.consumerLanguage = 'en';

/* global setPreferredLanguage */
/* eslint no-undef: "error" */
function setPreferredLanguage() {
  sessionStorage.consumerLanguage = $('#language-select').val();
  let flag = 'us';
  let language = 'English';

  switch (sessionStorage.consumerLanguage) {
    case 'ar':
      flag = 'ae';
      language = 'Arabic';
      break;
    case 'zh':
      flag = 'cn';
      language = 'Chinese (Mandarin)';
      break;
    case 'nl':
      flag = 'nl';
      language = 'Dutch';
      break;
    case 'fr':
      flag = 'fr';
      language = 'French';
      break;
    case 'de':
      flag = 'de';
      language = 'German';
      break;
    case 'it':
      flag = 'in';
      language = 'Italian';
      break;
    case 'ja':
      flag = 'jp';
      language = 'Japanese';
      break;
    case 'ko':
      flag = 'kr';
      language = 'Korean';
      break;
    case 'pt':
      flag = 'pt';
      language = 'Portuguese';
      break;
    case 'es':
      flag = 'mx';
      language = 'Spanish';
      break;
    default:
      flag = 'us';
      language = 'English';
  }

  $('#preferred-language-span').html('').html(`Preferred language is <img src='images/flags/${flag}.png'> ${language}`);
}

// function getAgentColor(displayName) {
// console.log('returning cyan for', displayName)
// return 'cyan'; // fixme
// }

function updateCaptionsMultiparty(transcripts) {
  const temp = document.createElement('div');
  temp.id = transcripts.msgid;

  // fixme how do i know if this is consumer
  let displayName = '';
  if (transcripts.agent) {
    displayName = 'CSR ';
  }
  displayName += transcripts.displayname;
  temp.innerHTML = createCaptionHtml(displayName, transcripts);

  temp.classList.add('transcripttext');
  // if (transcripts.agent) {

  // temp.classList.add('agent-color-' + getAgentColor(transcripts.displayname) ); //fixme
  // }
  document.getElementById('transcriptoverlay').prepend(temp);
  // setTimeout(function () { temp.remove() }, 5000);
}
