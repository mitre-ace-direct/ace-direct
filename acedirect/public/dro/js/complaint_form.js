let socket;

const privacyVideoUrl = `${window.location.origin}/${nginxPath}/media/videoPrivacy.webm` ? `${window.location.origin}/${nginxPath}/media/videoPrivacy.webm` : '';
const remoteStream = document.getElementById('remoteView');
const selfStream = document.getElementById('selfView');
const muteAudioButton = document.getElementById('mute-audio');
const hideVideoButton = document.getElementById('hide-video');
let callTimer = 0;
const inCall = false;
let vrs;
let acekurento = null;
const ua = null;
const videomailflag = false;
let hasMessages = false;
let isAgentTyping = false;
let isSidebarCollapsed = false;

$(document).ready(() => {
  $('#optionsModal').modal('show');
  connect_socket();
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
});

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

        // update the version and year in the footer
        socket.on('adversion', (data) => {
          $('#ad-version').text(data.version);
          $('#ad-year').text(data.year);
        });

        socket.on('connect', () => {
          const payload = jwt_decode(data.token);
          // get the start/end time strings for the after hours dialog
          // const tz = convertUTCtoLocal(payload.startTimeUTC).split(' ')[2];
          console.log('got connect');
          console.log('authenticated');

          $('#firstName').val(payload.first_name);
          $('#lastName').val(payload.last_name);
          $('#callerPhone').val(payload.vrs);
          vrs = payload.vrs;
          // $('#callerEmail').val(payload.email);
          $('#displayname').val(`${payload.first_name} ${payload.last_name}`);
          isOpen = payload.isOpen;
          if (!isOpen) { // after hours processing; if after hours, then show this modal
            // TODO Review potentially having config variable to determine if enabled per user
            // DO NOT enable for dro
            // $("#afterHoursModal").modal({ backdrop: "static" });
            // $("#afterHoursModal").modal("show");
            // console.log(`after hours modal suppressed. isOpen: ${isOpen}`);
          }

          // startTimeUTC = convertUTCtoLocal(payload.startTimeUTC).substring(0, 8); // start time in UTC
          // endTimeUTC = convertUTCtoLocal(payload.endTimeUTC).substring(0, 8); // end time in UTC
          // $('#ah-start-time').text(startTimeUTC);
          // $('#ah-end-time').text(`${endTimeUTC} ${tz}`);

          socket.emit('register-client', {
            hello: 'hello'
          });
          socket.emit('register-vrs', {
            hello: 'hello'
          });
        })
          .on('ad-ticket-created', (data) => {
            console.log('got ad-ticket-created');
            /* $('#userformoverlay').removeClass('overlay').hide();
                if (data.zendesk_ticket) {
                $('#firstName').val(data.first_name);
                $('#lastName').val(data.last_name);
                $('#callerPhone').val(data.vrs);
                $('#callerEmail').val(data.email);
                $('#ticketNumber').text(data.zendesk_ticket);
                } else {
                $('#ZenDeskOutageModal').modal('show');
                $('#userformbtn').prop('disabled', false);
                } */
          })
          .on('extension-created', (data) => {
            console.log('got extension-created');
            if (data.message === 'success') {
              globalData = data;
              // $('#outOfExtensionsModal').modal('hide');
              exten = data.extension;
              // $('#display_name').val(data.extension);

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
              /* $('#outOfExtensionsModal').modal({
                    show: true,
                    backdrop: 'static',
                    keyboard: false
                });
                let i = 10;
                var newExtensionRetryCounter = setInterval(() => {

                    document.getElementById('newExtensionRetryCounter').innerHTML = i;
                    i -= 1 || (clearInterval(newExtensionRetryCounter), extensionRetry());
                }, 1000); */
            } else {
              console.log('Something went wrong when getting an extension');
            }
          })
          .on('chat-message-new', (data) => {
            console.log(data);
            newChatMessage(data);
            /*
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
                */
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
              if ($('#chat-messages').hasClass('emptyMessages') && !isAgentTyping) {
                $('#emptyChat').text('');
                $('#chat-messages').removeClass('emptyMessages');
                $('#chat-messages').addClass('populatedMessages');
                $('#rtt-typing').css('display', 'block');
                setTimeout(() => {
                  $('#rtt-typing').css('display', 'block');
                  $('#rtt-typing').html(`<b>${data.displayname}</b>` + `<br/>${data.rttmsg}`).addClass('direct-chat-text').addClass('direct-chat-timestamp text-bold');
                  $('#rtt-typing').appendTo($('#chat-messages'));
                  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
                }, 100);
              } else {
                $('#rtt-typing').css('display', 'block');
                $('#rtt-typing').html(`<b>${data.displayname}</b>` + `<br/>${data.rttmsg}`).addClass('direct-chat-text').addClass('direct-chat-timestamp text-bold');
                $('#rtt-typing').appendTo($('#chat-messages'));
                $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
              }
              isAgentTyping = true;
            }
          })
          .on('typing-clear', (data) => {
            if ($('#displayname').val() !== data.displayname) {
              isAgentTyping = false;
              if (!hasMessages) {
                console.log($('.agentChatName').text());
                $('#chat-messages').removeClass('populatedMessages');
                $('#chat-messages').addClass('emptyMessages');
                $('#emptyChat').text(`This is the start of your chat${$('.agentChatName').text()}. No messages yet to display`);
                $('#chat-messages').css('padding-top', '75% !important');
              } else {
                $('#emptyChat').css('margin-top', '0px');
              }
              console.log('typing clear');
              $('#rtt-typing').css('display', 'none');
              $('#chat-messages').remove($('#rtt-typing'));
              $('#rtt-typing').html('').removeClass('direct-chat-text').removeClass('direct-chat-timestamp text-bold');
              $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
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
            }
          })
        // TODO Rename skinny mode references to base configuration
          .on('skinny-config', (data) => {
            if (data === 'true') {
              $('#ticket-section').attr('hidden', true);
              $('#vrs-info-box').attr('hidden', true);
              $('#video-section').removeClass((index, className) => (className.match(/\bcol-\S+/g) || []).join(' '));
              $('#video-section').addClass('col-lg-6');
              $('#chat-section').removeClass((index, className) => (className.match(/\bcol-\S+/g) || []).join(' '));
              $('#chat-section').addClass('col-lg-5');
              $('#caption-settings').attr('hidden', true);
              $('#trans-tab').attr('hidden', true);
              skinny = true;
            } else {
              $('#ticket-section').removeAttr('hidden');
              $('#vrs-info-box').removeAttr('hidden');
              $('#video-section').removeClass((index, className) => (className.match(/\bcol-\S+/g) || []).join(' '));
              $('#video-section').addClass('col-lg-5');
              $('#chat-section').removeClass((index, className) => (className.match(/\bcol-\S+/g) || []).join(' '));
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
              // setQueueText(data.position -= 1); // subtract because asterisk wording is off by one
            }
            console.log('queue caller join');
          })
          .on('queue-caller-leave', (data) => {
            const currentPosition = $('#pos-in-queue').text();
            if (data.queue === 'ComplaintsQueue') {
              /* if (!abandonedCaller) { // abandoned caller triggers both leave and abandon event. this prevents duplicate removes.
                    setQueueText(currentPosition -= 1);
                } */
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
                // setQueueText(currentPosition -= 1);
              }
              console.log('queue caller abandon');
              abandonedCaller = true;
            }
          })
          .on('agent-name', (data) => {
            if (data.agent_name !== null || data.agent_name !== '' || data.agent_name !== undefined) {
              const firstname = data.agent_name.split(' ');
              $('#agent-name').text(firstname[0]); // TODO add to communicating header
              $('#CommunicationText').text(`You are communicating with ${firstname[0]}`);
              // $('#agent-name-box').show();
              agentExtension = data.vrs;
              $('.agentChatName').text(` with ${firstname[0]}`);
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
            addFileToSentList(data);
            $('#fileInput').val('');
            $('#shareFileConsumer').prop('disabled', true);
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
            /* $('#language-select').msDropDown(
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
                $('#language-select_msdd').css('text-align', 'left'); */
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

// setup for the call. creates and starts the User Agent (UA) and registers event handlers
// This uses the new ACE Kurento object rather than JsSIP
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
            console.log('sending caption:', transcripts.transcript, myExtension);
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
              screenShareEnabled = false;
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
      // clearScreen();
      // disableChatButtons();
      // enableInitialButtons();
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
        $('#waitingModal').modal('hide');
        document.getElementById('noCallPoster').style.display = 'none';
        document.getElementById('inCallSection').style.display = 'block';
      }
    }
  };
  console.log('Registering...');
  acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
  acekurento.register(myExtension, myPassword, false);
}

// terminates the call (if present) and unregisters the ua
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

// CALL FLOW FUNCTIONS

function enterQueue() {
  const language = 'en';
  socket.emit('call-initiated', {
    language,
    vrs
  });
  $('#waitingModal').modal('show');
}

function endCall() {
  terminateCall();

  // TODO: this redirects, but we need the new redirect modal here
  if (complaintRedirectActive) {
    $('#callEndedModal').modal('show'); // TODO - does not exist at the moment
    setTimeout(() => {
      window.location = complaintRedirectUrl;
    }, 5000);
  }
}

function exitQueue() {
  endCall();
  $('#waitingModal').modal('hide');
  window.location = `${window.location.origin}/${nginxPath}${consumerPath}`;
}

// makes a call
/*
* Use acekurento object to make the call. Not sure about the extension
*/
function startCall(otherSipUri) {
  let minutes;
  // Set the timer
  callTimer = setInterval(() => {
    callTimer += 1;
    minutes = Math.floor((callTimer / 60)) > 0 ? Math.floor(callTimer / 60) : 0;
    seconds = (callTimer - minutes * 60);
    if (seconds < 10) {
      seconds = `0${seconds}`;
    }
    $('#callTime').text(`${minutes}:${seconds} min`);
  }, 1000);

  console.log(`startCall: ${otherSipUri}`);
  selfStream.removeAttribute('hidden');
  // if (!captionsMuted()) {
  //  showCaptions();
  // }

  $('#screenshareButton').removeAttr('disabled');
  $('#fileInput').removeAttr('disabled');
  $('#shareFileConsumer').removeAttr('disabled');
  // acekurento.call(globalData.queues_complaint_number, false);
  acekurento.call(otherSipUri, false);
}

function terminateCall() {
  if (acekurento !== null) {
    acekurento.stop(false);
    acekurento = null;
  }
  callTerminated = true;
  // monitorExt = null;

  //  $('#fileInput').prop('disabled', true);
  // $('#shareFileConsumer').prop('disabled', true);
  // clearScreen();
  //  removeVideo();
  // disableChatButtons();
  //  enableInitialButtons();
  //  exitFullscreen();
  // $('#transcriptoverlay').html('');
  // hideCaptions();

  // remove file sharing
  socket.emit('call-ended', { agentExt: '' });
}

// END CALL FLOW FUNCTIONS

// IN CALL FEATURES

// mutes self audio so remote cannot hear you
function muteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone').addClass('call-btn-icon fa fa-microphone-slash');
  $('#mute-audio').attr('onclick', 'unmuteAudio()');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, true); // mute audio
  }
}

// unmutes self audio so remote can hear you
function unmuteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone-slash').addClass('call-btn-icon fa fa-microphone');
  $('#mute-audio').attr('onclick', 'muteAudio()');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, true); // unmute audio
  }
}

function enableVideoPrivacy() {
  $('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera').addClass('call-btn-icon fa fa-video-camera-slash');
  $('#hide-video').attr('onclick', 'disableVideoPrivacy()');
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.remove('mirror-mode');
        acekurento.enableDisableTrack(false, false); // mute video
        hideVideoButton.setAttribute('onclick', 'javascript: disableVideoPrivacy();');
        hideVideoIcon.style.display = 'block';
        acekurento.privateMode(true, privacyVideoUrl);
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.remove('mirror-mode');
      acekurento.enableDisableTrack(false, false); // mute video
      acekurento.privateMode(true, privacyVideoUrl);
    }
  }
}

function disableVideoPrivacy() {
  $('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera-slash').addClass('call-btn-icon fa fa-video-camera');
  $('#hide-video').attr('onclick', 'enableVideoPrivacy()');
  if (acekurento !== null) {
    if (acekurento.isMonitoring) {
      socket.emit('force-monitor-leave', { monitorExt, reinvite: true });
      setTimeout(() => {
        selfStream.classList.add('mirror-mode');
        acekurento.enableDisableTrack(true, false); // unmute video
        hideVideoButton.setAttribute('onclick', 'javascript: enableVideoPrivacy();');
        hideVideoIcon.style.display = 'none';
        acekurento.privateMode(false);
        hideVideoIcon.style.display = 'none';
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.add('mirror-mode');
      acekurento.enableDisableTrack(true, false); // unmute video
      acekurento.privateMode(false);
    }
  }
}

function logout() {
  // clear the token from session storage
  // console.log(`logout(): ${msg}`);
  sessionStorage.clear();
  // disconnect socket.io connection
  if (socket) {
    socket.disconnect();
  }
  // display the login screen to the user.
  window.location.href = './logout';
}

function showFileShareConfirmation() {
  // just showing a confirmation to demo UI
  $('#fileSent').show();
}

$('#newchatmessage').on('keyup change keydown paste input', function (evt) {
  if (evt.keyCode === 13) {
    evt.preventDefault();
    if ($('#newchatmessage').val() !== '') {
      $('#chatsend').submit();
    }
  }

  // rtt
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

  this.style.height = `${this.scrollHeight}px`;
  if ($('#newchatmessage').val() == '') {
    this.style.height = '34px';
  }
});

$('#fileInput').on('change', () => {
  if ($('#fileInput')[0].value == '') {
    console.log('no file chosen');
    $('#shareFileConsumer').prop('disabled', true);
    $('#removeFileBtn').css('display', 'none');
  } else {
    console.log('file chosen!');
    $('#shareFileConsumer').prop('disabled', false);
    $('#removeFileBtn').css('display', 'block');
  }
});

function removeFile() {
  $('#fileInput')[0].value = '';
  $('#shareFileConsumer').prop('disabled', true);
}
$('#removeFileBtn').on('keyup', (evt) => {
  evt.preventDefault();
  if (evt.keyCode === 13) {
    $('#removeFileBtn').click();
  }
});

// in-call chat logic
$('#chatsend').submit((evt) => {
  evt.preventDefault();

  const msg = $('#newchatmessage').val();
  const displayname = $('#displayname').val();
  const date = moment();
  const timestamp = date.format('h:mm a');

  // const language = sessionStorage.consumerLanguage;
  const language = 'en';

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
  $('#newchatmessage').focus();
}

function newChatMessage(data) {
  hasMessages = true;
  let msg = data.message;
  const { displayname } = data;
  const { timestamp } = data;
  const msgblock = document.createElement('div');
  const msginfo = document.createElement('div');
  const msgsender = document.createElement('span');
  const msgtime = document.createElement('span');
  const msgtext = document.createElement('div');
  console.log(`Data is ${JSON.stringify(data)}`);
  console.log(`Also ${data.displayname} ${data.timestamp}`);

  msg = msg.replace(/:\)/, '<i class="fa fa-smile-o fa-2x"></i>');
  msg = msg.replace(/:\(/, '<i class="fa fa-frown-o fa-2x"></i>');

  if ($('#chat-messages').hasClass('emptyMessages')) {
    $('#emptyChat').text('');
    $('#chat-messages').removeClass('emptyMessages');
    $('#chat-messages').addClass('populatedMessages');
    $('#emptyChat').css('margin-top', '0px');
  }

  $(msgsender).addClass('direct-chat-name pull-left').html(displayname).appendTo(msginfo);
  $(msgtime).addClass('direct-chat-timestamp').html(` ${timestamp}`).appendTo(msginfo);
  $(msginfo).addClass('direct-chat-info clearfix').appendTo(msgblock);
  $(msgtext).addClass('direct-chat-text').html(msg).appendTo(msgblock);

  if ($('#displayname').val() === displayname) {
    $(msgblock).addClass('alert alert-info sentChat').appendTo($('#chat-messages'));
    if (isAgentTyping) {
      // keep the rtt at the bottom of the the chat pane
      $('#rtt-typing').appendTo($('#chat-messages'));
    }
  } else {
    isAgentTyping = false;
    $('#rtt-typing').css('display', 'none');
    $('#chat-messages').remove($('#rtt-typing'));
    $('#rtt-typing').html('').removeClass('direct-chat-text');
    $(msgblock).addClass('alert alert-secondary receivedChat').appendTo($('#chat-messages'));
  }
  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

// file share logic
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
        // fileSentSuccess(data);
        console.log(JSON.stringify(data, null, 2));
        socket.emit('get-file-list-consumer', { vrs: vrs.toString().replace(/^1|[^\d]/g, '') });
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


function addFileToDownloadList(data) {
  $('#noReceivedFiles').attr('hidden', true);
  // only show latest file
  $('#receivedFilesList').empty();
  $('#receivedFilesList').append(
    (`<span>${data.original_filename}</span>
    <span class="btn-toolbar pull-right" role="toolbar">
      <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Download" target="_blank" href="./downloadFile?id=${data.id}"><i class="fa fa-download"></i></a>
      <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="View" target="_blank" href="./viewFile?id=${data.id}"><i class="fa fa-eye"></i></a>
    </span>
    <hr/>`)
  );

  // need to call this every time we add a new tooltip
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
}

function addFileToSentList(data) {
  $('#noSentFiles').attr('hidden', true);

  // add to sent files list
  $('#sentFilesList').append(
    (`<span>${data.original_filename}</span>
    <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="View" target="_blank" href="./viewFile?id=${data.id}"><i class="fa fa-eye"></i></a>
    <hr/>`)
  );

  // need to call this every time we add a new tooltip
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
}

function setFontSize(size) {
  const currentFontSize = $('.currentFontSize').text().split('%')[0];
  const newFontSize = Number(currentFontSize) + size;

  if (newFontSize >= 50 && size === -10 || newFontSize <= 200 && size === 10) {
    if (newFontSize >= 80 && newFontSize <= 150) {
      setOtherFontSize(size);
    }

    $('.tabFontSize').css('font-size', `${newFontSize.toString()}%`);
    $('.currentFontSize').text(`${newFontSize.toString()}%`);
  }
}

function setOtherFontSize(size) {
  // sets font sizes for buttons/text input
  console.log(`size: ${size}`);
  const originalFont = Number($('.currentFontSize').text().split('%')[0]);
  const temp = (originalFont + size) / 100;

  console.log(`setting new button font-size to: ${(14 * temp).toString()}px`);
  console.log(`setting new header font-size to: ${(30 * temp).toString()}px`);
  $('.buttonFontSize').css('font-size', `${(Number(14) * temp).toString()}px`);

  $('#newchatmessage').css('height', $('#chat-send').css('height'));
}

function collapseSidebar() {
  console.log('collapseSidebar!')
  console.log(isSidebarCollapsed)
  if (isSidebarCollapsed) {
    // open the sidebar
    isSidebarCollapsed = false;
    $('.tab-content').attr('hidden', false);
    $('#tab-pane').attr('hidden', false)
    $('#tab-options').css('padding-left', '');
    $('#chatTab').addClass('active');
    $('sidebarTab').css('width', '8vw');

    $('#callFeaturesColumn').removeClass('col-md-1');
    $('#callFeaturesColumn').addClass('col-md-4');
    $('#callVideoColumn').removeClass('col-md-11');
    $('#callVideoColumn').addClass('col-md-8');

    $('#callFeaturesColumn').css('border-left', '1px solid #ddd');
    $('#callFeaturesColumn').css('padding-left', '')

    $('#collapseButton').attr('data-original-title', "Collapse").parent().find('.tooltip-inner').html('Collapse');
    $('#collapseButtonIcon').removeClass('fa fa-angle-double-left');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-right');

    $('#remoteViewCol').css('height', '');
    $('#remoteView').css('height','');
    $('#remoteView').css('width', '');
  } else {
    // close the sidebar
    isSidebarCollapsed = true;
    $('.tab-content').attr('hidden', true);
    $('#tab-pane').attr('hidden', true);
    $('#tab-options').css('padding-left', '0px');
    $('li').removeClass('active');
    $('.sidebarTab').css('width', '8.8vw')

    $('#callFeaturesColumn').removeClass('col-md-4');
    $('#callFeaturesColumn').addClass('col-md-1');
    $('#callVideoColumn').removeClass('col-md-8');
    $('#callVideoColumn').addClass('col-md-11');

    $('#callFeaturesColumn').css('border-left', '');
    $('#callFeaturesColumn').css('padding-left', '0px');

    $('#collapseButton').attr('data-original-title', "Expand").parent().find('.tooltip-inner').html('Expand');
    $('#collapseButtonIcon').removeClass('fa fa-angle-double-right');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-left');

    // make sure remote video doesn't expand past footer 
    $('#remoteViewCol').css('height', '75vh');
    $('#remoteView').css('height','100%');
    $('#remoteView').css('width', '100% !important');
  }
}

function toggleTab(tab) {
  if (isSidebarCollapsed) {
    // open sidebar
    collapseSidebar();
  }
}
