let socket;
let asteriskSipUri;
let exten;
let abandonedCaller;
let videomailflag = false;
let switchQueueFlag = false;
let isOpen = true;
let startTimeUTC = '14:00'; // start time in UTC
let endTimeUTC = '21:30'; // end time in UTC
let skinny = false;
let acekurento = null;
let globalData;
let agentExtension;
// Used for DTMFpad toggle
let DTMFpad = false;
let fadeTimer = null;

$(document).ready(() => {
  // formats the phone number.
  $('[data-mask]').inputmask();

  // JSSIP components
  $('#login-full-background').hide();
  $('#login-box').hide();
  $('#consumer-webcam').show();

  $('#complaint').keyup(() => {
    let left = 2000 - $(this).val().length;
    if (left < 0) {
      left = 0;
    }
    $('#complaintcounter').text(left);
  });

  $('#newchatmessage').keyup(() => {
    const messageCount = Array.from($(this).val()).length; // counts emojis as a single character
    let left = 500 - messageCount;
    if (left < 0) {
      left = 0;
    }
    $('#chatcounter').text(left);
  });
  connect_socket();

  // chat-transcript toggle
  $('#chat-tab').on('click', () => {
    $('#chat-body').css('display', 'block');
    $('#chat-footer').css('display', 'block');
    $('#trans-body').css('display', 'none');
    $('#caption-settings-body').css('display', 'none');
    $('#caption-settings-footer').css('display', 'none');
  });
  $('#trans-tab').on('click', () => {
    $('#chat-body').css('display', 'none');
    $('#chat-footer').css('display', 'none');
    $('#caption-settings-body').css('display', 'none');
    $('#caption-settings-footer').css('display', 'none');
    $('#trans-body').css('display', 'block');
  });
  $('#caption-settings-tab').on('click', () => {
    $('#chat-body').css('display', 'none');
    $('#chat-footer').css('display', 'none');
    $('#trans-body').css('display', 'none');
    $('#caption-settings-body').css('display', 'block');
    $('#caption-settings-footer').css('display', 'block');
  });
});

function clearScreen() {
  $('#ticketNumber').text('');
  $('#complaintcounter').text('2,000');
  $('#complaint').val('');
  $('#subject').val('');
  $('#userform').find('input:text').val('');
  $('#callerEmail').val('');

  $('#callinfodiv').find('input:text').val('');

  $('#inbounddhohlabel').hide();
  $('#outbounddhohlabel').hide();

  $('#outboundnumber').text('');
  $('#inboundnumber').text('');

  $('#duration').timer('reset');
  $('#duration').timer('pause');

  $('#caption-messages').html('');
  $('#chat-messages').html('<div id="rtt-typing" ></div>');
  $('#newchatmessage').val('');

  $('#ticketForm').find('input:text').val('');
  $('#ticketForm').find('textarea').val('');

  $('#complaintsInCall').hide();
  $('#geninfoInCall').hide();

  $('#ivrsnum').val('');
  $('#ivrsmessage').hide();

  $('#notickettxt').hide();
  $('#ticketTab').removeClass('bg-pink');

  $('#modalWrapup').modal('hide');

  clearDownloadList();
  $('#fileInput').val('');
  $('#fileSent').hide();
  $('#fileSentError').hide();
}

// convert UTC hh:mm to current time in browser's timezone, e.g., 01:00 PM EST
// accepts UTC hh:mm, e.g., 14:00
// returns hh:mm in browser timezone, e.g., 09:00 AM EST
function convertUTCtoLocal(hhmmutc) {
  const hh = parseInt(hhmmutc.split(':')[0]); // e.g., 14
  const mins = hhmmutc.split(':')[1]; // e.g., 00
  const todaysDate = new Date();
  const yyyy = todaysDate.getFullYear().toString();
  const mm = (todaysDate.getMonth() + 1).toString();
  const dd = todaysDate.getDate().toString();
  const dte = `${mm}/${dd}/${yyyy} ${hh}:${mins} UTC`;
  const converteddate = new Date(dte);
  const newdte = converteddate.toString(); // Wed Jan 24 2018 09:00:00 GMT-0500 (EST)
  const arr = newdte.split(' ');
  let newhh = arr[4].split(':')[0];
  const newmin = arr[4].split(':')[1];
  let ampm = 'AM';
  if (newhh > 11) {
    ampm = 'PM';
  }
  if (newhh > 12) {
    newhh -= 12;
  }
  return `${newhh}:${newmin} ${ampm} ${arr[6].replace('(', '').replace(')', '')}`;
}

function initiateCall() {
  const vrs = $('#callerPhone').val().replace(/^1|[^\d]/g, '');
  const language = sessionStorage.consumerLanguage;
  socket.emit('call-initiated', {
    language,
    vrs
  }); // sends vrs number to adserver
}

function newChatMessage(data) {
  let msg = data.message;
  const displayname = data.displayname;
  const timestamp = data.timestamp;
  const msgblock = document.createElement('div');
  const msginfo = document.createElement('div');
  const msgsender = document.createElement('span');
  const msgtime = document.createElement('span');
  const msgtext = document.createElement('div');
  console.log(`Data is ${JSON.stringify(data)}`);
  console.log(`Also ${data.displayname} ${data.timestamp}`);

  msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
  msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

  if ($('#displayname').val() === displayname) {
    $(msgsender).addClass('direct-chat-name pull-right').html(displayname).appendTo(msginfo);
    $(msgtime).addClass('direct-chat-timestamp pull-left').html(timestamp).appendTo(msginfo);
    $(msginfo).addClass('direct-chat-info clearfix').appendTo(msgblock);
    $(msgtext).addClass('direct-chat-text').html(msg).appendTo(msgblock);
    $(msgblock).addClass('direct-chat-msg right').appendTo($('#chat-messages'));
  } else {
    $('#chat-messages').remove($('#rtt-typing'));
    $('#rtt-typing').html('').removeClass('direct-chat-text');

    $(msgsender).addClass('direct-chat-name pull-left').html(displayname).appendTo(msginfo);
    $(msgtime).addClass('direct-chat-timestamp pull-right').html(timestamp).appendTo(msginfo);
    $(msginfo).addClass('direct-chat-info clearfix').appendTo(msgblock);
    $(msgtext).addClass('direct-chat-text').html(msg).appendTo(msgblock);
    $(msgblock).addClass('direct-chat-msg').appendTo($('#chat-messages'));

  }
  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

function setQueueText(position) {
  if (position === 0) $('#queue-msg').text('There are no callers ahead of you.');
  else if (position === 1) $('#queue-msg').html('There is <span id="pos-in-queue"> 1 </span> caller ahead of you.');
  else if (position > 1) $('#pos-in-queue').text(position);
  else $('#queue-msg').text('One of our agents will be with you shortly.'); // default msg
}

function addFileToDownloadList(data) {
  $('#consumer-file-group').show();
  $('#consumer-file-list ').append(
    $('<li class="list-group-item btn-primary btn btn-flat">')
      .append(`<a style="color:white;display:block;" target="_blank" href="./downloadFile?id=${data.id}">${data.original_filename}</a>`)
  );
}

function logout(msg) {
  // clear the token from session storage
  console.log(`logout(): ${msg}`);
  sessionStorage.clear();
  // disconnect socket.io connection
  if (socket) {
    socket.disconnect();
  }
  // display the login screen to the user.
  window.location.href = './logout';
}

function connect_socket() {
  console.log('connect_socket to ');
  console.log(window.location.host);
  $.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    success: (data) => {
      console.log(JSON.stringify(data));
      if (data.message === 'success') {
        socket = io.connect(`https://${window.location.host}`, {
          path: `${nginxPath}/socket.io`,
          query: `token=${data.token}`,
          forceNew: true
        });

        socket.on('connect', () => {
          const payload = jwt_decode(data.token);
          // get the start/end time strings for the after hours dialog
          const tz = convertUTCtoLocal(payload.startTimeUTC).split(' ')[2];
          console.log('got connect');
          console.log('authenticated');

          $('#firstName').val(payload.first_name);
          $('#lastName').val(payload.last_name);
          $('#callerPhone').val(payload.vrs);
          $('#callerEmail').val(payload.email);
          $('#displayname').val(`${payload.first_name} ${payload.last_name}`);
          isOpen = payload.isOpen;
          if (!isOpen) { // after hours processing; if after hours, then show this modal
            // $("#afterHoursModal").modal({ backdrop: "static" });
            // $("#afterHoursModal").modal("show");
            console.log(`after hours modal suppressed. isOpen: ${isOpen}`);
          }

          startTimeUTC = convertUTCtoLocal(payload.startTimeUTC).substring(0, 8); // start time in UTC
          endTimeUTC = convertUTCtoLocal(payload.endTimeUTC).substring(0, 8); // end time in UTC
          $('#ah-start-time').text(startTimeUTC);
          $('#ah-end-time').text(`${endTimeUTC} ${tz}`);

          socket.emit('register-client', {
            hello: 'hello'
          });
          socket.emit('register-vrs', {
            hello: 'hello'
          });
        })
          .on('ad-ticket-created', (data) => {
            console.log('got ad-ticket-created');
            $('#userformoverlay').removeClass('overlay').hide();
            if (data.zendesk_ticket) {
              $('#firstName').val(data.first_name);
              $('#lastName').val(data.last_name);
              $('#callerPhone').val(data.vrs);
              $('#callerEmail').val(data.email);
              $('#ticketNumber').text(data.zendesk_ticket);
            } else {
              $('#ZenDeskOutageModal').modal('show');
              $('#userformbtn').prop('disabled', false);
            }
          })
          .on('extension-created', (data) => {
            console.log('got extension-created');
            if (data.message === 'success') {
              globalData = data;
              $('#outOfExtensionsModal').modal('hide');
              exten = data.extension;
              $('#display_name').val(data.extension);

              // is this a videomail call or complaint call?
              if (videomailflag) {
                // Videomail calls must come from videomail ext
                asteriskSipUri = `sip:${data.queues_videomail_number}@${data.asterisk_public_hostname}`;
              } else {
                asteriskSipUri = `sip:${data.queues_complaint_number}@${data.asterisk_public_hostname}`;
                asteriskSipUri = data.queues_complaint_number; // TODO: what is this doing?
              }

              console.log(`Asterisk sip URI = ${asteriskSipUri}`);
              // get the max videomail recording seconds
              maxRecordingSeconds = data.queues_videomail_maxrecordsecs;

              // get complaint redirect options
              complaintRedirectActive = data.complaint_redirect_active;
              complaintRedirectDesc = data.complaint_redirect_desc;
              complaintRedirectUrl = data.complaint_redirect_url;
              $('#redirecttag').attr('href', complaintRedirectUrl);
              $('#redirectdesc').text(`Redirecting to ${complaintRedirectDesc} ...`);

              $('#sip_password').attr('name', data.password);
              $('#pc_config').attr('name', `stun:${data.stun_server}`);

              // registerJssip(data.extension, data.password); //register with the given extension

              console.log(`asteriskSipUri: ${asteriskSipUri}`);

              // registerJssip(data.extension, data.password); //register with the given extension

              // TO DO - This needs to be a string representation of the extension (e.g. '575791')
              // startCall(asteriskSipUri); //calling asterisk to get into the queue
              // Original
              // startCall(asteriskSipUri); //calling asterisk to get into the queue

              // add ace kurento signal handling so we can get params, then call once we have a wv connection
              if (acekurento === null) {
                let signalingUrl = globalData.signaling_server_url;
                signalingUrl = signalingUrl.trim();

                acekurento = new ACEKurento({ acekurentoSignalingUrl: signalingUrl });

                acekurento.remoteStream = document.getElementById('remoteView');
                acekurento.selfStream = document.getElementById('selfView');

                const eventHandlers = {
                  connected: (e) => {
                    console.log('--- WV: Connected ---\n');
                    registerJssip(data.extension, data.password); // register with the given extension
                    startCall(asteriskSipUri); // calling asterisk to get into the queue
                  },
                  registerResponse: (error) => {
                    console.log('--- WV: Register response:', error || 'Success ---');
                    if (!error) {
                      // empty
                    }
                  },
                  accepted: (e) => {
                    $('#remoteView').removeClass('mirror-mode');
                  },
                  pausedQueue: (e) => {
                    console.log('--- WV: Paused Agent Member in Queue ---\n');
                  },
                  unpausedQueue: (e) => {
                    console.log('--- WV: Unpaused Agent Member in Queue ---\n');
                  },
                  callResponse: (e) => {
                    console.log('--- WV: Call response ---\n', e);
                  },
                  incomingCall: (call) => {
                    console.log('--- WV: Incoming call ---\n');
                  },
                  progress: (e) => {
                    console.log('--- WV: Calling... ---\n');
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
                  ended: (e) => {
                    console.log('--- WV: Call ended ---\n');
                    // terminateCall();
                  }
                };
                acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
              }
            } else if (data.message === 'OutOfExtensions') {
              console.log('out of extensions...');
              // Try again in 10 seconds.
              $('#outOfExtensionsModal').modal({
                show: true,
                backdrop: 'static',
                keyboard: false
              });
              let i = 10;
              var newExtensionRetryCounter = setInterval(() => {

                document.getElementById('newExtensionRetryCounter').innerHTML = i;
                i -= 1 || (clearInterval(newExtensionRetryCounter), extensionRetry());
              }, 1000);
            } else {
              console.log('Something went wrong when getting an extension');
            }
          })
          .on('chat-message-new', (data) => {
            // debugtxt('chat-message-new', data);

            // Translate incoming message
            const localLanguage = sessionStorage.consumerLanguage;
            console.log(`Selected language is ${localLanguage}`);
            // var localLanguage = 'es';
            data['toLanguage'] = localLanguage;
            if (localLanguage === data.fromLanguage) {
              newChatMessage(data);
            } else {
              socket.emit('translate', data);
            }
          })
          .on('chat-message-new-translated', (data) => {
            newChatMessage(data);
            console.log('translated', data);
          })
          .on('translate-language-error', (error) => {
            console.error('Translation error:', error);
          })
          .on('typing', (data) => {
            if ($('#displayname').val() !== data.displayname) {
              /* there's still some weird spacing between agent messages on the first call */
              $('#rtt-typing').html(data.displayname + ': ' + data.rttmsg).addClass('direct-chat-text').addClass('direct-chat-timestamp text-bold');
              $('#rtt-typing').appendTo($('#chat-messages'));
            }
          })
          .on('typing-clear', (data) => {
            if ($('#displayname').val() !== data.displayname) {
              $('#chat-messages').remove($('#rtt-typing'));
              $('#rtt-typing').html('').removeClass('direct-chat-text').removeClass('direct-chat-timestamp text-bold');
            }
          })
          .on('disconnect', () => {
            console.log('disconnected');
            unregisterJssip();
          })
          .on('unauthorized', (error) => {
            if (error.data.type === 'UnauthorizedError' || error.data.code === 'invalid_token') {
              logout('Session has expired');
            }
          })
          .on('caption-config', (data) => {
            if (data === 'false') {
              $('#caption-settings').css('display', 'none');
              $('#transcriptoverlay').css('display', 'none');
              $('#mute-captions').css('display', 'none');
              $('#trans-tab').css('display', 'none');
              $('#chat-tab').removeClass('tab active-tab');
              $('#consumer-webcam').css('height', '100%');
              $('#consumer-captions').hide();
              $('#consumer-divider').hide();
              document.getElementById('mute-captions-off-icon').style.display = 'block'; // used by jssip_consumer.js to see if captions are muted
            }
          })
          .on('skinny-config', (data) => {
            if (data === 'true') {
              $('#ticket-section').attr('hidden', true);
              $('#vrs-info-box').attr('hidden', true);
              $('#video-section').removeClass(function(index, className) {
                return (className.match(/\bcol-\S+/g) || []).join(' ');
              });
              $('#video-section').addClass('col-lg-6');
              $('#chat-section').removeClass(function(index, className) {
                return (className.match(/\bcol-\S+/g) || []).join(' ');
              });
              $('#chat-section').addClass('col-lg-5');
              $('#caption-settings').attr('hidden', true);
              $('#trans-tab').attr('hidden', true);
              skinny = true;
            } else {
              $('#ticket-section').removeAttr('hidden');
              $('#vrs-info-box').removeAttr('hidden');
              $('#video-section').removeClass(function(index, className) {
                return (className.match(/\bcol-\S+/g) || []).join(' ');
              });
              $('#video-section').addClass('col-lg-5');
              $('#chat-section').removeClass(function(index, className) {
                return (className.match(/\bcol-\S+/g) || []).join(' ');
              });
              $('#chat-section').addClass('col-lg-3');
              $('#callbutton').attr('disabled', 'disabled');
              $('#newchatmessage').attr('disabled', 'disabled');
              $('#chat-send').attr('disabled', 'disabled');
              $('#chat-emoji').attr('disabled', 'disabled');
              $('#caption-settings').removeAttr('hidden');
              $('#trans-tab').removeAttr('hidden');
              skinny = false;
            }
          })
          .on('queue-caller-join', (data) => {
            if (data.extension === exten && data.queue === 'ComplaintsQueue') {
              setQueueText(data.position -= 1); // subtract because asterisk wording is off by one
            }
            console.log('queue caller join');
          })
          .on('queue-caller-leave', (data) => {
            var currentPosition = $('#pos-in-queue').text();
            if (data.queue === 'ComplaintsQueue') {
              if (!abandonedCaller) { // abandoned caller triggers both leave and abandon event. this prevents duplicate removes.
                setQueueText(currentPosition -= 1);
              }
              console.log('queue caller leave');
              abandonedCaller = false;
            }
          })
          .on('queue-caller-abandon', (data) => {
            if (data.queue === 'ComplaintsQueue') {
              let currentPosition = $('#pos-in-queue').text();
              currentPosition += 1;
              if (currentPosition > data.position) { // checks if the abandoned caller was ahead of you
                currentPosition = $('#pos-in-queue').text();
                setQueueText(currentPosition -= 1);
              }
              console.log('queue caller abandon');
              abandonedCaller = true;
            }
          })
          .on('agent-name', (data) => {
            if (data.agent_name !== null || data.agent_name !== '' || data.agent_name !== undefined) {
              const firstname = data.agent_name.split(' ');
              $('#agent-name').text(firstname[0]);
              $('#agent-name-box').show();
              console.log(`AGENT NUMBER IS ${data.vrs}`);
              agentExtension = data.vrs;
            }
          })
          .on('agents', (data) => {
            if (data.agents_logged_in) {
              $('#agents-avail').text('');
            } else {
              $('#agents-avail').text('No representatives are available to take your call at this time.');
            }
          })
          .on('chat-leave', (error) => {
            // clear chat
            $('#chatcounter').text('500');
            $('#chat-messages').html('<div id="rtt-typing" ></div>');
            $('#caption-messages').html('');
            $('#newchatmessage').val('');

            // reset buttons and ticket form
            $('#ticketNumber').text('');
            $('#complaintcounter').text('2,000');
            $('#complaint').val('');
            $('#subject').val('');

            if (complaintRedirectActive) {
              $('#callEndedModal').modal('show');
              setTimeout(() => {
                window.location = complaintRedirectUrl;
              }, 5000);
            }
          })
          .on('error', (reason) => {
            if (reason.code === 'invalid_token') {
              logout('Session has expired');
            } else {
              logout(`An Error Occurred: ${JSON.stringify(reason)}`);
            }
          })
          .on('fileListConsumer', (data) => {
            $('#fileSent').hide();
            $('#fileSentError').hide();
            addFileToDownloadList(data);
          })
          .on('fileListAgent', (data) => {
            // file sent confirmation
            $('#fileInput').val('');
          })
          .on('screenshareResponse', (data) => {
            console.log(`screen request received ${data.permission}`);
            if (data.permission === true) {
              $('#startScreenshare').show();
              $('#screenshareButton').prop('disabled', true);
              $('#startScreenshare').prop('disabled', false);
              $('#screenshareButtonGroup').show();
              $('#requestAck').hide();
            } else {
              console.log('No permission');
              $('#requestAck').html('Permission has been denied.');
            }
          })
          .on('multiparty-caption', (transcripts) => {
            console.log('multiparty caption:', JSON.stringify(transcripts));
            socket.emit('translate-caption', {
              transcripts,
              callerNumber: exten,
              displayname: transcripts.displayname
            });
          })
          .on('caption-translated', (transcripts) => {
            console.log('consumer received translation', transcripts);
            if (acekurento.isMultiparty) {
              // TODO: clear Regular Transcripts
              updateCaptionsMultiparty(transcripts);
            } else {
              updateConsumerCaptions(transcripts); // in jssip_consumer.js
            }
          })
          .on('enable-translation', () => {
            // Activate flag/language dropdown
            $('#language-select').msDropDown(
              {
                on: {
                  open: (data, ui) => {
                    // hack to make it work in bootstrap modal
                    $('#language-select_child').height('auto');
                  }
                }
              }
            );
            $('#languageSelectModal').modal('show');
            // Align flags and labels to left
            $('#language-select_msdd').css('text-align', 'left');
          })
          .on('consumer-multiparty-hangup', () => {
            // show 'One Moment Please'
            $('#multipartyTransitionModal').modal('show');
            $('#multipartyTransitionModal').modal({
              backdrop: 'static',
              keyboard: false
            });
            setTimeout(() => {
              $('#multipartyTransitionModal').modal('hide');
            }, 3000);
          })
          .on('consumer-being-monitored', () => {
            // keep self-view and don't enable multiparty 
            // captions during a monitored one-to-one call
            acekurento.isMonitoring = true;
            $('#end-call').attr('onclick', 'monitorHangup()');
          })
          .on('consumer-stop-monitor', () => {
            acekurento.isMonitoring = false;
            monitorExt = null;
            $('#end-call').attr('onclick', 'terminateCall()');
          })
          .on('call-center-closed', (data) => {
            if (data && data.closed) {
              // closed
              $('#closed-message').css('display', 'inline');
              $('#callbutton').prop('disabled', true);
            } else {
              // open
              $('#closed-message').css('display', 'none');
              $('#callbutton').prop('disabled', false);
            }
          });
      } else {
        // need to handle bad connections?
      }
    },
    error: (xhr, status, error) => {
      console.log('Error');
      $('#message').text('An Error Occured.');
    }
  });
}

$('#callbutton').click(() => {
  videomailflag = false;
  $('#record-progress-bar').hide();
  $('#vmsent').hide();
  $('#callbutton').prop('disabled', true);
  $('#videomailbutton').prop('disabled', true);
  $('#queueModal').modal({
    backdrop: 'static'
  });
  $('#queueModal').modal('show');
  $('#dialboxcallbtn').click(); // may or may not be dead code

  initiateCall();
  console.log('call-initiated event for complaint');
  enableChatButtons();
});

$('#videomailbutton').click(() => {
  // $('#videomailModal').modal('show');
  startRecordingVideomail(false);
});

function startRecordingVideomail(switchQueueFlag) {
  const vrs = $('#callerPhone').val().replace(/^1|[^\d]/g, '');
  const language = sessionStorage.consumerLanguage;
  if (switchQueueFlag) {
    $('#videomailModal').modal('hide');
    transferToVideomail();
  } else {
    $('#videomailModal').modal('hide');
    // $('#vmwait').show();
    // swapVideo();
    $('#vmsent').hide();
    videomailflag = true;
    $('#record-progress-bar').show();
    $('#callbutton').prop('disabled', true);
    $('#userformbtn').prop('disabled', true);
    // dial into the videomail queue
    $('#videomailbutton').prop('disabled', true);

    socket.emit('call-initiated', {
      language,
      vrs
    }); // sends vrs number to adserver

    console.log('call-initiated event for videomail');
  }
  switchQueueFlag = false;
}

$('#userform').submit((evt) => {
  const subject = $('#subject').val();
  const complaint = $('#complaint').val();
  const vrs = $('#callerPhone').val().replace(/^1|[^\d]/g, '');
  evt.preventDefault();

  socket.emit('ad-ticket', {
    vrs,
    subject,
    description: complaint
  });
  $('#userformoverlay').addClass('overlay').show();
  $('#userformbtn').prop('disabled', true);
  $('#callbutton').removeAttr('disabled');
});

function extensionRetry() {
  // $('#newExtensionRetryCounter').timer('remove');
  clearInterval(newExtensionRetryCounter);
  initiateCall();
}

// Logout the user
$('#notMyInfoLink').click((e) => {
  e.preventDefault();
  // clear the token from session storage
  sessionStorage.clear();
  // disconnect socket.io connection
  if (socket) {
    socket.disconnect();
  }
  // display the login screen to the user.
  window.location.href = './logout';
});

$('#newchatmessage').on('change keydown paste input', () => {
  const value = $('#newchatmessage').val();
  const displayname = $('#displayname').val();
  if (value.length > 0) {
    socket.emit('chat-typing', {
      displayname,
      rttmsg: value
    });
  } else {
    socket.emit('chat-typing-clear', {
      displayname
    });
  }
});

$('#chatsend').submit((evt) => {
  evt.preventDefault();

  const msg = $('#newchatmessage').val();
  const displayname = $('#displayname').val();
  const date = moment();
  const timestamp = date.format('D MMM h:mm a');

  const language = sessionStorage.consumerLanguage;
  $('#newchatmessage').val('');
  $('#chatcounter').text('500');
  console.log('sent message with language', language);
  isTyping = false;
  socket.emit('chat-message', {
    message: msg,
    timestamp,
    displayname,
    fromLanguage: language
  });
});

function addEmoji(emoji) {
  let value = $('#newchatmessage').val();
  const displayname = $('#displayname').val();
  // update the character count
  const messageCount = Array.from($('#newchatmessage').val()).length; // reads the emoji as one character
  let left = 500 - messageCount;

  value += emoji;
  $('#newchatmessage').val(value);

  // update rtt
  socket.emit('chat-typing', {
    displayname,
    rttmsg: value
  });

  if (left < 0) {
    left = 0;
  }

  $('#chatcounter').text(left);
}

// Event listener for the full-screen button
function enterFullscreen() {
  const webcamContainer = document.getElementById('fullscreen-element');

  if (!document.fullscreenElement && !document.mozFullScreenElement
    && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (webcamContainer.requestFullscreen) {
      webcamContainer.requestFullscreen();
    } else if (webcamContainer.msRequestFullscreen) {
      webcamContainer.msRequestFullscreen();
    } else if (webcamContainer.mozRequestFullScreen) {
      webcamContainer.mozRequestFullScreen();
    } else if (webcamContainer.webkitRequestFullscreen) {
      webcamContainer.webkitRequestFullscreen();
    }

    // $('#remoteView').css('object-fit', 'cover');
  } else {

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }

    $('#remoteView').css('object-fit', 'contain');
  }
}

function clearFadeTimer() {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = 0;
  }
}

function fade(type = 'out') {
  $('#call-option-buttons button').each((i, element) => {
    $(element).css('animation', `fade-${type} 0.${i + 2}s ease-out forwards`);
  });

  if (type === 'out') {
    $('#transcriptoverlay').css('bottom', '10px');
  } else {
    $('#transcriptoverlay').css('bottom', '65px');
  }
}

$('#fullscreen-element').mousemove(() => {
  clearFadeTimer();
  fade('in');
  fadeTimer = setTimeout(fade, 3000);
});

$('#fullscreen-element').mouseleave(() => {
  clearFadeTimer();
  fadeTimer = setTimeout(fade, 500);
});

// Send screenshare request
$('#screenshareButton').prop('disabled', true).click(() => {
  console.log('Request screenshare button clicked');
  $('#requestAck').show();
  socket.emit('requestScreenshare', {
    agentNumber: agentExtension
  });
});

$('#startScreenshare').prop('disabled', true).click(() => {
  if (monitorExt) {
    // kick the monitor from the session first
    socket.emit('force-monitor-leave', { monitorExt, reinvite: true });
  }
  acekurento.screenshare(true);
});

function exitQueue() {
  $('#queueModal').modal('hide');
  terminateCall();
  clearScreen();
}

function afterHourVoicemail() {
  exitQueue();
  $('#afterHoursModal').modal('hide');
  // $('#videomailModal').modal('show');
  startRecordingVideomail(false);
}

function afterHoursHideVoicemail() {
  if (isOpen) {
    // $('afterHoursModal').modal('show');
    console.log(`afterHoursHideVoicemail(): after hours modal suppressed. isOpen: ${isOpen}`);
  }
  $('#videomailModal').modal('hide');
  $('#videomailbutton').removeAttr('disabled');
  $('#callbutton').removeAttr('disabled');
}

// enables chat buttons on a webrtc call when it is accepted
function enableChatButtons() {
  $('#newchatmessage').removeAttr('disabled');
  $('#chat-send').removeAttr('disabled');
  $('#chat-emoji').removeAttr('disabled');
  $('#newchatmessage').attr('placeholder', 'Type Message ...');
  $('#characters-left').show();
}

// disables chat buttons
function disableChatButtons() {
  $('#newchatmessage').attr('disabled', 'disabled');
  $('#chat-send').attr('disabled', 'disabled');
  $('#chat-emoji').attr('disabled', 'disabled');
  $('#newchatmessage').attr('placeholder', 'Chat disabled');
  $('#characters-left').hide();
}

// restores default buttons after a call is completed
function enableInitialButtons() {
  if (skinny) {
    $('#callbutton').removeAttr('disabled');
    $('#videomailbutton').removeAttr('disabled');
  } else {
    $('#userformbtn').removeAttr('disabled');
    $('#callbutton').attr('disabled', 'disabled');
    $('#videomailbutton').removeAttr('disabled');
  }
}

// Fileshare for consumer portal
function shareFileConsumer() {
  $('#fileSent').hide();
  $('#fileSentError').hide();
  if ($('#fileInput')[0].files[0]) {
    const formData = new FormData();
    console.log('uploading:');
    console.log($('#fileInput')[0].files[0]);
    formData.append('uploadfile', $('#fileInput')[0].files[0]);
    $.ajax({
      url: './fileUpload',
      type: 'POST',
      data: formData,
      contentType: false,
      processData: false,
      success: (data) => {
        console.log(JSON.stringify(data, null, 2));
        socket.emit('get-file-list-consumer', { vrs: $('#callerPhone').val().replace(/^1|[^\d]/g, '') });
        console.log('file successfully sent');
        $('#fileSent').show();
      },
      error: (jXHR, textStatus, errorThrown) => {
        console.log(`ERROR: ${jXHR} ${textStatus} ${errorThrown}`);
        $('#fileSentError').show();
      }
    });
  }
}

// Keypress for DTMF toggle
$(document).on('keypress', (e) => {
  if (e.which === 'k' && agentStatus === 'IN_CALL') {
    if (DTMFpad) {
      $('#dtmfpad').hide();
      DTMFpad = false;
    } else {
      $('#dtmfpad').show();
      DTMFpad = true;
    }
  }
});

// Button press for DTMF toggle
$('#toggleDTMF').click(() => {
  if (DTMFpad) {
    $('#dtmfpad').hide();
    DTMFpad = false;
  } else {
    $('#dtmfpad').show();
    DTMFpad = true;
  }
});

function DTMFpress(number) {
  showAlert('info', `You pressed key number ${number}`);
  acekurento.sendDTMF(number);
}

function clearDownloadList() {
  $('#consumer-file-list').empty();
  $('#consumer-file-group').hide();
}
