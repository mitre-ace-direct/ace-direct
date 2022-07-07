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
let sharingScreen = false;
let isSidebarCollapsed = false;
let index = 0;
let monitorExt = '';
let isScreenshareRestart = false;
let callAnswered = false;
let emojiToggle = false;
let feedbackTimeoutID;
// this list may be incomplete
const viewableFileTypes = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'pdf',
  'md',
  'txt',
  'json',
  'html'
];

$(document).ready(() => {
  $('#optionsModal').modal('show');
  openDialog('optionsModal', window);
  document.getElementById('exitFullscreen').style.display = 'none';
  connect_socket();
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });

  // Use arrow keys to navigate tabs
  // SOURCE: http://web-accessibility.carnegiemuseums.org/code/tabs/

  const $tabs = $('a.tab');

  $tabs.bind({
    // on keydown,
    // determine which tab to select
    keydown: function(ev) {
      var LEFT_ARROW = 37;
      var UP_ARROW = 38;
      var RIGHT_ARROW = 39;
      var DOWN_ARROW = 40;

      var key = ev.which || ev.keyCode;

      // if the key pressed was an arrow key
      if (key >= LEFT_ARROW && key <= DOWN_ARROW){
        // move left one tab for left and up arrows
        if (key == LEFT_ARROW || key == UP_ARROW){
          if (index > 0) {
            index--;
          }
          // unless you are on the first tab,
          // in which case select the last tab.
          else {
            index = $tabs.length - 1;
          }
        }

        // move right one tab for right and down arrows
        else if (key == RIGHT_ARROW || key == DOWN_ARROW){
          if (index < ($tabs.length - 1)){
            index++;
          }
          // unless you're at the last tab,
          // in which case select the first one
          else {
            index = 0;
          }
        }

        // trigger a click event on the tab to move to
        if (!isSidebarCollapsed) {
          $($tabs.get(index)).click();
        } else {
          $($tabs.get(index)).attr(
            {
              tabindex: '0',
              'aria-selected': 'true'
            }).addClass('active').focus();
        }
        ev.preventDefault();
      }
    },

    // just make the clicked tab the selected one
    click: function(ev){
      index = $.inArray(this, $tabs.get());
      setFocus();
      ev.preventDefault();
    }
  });

  var setFocus = function() {
    // undo tab control selected state,
    // and make them not selectable with the tab key
    // (all tabs)
    $tabs.attr(
    {
      tabindex: '-1',
      'aria-selected': 'false'
    }).removeClass('active');

    // hide all tab panels.
    $('.tab-pane').removeClass('active');

    // make the selected tab the selected one, shift focus to it
    $($tabs.get(index)).attr(
    {
      tabindex: '0',
      'aria-selected': 'true'
    }).addClass('active').focus();

    // handle parent <li> active class (for coloring the tabs)
    $($tabs.get(index)).parent().siblings().removeClass('active');
    $($tabs.get(index)).parent().addClass('active');

    // add an active class also to the tab panel
    // controlled by the clicked tab
    
    $($($tabs.get(index)).attr('href')).addClass('active');
  };

});

$(window).bind('fullscreenchange', function (_e) {
  // check to see if your browser has exited fullscreen
  console.log('CURRENTLY CHECKING ' + !document.fullscreenElement && !document.mozFullScreenElement
    && !document.webkitFullscreenElement && !document.msFullscreenElement);
  if (!document.fullscreenElement && !document.mozFullScreenElement
    && !document.webkitFullscreenElement && !document.msFullscreenElement) { // video fullscreen mode has changed
    if (document.fullscreenElement) {
      // you have just ENTERED full screen video
    } else {
      document.getElementById('exitFullscreen').style.display = 'none';
    }
  }
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

          $('#button-feedback').hide();
          $('#button-feedback').attr('aria-hidden', 'true');

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
                  connected: (_e) => {
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
                  accepted: (_e) => {
                    $('#remoteView').removeClass('mirror-mode');
                    callAnswered = true;
                  },
                  pausedQueue: (_e) => {
                    console.log('--- WV: Paused Agent Member in Queue ---\n');
                  },
                  unpausedQueue: (_e) => {
                    console.log('--- WV: Unpaused Agent Member in Queue ---\n');
                  },
                  callResponse: (e) => {
                    console.log('--- WV: Call response ---\n', e);
                  },
                  incomingCall: (_call) => {
                    console.log('--- WV: Incoming call ---\n');
                  },
                  progress: (_e) => {
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
                  ended: (_e) => {
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
          .on('queue-caller-join', (data) => {
            if (data.extension === exten && data.queue === 'ComplaintsQueue') {
              // setQueueText(data.position -= 1); // subtract because asterisk wording is off by one
            }
            console.log('queue caller join');
          })
          .on('queue-caller-leave', (data) => {
            const currentPosition = $('#pos-in-queue').text();
            if (data.queue === 'ComplaintsQueue') {
              /* if (!abandonedCaller) {
                // abandoned caller triggers both leave and abandon event. this prevents duplicate removes.
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
          .on('chat-leave', (_error) => {
            // clear chat
            $('#chatcounter').text('500');
            $('#newchatmessage').val('');
            $('#chat-messages').removeClass('populatedMessages');
            $('#chat-messages').addClass('emptyMessages');
            $('#chat-messages').html('<div class="direct-chat-timestamp text-bold alert alert-secondary rttChatBubble" id="rtt-typing" style="min-height: 20px; display: none;"></div>\
            <span id="emptyChat">This is the start of your chat<span class="agentChatName"></span>. No messages yet to display</span>');

            // reset buttons and ticket form
            $('#ticketNumber').text('');
            $('#complaintcounter').text('2,000');
            $('#complaint').val('');
            $('#subject').val('');

            if (complaintRedirectActive) {
              $('#redirectURL').text(complaintRedirectUrl);
              $('#callEndedModal').modal('show');
              openDialog('callEndedModal', window);
              setTimeout(() => {
                location = complaintRedirectUrl;
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
            $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');
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
            // keep self-view 
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
              // console.log('call center closed');
              // window.location.replace('videomail'); // redirect to videomail
              // closed
              $('#closed-message').css('display', 'inline');
              $('#callbutton').prop('disabled', true);
            } else {
              // open
              $('#closed-message').css('display', 'none');
              $('#callbutton').prop('disabled', false);
            }
          }).on('agentScreenshare', () => {
            // agent is stopping/starting screenshare
            isScreenshareRestart = true;
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

const setColumnSize = function () {
  // sidebar tabs
  let chatSeparator = document.getElementById("chat-separator");
  let fileShareSeparator = document.getElementById("fileshare-separator");
  let footer = document.getElementById("footer-container-consumer");
  let tabsTop = chatSeparator.getBoundingClientRect().bottom || fileShareSeparator.getBoundingClientRect().bottom;
  let chatHeight = footer.getBoundingClientRect().top - tabsTop;
  let fileshareHeight = footer.getBoundingClientRect().top - tabsTop;

  $('#chat-box-body').height(chatHeight - ($('#footer-container-consumer').height() + 20));
  $('#chat-body').height(chatHeight - ($('#footer-container-consumer').height() + 20));
  
  $('#fileshare-box-body').height(fileshareHeight - ($('#footer-container-consumer').height() + 20));
  $('#fileshare-body').height(fileshareHeight - ($('#footer-container-consumer').height() + 20));

  $('.tabs-right').height((chatHeight + tabsTop) - ($('#footer-container-consumer').height() + 20));

  // video section
  $('#callVideoColumn').height(footer.getBoundingClientRect().top - 70);

  let buttonFeedback = document.getElementById("button-feedback");
  let speakingToRow = document.getElementById("speakingToRow");
  let videoButtonsRow = document.getElementById("callButtonsRow");
  let videoTop = buttonFeedback.getBoundingClientRect().bottom || speakingToRow.getBoundingClientRect().bottom || videoButtonsRow.getBoundingClientRect().bottom;
  let videoHeight = footer.getBoundingClientRect().top - videoTop;
  $('#remoteViewCol').height(videoHeight);
  $('#remoteView').height(videoHeight);
}
setColumnSize();
window.addEventListener('resize', setColumnSize);

// Function to change the text of the feedback for the buttons.
function setFeedbackText(text) {
  if ($('#button-feedback').is(':hidden')) {
    $('#button-feedback').show();
    $('#button-feedback').attr('aria-hidden', 'false');
    setColumnSize();

    if (feedbackTimeoutID) {
      clearTimeout(feedbackTimeoutID);
    }

    feedbackTimeoutID = setTimeout(() => {
      $('#button-feedback').slideUp(500, () => {
        setColumnSize();
      });
    }, 6000);
  } else {
    if (feedbackTimeoutID) {
      clearTimeout(feedbackTimeoutID);
    }

    feedbackTimeoutID = setTimeout(() => {
      $('#button-feedback').slideUp(500, () => {
        setColumnSize();
      });
    }, 6000);
  }

  $('#button-feedback').text(text);
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
          console.log('SCREENSHARE ENDED SELF');
          // $('#startScreenshare').hide();
          //acekurento.screenshare(false);
          //document.getElementById('startScreenshare').innerText = 'Start Screenshare';
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
          acekurento.screenshare(false);
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

      endCall();
      // terminateCall();
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

      if (partCount === 2 && !isScreenshareRestart) {
        startCallTimer();
      } else if (isScreenshareRestart) {
        isScreenshareRestart = false;
      }

      if (partCount >= 2 || videomailflag) {
        console.log('--- WV: CONNECTED');
        $('#queueModal').modal('hide');
        $('#waitingModal').modal('hide');
        document.getElementById('noCallPoster').style.display = 'none';
        document.getElementById('inCallSection').style.display = 'block';
        setColumnSize();
        callAnswered = true;
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
  }, (isOpen) => {
    console.log('isOpen:', isOpen);
    if (isOpen) {
      $('#waitingModal').modal('show');
      openDialog('waitingModal', window);
    } else {
      $('#noAgentsModal').modal('show');
      openDialog('noAgentsModal', window);
    }
  });
}

function endCall(forceHangup) {
  terminateCall();
  clearInterval(callTimer);
  if(callAnswered || forceHangup){
    if (complaintRedirectActive) {
      $('#redirectURL').text(complaintRedirectUrl);
      $('#callEndedModal').modal('show');
      openDialog('callEndedModal', window);
      document.getElementById('noCallPoster').style.display = 'block';
      document.getElementById('inCallSection').style.display = 'none';
      setTimeout(() => {
        location = complaintRedirectUrl;
      }, 5000);
    } else {
      // reset the page
      window.location = `${window.location.origin}/${nginxPath}${consumerPath}`;
    }
  } else {
    $('#waitingModal').modal('hide');
    $('#noAgentsModal').modal('show');
  }
}

function exitQueue() {
  endCall(true);
  $('#waitingModal').modal('hide');
}

// makes a call
/*
* Use acekurento object to make the call. Not sure about the extension
*/
function startCall(otherSipUri) {
  console.log(`startCall: ${otherSipUri}`);
  selfStream.removeAttribute('hidden');

  setFeedbackText('Agent connected!');

  $('#screenshareButton').removeAttr('disabled');
  $('#fileInput').removeAttr('disabled');
  // acekurento.call(globalData.queues_complaint_number, false);
  acekurento.call(otherSipUri, false);
}

function startCallTimer() {
  let minutes = 0;
  let seconds = 0;
  let start = new Date;

  callTimer = setInterval(function() {
    let temp = Math.round(new Date - start) / 1000;
    minutes = Math.floor(temp / 60) > 0 ? Math.floor(temp / 60) : 0;
    seconds = Math.floor((temp -(minutes * 60)));

    if (seconds < 10) {
      seconds = `0${seconds}`;
    }
    $('#callTime').text(`${minutes}:${seconds} min`);
  }, 1000);
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
  exitFullscreen();
  // $('#transcriptoverlay').html('');

  // remove file sharing
  socket.emit('call-ended', { agentExt: '' });
}

// END CALL FLOW FUNCTIONS

// IN CALL FEATURES

// mutes self audio so remote cannot hear you
function muteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone').addClass('call-btn-icon fa fa-microphone-slash');
  $('#mute-audio').attr('onclick', 'unmuteAudio()');
  $('#mute-audio').attr('aria-label', 'Unmute Audio');
  setFeedbackText('Audio Muted!');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, true); // mute audio
  }
  $("#mute-audio").blur();
}

// unmutes self audio so remote can hear you
function unmuteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone-slash').addClass('call-btn-icon fa fa-microphone');
  $('#mute-audio').attr('onclick', 'muteAudio()');
  $('#mute-audio').attr('aria-label', 'Mute Audio');
  setFeedbackText('Audio Unmuted!');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, true); // unmute audio
  }
  $("#mute-audio").blur();
}

function enableVideoPrivacy() {
  $("#hide-video").blur();
  //$('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera').addClass('call-btn-icon fa-stack');
  $('#mute-camera-off-icon').children().remove();
  $('#mute-camera-off-icon').append(
    '<i class="fa fa-video-camera fa-stack-1x"></i><i class="fa fa-ban fa-stack-2x text-danger"></i>'
  );
  $('#hide-video').attr('onclick', 'disableVideoPrivacy()');
  $('#hide-video').attr('aria-label', 'Disable Video Privacy');
  setFeedbackText('Video is off!');
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
  $("#hide-video").blur();
  //$('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera').addClass('call-btn-icon fa fa-video-camera');
  $('#mute-camera-off-icon').children().remove();
  $('#mute-camera-off-icon').append(
    '<i class="fa fa-video-camera fa-stack-1x"></i>'
  );
  $('#hide-video').attr('onclick', 'enableVideoPrivacy()');
  $('#hide-video').attr('aria-label', 'Enable Video Privacy');
  setFeedbackText('Video is on!');
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

function toggleScreenShare(toggle) {
  $("#startScreenshare").blur();
  isScreenshareRestart = true;
  if (!toggle) {
    acekurento.screenshare(false);
    console.log("UPDATING SCREENSHARE BUTTON FALSE");
    //sharingScreen = false;
    $('#startScreenshare').removeAttr('onclick');
    $('#startScreenshare').attr('onClick', 'toggleScreenShare(true);');
    $('#startScreenshare').text("");
    $('#startScreenshare').children().remove();
    $('#startScreenshare').append(
      '<i id="screenshare-icon" class="call-btn-icon fa fa-desktop"></i> Start Screenshare'
    )
    $('#startScreenshare').attr('aria-label', 'Share screen');
    setFeedbackText('Screenshare ended!');
  } else {
    acekurento.screenshare(true);
    console.log("UPDATING SCREENSHARE BUTTON TRUE");
    //sharingScreen = true;
    $('#startScreenshare').removeAttr('onclick');
    $('#startScreenshare').attr('onClick', 'toggleScreenShare(false);');
    $('#startScreenshare').text("");
    $('#startScreenshare').children().remove();
    $('#startScreenshare').append(
      '<i id="screenshare-icon" class="call-btn-icon fa fa-desktop"></i> Stop Screenshare'
    )
    $('#startScreenshare').attr('aria-label', 'Stop screen share');
    setFeedbackText('Screenshare started!');
  }
}

function enterFullscreen() {
  const webcamContainer = document.getElementById('fullscreen-element');

  if (!document.fullscreenElement && !document.mozFullScreenElement
    && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    document.getElementById('exitFullscreen').style.display = 'block';
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
    document.getElementById('exitFullscreen').style.display = 'none';
    $('#remoteView').css('object-fit', 'contain');
  }
}

// Used to exit fullscreen if active when call is teminated
function exitFullscreen() {
  if (document.getElementById('fullscreen-element').fullscreenElement) {
    document.getElementById('exitFullscreen').style.display = 'none';
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

function showFileShareConfirmation() {
  // just showing a confirmation to demo UI
  $('#fileSent').show();
}

$('#dropup-menu').on('shown.bs.dropdown', () => {
  emojiToggle = true;
});

// $('#dropup-menu').on('hidden.bs.dropdown', () => {
//   emojiToggle = false;
// });

$('#newchatmessage').on('keyup change keydown paste input', function (evt) {
  if (evt.keyCode === 13) {
    evt.preventDefault();
    if ($('#newchatmessage').val() !== '' && !emojiToggle) {
      $('#chatsend').submit();
    } else if (emojiToggle) {
      emojiToggle = false;
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
  if ($('#newchatmessage').val() === '') {
    this.style.height = $('#chat-send').css('height');
  }
});

$('#fileInput').on('change', () => {
  if ($('#fileInput')[0].value === '') {
    console.log('no file chosen');
    $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');
    $('#removeFileBtn').css('display', 'none');
    // add tooltip to send button
    $('#shareFileConsumer').attr('data-original-title', 'You must choose a file').parent().find('.tooltip-inner').html('You must choose a file');
  } else {
    console.log('file chosen!');
    $('#shareFileConsumer').attr('disabled', false).css('background-color','#073863');;
    $('#removeFileBtn').css('display', 'block');
    // remove tooltip on send button
    $('#shareFileConsumer').attr('data-original-title', '').parent().find('.tooltip-inner').html('');
  }
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
});

function removeFile() {
  $('#fileInput')[0].value = '';
  $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');;
  $('#removeFileBtn').css('display', 'none');
  $('#shareFileConsumer').attr('data-original-title', 'You must choose a file').parent().find('.tooltip-inner').html('You must choose a file');
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
}

$('#removeFileBtn').on('keyup', (evt) => {
  evt.preventDefault();
  if (evt.keyCode === 13) {
    $('#removeFileBtn').click();
  }
});

$('#shareFileConsumer').on('keyup', (evt) => {
  evt.preventDefault();
  if (evt.keyCode === 13) {
    $('#shareFileConsumer').click();
  }
});

$('.closeFileResponse').on('keyup', (evt) => {
  evt.preventDefault();
  if (evt.keyCode === 13) {
    $('.closeFileResponse').click();
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
  $(msgtext).addClass('direct-chat-text')
    .html(msg)
    .appendTo(msgblock);

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
    $(msgblock).addClass('alert alert-secondary receivedChat')
      .attr('aria-live', 'assertive')
      .appendTo($('#chat-messages'));
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
    setFeedbackText('Sending file...');
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
        $('#removeFileBtn').hide();
        $('#shareFileConsumer').attr('data-original-title', 'You must choose a file').parent().find('.tooltip-inner').html('You must choose a file');
        $('#button-feedback').hide();
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
  setFeedbackText('File received from agent!');
  let fileType = data.original_filename.split('.')[1];
  if (fileType) {
    if (viewableFileTypes.includes(fileType.toLowerCase())) {
      // we can open this file in a new tab without downloading it
      $('#receivedFilesList').append(
        (`<span>${data.original_filename}</span>
        <span class="btn-toolbar pull-right" role="toolbar">
          <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Download" target="_blank" href="./downloadFile?id=${data.id}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="View" target="_blank" href="./viewFile?id=${data.id}"><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        <hr/>`)
      );
    } else {
      // cannot view without downloading
      $('#receivedFilesList').append(
        (`<span>${data.original_filename}</span>
        <span class="btn-toolbar pull-right" role="toolbar">
          <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Download" target="_blank" href="./downloadFile?id=${data.id}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="You need to download this file to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        <hr/>`)
      );
    }
  } else {
    // file type not in file name-- cannot view without downloading
    $('#receivedFilesList').append(
      (`<span>${data.original_filename}</span>
      <span class="btn-toolbar pull-right" role="toolbar">
        <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Download" target="_blank" href="./downloadFile?id=${data.id}"><i class="fa fa-download fileShareIcon"></i></a>
        <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="You need to download this file to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
      </span>
      <hr/>`)
    );
  }

  // need to call this every time we add a new tooltip
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
}

function addFileToSentList(data) {
  $('#noSentFiles').attr('hidden', true);
  let fileType = data.original_filename.split('.')[1];

  if (fileType) {
    if (viewableFileTypes.includes(fileType.toLowerCase())) {
      // we can open this file in a tab without downloading it
      // add to sent files list
      $('#sentFilesList').append(
        (`<span>${data.original_filename}</span>
        <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="View" target="_blank" href="./viewFile?id=${data.id}" role="button" aria-label="View file"><i class="fa fa-eye fileShareIcon"></i></a>
        <hr/>`)
      );
    } else {
      // we cannot open this file in a tab without downloading it
      // add to sent files list
      $('#sentFilesList').append(
        (`<span>${data.original_filename}</span>
        <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Cannot view this file type" disabled><i class="fa fa-eye fileShareIcon"></i></a>
        <hr/>`)
      );
    }
  } else {
    // file type isn't in the file name-- cannot open the file in a new tab
    // add to sent files list
    $('#sentFilesList').append(
      (`<span>${data.original_filename}</span>
      <a class="btn pull-right fileshareButton" data-toggle="tooltip" title="Cannot view this file type" disabled><i class="fa fa-eye fileShareIcon" ></i></a>
      <hr/>`)
    );
  }

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

  $('.buttonFontSize').css('font-size', `${(Number(14) * temp).toString()}px`);

  if ($('#fileBody').hasClass('active')) {
    // need to do some weird stuff to update the textarea height when the chat tab isn't active
    $('#chatBody').addClass('active');

    if ($('#newchatmessage').val() === '') {
      $('#newchatmessage').css('height', $('#chat-send').css('height'));
    } else {
      // changing the font size while the textarea has a content
      $('#newchatmessage').css('height', '0px');
      $('#newchatmessage').css('height', `${$('#newchatmessage')[0].scrollHeight}px`);
    }
    $('#chatBody').removeClass('active');
  } else {
    // the chat tab is open
    if ($('#newchatmessage').val() === '') {
      $('#newchatmessage').css('height', $('#chat-send').css('height'));
    } else {
      // changing the font size while the textarea has a content
      $('#newchatmessage').css('height','0px');
      $('#newchatmessage').css('height', `${$('#newchatmessage')[0].scrollHeight}px`);
    }
  }
}

$('#collapseButton').on('keydown', (e) =>{
  if (e.keyCode === 13) {
    // enter key pressed
    // do not show the collapse button tooltip on enter press
    e.preventDefault();
    collapseSidebar('chatTab');
    $('#collapseButton').tooltip('hide');
  }
});

function collapseSidebar(tab) {
  if (isSidebarCollapsed) {
    // open the sidebar
    isSidebarCollapsed = false;
    $('#collapseButton').attr('aria-label', 'Collapse Sidebar');
    $('#collapseTabTitle').attr('title', 'Collapse Sidebar');
    $('#collapseButton').attr('aria-expanded', 'true');
    $('.tab-content').attr('hidden', false);
    $('#tab-pane').attr('hidden', false);
    $('#tab-options').css('padding-left', '');

    $('#fileShareTab').attr('aria-label', 'File share tab');
    $('#chatTab').attr('aria-label', 'Chat tab');

    if (tab !== '') {
      // open the selected tab
      $('#' + tab).addClass('active');
      if (tab === 'fileShareTab') {
        $('#fileBody').addClass('active');
        $('#fileShareTab').addClass('active');
        $('#chatTab').attr('aria-selected', 'false');
        $('#fileShareTab').attr('aria-selected', 'true');
        $('#tab2').addClass('active');
      } else if (tab === 'chatTab') {
        $('#chatBody').addClass('active');
        $('#chatTab').addClass('active');
        $('#chatTab').attr('aria-selected', 'true');
        $('#fileShareTab').attr('aria-selected', 'false');
        $('#tab1').addClass('active');
      }
    } else {
      // default to chat tab
      $('#chatTab').addClass('active');
      $('#chatBody').addClass('active');
      $('#chatTab').attr('aria-selected', 'true');
      $('#fileShareTab').attr('aria-selected', 'false');
      $('#tab1').addClass('active');
    }

    $('.sidebarTab').css('width', '8vw');

    $('#callFeaturesColumn').removeClass('col-md-1');
    $('#callFeaturesColumn').addClass('col-xs-6 col-lg-4');
    $('#callVideoColumn').removeClass('col-md-11');
    $('#callVideoColumn').addClass('col-xs-6 col-lg-8');

    $('#callFeaturesColumn').css('border-left', '1px solid #ddd');
    $('#callFeaturesColumn').css('padding-left', '');

    $('#collapseButtonIcon').removeClass('fa fa-angle-double-left');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-right');

    // update the collapse button tooltip
    $('#collapseButton').attr('data-original-title', 'Collapse').parent().find('.tooltip-inner').html('Collapse');
    if (tab === '') {
      $('#collapseButton').tooltip('show');
    }

    $('#remoteViewCol').css('height', '');
    $('#remoteView').css('height','');
    $('#remoteView').css('width', '');
    setColumnSize();
  } else {
    // close the sidebar
    isSidebarCollapsed = true;
    $('#collapseButton').attr('aria-label', 'Expand Sidebar');
    $('#collapseTabTitle').attr('title', 'Expand Sidebar');
    $('#collapseButton').attr('aria-expanded', 'false');
    $('.tab-content').attr('hidden', true);
    $('#tab-pane').attr('hidden', true);
    $('#tab-options').css('padding-left', '0px');
    $('li').removeClass('active');
    $('.tab-pane').removeClass('active');
    $('.sidebarTab').css('width', '8.8vw');

    $('#chatTab').attr('aria-selected', 'false');
    $('#fileShareTab').attr('aria-selected', 'false');
    $('#chatTab').attr('tabindex', '0');
    $('#fileShareTab').attr('tabindex', '-1');
    $('#fileShareTab').attr('aria-label', 'Collapsed file share tab');
    $('#chatTab').attr('aria-label', 'Collapsed chat tab');

    $('#callFeaturesColumn').removeClass('col-xs-6 col-lg-4');
    $('#callFeaturesColumn').addClass('col-md-1');
    $('#callVideoColumn').removeClass('col-xs-6 col-lg-8');
    $('#callVideoColumn').addClass('col-md-11');

    $('#callFeaturesColumn').css('border-left', '');
    $('#callFeaturesColumn').css('padding-left', '0px');

    // update the collapse button tooltip
    $('#collapseButton').attr('data-original-title', 'Expand').parent().find('.tooltip-inner').html('Expand');
    if (tab === '') {
      $('#collapseButton').tooltip('show');
    }
    $('#collapseButtonIcon').removeClass('fa fa-angle-double-right');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-left');

    // make sure remote video doesn't expand past footer
    setColumnSize()
  }
}

function toggleTab(tab) {
  if (isSidebarCollapsed) {
    // open sidebar
    collapseSidebar(tab);
  } else {
    if (tab === 'chatTab') {
      $('#chatTab').addClass('active');
      $('#chatTab').attr('aria-selected', 'true');

      $('#fileShareTab').removeClass('active');
      $('#fileShareTab').attr('aria-selected', 'false');
    } else if (tab === 'fileShareTab') {
      $('#fileShareTab').addClass('active');
      $('#fileShareTab').attr('aria-selected', 'true');

      $('#chatTab').removeClass('active');
      $('#chatTab').attr('aria-selected', 'false');
    }
  }
  setColumnSize();
}

function redirectToVideomail(){
  if(acekurento != null){
    acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, {ended: (e) => {
      console.log("--Call ended by asterisk, not abandoned--");
      window.location.href = "./videomail";
    }
  })
    acekurento.callTransfer("videomail");  
  } else {
    window.location.href = "./videomail";
  }
}
