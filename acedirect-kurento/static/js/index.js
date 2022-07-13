let acekurento;
let stunServerFqdn;
let stunServerPort;
let turnServerFqdn;
let turnServerPort;
let turnServerUser;
let turnServerPass;
window.onload = function () {
  console = new Console();
  // setRegisterState(NOT_REGISTERED);
  acekurento = new ACEKurento({ acekurentoSignalingUrl: `wss://${window.location.host}${window.location.pathname}signaling` });
  const drag = new Draggabilly(document.getElementById('videoSmall'));
  let incomingCall = null;
  let peerOnHold = false;
  let recording = false;
  let privateMode = false;
  let privateIndex = 0;
  const privateMedia = [
    `https://${window.location.host}${window.location.pathname}img/private.mp4` // URL relative to Kurento on Docker
  ];

  acekurento.remoteStream = document.getElementById('videoOutput');
  acekurento.selfStream = document.getElementById('videoInput');

  document.getElementById('ext').focus();

  document.getElementById('register').addEventListener('click', () => {
    stunServerFqdn = document.getElementById('stun-server-fqdn').value;
    stunServerPort = document.getElementById('stun-server-port').value;
    turnServerFqdn = document.getElementById('turn-server-fqdn').value;
    turnServerPort = document.getElementById('turn-server-port').value;
    turnServerUser = document.getElementById('turn-server-username').value;
    turnServerPass = document.getElementById('turn-server-password').value;
    acekurento.register(document.getElementById('ext').value, document.getElementById('password').value, document.getElementById('isAgent').checked);
  });
  document.getElementById('loopback').addEventListener('click', () => {
    stunServerFqdn = document.getElementById('stun-server-fqdn').value;
    stunServerPort = document.getElementById('stun-server-port').value;
    turnServerFqdn = document.getElementById('turn-server-fqdn').value;
    turnServerPort = document.getElementById('turn-server-port').value;
    turnServerUser = document.getElementById('turn-server-username').value;
    turnServerPass = document.getElementById('turn-server-password').value;
    // generate a loopback call with random extension
    acekurento.loopback(Math.floor(Math.random() * Math.floor(1000)));
  });
  document.getElementById('call').addEventListener('click', () => {
    acekurento.call(
      document.getElementById('peer').value,
      document.getElementById('skipQueue').checked
    );
  });
  document.getElementById('terminate').addEventListener('click', () => {
    acekurento.stop(false);
  });
  document.getElementById('hold').addEventListener('click', function () {
    this.setAttribute('disabled', '');
    if (peerOnHold) {
      acekurento.unhold((success) => {
        peerOnHold = false;
        this.removeAttribute('disabled');
        if (success) {
          document.getElementById('hold-lbl').innerHTML = 'Hold';
        }
      });
    } else {
      acekurento.hold((success) => {
        peerOnHold = true;
        this.removeAttribute('disabled');
        if (success) {
          document.getElementById('hold-lbl').innerHTML = 'Unhold';
        }
      });
    }
  });
  document.getElementById('accept').addEventListener('click', () => {
    incomingCall && incomingCall.accept();
    document.getElementById('prompt').style.visibility = 'hidden';
  });
  document.getElementById('reject').addEventListener('click', () => {
    incomingCall && incomingCall.reject();
    document.getElementById('prompt').style.visibility = 'hidden';
  });
  document.getElementById('agentAway').addEventListener('click', () => {
    const away = document.getElementById('agentAway').checked;
    console.log('AWAY:', away);
    // activate/deactivate active member from queue
    if (away) {
      acekurento.pauseQueue();
    } else {
      acekurento.unpauseQueue();
    }
  });

  document.getElementById('record').addEventListener('click', () => {
    if (recording) {
      acekurento.stopRecording();
    } else {
      acekurento.startRecording();
    }
  });

  document.getElementById('private').addEventListener('click', () => {
    if (privateMode) {
      acekurento.privateMode(false);
    } else {
      if (privateIndex >= privateMedia.length) privateIndex = 0;
      acekurento.privateMode(true, privateMedia[privateIndex++]);
    }
    privateMode = !privateMode;
  });

  document.getElementById('invite').addEventListener('click', (evt) => {
    evt.preventDefault();
    acekurento.invitePeer(document.getElementById('peer').value);
  });

  document.getElementById('sipReinvite').addEventListener('click', () => {
    acekurento.sipReinvite();
  });

  document.getElementById('screenShare').addEventListener('click', () => {
    if (acekurento.isScreensharing) {
      acekurento.screenshare(false);
    } else {
      acekurento.screenshare(true);
    }
  });

  document.getElementById('transfer').addEventListener('click', (_evt) => {
    // evt.preventDefault();
    acekurento.callTransfer(document.getElementById('peer').value, false);
  });

  document.getElementById('sendText').addEventListener('click', (_evt) => {
    const target = document.getElementById('peer').value;
    const body = document.getElementById('text_message').value;

    acekurento.sendSIPInstantMessage(target, body);
  });

  // Events
  const eventHandlers = {
    connected: function (_e) {
      console.log('--- Connected ---\n');
    },

    registerResponse: function (error) {
      console.log('--- Register response:', error || 'Success ---');
      if (!error) {
        document.getElementById('agentAwayConf').classList.remove('invisible');
      }
    },

    pausedQueue: function (_e) {
      console.log('--- Paused Agent Member in Queue ---\n');
    },

    unpausedQueue: function (_e) {
      console.log('--- Unpaused Agent Member in Queue ---\n');
    },

    callResponse: function (e) {
      console.log('--- Call response ---\n', e);
    },

    incomingCall: function (call) {
      console.log('--- Incoming call ---\n');
      document.getElementById('prompt').style.visibility = 'visible';
      document.getElementById('from').innerHTML = call.from;
      incomingCall = call;
    },

    progress: function (_e) {
      console.log('--- Calling... ---\n');
    },

    sipConfirmed: function (_e) {
      console.log('--- SIP ACK ---');
      // acekurento.sipReinvite();
    },

    startedRecording: function (e) {
      console.log('--- Started Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        recording = true;
        document.getElementById('record-lbl').innerHTML = 'Stop Recording';
      }
    },

    stoppedRecording: function (e) {
      console.log('--- Stopped Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        recording = false;
        document.getElementById('record-lbl').innerHTML = 'Record';
      }
    },

    failed: function (e) {
      console.log(`--- Failed ---\n${e}`);
    },

    ended: function (e) {
      const pNode = document.getElementById('participants');
      while (pNode.firstChild) {
        pNode.removeChild(pNode.firstChild);
      }
      console.log(`--- Call ended [${e.reason}] ---\n`);
    },

    inviteResponse: function (e) {
      console.log('--- Invite response (multiparty) ---\n', e);
    },

    callTransferResponse: function (e) {
      console.log('--- Call transfer response ---\n', e);
    },

    sipReinviteResponse: function (e) {
      console.log('--- Re-Invite response:', (e.success) ? 'Success ---' : 'Error ---');
    },

    sipUpdateResponse: function (e) {
      console.log('--- Update response:', (e.success) ? 'Success ---' : 'Error ---');
    },

    newMessage: function (e) {
      console.log(`--- New Message ---\n${JSON.stringify(e.msg)}`);
    },

    participantsUpdate: function (e) {
      const pNode = document.getElementById('participants');
      while (pNode.firstChild) {
        pNode.removeChild(pNode.firstChild);
      }

      for (let i = 0; i < e.participants.length; i++) {
        const p = e.participants[i];
        const li = document.createElement('li');
        const type = p.type.split(':');
        const hold = p.onHold ? 'Yes' : 'No';
        const txt = document.createTextNode(`${p.ext}: ${type[1].toUpperCase()}, on hold: ${hold}`);
        li.appendChild(txt);
        pNode.appendChild(li);
      }
    }
  };

  acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);

  // MUTE/UNMUTE AUDIO/VIDEO
  const audioChk = document.getElementById('audioChk');
  const videoChk = document.getElementById('videoChk');

  audioChk.onclick = function () {
    acekurento.enableDisableTrack(audioChk.checked, true);
  };
  videoChk.onclick = function () {
    acekurento.enableDisableTrack(videoChk.checked, false);
  };

  if (window.URLSearchParams) {
    const q = new URLSearchParams(window.location.search);
    const ext = q.get('ext');
    if (ext) {
      document.getElementById('ext').value = ext;
    }
    const peer = q.get('peer');
    if (peer) {
      document.getElementById('peer').value = peer;
    }
  }
};
