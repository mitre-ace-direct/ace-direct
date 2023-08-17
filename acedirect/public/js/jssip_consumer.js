/* global
  acekurento:writable,
  clearScreen,
  complaintRedirectActive,
  complaintRedirectUrl,
  complaintRedirectDesc,
  disableChatButtons,
  enableInitialButtons,
  isOpen,
  maxRecordingSeconds:writable,
  nginxPath,
  remoteView,
  selfView,
  socket,
  videomailflag:writable */

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

maxRecordingSeconds = 90;
let callTerminated = false;
// const privacyVideoUrl = window.location.origin + '/' + nginxPath + '/media/videoPrivacy.webm';

const privacyVideoUrl = `${window.location.origin}/${nginxPath}/media/videoPrivacy.webm`;
let monitorExt;

// VIDEOMAIL recording progress bar
let recordId = null;

// Adds an element to the document
function addElement(parentId, elementTag, elementId, html) {
  const p = document.getElementById(parentId);
  const newElement = document.createElement(elementTag);
  newElement.setAttribute('id', elementId);
  newElement.setAttribute('class', elementId);
  newElement.innerHTML = html;
  p.appendChild(newElement);
}

// Removes an element from the document
function removeElement(elementId) {
  const element = document.getElementById(elementId);
  element.parentNode.removeChild(element);
}

function showCaptions() {
  $('#consumer-webcam').css('height', '70%');
  $('#consumer-captions').show();
  $('#consumer-divider').show();
}

function hideCaptions() {
  $('#consumer-webcam').css('height', '100%');
  $('#consumer-captions').hide();
  $('#consumer-divider').hide();
}

// toggles showing call option buttons at the bottom of the video window (ie end call, mute, etc).
// The buttons themselves are in acedirect and the complaint_form, this simply un-hides them
// @param make_visible: boolean whether or not to show the call option buttons
function toggleIncallButtons(makeVisible) {
  if (makeVisible) callOptionButtons.style.display = 'block';
  else callOptionButtons.style.display = 'none';
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
      setTimeout(() => {
        window.location = complaintRedirectUrl;
      }, 5000);
    }
  }
}

function enableVideoPrivacy() {
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.remove('mirror-mode');
        acekurento.enableDisableTrack(false, false); // mute video
        hideVideoButton.setAttribute('onclick', 'disableVideoPrivacy();');
        hideVideoIcon.style.display = 'block';
        acekurento.privateMode(true, privacyVideoUrl);
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.remove('mirror-mode');
      acekurento.enableDisableTrack(false, false); // mute video
      hideVideoButton.setAttribute('onclick', 'disableVideoPrivacy();');
      hideVideoIcon.style.display = 'block';
      acekurento.privateMode(true, privacyVideoUrl);
    }
  }
}

function disableVideoPrivacy() {
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.add('mirror-mode');
        acekurento.enableDisableTrack(true, false); // unmute video
        hideVideoButton.setAttribute('onclick', 'enableVideoPrivacy();');
        hideVideoIcon.style.display = 'none';
        acekurento.privateMode(false);
        hideVideoIcon.style.display = 'none';
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.add('mirror-mode');
      acekurento.enableDisableTrack(true, false); // unmute video
      hideVideoButton.setAttribute('onclick', 'enableVideoPrivacy();');
      hideVideoIcon.style.display = 'none';
      acekurento.privateMode(false);
      hideVideoIcon.style.display = 'none';
    }
  }
}

// starts the local streaming video. Works with some older browsers,
// if it is incompatible it logs an error message,
// and the selfStream html box stays hidden
function startSelfVideo() {
  // not needed?
}

// removes both the remote and self video streams and replaces it with default image.
// stops allowing camera to be active. also hides callOptionsButtons.
function removeVideo() {
  selfStream.setAttribute('hidden', true);
  selfStream.pause();
  remoteStream.pause();
  selfStream.src = '';
  remoteView.src = '';

  console.log('Disabling video privacy button');
  hideVideoButton.setAttribute('onclick', 'enableVideoPrivacy();');
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

  toggleIncallButtons(false);
  if (acekurento !== null) {
    acekurento.remoteStream = document.getElementById('remoteView');
    acekurento.selfStream = document.getElementById('selfView');
  }
}

// handles cleanup from jssip call. removes the session if it is active and removes video.
function terminateCall() {
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
  removeVideo();
  disableChatButtons();
  enableInitialButtons();
  $('#start-call-buttons').show();
  $('#agent-name-box').hide();
  $('#agent-name').text('');
  exitFullscreen();
  $('#transcriptoverlay').html('');
  hideCaptions();

  // reset the incall mute button
  muteAudioButton.setAttribute('onclick', 'muteAudio();');
  muteAudioIcon.classList.add('fa-microphone');
  muteAudioIcon.classList.remove('fa-microphone-slash');

  // remove file sharing
  socket.emit('call-ended', { agentExt: '' });

  stopRecordProgress();
}

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
  seconds = 0;

  function myFunc() {
    if (seconds >= maxRecordingSeconds) {
      terminateCall();
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
  recordId = setInterval(myFunc, 1000);
}

// setup for the call. creates and starts the User Agent (UA) and registers event handlers
// This uses the new ACE Kurento object rather than JsSIP
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function registerJssip(myExtension, myPassword) {
  const eventHandlers = {
    connected: (e) => {
      console.log(`--- WV: Connected ---\n${e}`);
      callTerminated = false;
    },
    accepted: (e) => {
      console.log(`--- WV: UA accepted ---\n${e}`);
    },
    newMessage: (e) => {
      console.log('--- WV: New Message ---\n');
      const { consumerLanguage } = sessionStorage;

      console.log(`Consumer's selected language is ${consumerLanguage}`);

      try {
        if (e.msg === 'STARTRECORDING') {
          startRecordProgress();
          enableVideoPrivacy();
          setTimeout(() => {
            disableVideoPrivacy();
          }, 1000);
        } else {
          const transcripts = JSON.parse(e.msg);
          if (transcripts.transcript && !acekurento.isMultiparty) {
            // Acedirect will skip translation service if languages are the same
            socket.emit('translate-caption', {
              transcripts,
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
    registerResponse: (error) => {
      console.log('--- WV: Register response:', error || 'Success ---');
      if (!error) {
        // empty
      }
    },
    pausedQueue: (e) => {
      console.log(`--- WV: Paused Agent Member in Queue ---\n${e}`);
    },
    unpausedQueue: (e) => {
      console.log(`--- WV: Unpaused Agent Member in Queue ---\n${e}`);
    },
    callResponse: (e) => {
      console.log(`--- WV: Call response ---\n${e}`);
    },
    incomingCall: (call) => {
      console.log(`--- WV: Incoming call ---\n${call}`);
    },
    progress: (e) => {
      console.log(`--- WV: Calling... ---\n${e}`);
    },
    startedRecording: (e) => {
      console.log('--- WV: Started Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        // empty
      }
    },
    stoppedRecording: (e) => {
      console.log('--- WV: Stopped Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        // empty
      }
    },
    failed: (e) => {
      console.log(`--- WV: Failed ---\n${e}`);
    },
    restartCallResponse: (e) => {
      console.log(`--- WV: restartCallResponse ---\n${JSON.stringify(e)}`);
      if (selfStream && selfStream.srcObject) {
        selfStream.srcObject.getVideoTracks()[0].onended = () => {
          console.log('screensharing ended self');
          $('#startScreenshare').hide();

          if (monitorExt) {
            // force monitor to leave the session first
            socket.emit('force-monitor-leave', { monitorExt, reinvite: true });

            setTimeout(() => {
              if (acekurento) acekurento.screenshare(false);
            }, 500);
          } else if (acekurento) {
            acekurento.screenshare(false);
          }
        };
      }
      if (remoteStream && remoteStream.srcObject) {
        remoteStream.srcObject.getVideoTracks()[0].onended = () => {
          console.log('screensharing ended remote');
          $('#startScreenshare').hide();
        };
      }

      if (monitorExt) {
        // bring the monitor back to the session
        socket.emit('reinvite-monitor', { monitorExt });
      }
    },
    ended: (e) => {
      console.log(`--- WV: Call ended ---\n${e}`);

      $('#startScreenshare').hide();

      terminateCall();
      clearScreen();
      disableChatButtons();
      enableInitialButtons();
      $('#start-call-buttons').show();
      $('#agent-name-box').hide();
      $('#agent-name').text('');
      $('#end-call').attr('onclick', 'terminateCall()');
    },
    participantsUpdate: (e) => {
      const partCount = e.participants.filter((t) => t.type === 'participant:webrtc').length;
      console.log('--- WV: Participants Update ---\n');
      console.log(`--- WV: ${JSON.stringify(e)}`);
      console.log(`--- WV: e.participants.length: ${e.participants.length}`);

      console.log(`--- WV: partCount: ${partCount}`);

      for (let i = 0; i < e.participants.length; i += 1) {
        if (e.participants[i].isMonitor) {
          monitorExt = e.participants[i].ext;
        }
      }

      if (partCount >= 2 || videomailflag) {
        console.log('--- WV: CONNECTED');
        $('#queueModal').modal('hide');

        toggleIncallButtons(true);
        startSelfVideo();
        $('#start-call-buttons').hide();
      }
    }
  };
  console.log('Registering...');
  acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
  acekurento.register(myExtension, myPassword, false);
}

// makes a call
/*
* Use acekurento object to make the call. Not sure about the extension
*/
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function startCall(otherSipUri) {
  console.log(`startCall: ${otherSipUri}`);
  selfStream.removeAttribute('hidden');
  // eslint-disable-next-line no-use-before-define -- defined in complaint_form.js
  if (!captionsMuted()) {
    showCaptions();
  }

  $('#screenshareButton').removeAttr('disabled');
  $('#fileInput').removeAttr('disabled');
  $('#shareFileConsumer').removeAttr('disabled');
  // acekurento.call(globalData.queues_complaint_number, false);
  acekurento.call(otherSipUri, false);
}

// swaps remote and local videos for videomail recording
// puts Consumer's own video in the big video
function swapVideo() {
  // local becomes remote and remote becomes local
  $('#remoteView').attr('id', 'tempView');
  $('#selfView').attr('id', 'remoteView');
  $('#tempView').attr('id', 'selfView');

  $('#selfView').attr('width', 0);
  $('#selfView').attr('height', 0);
  $('#selfView').attr('muted', true);
  $('#selfView').attr('hidden', true);
}

// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function transferToVideomail() {
  if (currentSession) {
    currentSession.sendDTMF(1);

    $('#vmwait').show();
    swapVideo();
    $('#vmsent').hide();
    videomailflag = true;
    $('#record-progress-bar').show();
    $('#callbutton').prop('disabled', true);
    $('#userformbtn').prop('disabled', true);
    $('#videomailbutton').prop('disabled', true);
  }
}

// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function monitorHangup() {
  socket.emit('force-monitor-leave', { monitorExt, reinvite: false });
  setTimeout(() => {
    terminateCall();
  }, 500);
}

// terminates the call (if present) and unregisters the ua
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function unregisterJssip() {
  terminateCall();
  if (ua) {
    ua.unregister();
    ua.terminateSessions();
    ua.stop();
  }
  localStorage.clear();
  sessionStorage.clear();
}

// mutes self audio so remote cannot hear you
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function muteAudio() {
  console.log('here mute');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, true); // mute audio
    muteAudioButton.setAttribute('onclick', 'unmuteAudio();');
    muteAudioIcon.classList.add('fa-microphone-slash');
    muteAudioIcon.classList.remove('fa-microphone');
    console.log('here mute2');
  }
}

// unmutes self audio so remote can hear you
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function unmuteAudio() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, true); // unmute audio
    muteAudioButton.setAttribute('onclick', 'muteAudio();');
    muteAudioIcon.classList.add('fa-microphone');
    muteAudioIcon.classList.remove('fa-microphone-slash');
  }
}

function captionsMuted() {
  return muteCaptionsOffIcon.style.display === 'block';
}

// hide/unhide captions
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function toggleCaptions() {
  if (!captionsMuted()) {
    muteCaptionsOffIcon.style.display = 'block';
    transcriptOverlay.style.display = 'none';
    hideCaptions();
  } else {
    muteCaptionsOffIcon.style.display = 'none';
    transcriptOverlay.style.display = 'block';
    showCaptions();
  }
}

// hides self video so remote cannot see you
function hideVideo() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, false); // mute video
    selfStream.setAttribute('hidden', true);
  }
}

// unhides self video so remote can see you
function unhideVideo() {
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, false); // unmute video
    selfStream.removeAttribute('hidden');
  }
}

// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function toggleSelfview() {
  setTimeout(() => {
    hideVideo();
    setTimeout(() => {
      unhideVideo();
    }, 1000);
  }, 3000);
}

// times out and ends call after 30 or so seconds.
// agent gets event 'ended' with cause 'RTP Timeout'.
// puts session on hold
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function hold() {
  if (currentSession) {
    const options = {
      useUpdate: true
    };
    currentSession.hold(options);
    holdButton.setAttribute('onclick', 'unhold();');
    holdButton.innerHTML = 'Unhold';
  }
}

// resumes
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function unhold() {
  if (currentSession) {
    currentSession.unhold();
    holdButton.setAttribute('onclick', 'hold();');
    holdButton.innerHTML = 'Hold';
  }
}

// Change the style of the video captions
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
function changeCaption(id) {
  const value = id.split('-')[1];
  const target = id.split('-')[0];
  let alpha = $('#opacity-slider-consumer').val();
  let color;

  // change css variable value
  if (target === 'bg') {
    if (alpha === 0) {
      alpha = 1;
      $('#opacity-slider-consumer').val(1);
    }
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
      default: // Shouldn't happen
        color = `rgba(0,0,0,${alpha})`;
    }
    document.documentElement.style.setProperty('--caption-bg-color', color);
  } else if (target === 'font') {
    document.documentElement.style.setProperty('--caption-font-color', value);
  } else {
    document.documentElement.style.setProperty('--caption-font-size', `${id}rem`);
  }
}

$('#bg-transparent').click(() => {
  $('#opacity-slider-consumer').val(0);
  $('#opacity-slider-consumer').trigger('mousemove');
});

$('#opacity-slider-consumer').on('change mousemove', () => {
  const alpha = $(this).val();
  let current = document.documentElement.style.getPropertyValue('--caption-bg-color');
  const color = `${current.substring(0, current.lastIndexOf(',') + 1)}${alpha})`;
  if (current === '') {
    current = 'rgba(128,128,128,0';
  }
  document.documentElement.style.setProperty('--caption-bg-color', color);
});

function createCaptionHtml(displayName, transcripts) {
  let caption = transcripts.transcript;
  if (!transcripts.final) {
    caption += '...';
  }
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<span class="timestamp">${timestamp}</span><strong>${displayName}:</strong> ${caption}`;
}

// eslint-disable-next-line no-use-before-define, no-unused-vars -- used by complaint_form.js
function updateConsumerCaptions(transcripts) {
  const tDiv = document.getElementById(transcripts.msgid);
  const displayName = `CSR ${$('#agent-name').text()}`;
  const caption = createCaptionHtml(displayName, transcripts);
  console.log('--- WV: transcripts.transcript ---\n');

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
      $('#caption-messages').append(`<div class='agent-scripts'><div class='direct-chat-text'>${transcripts.transcript}</div></div>`);
      $('#caption-messages').scrollTop($('#caption-messages')[0].scrollHeight);
    }
  }
}

// Default to English
sessionStorage.consumerLanguage = 'en-US';

/* eslint no-undef: "error" */
// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
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

// eslint-disable-next-line no-unused-vars -- used by complaint_form.js
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
