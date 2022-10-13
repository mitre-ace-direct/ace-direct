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
const muteCaptionsOffIcon = document.getElementById('mute-captions-off-icon');
let hasMessages = false;
let isAgentTyping = false;
const sharingScreen = false;
let isSidebarCollapsed = false;
const index = 0;
let monitorExt = '';
let isScreenshareRestart = false;
let callAnswered = false;
let emojiToggle = false;
let feedbackTimeoutID;
let unreadMessages = 0;
let unreadFiles = 0;
let openTab = 'chat';
let exitingQueue = false;
let isCaptioning = false;
let captionsEnabled = false;
// captionsOn irrelevant if captionsEnabled is false, represents whether user has
// captions turn on or off via the cc button when enabled
let captionsOn = true;
const currentCaptions = [];
const historicalCaptions = [];
let recognitionStarted = false;
let body1globalFontSize;
let body2globalFontSize;

let exten;
// This variable is for catching the double end call that occurs when a user clicks the button
// that ends the call while in queue as if causes both the normal end call and the asterisk
// end call method to fire
let callAlreadyTerminated = false;
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
const syntaxCharacters = [
  { symbol: '&', replacement: '&amp;' },
  { symbol: '>', replacement: '&gt;' },
  { symbol: '<', replacement: '&lt;' },
  { symbol: '"', replacement: '&quot;' },
  { symbol: '\'', replacement: '&apos' }
];

$(document).ready(() => {
  // autoplay videos (configurable)
  if (autoplayEnabled === 'true') {
    console.log(`autoplayEnabled: ${autoplayEnabled}`);
    $('#optionsModal').on('shown.bs.modal', () => {
      $('#instructionsVideo').trigger('play');
    });
    $('#waitingModal').on('shown.bs.modal', () => {
      $('#pleaseWaitVideo').trigger('play');
    });
    $('#noAgentsModal').on('shown.bs.modal', () => {
      $('#noAgentsVideo').trigger('play');
    });
  }

  $('#optionsModal').on('shown.bs.modal', () => {
    $('#optionsModal').css('overflow-y', 'auto');
    window.openDialog('optionsModal', window);
  });
  $('#noAgentsModal').on('shown.bs.modal', () => {
    $('#noAgentsModal').css('overflow-y', 'auto');
    window.openDialog('noAgentsModal', window);
  });
  $('#waitingModal').on('shown.bs.modal', () => {
    $('#waitingModal').css('overflow-y', 'auto');
    window.openDialog('waitingModal', window);
  });
  $('#callEndedModal').on('shown.bs.modal', () => {
    $('#callEndedModal').css('overflow-y', 'auto');
    window.openDialog('callEndedModal', window);
  });

  $('#optionsModal').on('hidden.bs.modal', () => {
    window.removeFocus();
  });
  $('#noAgentsModal').on('hidden.bs.modal', () => {
    window.removeFocus();
  });
  $('#waitingModal').on('hide.bs.modal', () => {
    window.removeFocus();
  });
  $('#callEndedModal').on('hide.bs.modal', () => {
    window.removeFocus();
  });

  if (fileSharingEnabled === 'false') {
    // remove filesharing tab
    $('#tab2').remove();
  }

  $('#optionsModal').modal('show');

  document.getElementById('exitFullscreen').style.display = 'none';
  connect_socket();
  $('#shareFileConsumer').tooltip({
    trigger: 'hover',
    viewport: $('#shareFileConsumer')
  });

  $('#collapseButton').tooltip({
    trigger: 'hover',
    viewport: $('#collapseTab')
  });

  // Use arrow keys to navigate tabs
  const tablists = document.querySelectorAll('[role=tablist].tabs-right');
  for (let i = 0; i < tablists.length; i += 1) {
    new TabsManual(tablists[i]);
  }

  // Extend dayjs with utc plugin
  dayjs.extend(window.dayjs_plugin_utc);

  // update the page height when the accelerated hardware banner appears/disappears
  const observer = new MutationObserver(function (mutations) {
    console.log('setting setColumnSize()');
    setColumnSize();
  });
  const target = document.querySelector('#hardware-acc-warning');
  observer.observe(target, {
    attributes: true
  });
});

$(window).bind('fullscreenchange', function (_e) {
  // check to see if your browser has exited fullscreen
  if (!document.fullscreenElement && !document.mozFullScreenElement
    // video fullscreen mode has changed
    && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (document.fullscreenElement) {
      // you have just ENTERED full screen video
    } else {
      document.getElementById('exitFullscreen').style.display = 'none';
    }
  }
});

function connect_socket() {
  $.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    success: (successData) => {
      if (successData.message === 'success') {
        socket = io.connect(`https://${window.location.host}`, {
          path: `${nginxPath}/socket.io`,
          query: `token=${successData.token}`,
          forceNew: true
        });

        // update the version and year in the footer
        socket.on('adversion', (data) => {
          $('#ad-version').text(data.version);
          $('#ad-year').text(data.year);
        });

        socket.on('connect', () => {
          const payload = jwt_decode(successData.token);
          // get the start/end time strings for the after hours dialog
          // const tz = convertUTCtoLocal(payload.startTimeUTC).split(' ')[2];

          $('#button-feedback').hide();
          $('#button-feedback').attr('aria-hidden', 'true');

          $('#firstName').val(payload.first_name);
          $('#lastName').val(payload.last_name);
          $('#callerPhone').val(payload.vrs);
          vrs = payload.vrs;
          // $('#callerEmail').val(payload.email);
          $('#displayname').val(`${payload.first_name} ${payload.last_name}`);
          const { isOpen } = payload;
          if (!isOpen) { // after hours processing; if after hours, then show this modal
            // TODO Review potentially having config variable to determine if enabled per user
            // DO NOT enable for dro
            // $("#afterHoursModal").modal({ backdrop: "static" });
            // $("#afterHoursModal").modal("show");
            // console.log(`after hours modal suppressed. isOpen: ${isOpen}`);
          }

          // start time is in UTC
          // startTimeUTC = convertUTCtoLocal(payload.startTimeUTC).substring(0, 8);
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
          .on('ad-ticket-created', (_data) => {

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

              // registerJssip(data.extension, data.password); //register with the given extension

              // TO DO - This needs to be a string representation of the extension (e.g. '575791')
              // startCall(asteriskSipUri); //calling asterisk to get into the queue
              // Original
              // startCall(asteriskSipUri); //calling asterisk to get into the queue

              // add ace kurento signal handling so we can get params,
              // then call once we have a wv connection
              if (acekurento === null) {
                let signalingUrl = globalData.signaling_server_url;
                signalingUrl = signalingUrl.trim();

                acekurento = new ACEKurento({ acekurentoSignalingUrl: signalingUrl });

                acekurento.remoteStream = document.getElementById('remoteView');
                acekurento.selfStream = document.getElementById('selfView');

                const eventHandlers = {
                  connected: (_e) => {
                    console.log('--- WV: Connected ---\n');
                    // register with the given extension
                    registerJssip(data.extension, data.password);
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
              console.log('error - out of extensions...');
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
              console.log('error - something went wrong when getting an extension');
            }
          })
          .on('chat-message-new', (data) => {
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
                  $('#rtt-typing').html(`<b>${data.displayname}</b>` + `<br/>${data.rttmsg}`).addClass('direct-chat-text chat-body1').addClass('direct-chat-timestamp text-bold body2');
                  $('#rtt-typing').appendTo($('#chat-messages'));
                  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
                }, 100);
              } else {
                $('#rtt-typing').css('display', 'block');
                $('#rtt-typing').html(`<b>${data.displayname}</b>` + `<br/>${data.rttmsg}`).addClass('direct-chat-text chat-body1').addClass('direct-chat-timestamp text-bold body2');
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
                $('#chat-messages').removeClass('populatedMessages');
                $('#chat-messages').addClass('emptyMessages');
                $('#emptyChat').text(`This is the start of your chat${$('.agentChatName').text()}. No messages yet to display`);
                $('#chat-messages').css('padding-top', '75% !important');
              } else {
                $('#emptyChat').css('margin-top', '0px');
              }
              $('#rtt-typing').css('display', 'none');
              $('#chat-messages').remove($('#rtt-typing'));
              $('#rtt-typing').html('').removeClass('direct-chat-text chat-body1').removeClass('direct-chat-timestamp text-bold chat-body2');
              $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
            }
          })
          .on('disconnect', () => {
            unregisterJssip();
          })
          .on('unauthorized', (error) => {
            if (error.data.type === 'UnauthorizedError' || error.data.code === 'invalid_token') {
              logout('Session has expired');
            }
          })
          .on('queue-caller-join', (data) => {
            if (data.extension === exten && data.queue === 'ComplaintsQueue') {
              // subtract because asterisk wording is off by one
              // setQueueText(data.position -= 1);
            }
          })
          .on('queue-caller-leave', (data) => {
            const currentPosition = $('#pos-in-queue').text();
            if (data.queue === 'ComplaintsQueue') {
              /* if (!abandonedCaller) {
                // abandoned caller triggers both leave and abandon event.
                // this prevents duplicate removes.
                    setQueueText(currentPosition -= 1);
                } */
              abandonedCaller = false;
            }
          })
          .on('queue-caller-abandon', (data) => {
            if (data.queue === 'ComplaintsQueue') {
              let currentPosition = $('#pos-in-queue').text();
              currentPosition += 1;

              // checks if the abandoned caller was ahead of you
              if (currentPosition > data.position) {
                currentPosition = $('#pos-in-queue').text();
                // setQueueText(currentPosition -= 1);
              }

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
            $('#chat-messages').html('<div class="direct-chat-timestamp text-bold alert alert-secondary rttChatBubble chat-body2" id="rtt-typing" style="min-height: 20px; display: none;"></div>\
            <span id="emptyChat">This is the start of your chat<span class="agentChatName"></span>. No messages yet to display</span>');

            // reset buttons and ticket form
            $('#ticketNumber').text('');
            $('#complaintcounter').text('2,000');
            $('#complaint').val('');
            $('#subject').val('');

            if (complaintRedirectActive && callAnswered) {
              $('#redirectURL').text(complaintRedirectUrl);
              $('#redirectUrlDesc').text(complaintRedirectDesc);
              $('#redirectUrlDesc').attr('href', complaintRedirectUrl);
              $('#callEndedModal').modal('show');

              setTimeout(() => {
                location = complaintRedirectUrl;
              }, 10000);
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

            if (isSidebarCollapsed || openTab !== 'fileShare') {
              unreadFiles += 1;
              $('#unreadFilesBadge').text(unreadFiles);
            }
          })
          .on('fileListAgent', (data) => {
            // file sent confirmation
            addFileToSentList(data);
            $('#fileInput').val('');
            $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');
          })
          .on('screenshareResponse', (data) => {
            if (data.permission === true) {
              $('#startScreenshare').show();
              $('#screenshareButton').prop('disabled', true);
              $('#startScreenshare').prop('disabled', false);
              $('#screenshareButtonGroup').show();
              $('#requestAck').hide();
            } else {
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
          })
          .on('agentScreenshare', () => {
            // agent is stopping/starting screenshare
            isScreenshareRestart = true;
          })
          .on('caption-config', (data) => {
            if (data && data !== 'false') {
              console.log(data, typeof data);
              captionsEnabled = data;
              if (captionsEnabled) {
                $('#mute-captions').show();
                $('#captions-area').show();
              }
            }
          })
          .on('caption-translated', (transcripts) => {
            console.log('received translation', transcripts.transcript, transcripts.msgid, transcripts.final);
            updateCaptions(transcripts);
          })
          .on('multiparty-caption', (data) => {
            updateCaptions(data);
          })
          .on('consumer-caption', function (transcripts) {
            // receiving own captions
            updateCaptions(transcripts);
          });
      } else {
        // need to handle bad connections?
      }
    },
    error: (_xhr, _status, _error) => {
      console.log('Error');
      $('#message').text('An Error Occured.');
    }
  });
}

const setColumnSize = function () {
  let acceleratedBannerHeight = 0;
  if ($('#hardware-acc-warning').is(':visible')) {
    acceleratedBannerHeight = $('#hardware-acc-warning').height();
  }

  // sidebar tabs
  const chatSeparator = document.getElementById('chat-separator');
  const fileShareSeparator = document.getElementById('fileshare-separator');
  const footer = document.getElementById('footer-container-consumer');
  const tabsTop = chatSeparator.getBoundingClientRect().bottom
    || fileShareSeparator.getBoundingClientRect().bottom;
  const chatHeight = footer.getBoundingClientRect().top - tabsTop;
  const fileshareHeight = footer.getBoundingClientRect().top - tabsTop;
  let newChatMessageHeight = parseInt((document.getElementById('newchatmessage').style.height).slice(0, -2), 10); // height of chat textarea
  const defaultBrowserFontSize = parseInt((window.getComputedStyle(document.body).getPropertyValue('font-size')), 10); // default browser font size
  const newChatTextSize = parseInt((document.getElementById('newchatmessage').style.fontSize).slice(0, -2), 10); // font size when increased/decreased by consumer
  // if newchatsize is a number, user zoomed in/out
  if (!Number.isNaN(newChatTextSize)) {
    if (newChatTextSize * 6 > newChatMessageHeight) {
      $('#newchatmessage').css('max-height', `${newChatTextSize * 6}px`);
    } else {
      newChatMessageHeight = newChatTextSize * 6; // increase textarea height as zoom increases
    }
  } else { // limit the textarea height to 6x default browser font height
    if(defaultBrowserFontSize * 6 > newChatMessageHeight){
      $('#newchatmessage').css('max-height', `${defaultBrowserFontSize * 6}px`);
    } else {
      newChatMessageHeight = defaultBrowserFontSize * 6;
    }
  }

  $('#chat-box-body').height(chatHeight - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight));
  if ($('#chat-messages').hasClass('emptyMessages')) {
    $('#chat-body').height(chatHeight - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight));
  } else {
    $('#chat-body').height(chatHeight - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight + newChatMessageHeight));
  }

  $('#fileshare-box-body').height(fileshareHeight - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight));
  $('#fileshare-body').height(fileshareHeight - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight));

  $('.tabs-right').height((chatHeight + tabsTop) - ($('#footer-container-consumer').height() + 20 + acceleratedBannerHeight));

  // video section
  $('#callVideoColumn').height(footer.getBoundingClientRect().top - 200);

  const buttonFeedback = document.getElementById('button-feedback');
  const speakingToRow = document.getElementById('speakingToRow');
  const videoButtonsRow = document.getElementById('callButtonsRow');
  const videoTop = buttonFeedback.getBoundingClientRect().bottom
    || speakingToRow.getBoundingClientRect().bottom
    || videoButtonsRow.getBoundingClientRect().bottom;
  let captionAreaHeight = 0;

  if (captionsEnabled && captionsOn) {
    captionAreaHeight = 300;
  }

  const videoHeight = footer.getBoundingClientRect().top - videoTop - captionAreaHeight;

  $('#remoteViewCol').height(`${videoHeight}px`);
  $('#remoteView').height(`${videoHeight}px`);

  // set remote video column width
  $('#remoteViewCol').width(`${($('#callVideosRow').width() - $('#selfViewCol').width()) - 19}px`);
};
setColumnSize();
window.addEventListener('resize', setColumnSize);

// Updates the unordered lists in the caption area with the contents of the caption arrays
function refreshCaptions() {
  // Clear both unordered lists
  $('#currentCaptions').empty();
  $('#historicalCaptions').empty();

  // Populate current captions
  if (currentCaptions.length < 1) {
    $('#currentCaptions').prepend('<li>...no one is speaking, no captions to display</li>');
  } else {
    currentCaptions.forEach((caption, _index) => {
      const date = dayjs(caption.timestamp);
      const timestamp = date.format('h:mm a');
      $('#currentCaptions').prepend('<li><span class="timestamp">' + timestamp + '</span> <span class="speaker">' + caption.displayname + '</span> <span class="caption">' + caption.transcript + '</span></li>');
    });
  }

  // Populate historical captions
  historicalCaptions.forEach((caption, _index) => {
    const date = dayjs(caption.timestamp);
    const timestamp = date.format('h:mm a');
    $('#historicalCaptions').append('<li><span class="timestamp">' + timestamp + '</span> <span class="speaker">' + caption.displayname + '</span> <span class="caption">' + caption.transcript + '</span></li>');
  });
}

// Updates the caption arrays and calls refreshCaptions()
function updateCaptions(caption) {
  console.log(caption);
  if (caption.final) {
    console.log('final!');
    // Remove caption from current captions
    currentCaptions.forEach((element, captionIndex) => {
      if (element.extension === caption.extension) {
        currentCaptions.splice(captionIndex, 1);
      }
    });

    // Add to historical
    historicalCaptions.unshift(caption);
  } else {
    let found = false;
    currentCaptions.forEach((element, captionIndex) => {
      if (element.extension === caption.extension) {
        found = true;
        currentCaptions[captionIndex] = caption;
      }
    });
    if (!found) {
      currentCaptions.unshift(caption);
    }
  }
  refreshCaptions();
}

function captionsMuted() {
  return muteCaptionsOffIcon.style.display === 'block';
}

function toggleCaptions() {
  if (!captionsMuted()) {
    captionsOn = false;
    muteCaptionsOffIcon.style.display = 'block';
    $('#captions-area').hide();
  } else {
    captionsOn = true;
    muteCaptionsOffIcon.style.display = 'none';
    $('#captions-area').show();
  }

  setColumnSize();
}

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
          isScreenshareRestart = true;
          // $('#startScreenshare').hide();
          // acekurento.screenshare(false);
          // document.getElementById('startScreenshare').innerText = 'Start Screenshare';
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
          isScreenshareRestart = true;
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
      // console.log('RECEIVED ENDCALL');
      endCall(false);
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
        if (captionsEnabled) {
          e.participants.forEach((part) => {
            if (part.isAgent) {
              socket.emit('consumer-captions-enabled', { agentExt: part.ext });
            }
          });
        }
      } else if (isScreenshareRestart) {
        isScreenshareRestart = false;
      }

      if (partCount >= 2 || videomailflag) {
        console.log('--- WV: CONNECTED');

        if ($('#queueModal').is(':visible')) {
          $('#queueModal').modal('hide');
        }

        if ($('#waitingModal').is(':visible')) {
          $('#waitingModal').modal('hide');
          if ($('#pleaseWaitTranscript').is(':visible')) {
            // close the transcript when closing the modal
            toggleTranscripts('pleaseWait');
          }
        }

        document.getElementById('noCallPoster').style.display = 'none';
        document.getElementById('inCallSection').style.display = 'block';
        setColumnSize();
        callAnswered = true;
        if (!isCaptioning) {
          captionsStart();
        }
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

// Modal Video Transcripts
function toggleTranscripts(video) {
  const transcriptButton = `#${video}TranscriptBtn`;
  const transcript = `#${video}Transcript`;

  if ($(transcript).is(':hidden')) {
    // open the transcript
    $(transcript).attr('hidden', false);
    $(transcript).attr('aria-hidden', 'false');
    $(transcriptButton).html('Hide Video Transcript <i class="fa fa-chevron-up" alt="" aria-hidden="true"></i>');
    $(transcriptButton).blur();
    $(transcript).focus();
  } else {
    // close the transcript
    $(transcript).attr('hidden', true);
    $(transcript).attr('aria-hidden', 'true');
    $(transcriptButton).html('Show Video Transcript <i class="fa fa-chevron-down" alt="" aria-hidden="true"></i>');
  }
}

// CALL FLOW FUNCTIONS
function enterQueue() {
  callAlreadyTerminated = false;
  if ($('#instructionsVideoTranscript').is(':visible')) {
    // close the transcript when closing the modal
    toggleTranscripts('instructionsVideo');
  }

  const language = 'en';
  socket.emit('call-initiated', {
    language,
    vrs
  }, (isOpen) => {
    console.log('isOpen:', isOpen);

    if (isOpen) {
      // wait for the options modal to fully close before opening another modal
      $('#optionsModal').one('hidden.bs.modal', () => {
        $('#waitingModal').modal('show');
      });
    } else {
      // wait for the options modal to fully close before opening another modal
      $('#optionsModal').one('hidden.bs.modal', () => {
        $('#noAgentsModal').modal('show');
      });
    }
  });
}

/**
 *
 * @param {*Determines if the user hang up while waiting in queue or ended an active call} inCall
 */
function endCall(userInitiated = false) {
  if (callAlreadyTerminated && !userInitiated) {
    return; // Prevents a double call from someone leaving the queue from occurring.
  }
  console.log(`CALLING ENDCALL COMPARING ${userInitiated}`);
  clearInterval(callTimer);

  // if(callAnswered || forceHangup){
  // Catches if the user clicks the hangup on the noagents modal
  if (($('#noAgentsModal').hasClass('in') || $('#optionsModal').hasClass('in')) && !userInitiated) {
    $('#noAgentsModal').one('hidden.bs.modal', () => {
      $('#optionsModal').modal('show');
    });

    $('#noAgentsModal').modal('hide');
    if ($('#noAgentsTranscript').is(':visible')) {
      // close the transcript when closing the modal
      toggleTranscripts('noAgents');
    }
    closeDialog($('#noAgentsHangUpButton')[0]);
  } else if (callAnswered) {
    // Arrives here when a consumer ends a call that was connected with agent
    if (complaintRedirectActive) {
      $('#redirectURL').text(complaintRedirectUrl);
      $('#redirectUrlDesc').text(complaintRedirectDesc);
      $('#redirectUrlDesc').attr('href', complaintRedirectUrl);

      // wait for the modal to fully close before opening another modal
      $('#waitingModal').one('hidden.bs.modal', () => {
        $('#callEndedModal').modal('show');
      });

      $('#waitingModal').modal('hide');
      if ($('#pleaseWaitTranscript').is(':visible')) {
        // close the transcript when closing the modal
        toggleTranscripts('pleaseWait');
      }
      closeDialog($('#waitingHangUpButton')[0]);

      document.getElementById('noCallPoster').style.display = 'block';
      document.getElementById('inCallSection').style.display = 'none';

      setTimeout(() => {
        location = complaintRedirectUrl;
      }, 10000);
      captionsEnd();
    } else {
      // reset the page
      window.location = `${window.location.origin}/${nginxPath}${consumerPath}`;
    }
  } else if (userInitiated) {
    // Called when a user ends the call with the "Hang Up" button while waiting in queue

    if ($('#waitingModal').is(':visible')) {
      $('#waitingModal').one('hidden.bs.modal', () => {
        $('#optionsModal').modal('show');
      });

      $('#waitingModal').modal('hide');
      if ($('#pleaseWaitTranscript').is(':visible')) {
        // close the transcript when closing the modal
        toggleTranscripts('pleaseWait');
      }
    }

    if ($('#noAgentsModal').is(':visible')) {
      $('#noAgentsModal').one('hidden.bs.modal', () => {
        $('#optionsModal').modal('show');
      });

      $('#noAgentsModal').modal('hide');
      if ($('#noAgentsTranscript').is(':visible')) {
        // close the transcript when closing the modal
        toggleTranscripts('noAgents');
      }
    }
  } else {
    // Called when a user ends the call while waiting in queue

    if ($('#waitingModal').is(':visible')) {
      // wait for the modal to fully close before opening another modal
      $('#waitingModal').one('hidden.bs.modal', () => {
        $('#noAgentsModal').modal('show');
      });

      $('#waitingModal').modal('hide');
      if ($('#pleaseWaitTranscript').is(':visible')) {
        // close the transcript when closing the modal
        toggleTranscripts('pleaseWait');
      }
      // closeDialog($('#waitingHangUpButton')[0]);
    }

    if ($('#optionsModal').is(':visible')) {
      // wait for the modal to fully close before opening another modal
      $('#optionsModal').one('hidden.bs.modal', () => {
        $('#noAgentsModal').modal('show');
      });

      $('#optionsModal').modal('hide');
      if ($('#instructionsVideoTranscript').is(':visible')) {
        // close the transcript when closing the modal
        toggleTranscripts('instructionsVideo');
      }
      // closeDialog($('#callQueueButton')[0]);
    }
  }

  callAlreadyTerminated = true;
  terminateCall();
}

function exitQueue() {
  console.log('EXITING QUEUE');
  exitingQueue = true;
  endCall();
}

// makes a call
/*
* Use acekurento object to make the call. Not sure about the extension
*/
function startCall(otherSipUri) {
  console.log(`startCall: ${otherSipUri}`);
  selfStream.removeAttribute('hidden');

  $('#screenshareButton').removeAttr('disabled');
  $('#fileInput').removeAttr('disabled');
  // acekurento.call(globalData.queues_complaint_number, false);
  acekurento.call(otherSipUri, false);
}

function startCallTimer() {
  let minutes = 0;
  let seconds = 0;
  const start = new Date();

  callTimer = setInterval(function () {
    const temp = Math.round(new Date() - start) / 1000;
    minutes = Math.floor(temp / 60) > 0 ? Math.floor(temp / 60) : 0;
    seconds = Math.floor((temp - (minutes * 60)));

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
let isMuted = false;
function muteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone').addClass('call-btn-icon fa fa-microphone-slash');
  $('#mute-audio').attr('onclick', 'unmuteAudio()');
  $('#mute-audio').attr('aria-label', 'Unmute Audio');
  isMuted = true;
  setFeedbackText('Audio Muted!');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(false, true); // mute audio
  }
  $('#mute-audio').blur();
  if (recognitionStarted && recognition) {
    recognition.stop();
  }
}

// unmutes self audio so remote can hear you
function unmuteAudio() {
  $('#mute-audio-icon').removeClass('call-btn-icon fa fa-microphone-slash').addClass('call-btn-icon fa fa-microphone');
  $('#mute-audio').attr('onclick', 'muteAudio()');
  $('#mute-audio').attr('aria-label', 'Mute Audio');
  isMuted = false;
  setFeedbackText('Audio Unmuted!');
  if (acekurento !== null) {
    acekurento.enableDisableTrack(true, true); // unmute audio
  }
  $('#mute-audio').blur();
  if (captionsEnabled && !recognitionStarted) {
    captionsStart();
  }
}

function enableVideoPrivacy() {
  $('#hide-video').blur();
  // $('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera')
  // .addClass('call-btn-icon fa-stack');
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
        muteAudio(); //
        captionsEnd();
        hideVideoButton.setAttribute('onclick', 'javascript: disableVideoPrivacy();');
        hideVideoIcon.style.display = 'block';
        acekurento.privateMode(true, privacyVideoUrl);
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.remove('mirror-mode');
      acekurento.enableDisableTrack(false, false); // mute video
      muteAudio(); //
      captionsEnd();
      acekurento.privateMode(true, privacyVideoUrl);
    }
  }
}

function disableVideoPrivacy() {
  $('#hide-video').blur();
  // $('#mute-camera-off-icon').removeClass('call-btn-icon fa fa-video-camera')
  //   .addClass('call-btn-icon fa fa-video-camera');
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
        unmuteAudio(); //
        captionsStart();
        hideVideoButton.setAttribute('onclick', 'javascript: enableVideoPrivacy();');
        hideVideoIcon.style.display = 'none';
        acekurento.privateMode(false);
        hideVideoIcon.style.display = 'none';
        socket.emit('reinvite-monitor', { monitorExt });
      }, 500);
    } else {
      selfStream.classList.add('mirror-mode');
      acekurento.enableDisableTrack(true, false); // unmute video
      unmuteAudio(); //
      captionsStart();
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
  $('#startScreenshare').blur();
  isScreenshareRestart = true;
  if (!toggle) {
    acekurento.screenshare(false);
    console.log('UPDATING SCREENSHARE BUTTON FALSE');
    // sharingScreen = false;
    $('#startScreenshare').removeAttr('onclick');
    $('#startScreenshare').attr('onClick', 'toggleScreenShare(true);');
    $('#startScreenshare').text('');
    $('#startScreenshare').children().remove();
    $('#startScreenshare').append(
      '<i id="screenshare-icon" class="call-btn-icon fa fa-desktop"></i> Start Screenshare'
    );
    $('#startScreenshare').attr('aria-label', 'Share screen');
    // setFeedbackText('Screenshare ended!');
  } else {
    acekurento.screenshare(true);
    console.log('UPDATING SCREENSHARE BUTTON TRUE');
    // sharingScreen = true;
    $('#startScreenshare').removeAttr('onclick');
    $('#startScreenshare').attr('onClick', 'toggleScreenShare(false);');
    $('#startScreenshare').text('');
    $('#startScreenshare').children().remove();
    $('#startScreenshare').append(
      '<i id="screenshare-icon" class="call-btn-icon fa fa-desktop"></i> Stop Screenshare'
    );
    $('#startScreenshare').attr('aria-label', 'Stop screen share');
    // setFeedbackText('Screenshare started!');
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

  // readjust the chat window as the consumer is typing
  setColumnSize();
});

$('#fileInput').on('change', () => {
  if ($('#fileInput')[0].value === '') {
    console.log('no file chosen');
    $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');
    $('#removeFileBtn').css('display', 'none');
    // add tooltip to send button
    $('#shareFileConsumer').attr('data-original-title', 'Choose a file to send').parent().find('.tooltip-inner')
      .html('Choose a file to send');
  } else {
    console.log('file chosen!');
    $('#shareFileConsumer').attr('disabled', false).css('background-color', '#073863');
    $('#removeFileBtn').css('display', 'block');
    // remove tooltip on send button
    $('#shareFileConsumer').attr('data-original-title', '').parent().find('.tooltip-inner')
      .html('');
  }
  $('[data-toggle="tooltip"]').tooltip({
    trigger: 'hover'
  });
});

function removeFile() {
  $('#fileInput')[0].value = '';
  $('#shareFileConsumer').attr('disabled', true).css('background-color', 'rgb(15, 42, 66)');
  $('#removeFileBtn').css('display', 'none');
  $('#shareFileConsumer').attr('data-original-title', 'Choose a file to send').parent().find('.tooltip-inner')
    .html('Choose a file to send');
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
  const date = dayjs();
  const timestamp = date.format('h:mm a');

  // console.log('local time: ' + date.format());
  // console.log('utc time: ' + date.utc().format());
  // const timestamp = date.utc();

  // const language = sessionStorage.consumerLanguage;
  const language = 'en';

  $('#newchatmessage').val('');
  $('#newchatmessage').height(0);
  $('#chatcounter').text('500');
  setColumnSize();
  console.log('sent message with language', language);
  isTyping = false;
  socket.emit('chat-message', {
    message: msg,
    timestamp,
    displayname,
    fromLanguage: language,
    isConsumerMessage: true
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

  if (data.isConsumerMessage) {
    $(msgsender).addClass('direct-chat-name pull-left chat-body2').html('You')
      .css('font-weight', '700 !important')
      .css('font-size', body2globalFontSize)
      .appendTo(msginfo);
  } else {
    $(msgsender).addClass('direct-chat-name pull-left chat-body2').html(displayname)
      .css('font-weight', '700 !important')
      .appendTo(msginfo);
  }

  $(msgtime).addClass('direct-chat-timestamp chat-body2').html(` ${timestamp}`).appendTo(msginfo);
  // $(msgtime).addClass('direct-chat-timestamp chat-body2')
  //   .html(` ${dayjs(timestamp).local().format('h:mm a')}`).appendTo(msginfo);
  $(msginfo).addClass('direct-chat-info clearfix').appendTo(msgblock);
  $(msgtext).addClass('direct-chat-text chat-body1')
    .html(msg)
    .css('font-size', body1globalFontSize)
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
    $('#rtt-typing').html('').removeClass('direct-chat-text chat-body1');
    $(msgblock).addClass('alert alert-secondary receivedChat')
      .attr('aria-live', 'assertive')
      .appendTo($('#chat-messages'));
  }
  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);

  if (isSidebarCollapsed || openTab !== 'chat') {
    // add a badge notification
    unreadMessages += 1;
    $('#unreadMessagesBadge').text(unreadMessages);
  }
}

// file share logic
// Fileshare for consumer portal
function shareFileConsumer() {
  $('#fileSent').hide();
  $('#fileSentError').hide();
  $('#shareFileConsumer').blur();
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
        $('#removeFileBtn').hide();
        $('#shareFileConsumer').attr('data-original-title', 'You must choose a file').parent().find('.tooltip-inner')
          .html('You must choose a file');
        $('#button-feedback').hide();

        setTimeout(() => {
          $('#fileSent').slideUp(500);
        }, 6000);
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
  if (!$('#receivedFilesDivider').hasClass('populatedFilesDivider')) {
    $('#receivedFilesDivider').addClass('populatedFilesDivider');
  }
  setFeedbackText('File received from agent!');
  const tempFilename = data.original_filename;
  let filename = tempFilename;

  syntaxCharacters.forEach((e) => {
    if (tempFilename.includes(e.symbol)) {
      filename = tempFilename.replaceAll(e.symbol, e.replacement);
    }
  });

  const fileType = filename.substring(filename.lastIndexOf('.') + 1, filename.length) || filename;
  if (fileType) {
    if (viewableFileTypes.includes(fileType.toLowerCase())) {
      // we can open this file in a new tab without downloading it
      $('#receivedFilesList').append(
        (`<span class="fileShareRow">
        <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
        <span class="fileShareFiller"></span>
        <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
          <a class="btn pull-right fileshareButton downloadFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton downloadFilesViewBtn" data-toggle="tooltip" data-container="body" title="View file in new tab" target="_blank" href="./viewFile?id=${data.id}" role="button" aria-label="View ${data.original_filename} in new tab"><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        </span>`)
      );
    } else {
      // cannot view without downloading
      $('#receivedFilesList').append(
        (`<span class="fileShareRow">
        <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
        <span class="fileShareFiller"></span>
        <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
          <a class="btn pull-right fileshareButton downloadFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton downloadFilesViewBtn" data-toggle="tooltip" data-container="body" title="Download this file to view it" aria-label="Download ${data.original_filename} to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        </span>`)
      );
    }
  } else {
    // file type not in file name-- cannot view without downloading
    $('#receivedFilesList').append(
      (`<span class="fileShareRow">
      <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
      <span class="fileShareFiller"></span>
      <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
        <a class="btn pull-right fileshareButton downloadFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
        <a class="btn pull-right fileshareButton downloadFilesViewBtn" data-toggle="tooltip" data-container="body" title="Download this file to view it" aria-label="Download ${data.original_filename} to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
      </span>
      </span>`)
    );
  }

  // need to call this every time we add a new tooltip
  $('.downloadFilesDownloadBtn').tooltip({
    trigger: 'hover',
    viewport: $('.downloadFilesDownloadBtn')
  });
  $('.downloadFilesViewBtn').tooltip({
    trigger: 'hover',
    viewport: $('.downloadFilesViewBtn')
  });

  $('.fileShareCellFilename').tooltip({
    trigger: 'hover',
    viewport: $('.fileShareCellFilename')
  });
}

function addFileToSentList(data) {
  $('#noSentFiles').attr('hidden', true);
  if (!$('#sentFilesDivider').hasClass('populatedFilesDivider')) {
    $('#sentFilesDivider').addClass('populatedFilesDivider');
  }

  const tempFilename = data.original_filename;
  let filename = tempFilename;

  syntaxCharacters.forEach((e) => {
    if (tempFilename.includes(e.symbol)) {
      filename = tempFilename.replaceAll(e.symbol, e.replacement);
    }
  });
  const fileType = filename.substring(filename.lastIndexOf('.') + 1, filename.length) || filename;

  if (fileType) {
    if (viewableFileTypes.includes(fileType.toLowerCase())) {
      // we can open this file in a tab without downloading it
      // add to sent files list
      $('#sentFilesList').append(
        (`<span class="fileShareRow">
        <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
        <span class="fileShareFiller"></span>
        <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
          <a class="btn pull-right fileshareButton sentFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton sentFilesViewBtn" data-toggle="tooltip" data-container="body" title="View file in new tab" target="_blank" href="./viewFile?id=${data.id}" role="button" aria-label="View ${data.original_filename} in new tab"><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        </span>`)
      );
    } else {
      // we cannot open this file in a tab without downloading it
      // add to sent files list
      $('#sentFilesList').append(
        (`<span class="fileShareRow">
        <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
        <span class="fileShareFiller"></span>
        <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
          <a class="btn pull-right fileshareButton sentFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
          <a class="btn pull-right fileshareButton sentFilesViewBtn" data-toggle="tooltip" data-container="body" title="Download this file to view it" aria-label="Download ${data.original_filename} to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
        </span>
        </span>`)
      );
    }
  } else {
    // file type isn't in the file name-- cannot open the file in a new tab
    // add to sent files list
    $('#sentFilesList').append(
      (`<span class="fileShareRow">
      <span class="fileShareCellFilename chat-body1" data-toggle="tooltip" title="${filename}">${filename}</span>
      <span class="fileShareFiller"></span>
      <span class="btn-toolbar pull-right fileShareCellBtn" role="toolbar">
        <a class="btn pull-right fileshareButton sentFilesDownloadBtn" data-toggle="tooltip" data-container="body" title="Download" target="_blank" href="./downloadFile?id=${data.id}" role="button" aria-label="Download ${data.original_filename}"><i class="fa fa-download fileShareIcon"></i></a>
        <a class="btn pull-right fileshareButton sentFilesViewBtn" data-toggle="tooltip" data-container="body" title="Download this file to view it" aria-label="Download ${data.original_filename} to view it" disabled><i class="fa fa-eye fileShareIcon"></i></a>
      </span>
      </span>`)
    );
  }

  // need to call this every time we add a new tooltip
  $('.sentFilesDownloadBtn').tooltip({
    trigger: 'hover',
    viewport: $('.sentFilesDownloadBtn')
  });
  $('.sentFilesViewBtn').tooltip({
    trigger: 'hover',
    viewport: $('.sentFilesViewBtn')
  });

  $('.fileShareCellFilename').tooltip({
    trigger: 'hover',
    viewport: $('.fileShareCellFilename')
  });
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
      $('#newchatmessage').css('height', '0px');
      $('#newchatmessage').css('height', `${$('#newchatmessage')[0].scrollHeight}px`);
    }
  }
}

function setFontSize(size) {
  $('.fontSizeButtons').blur();
  const currentFontSize = $('.currentFontSize').text().split('%')[0];
  const newFontSize = Number(currentFontSize) + size;
  const body1FontSizeInPx = (16 * newFontSize) / 100; // 16px is the default font size for body1
  const body2FontSizeInPx = (14 * newFontSize) / 100; // 14px is the default font size for body2
  body1globalFontSize = body1FontSizeInPx;
  body2globalFontSize = body2FontSizeInPx;

  if ((newFontSize >= 50 && size === -10) || (newFontSize <= 200 && size === 10)) {
    if (newFontSize >= 80 && newFontSize <= 150) {
      setOtherFontSize(size);
    }

    $('.tabFontSize').css('font-size', `${body1FontSizeInPx.toString()}px`);
    $('.chat-body1').css('font-size', `${body1FontSizeInPx.toString()}px`);
    $('.chat-body2').css('font-size', `${body2FontSizeInPx.toString()}px`);

    $('.currentFontSize').text(`${newFontSize.toString()}%`);
  }
}

$('#collapseButton').on('keydown', (e) => {
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
    // $('#tab-options').css('padding-left', '');

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

        // reset the unread files count
        unreadFiles = 0;
        $('#unreadFilesBadge').text('');
        openTab = 'fileShare';
      } else if (tab === 'chatTab') {
        $('#chatBody').addClass('active');
        $('#chatTab').addClass('active');
        $('#chatTab').attr('aria-selected', 'true');
        $('#fileShareTab').attr('aria-selected', 'false');
        $('#tab1').addClass('active');

        // reset the unread messages count
        unreadMessages = 0;
        $('#unreadMessagesBadge').text('');
        openTab = 'chat';
        $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
      }
    } else {
      // default to chat tab
      $('#chatTab').addClass('active');
      $('#chatBody').addClass('active');
      $('#chatTab').attr('aria-selected', 'true');
      $('#fileShareTab').attr('aria-selected', 'false');
      $('#tab1').addClass('active');

      // reset the unread messages count
      unreadMessages = 0;
      $('#unreadMessagesBadge').text('');
      openTab = 'chat';
      $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
    }

    // $('.sidebarTab').css('width', '8vw');

    $('#callFeaturesColumn').removeClass('col-xs-1');
    $('#callFeaturesColumn').addClass('col-xs-4');
    $('#callVideoColumn').removeClass('col-xs-11');
    $('#callVideoColumn').addClass('col-xs-8');
    $('#tab-options').removeClass('collapsedTabWidth');

    $('#callFeaturesColumn').css('border-left', '1px solid #ddd');
    $('#callFeaturesColumn').css('padding-left', '');
    $('#callFeaturesColumn').css('padding-right', '');

    $('#collapseButtonIcon').removeClass('fa fa-angle-double-left');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-right');

    // update the collapse button tooltip
    $('#collapseButton').attr('data-original-title', 'Collapse').parent().find('.tooltip-inner')
      .html('Collapse');
    if (tab === '') {
      $('#collapseButton').tooltip('show');
    }

    $('#remoteViewCol').css('height', '');
    $('#remoteView').css('height', '');
    $('#remoteView').css('width', '');
    $('#tabRightGroup').addClass('tabsWidthClass');
    setColumnSize();
  } else {
    // close the sidebar
    isSidebarCollapsed = true;
    openTab = '';
    $('#collapseButton').attr('aria-label', 'Expand Sidebar');
    $('#collapseTabTitle').attr('title', 'Expand Sidebar');
    $('#collapseButton').attr('aria-expanded', 'false');
    $('.tab-content').attr('hidden', true);
    $('#tab-pane').attr('hidden', true);
    $('#tab-options').css('padding-left', '0px');
    $('li').removeClass('active');
    $('.tab-pane').removeClass('active');
    // $('.sidebarTab').css('width', '8.48vw');

    $('#chatTab').attr('aria-selected', 'false');
    $('#fileShareTab').attr('aria-selected', 'false');
    $('#chatTab').attr('tabindex', '0');
    $('#fileShareTab').attr('tabindex', '-1');
    $('#fileShareTab').attr('aria-label', 'Collapsed file share tab');
    $('#chatTab').attr('aria-label', 'Collapsed chat tab');
    $('#callFeaturesColumn').removeClass('col-xs-4');
    $('#callFeaturesColumn').addClass('col-xs-1');
    $('#callVideoColumn').removeClass('col-xs-8');
    $('#callVideoColumn').addClass('col-xs-11');
    $('#tab-options').addClass('collapsedTabWidth');
    $('#tabRightGroup').removeClass('tabsWidthClass');

    $('#callFeaturesColumn').css('border-left', '');
    $('#callFeaturesColumn').css('padding-left', '0px');
    $('#callFeaturesColumn').css('padding-right', '0px');

    // update the collapse button tooltip
    $('#collapseButton').attr('data-original-title', 'Expand').parent().find('.tooltip-inner')
      .html('Expand');
    if (tab === '') {
      $('#collapseButton').tooltip('show');
    }
    $('#collapseButtonIcon').removeClass('fa fa-angle-double-right');
    $('#collapseButtonIcon').addClass('fa fa-angle-double-left');

    // make sure remote video doesn't expand past footer
    setColumnSize();
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
      $('#chatBody').addClass('active');
      $('#tab1').addClass('active');

      $('#fileShareTab').removeClass('active');
      $('#fileShareTab').attr('aria-selected', 'false');

      // reset the unread messages count
      unreadMessages = 0;
      $('#unreadMessagesBadge').text('');
      openTab = 'chat';

      $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
    } else if (tab === 'fileShareTab') {
      $('#fileShareTab').addClass('active');
      $('#fileShareTab').attr('aria-selected', 'true');
      $('#fileBody').addClass('active');
      $('#tab2').addClass('active');

      $('#chatTab').removeClass('active');
      $('#chatTab').attr('aria-selected', 'false');

      // reset the unread messages count
      unreadFiles = 0;
      $('#unreadFilesBadge').text('');
      openTab = 'fileShare';
    }
  }
  setColumnSize();
}

function redirectToVideomail() {
  if (acekurento != null) {
    acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, {
      ended: (_e) => {
        console.log('--Call ended by asterisk, not abandoned--');
        window.location.href = './videomail';
      }
    });
    acekurento.callTransfer('videomail');
  } else {
    window.location.href = './videomail';
  }
}

let recognition = null;
function captionsStart() {
  isCaptioning = true;
  let language = $('#language-select').val();
  switch (language) {
    case 'en': // English US
      language = 'en-US';
      break;
    case 'es': // Spanish (Mexican)
      language = 'es-US';
      break;
    case 'ar': // Arabic (Modern Standard)
      language = 'ar-EG';
      break;
    case 'pt': // Brazilian Portuguese
      language = 'pt-PT';
      break;
    case 'zh': // Chinese (Mandarin)
      language = 'zh';
      break;
    case 'nl': // Dutch
      language = 'nl-NL';
      break;
    case 'fr': // French
      language = 'fr-FR';
      break;
    case 'de': // German
      language = 'de-DE';
      break;
    case 'it': // Italian
      language = 'it-IT';
      break;
    case 'ja': // Japanese
      language = 'ja-JP';
      break;
    case 'ko': // Korean
      language = 'ko-KR';
      break;
    default:
      language = 'en-US';
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.lang = language;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = function (event) {
    if (!isMuted && event && event.results && (event.results.length > 0)) {
      const lastResult = event.results.length - 1;

      socket.emit('caption-consumer', {
        transcript: event.results[lastResult][0].transcript,
        final: event.results[lastResult].isFinal,
        language: language,
        extension: exten
      });
    } else if (isMuted && event?.results && recognitionStarted) {
      // Resend any partial captions as Final
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal) {
          transcript += (event.results[i][0].transcript);
        }
      }

      if (transcript === '') {
        // If speaking slowly, the caption will be set to final. Make sure it still gets sent
        var lastResult = event.results.length - 1;
        transcript = event.results[lastResult][0].transcript;
      }

      socket.emit('caption-consumer', {
        transcript: transcript,
        final: true,
        language: language,
        extension: exten
      });
      captionsEnd();
    }
  };

  recognition.onend = function (_event) {
    if (!isMuted) {
      captionsStart();
    } else {
      captionsEnd();
    }
  };
  recognitionStarted = true;
  recognition.start();
}

function captionsEnd() {
  isCaptioning = false;
  if (recognition) {
    recognition.abort();
  }
  recognition = null;
  recognitionStarted = false;
}
