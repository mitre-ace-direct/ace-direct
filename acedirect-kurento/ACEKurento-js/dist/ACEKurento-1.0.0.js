/*!
 * @license ACEDirect v1.0.0
 * Copyright 2019 ACEDirect. All Rights Reserved.
 */
(function (f) { if (typeof exports === "object" && typeof module !== "undefined") { module.exports = f(); } else if (typeof define === "function" && define.amd) { define([], f); } else { let g; if (typeof window !== "undefined") { g = window; } else if (typeof global !== "undefined") { g = global; } else if (typeof self !== "undefined") { g = self; } else { g = this; }g.kurentoUtils = f(); } })(function () { let define; let module; let exports; return (function () { function r(e, n, t) { function o(i, f) { if (!n[i]) { if (!e[i]) { const c = "function" == typeof require && require; if (!f && c) return c(i, !0); if (u) return u(i, !0); const a = new Error(`Cannot find module '${i}'`); throw a.code = "MODULE_NOT_FOUND", a; } const p = n[i] = { exports: {} }; e[i][0].call(p.exports, (r) => { const n = e[i][1][r]; return o(n || r); }, p, p.exports, r, e, n, t); } return n[i].exports; } for (let u = "function" == typeof require && require, i = 0; i < t.length; i++)o(t[i]); return o; } return r; })()({ 1: [function (require, module, exports) {
  const freeice = require('freeice');
  const inherits = require('inherits');
  const UAParser = require('ua-parser-js');
  const uuid = require('uuid');
  const hark = require('hark');
  const EventEmitter = require('events').EventEmitter;
  const recursive = require('merge').recursive.bind(undefined, true);
  const sdpTranslator = require('sdp-translator');
  const logger = window.Logger || console;
  // Do not use plugin for screenshare
  // try {
  //   require('kurento-browser-extensions');
  // } catch (error) {
  //   if (typeof getScreenConstraints === 'undefined') {
  //     logger.warn('screen sharing is not available');
  //     getScreenConstraints = function getScreenConstraints(sendSource, callback) {
  //       callback(new Error('This library is not enabled for screen sharing'));
  //     };
  //   }
  // }
  const MEDIA_CONSTRAINTS = {
    audio: true,
    video: {
      width: 640,
      framerate: 15
    }
  };
  const ua = window && window.navigator ? window.navigator.userAgent : '';
  const parser = new UAParser(ua);
  const browser = parser.getBrowser();
  let usePlanB = false;
  if (browser.name === 'Chrome' || browser.name === 'Chromium') {
    logger.debug(`${browser.name}: using SDP PlanB`);
    usePlanB = true;
  }
  function noop(error) {
    if (error) { logger.error(error); }
  }
  function trackStop(track) {
    track.stop && track.stop();
  }
  function streamStop(stream) {
    stream.getTracks().forEach(trackStop);
  }
  const dumpSDP = function (description) {
    if (typeof description === 'undefined' || description === null) {
      return '';
    }
    return `type: ${description.type}\r\n${description.sdp}`;
  };
  function bufferizeCandidates(pc, onerror) {
    const candidatesQueue = [];
    pc.addEventListener('signalingstatechange', function () {
      if (this.signalingState === 'stable') {
        while (candidatesQueue.length) {
          const entry = candidatesQueue.shift();
          pc.addIceCandidate(entry.candidate, entry.callback, entry.callback);
        }
      }
    });
    return function (candidate, callback) {
      callback = callback || onerror;
      switch (pc.signalingState) {
        case 'closed':
          callback(new Error('PeerConnection object is closed'));
          break;
        case 'stable':
          if (pc.remoteDescription) {
            pc.addIceCandidate(candidate, callback, callback);
            break;
          }
        default:
          candidatesQueue.push({
            candidate: candidate,
            callback: callback
          });
      }
    };
  }
  function removeFIDFromOffer(sdp) {
    const n = sdp.indexOf('a=ssrc-group:FID');
    if (n > 0) {
      return sdp.slice(0, n);
    } else {
      return sdp;
    }
  }
  function getSimulcastInfo(videoStream) {
    const videoTracks = videoStream.getVideoTracks();
    if (!videoTracks.length) {
      logger.warn('No video tracks available in the video stream');
      return '';
    }
    const lines = [
      'a=x-google-flag:conference',
      'a=ssrc-group:SIM 1 2 3',
      'a=ssrc:1 cname:localVideo',
      `a=ssrc:1 msid:${videoStream.id} ${videoTracks[0].id}`,
      `a=ssrc:1 mslabel:${videoStream.id}`,
      `a=ssrc:1 label:${videoTracks[0].id}`,
      'a=ssrc:2 cname:localVideo',
      `a=ssrc:2 msid:${videoStream.id} ${videoTracks[0].id}`,
      `a=ssrc:2 mslabel:${videoStream.id}`,
      `a=ssrc:2 label:${videoTracks[0].id}`,
      'a=ssrc:3 cname:localVideo',
      `a=ssrc:3 msid:${videoStream.id} ${videoTracks[0].id}`,
      `a=ssrc:3 mslabel:${videoStream.id}`,
      `a=ssrc:3 label:${videoTracks[0].id}`
    ];
    lines.push('');
    return lines.join('\n');
  }
  function WebRtcPeer(mode, options, callback) {
    if (!(this instanceof WebRtcPeer)) {
      return new WebRtcPeer(mode, options, callback);
    }
    WebRtcPeer.super_.call(this);
    if (options instanceof Function) {
      callback = options;
      options = undefined;
    }
    options = options || {};
    callback = (callback || noop).bind(this);
    const self = this;
    const localVideo = options.localVideo;
    const remoteVideo = options.remoteVideo;
    let videoStream = options.videoStream;
    let audioStream = options.audioStream;
    const mediaConstraints = options.mediaConstraints;
    const connectionConstraints = options.connectionConstraints;
    let pc = options.peerConnection;
    const sendSource = options.sendSource || 'webcam';
    const dataChannelConfig = options.dataChannelConfig;
    const useDataChannels = options.dataChannels || false;
    let dataChannel;
    const guid = uuid.v4();
    const configuration = recursive({ iceServers: freeice() }, options.configuration);
    const onicecandidate = options.onicecandidate;
    if (onicecandidate) { this.on('icecandidate', onicecandidate); }
    const oncandidategatheringdone = options.oncandidategatheringdone;
    if (oncandidategatheringdone) {
      this.on('candidategatheringdone', oncandidategatheringdone);
    }
    const simulcast = options.simulcast;
    const multistream = options.multistream;
    const interop = new sdpTranslator.Interop();
    const candidatesQueueOut = [];
    let candidategatheringdone = false;
    Object.defineProperties(this, {
      peerConnection: {
        get: function () {
          return pc;
        }
      },
      id: {
        value: options.id || guid,
        writable: false
      },
      remoteVideo: {
        get: function () {
          return remoteVideo;
        }
      },
      localVideo: {
        get: function () {
          return localVideo;
        }
      },
      dataChannel: {
        get: function () {
          return dataChannel;
        }
      },
      currentFrame: {
        get: function () {
          if (!remoteVideo) { return; }
          if (remoteVideo.readyState < remoteVideo.HAVE_CURRENT_DATA) { throw new Error('No video stream data available'); }
          const canvas = document.createElement('canvas');
          canvas.width = remoteVideo.videoWidth;
          canvas.height = remoteVideo.videoHeight;
          canvas.getContext('2d').drawImage(remoteVideo, 0, 0);
          return canvas;
        }
      }
    });
    if (!pc) {
      pc = new RTCPeerConnection(configuration);
      if (useDataChannels && !dataChannel) {
        let dcId = `WebRtcPeer-${self.id}`;
        let dcOptions = undefined;
        if (dataChannelConfig) {
          dcId = dataChannelConfig.id || dcId;
          dcOptions = dataChannelConfig.options;
        }
        dataChannel = pc.createDataChannel(dcId, dcOptions);
        if (dataChannelConfig) {
          dataChannel.onopen = dataChannelConfig.onopen;
          dataChannel.onclose = dataChannelConfig.onclose;
          dataChannel.onmessage = dataChannelConfig.onmessage;
          dataChannel.onbufferedamountlow = dataChannelConfig.onbufferedamountlow;
          dataChannel.onerror = dataChannelConfig.onerror || noop;
        }
      }
    }
    pc.addEventListener('icecandidate', (event) => {
      const candidate = event.candidate;
      if (EventEmitter.listenerCount(self, 'icecandidate') || EventEmitter.listenerCount(self, 'candidategatheringdone')) {
        if (candidate) {
          let cand;
          if (multistream && usePlanB) {
            cand = interop.candidateToUnifiedPlan(candidate);
          } else {
            cand = candidate;
          }
          self.emit('icecandidate', cand);
          candidategatheringdone = false;
        } else if (!candidategatheringdone) {
          self.emit('candidategatheringdone');
          candidategatheringdone = true;
        }
      } else if (!candidategatheringdone) {
        candidatesQueueOut.push(candidate);
        if (!candidate) { candidategatheringdone = true; }
      }
    });
    pc.onaddstream = options.onaddstream;
    pc.onnegotiationneeded = options.onnegotiationneeded;
    this.on('newListener', (event, listener) => {
      if (event === 'icecandidate' || event === 'candidategatheringdone') {
        while (candidatesQueueOut.length) {
          const candidate = candidatesQueueOut.shift();
          if (!candidate === (event === 'candidategatheringdone')) {
            listener(candidate);
          }
        }
      }
    });
    const addIceCandidate = bufferizeCandidates(pc);
    this.addIceCandidate = function (iceCandidate, callback) {
      let candidate;
      if (multistream && usePlanB) {
        candidate = interop.candidateToPlanB(iceCandidate);
      } else {
        candidate = new RTCIceCandidate(iceCandidate);
      }
      logger.debug('Remote ICE candidate received', iceCandidate);
      callback = (callback || noop).bind(this);
      addIceCandidate(candidate, callback);
    };
    this.generateOffer = function (callback) {
      callback = callback.bind(this);
      let offerAudio = true;
      let offerVideo = true;
      if (mediaConstraints) {
        offerAudio = typeof mediaConstraints.audio === 'boolean' ? mediaConstraints.audio : true;
        offerVideo = typeof mediaConstraints.video === 'boolean' ? mediaConstraints.video : true;
      }
      const browserDependantConstraints = {
        offerToReceiveAudio: mode !== 'sendonly' && offerAudio,
        offerToReceiveVideo: mode !== 'sendonly' && offerVideo
      };
      const constraints = browserDependantConstraints;
      logger.debug(`constraints: ${JSON.stringify(constraints)}`);
      pc.createOffer(constraints).then((offer) => {
        logger.debug('Created SDP offer');
        offer = mangleSdpToAddSimulcast(offer);
        return pc.setLocalDescription(offer);
      }).then(() => {
        let localDescription = pc.localDescription;
        logger.debug('Local description set', localDescription.sdp);
        if (multistream && usePlanB) {
          localDescription = interop.toUnifiedPlan(localDescription);
          logger.debug('offer::origPlanB->UnifiedPlan', dumpSDP(localDescription));
        }
        callback(null, localDescription.sdp, self.processAnswer.bind(self));
      }).catch(callback);
    };
    this.getLocalSessionDescriptor = function () {
      return pc.localDescription;
    };
    this.getRemoteSessionDescriptor = function () {
      return pc.remoteDescription;
    };
    function setRemoteVideo() {
      if (remoteVideo) {
        remoteVideo.pause();
        const stream = pc.getRemoteStreams()[0];
        remoteVideo.srcObject = stream;
        logger.debug('Remote stream:', stream);
        remoteVideo.load();
      }
    }
    this.showLocalVideo = function () {
      localVideo.srcObject = videoStream;
      localVideo.muted = true;
    };
    this.send = function (data) {
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(data);
      } else {
        logger.warn('Trying to send data over a non-existing or closed data channel');
      }
    };
    this.processAnswer = function (sdpAnswer, callback) {
      callback = (callback || noop).bind(this);
      let answer = new RTCSessionDescription({
        type: 'answer',
        sdp: sdpAnswer
      });
      if (multistream && usePlanB) {
        const planBAnswer = interop.toPlanB(answer);
        logger.debug('asnwer::planB', dumpSDP(planBAnswer));
        answer = planBAnswer;
      }
      logger.debug('SDP answer received, setting remote description');
      if (pc.signalingState === 'closed') {
        return callback('PeerConnection is closed');
      }
      pc.setRemoteDescription(answer, () => {
        setRemoteVideo();
        callback();
      }, callback);
    };
    this.processOffer = function (sdpOffer, callback) {
      callback = callback.bind(this);
      let offer = new RTCSessionDescription({
        type: 'offer',
        sdp: sdpOffer
      });
      if (multistream && usePlanB) {
        const planBOffer = interop.toPlanB(offer);
        logger.debug('offer::planB', dumpSDP(planBOffer));
        offer = planBOffer;
      }
      logger.debug('SDP offer received, setting remote description');
      if (pc.signalingState === 'closed') {
        return callback('PeerConnection is closed');
      }
      pc.setRemoteDescription(offer).then(() => {
        return setRemoteVideo();
      }).then(() => {
        return pc.createAnswer();
      }).then((answer) => {
        answer = mangleSdpToAddSimulcast(answer);
        logger.debug('Created SDP answer');
        return pc.setLocalDescription(answer);
      })
        .then(() => {
          let localDescription = pc.localDescription;
          if (multistream && usePlanB) {
            localDescription = interop.toUnifiedPlan(localDescription);
            logger.debug('answer::origPlanB->UnifiedPlan', dumpSDP(localDescription));
          }
          logger.debug('Local description set', localDescription.sdp);
          callback(null, localDescription.sdp);
        })
        .catch(callback);
    };
    function mangleSdpToAddSimulcast(answer) {
      if (simulcast) {
        if (browser.name === 'Chrome' || browser.name === 'Chromium') {
          logger.debug('Adding multicast info');
          answer = new RTCSessionDescription({
            type: answer.type,
            sdp: removeFIDFromOffer(answer.sdp) + getSimulcastInfo(videoStream)
          });
        } else {
          logger.warn('Simulcast is only available in Chrome browser.');
        }
      }
      return answer;
    }
    function start() {
      if (pc.signalingState === 'closed') {
        callback('The peer connection object is in "closed" state. This is most likely due to an invocation of the dispose method before accepting in the dialogue');
      }
      if (videoStream && localVideo) {
        self.showLocalVideo();
      }
      if (videoStream) {
        pc.addStream(videoStream);
      }
      if (audioStream) {
        pc.addStream(audioStream);
      }
      const browser = parser.getBrowser();
      if (mode === 'sendonly' && (browser.name === 'Chrome' || browser.name === 'Chromium') && browser.major === 39) {
        mode = 'sendrecv';
      }
      callback();
    }
    if (mode !== 'recvonly' && !videoStream && !audioStream) {
      function getMedia(constraints) {
        if (constraints === undefined) {
          constraints = MEDIA_CONSTRAINTS;
        }
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
          videoStream = stream;
          start();
        }).catch(callback);
      }
      if (sendSource === 'webcam') {
        getMedia(mediaConstraints);
      } else {
        if (navigator.getDisplayMedia) {
          navigator.getDisplayMedia({ video: true, audio: true }).then((stream) => {
            videoStream = stream;
            navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((aStream) => {
              audioStream = aStream;
              start();
            }).catch(callback);
          }).catch(callback);
        } else if (navigator.mediaDevices.getDisplayMedia) {
          navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then((stream) => {
            videoStream = stream;
            navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((aStream) => {
              audioStream = aStream;
              start();
            }).catch(callback);
          }).catch(callback);
        } else {
          logger.warn('This browser does not support getDisplayMedia, screen share might fail');
          mediaConstraints.video = { mediaSource: 'screen' };
          getMedia(mediaConstraints);
        }
        // No plugin
        // getScreenConstraints(sendSource, function (error, constraints_) {
        //   if (error)
        //     return callback(error);
        //   constraints = [mediaConstraints];
        //   constraints.unshift(constraints_);
        //   getMedia(recursive.apply(undefined, constraints));
        // }, guid);
      }
    } else {
      setTimeout(start, 0);
    }
    this.on('_dispose', () => {
      if (localVideo) {
        localVideo.pause();
        localVideo.srcObject = null;
        localVideo.load();
        localVideo.muted = false;
      }
      if (remoteVideo) {
        remoteVideo.pause();
        remoteVideo.srcObject = null;
        remoteVideo.load();
      }
      self.removeAllListeners();
      if (window.cancelChooseDesktopMedia !== undefined) {
        window.cancelChooseDesktopMedia(guid);
      }
    });
  }
  inherits(WebRtcPeer, EventEmitter);
  function createEnableDescriptor(type) {
    const method = `get${type}Tracks`;
    return {
      enumerable: true,
      get: function () {
        if (!this.peerConnection) { return; }
        const streams = this.peerConnection.getLocalStreams();
        if (!streams.length) { return; }
        for (let i = 0, stream; stream = streams[i]; i++) {
          const tracks = stream[method]();
          for (let j = 0, track; track = tracks[j]; j++) {
            if (!track.enabled) return false;
          }
        }
        return true;
      },
      set: function (value) {
        function trackSetEnable(track) {
          track.enabled = value;
        }
        this.peerConnection.getLocalStreams().forEach((stream) => {
          stream[method]().forEach(trackSetEnable);
        });
      }
    };
  }
  Object.defineProperties(WebRtcPeer.prototype, {
    enabled: {
      enumerable: true,
      get: function () {
        return this.audioEnabled && this.videoEnabled;
      },
      set: function (value) {
        this.audioEnabled = this.videoEnabled = value;
      }
    },
    audioEnabled: createEnableDescriptor('Audio'),
    videoEnabled: createEnableDescriptor('Video')
  });
  WebRtcPeer.prototype.getLocalStream = function (index) {
    if (this.peerConnection) {
      return this.peerConnection.getLocalStreams()[index || 0];
    }
  };
  WebRtcPeer.prototype.getRemoteStream = function (index) {
    if (this.peerConnection) {
      return this.peerConnection.getRemoteStreams()[index || 0];
    }
  };
  WebRtcPeer.prototype.dispose = function () {
    logger.debug('Disposing WebRtcPeer');
    const pc = this.peerConnection;
    const dc = this.dataChannel;
    try {
      if (dc) {
        if (dc.signalingState === 'closed') { return; }
        dc.close();
      }
      if (pc) {
        if (pc.signalingState === 'closed') { return; }
        pc.getLocalStreams().forEach(streamStop);
        pc.close();
      }
    } catch (err) {
      logger.warn(`Exception disposing webrtc peer ${err}`);
    }
    this.emit('_dispose');
  };
  function WebRtcPeerRecvonly(options, callback) {
    if (!(this instanceof WebRtcPeerRecvonly)) {
      return new WebRtcPeerRecvonly(options, callback);
    }
    WebRtcPeerRecvonly.super_.call(this, 'recvonly', options, callback);
  }
  inherits(WebRtcPeerRecvonly, WebRtcPeer);
  function WebRtcPeerSendonly(options, callback) {
    if (!(this instanceof WebRtcPeerSendonly)) {
      return new WebRtcPeerSendonly(options, callback);
    }
    WebRtcPeerSendonly.super_.call(this, 'sendonly', options, callback);
  }
  inherits(WebRtcPeerSendonly, WebRtcPeer);
  function WebRtcPeerSendrecv(options, callback) {
    if (!(this instanceof WebRtcPeerSendrecv)) {
      return new WebRtcPeerSendrecv(options, callback);
    }
    WebRtcPeerSendrecv.super_.call(this, 'sendrecv', options, callback);
  }
  inherits(WebRtcPeerSendrecv, WebRtcPeer);
  function harkUtils(stream, options) {
    return hark(stream, options);
  }
  exports.bufferizeCandidates = bufferizeCandidates;
  exports.WebRtcPeerRecvonly = WebRtcPeerRecvonly;
  exports.WebRtcPeerSendonly = WebRtcPeerSendonly;
  exports.WebRtcPeerSendrecv = WebRtcPeerSendrecv;
  exports.hark = harkUtils;
}, {
  events: 4, freeice: 5, hark: 8, inherits: 9, 'kurento-browser-extensions': 10, merge: 11, 'sdp-translator': 18, 'ua-parser-js': 21, uuid: 23
}],
2: [function (require, module, exports) {
  if (window.addEventListener) { module.exports = require('./index'); }
}, { './index': 3 }],
3: [function (require, module, exports) {
  const WebRtcPeer = require('./WebRtcPeer');
  exports.WebRtcPeer = WebRtcPeer;
}, { './WebRtcPeer': 1 }],
4: [function (require, module, exports) {
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

  function EventEmitter() {
    this._events = this._events || {};
    this._maxListeners = this._maxListeners || undefined;
  }
  module.exports = EventEmitter;

  // Backwards-compat with node 0.10.x
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function (n) {
    if (!isNumber(n) || n < 0 || isNaN(n)) { throw TypeError('n must be a positive number'); }
    this._maxListeners = n;
    return this;
  };

  EventEmitter.prototype.emit = function (type) {
    let er;
    var handler;
    let len;
    let args;
    let i;
    let listeners;

    if (!this._events) { this._events = {}; }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      if (!this._events.error
      || (isObject(this._events.error) && !this._events.error.length)) {
        er = arguments[1];
        if (er instanceof Error) {
          throw er; // Unhandled 'error' event
        } else {
          // At least give some kind of context to the user
          const err = new Error(`Uncaught, unspecified "error" event. (${er})`);
          err.context = er;
          throw err;
        }
      }
    }

    handler = this._events[type];

    if (isUndefined(handler)) { return false; }

    if (isFunction(handler)) {
      switch (arguments.length) {
      // fast cases
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
          // slower
        default:
          args = Array.prototype.slice.call(arguments, 1);
          handler.apply(this, args);
      }
    } else if (isObject(handler)) {
      args = Array.prototype.slice.call(arguments, 1);
      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++) { listeners[i].apply(this, args); }
    }

    return true;
  };

  EventEmitter.prototype.addListener = function (type, listener) {
    let m;

    if (!isFunction(listener)) { throw TypeError('listener must be a function'); }

    if (!this._events) { this._events = {}; }

    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (this._events.newListener) {
      this.emit('newListener', type,
        isFunction(listener.listener)
          ? listener.listener : listener);
    }

    if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    } else if (isObject(this._events[type])) {
    // If we've already got an array, just append.
      this._events[type].push(listener);
    } else {
    // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }

    // Check for listener leak
    if (isObject(this._events[type]) && !this._events[type].warned) {
      if (!isUndefined(this._maxListeners)) {
        m = this._maxListeners;
      } else {
        m = EventEmitter.defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory '
        + 'leak detected. %d listeners added. '
        + 'Use emitter.setMaxListeners() to increase limit.',
        this._events[type].length);
        if (typeof console.trace === 'function') {
          // not supported in IE 10
          console.trace();
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.once = function (type, listener) {
    if (!isFunction(listener)) { throw TypeError('listener must be a function'); }

    let fired = false;

    function g() {
      this.removeListener(type, g);

      if (!fired) {
        fired = true;
        listener.apply(this, arguments);
      }
    }

    g.listener = listener;
    this.on(type, g);

    return this;
  };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener = function (type, listener) {
    var list;
    let position;
    var length;
    let i;

    if (!isFunction(listener)) { throw TypeError('listener must be a function'); }

    if (!this._events || !this._events[type]) { return this; }

    list = this._events[type];
    length = list.length;
    position = -1;

    if (list === listener
    || (isFunction(list.listener) && list.listener === listener)) {
      delete this._events[type];
      if (this._events.removeListener) { this.emit('removeListener', type, listener); }
    } else if (isObject(list)) {
      for (i = length; i-- > 0;) {
        if (list[i] === listener
        || (list[i].listener && list[i].listener === listener)) {
          position = i;
          break;
        }
      }

      if (position < 0) { return this; }

      if (list.length === 1) {
        list.length = 0;
        delete this._events[type];
      } else {
        list.splice(position, 1);
      }

      if (this._events.removeListener) { this.emit('removeListener', type, listener); }
    }

    return this;
  };

  EventEmitter.prototype.removeAllListeners = function (type) {
    let key;
    var listeners;

    if (!this._events) { return this; }

    // not listening for removeListener, no need to emit
    if (!this._events.removeListener) {
      if (arguments.length === 0) {
        this._events = {};
      } else if (this._events[type]) {
        delete this._events[type];
      }
      return this;
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {
      for (key in this._events) {
        if (key === 'removeListener') continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = {};
      return this;
    }

    listeners = this._events[type];

    if (isFunction(listeners)) {
      this.removeListener(type, listeners);
    } else if (listeners) {
      // LIFO order
      while (listeners.length) { this.removeListener(type, listeners[listeners.length - 1]); }
    }
    delete this._events[type];

    return this;
  };

  EventEmitter.prototype.listeners = function (type) {
    let ret;
    if (!this._events || !this._events[type]) {
      ret = [];
    } else if (isFunction(this._events[type])) {
      ret = [this._events[type]];
    } else {
      ret = this._events[type].slice();
    }
    return ret;
  };

  EventEmitter.prototype.listenerCount = function (type) {
    if (this._events) {
      const evlistener = this._events[type];

      if (isFunction(evlistener)) { return 1; } else if (evlistener) { return evlistener.length; }
    }
    return 0;
  };

  EventEmitter.listenerCount = function (emitter, type) {
    return emitter.listenerCount(type);
  };

  function isFunction(arg) {
    return typeof arg === 'function';
  }

  function isNumber(arg) {
    return typeof arg === 'number';
  }

  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }

  function isUndefined(arg) {
    return arg === void 0;
  }
}, {}],
5: [function (require, module, exports) {
  /* jshint node: true */

  'use strict';

  const normalice = require('normalice');

  /**
   # freeice

   The `freeice` module is a simple way of getting random STUN or TURN server
   for your WebRTC application.  The list of servers (just STUN at this stage)
   were sourced from this [gist](https://gist.github.com/zziuni/3741933).

   ## Example Use

   The following demonstrates how you can use `freeice` with
   [rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect):

   <<< examples/quickconnect.js

   As the `freeice` module generates ice servers in a list compliant with the
   WebRTC spec you will be able to use it with raw `RTCPeerConnection`
   constructors and other WebRTC libraries.

   ## Hey, don't use my STUN/TURN server!

   If for some reason your free STUN or TURN server ends up in the
   list of servers ([stun](https://github.com/DamonOehlman/freeice/blob/master/stun.json) or
   [turn](https://github.com/DamonOehlman/freeice/blob/master/turn.json))
   that is used in this module, you can feel
   free to open an issue on this repository and those servers will be removed
   within 24 hours (or sooner).  This is the quickest and probably the most
   polite way to have something removed (and provides us some visibility
   if someone opens a pull request requesting that a server is added).

   ## Please add my server!

   If you have a server that you wish to add to the list, that's awesome! I'm
   sure I speak on behalf of a whole pile of WebRTC developers who say thanks.
   To get it into the list, feel free to either open a pull request or if you
   find that process a bit daunting then just create an issue requesting
   the addition of the server (make sure you provide all the details, and if
   you have a Terms of Service then including that in the PR/issue would be
   awesome).

   ## I know of a free server, can I add it?

   Sure, if you do your homework and make sure it is ok to use (I'm currently
   in the process of reviewing the terms of those STUN servers included from
   the original list).  If it's ok to go, then please see the previous entry
   for how to add it.

   ## Current List of Servers

   * current as at the time of last `README.md` file generation

   ### STUN

   <<< stun.json

   ### TURN

   <<< turn.json

   * */

  const freeice = function (opts) {
    // if a list of servers has been provided, then use it instead of defaults
    const servers = {
      stun: (opts || {}).stun || require('./stun.json'),
      turn: (opts || {}).turn || require('./turn.json')
    };

    const stunCount = (opts || {}).stunCount || 2;
    const turnCount = (opts || {}).turnCount || 1;
    let selected;

    function getServers(type, count) {
      let out = [];
      const input = [].concat(servers[type]);
      let idx;

      while (input.length && out.length < count) {
        idx = (Math.random() * input.length) | 0;
        out = out.concat(input.splice(idx, 1));
      }

      return out.map((url) => {
        // If it's a not a string, don't try to "normalice" it
        // otherwise using type:url will screw it up
        if ((typeof url !== 'string') && (!(url instanceof String))) {
          return url;
        } else {
          return normalice(`${type}:${url}`);
        }
      });
    }

    // add stun servers
    selected = [].concat(getServers('stun', stunCount));

    if (turnCount) {
      selected = selected.concat(getServers('turn', turnCount));
    }

    return selected;
  };

  module.exports = freeice;
}, { './stun.json': 6, './turn.json': 7, normalice: 12 }],
6: [function (require, module, exports) {
  module.exports = [
    'stun.l.google.com:19302',
    'stun1.l.google.com:19302',
    'stun2.l.google.com:19302'
  ];
}, {}],
7: [function (require, module, exports) {
  module.exports = [];
}, {}],
8: [function (require, module, exports) {
  const WildEmitter = require('wildemitter');

  function getMaxVolume(analyser, fftBins) {
    let maxVolume = -Infinity;
    analyser.getFloatFrequencyData(fftBins);

    for (let i = 4, ii = fftBins.length; i < ii; i++) {
      if (fftBins[i] > maxVolume && fftBins[i] < 0) {
        maxVolume = fftBins[i];
      }
    }

    return maxVolume;
  }

  const audioContextType = window.AudioContext || window.webkitAudioContext;
  // use a single audio context due to hardware limits
  let audioContext = null;
  module.exports = function (stream, options) {
    const harker = new WildEmitter();

    // make it not break in non-supported browsers
    if (!audioContextType) return harker;

    // Config
    var options = options || {};
    const smoothing = (options.smoothing || 0.1);
    let interval = (options.interval || 50);
    let threshold = options.threshold;
    let play = options.play;
    const history = options.history || 10;
    let running = true;

    // Setup Audio Context
    if (!audioContext) {
      audioContext = new audioContextType();
    }
    let sourceNode;
    var fftBins;
    var analyser;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = smoothing;
    fftBins = new Float32Array(analyser.fftSize);

    if (stream.jquery) stream = stream[0];
    if (stream instanceof HTMLAudioElement || stream instanceof HTMLVideoElement) {
      // Audio Tag
      sourceNode = audioContext.createMediaElementSource(stream);
      if (typeof play === 'undefined') play = true;
      threshold = threshold || -50;
    } else {
      // WebRTC Stream
      sourceNode = audioContext.createMediaStreamSource(stream);
      threshold = threshold || -50;
    }

    sourceNode.connect(analyser);
    if (play) analyser.connect(audioContext.destination);

    harker.speaking = false;

    harker.setThreshold = function (t) {
      threshold = t;
    };

    harker.setInterval = function (i) {
      interval = i;
    };

    harker.stop = function () {
      running = false;
      harker.emit('volume_change', -100, threshold);
      if (harker.speaking) {
        harker.speaking = false;
        harker.emit('stopped_speaking');
      }
    };
    harker.speakingHistory = [];
    for (let i = 0; i < history; i++) {
      harker.speakingHistory.push(0);
    }

    // Poll the analyser node to determine if speaking
    // and emit events if changed
    const looper = function () {
      setTimeout(() => {
        // check if stop has been called
        if (!running) {
          return;
        }

        const currentVolume = getMaxVolume(analyser, fftBins);

        harker.emit('volume_change', currentVolume, threshold);

        let history = 0;
        if (currentVolume > threshold && !harker.speaking) {
          // trigger quickly, short history
          for (let i = harker.speakingHistory.length - 3; i < harker.speakingHistory.length; i++) {
            history += harker.speakingHistory[i];
          }
          if (history >= 2) {
            harker.speaking = true;
            harker.emit('speaking');
          }
        } else if (currentVolume < threshold && harker.speaking) {
          for (let i = 0; i < harker.speakingHistory.length; i++) {
            history += harker.speakingHistory[i];
          }
          if (history == 0) {
            harker.speaking = false;
            harker.emit('stopped_speaking');
          }
        }
        harker.speakingHistory.shift();
        harker.speakingHistory.push(0 + (currentVolume > threshold));

        looper();
      }, interval);
    };
    looper();

    return harker;
  };
}, { wildemitter: 24 }],
9: [function (require, module, exports) {
  if (typeof Object.create === 'function') {
    // implementation from standard node.js 'util' module
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    // old school shim for old browsers
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      const TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }
}, {}],
10: [function (require, module, exports) {
// Does nothing at all.

}, {}],
11: [function (require, module, exports) {
  /*!
   * @name JavaScript/NodeJS Merge v1.2.0
   * @author yeikos
   * @repository https://github.com/yeikos/js.merge

   * Copyright 2014 yeikos - MIT license
   * https://raw.github.com/yeikos/js.merge/master/LICENSE
   */

  (function (isNode) {
    /**
     * Merge one or more objects
     * @param bool? clone
     * @param mixed,... arguments
     * @return object
     */

    const Public = function (clone) {
      return merge(clone === true, false, arguments);
    };
    const publicName = 'merge';

    /**
     * Merge two or more objects recursively
     * @param bool? clone
     * @param mixed,... arguments
     * @return object
     */

    Public.recursive = function (clone) {
      return merge(clone === true, true, arguments);
    };

    /**
     * Clone the input removing any reference
     * @param mixed input
     * @return mixed
     */

    Public.clone = function (input) {
      let output = input;
      const type = typeOf(input);
      let index;
      let size;

      if (type === 'array') {
        output = [];
        size = input.length;

        for (index = 0; index < size; ++index) { output[index] = Public.clone(input[index]); }
      } else if (type === 'object') {
        output = {};

        for (index in input) { output[index] = Public.clone(input[index]); }
      }

      return output;
    };

    /**
     * Merge two objects recursively
     * @param mixed input
     * @param mixed extend
     * @return mixed
     */

    function merge_recursive(base, extend) {
      if (typeOf(base) !== 'object') { return extend; }

      for (const key in extend) {
        if (typeOf(base[key]) === 'object' && typeOf(extend[key]) === 'object') {
          base[key] = merge_recursive(base[key], extend[key]);
        } else {
          base[key] = extend[key];
        }
      }

      return base;
    }

    /**
     * Merge two or more objects
     * @param bool clone
     * @param bool recursive
     * @param array argv
     * @return object
     */

    function merge(clone, recursive, argv) {
      let result = argv[0];
      const size = argv.length;

      if (clone || typeOf(result) !== 'object') { result = {}; }

      for (let index = 0; index < size; ++index) {
        const item = argv[index];

        const type = typeOf(item);

        if (type !== 'object') continue;

        for (const key in item) {
          const sitem = clone ? Public.clone(item[key]) : item[key];

          if (recursive) {
            result[key] = merge_recursive(result[key], sitem);
          } else {
            result[key] = sitem;
          }
        }
      }

      return result;
    }

    /**
     * Get type of variable
     * @param mixed input
     * @return string
     *
     * @see http://jsperf.com/typeofvar
     */

    function typeOf(input) {
      return ({}).toString.call(input).slice(8, -1).toLowerCase();
    }

    if (isNode) {
      module.exports = Public;
    } else {
      window[publicName] = Public;
    }
  })(typeof module === 'object' && module && typeof module.exports === 'object' && module.exports);
}, {}],
12: [function (require, module, exports) {
  /**
   # normalice

   Normalize an ice server configuration object (or plain old string) into a format
   that is usable in all browsers supporting WebRTC.  Primarily this module is designed
   to help with the transition of the `url` attribute of the configuration object to
   the `urls` attribute.

   ## Example Usage

   <<< examples/simple.js

   * */

  const protocols = [
    'stun:',
    'turn:'
  ];

  module.exports = function (input) {
    let url = (input || {}).url || input;
    var protocol;
    let parts;
    const output = {};

    // if we don't have a string url, then allow the input to passthrough
    if (typeof url != 'string' && (!(url instanceof String))) {
      return input;
    }

    // trim the url string, and convert to an array
    url = url.trim();

    // if the protocol is not known, then passthrough
    protocol = protocols[protocols.indexOf(url.slice(0, 5))];
    if (!protocol) {
      return input;
    }

    // now let's attack the remaining url parts
    url = url.slice(5);
    parts = url.split('@');

    output.username = input.username;
    output.credential = input.credential;
    // if we have an authentication part, then set the credentials
    if (parts.length > 1) {
      url = parts[1];
      parts = parts[0].split(':');

      // add the output credential and username
      output.username = parts[0];
      output.credential = (input || {}).credential || parts[1] || '';
    }

    output.url = protocol + url;
    output.urls = [output.url];

    return output;
  };
}, {}],
13: [function (require, module, exports) {
  const grammar = module.exports = {
    v: [{
      name: 'version',
      reg: /^(\d*)$/
    }],
    o: [{ // o=- 20518 0 IN IP4 203.0.113.1
      // NB: sessionId will be a String in most cases because it is huge
      name: 'origin',
      reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/,
      names: ['username', 'sessionId', 'sessionVersion', 'netType', 'ipVer', 'address'],
      format: '%s %s %d %s IP%d %s'
    }],
    // default parsing of these only (though some of these feel outdated)
    s: [{ name: 'name' }],
    i: [{ name: 'description' }],
    u: [{ name: 'uri' }],
    e: [{ name: 'email' }],
    p: [{ name: 'phone' }],
    z: [{ name: 'timezones' }], // TODO: this one can actually be parsed properly..
    r: [{ name: 'repeats' }], // TODO: this one can also be parsed properly
    // k: [{}], // outdated thing ignored
    t: [{ // t=0 0
      name: 'timing',
      reg: /^(\d*) (\d*)/,
      names: ['start', 'stop'],
      format: '%d %d'
    }],
    c: [{ // c=IN IP4 10.47.197.26
      name: 'connection',
      reg: /^IN IP(\d) (\S*)/,
      names: ['version', 'ip'],
      format: 'IN IP%d %s'
    }],
    b: [{ // b=AS:4000
      push: 'bandwidth',
      reg: /^(TIAS|AS|CT|RR|RS):(\d*)/,
      names: ['type', 'limit'],
      format: '%s:%s'
    }],
    m: [{ // m=video 51744 RTP/AVP 126 97 98 34 31
      // NB: special - pushes to session
      // TODO: rtp/fmtp should be filtered by the payloads found here?
      reg: /^(\w*) (\d*) ([\w\/]*)(?: (.*))?/,
      names: ['type', 'port', 'protocol', 'payloads'],
      format: '%s %d %s %s'
    }],
    a: [
      { // a=rtpmap:110 opus/48000/2
        push: 'rtp',
        reg: /^rtpmap:(\d*) ([\w\-]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/,
        names: ['payload', 'codec', 'rate', 'encoding'],
        format: function (o) {
          return (o.encoding)
            ? 'rtpmap:%d %s/%s/%s'
            : o.rate
              ? 'rtpmap:%d %s/%s'
              : 'rtpmap:%d %s';
        }
      },
      {
        // a=fmtp:108 profile-level-id=24;object=23;bitrate=64000
        // a=fmtp:111 minptime=10; useinbandfec=1
        push: 'fmtp',
        reg: /^fmtp:(\d*) ([\S| ]*)/,
        names: ['payload', 'config'],
        format: 'fmtp:%d %s'
      },
      { // a=control:streamid=0
        name: 'control',
        reg: /^control:(.*)/,
        format: 'control:%s'
      },
      { // a=rtcp:65179 IN IP4 193.84.77.194
        name: 'rtcp',
        reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/,
        names: ['port', 'netType', 'ipVer', 'address'],
        format: function (o) {
          return (o.address != null)
            ? 'rtcp:%d %s IP%d %s'
            : 'rtcp:%d';
        }
      },
      { // a=rtcp-fb:98 trr-int 100
        push: 'rtcpFbTrrInt',
        reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/,
        names: ['payload', 'value'],
        format: 'rtcp-fb:%d trr-int %d'
      },
      { // a=rtcp-fb:98 nack rpsi
        push: 'rtcpFb',
        reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/,
        names: ['payload', 'type', 'subtype'],
        format: function (o) {
          return (o.subtype != null)
            ? 'rtcp-fb:%s %s %s'
            : 'rtcp-fb:%s %s';
        }
      },
      { // a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
        // a=extmap:1/recvonly URI-gps-string
        push: 'ext',
        reg: /^extmap:([\w_\/]*) (\S*)(?: (\S*))?/,
        names: ['value', 'uri', 'config'], // value may include "/direction" suffix
        format: function (o) {
          return (o.config != null)
            ? 'extmap:%s %s %s'
            : 'extmap:%s %s';
        }
      },
      {
        // a=crypto:1 AES_CM_128_HMAC_SHA1_80
        // inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
        push: 'crypto',
        reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/,
        names: ['id', 'suite', 'config', 'sessionConfig'],
        format: function (o) {
          return (o.sessionConfig != null)
            ? 'crypto:%d %s %s %s'
            : 'crypto:%d %s %s';
        }
      },
      { // a=setup:actpass
        name: 'setup',
        reg: /^setup:(\w*)/,
        format: 'setup:%s'
      },
      { // a=mid:1
        name: 'mid',
        reg: /^mid:([^\s]*)/,
        format: 'mid:%s'
      },
      { // a=msid:0c8b064d-d807-43b4-b434-f92a889d8587 98178685-d409-46e0-8e16-7ef0db0db64a
        name: 'msid',
        reg: /^msid:(.*)/,
        format: 'msid:%s'
      },
      { // a=ptime:20
        name: 'ptime',
        reg: /^ptime:(\d*)/,
        format: 'ptime:%d'
      },
      { // a=maxptime:60
        name: 'maxptime',
        reg: /^maxptime:(\d*)/,
        format: 'maxptime:%d'
      },
      { // a=sendrecv
        name: 'direction',
        reg: /^(sendrecv|recvonly|sendonly|inactive)/
      },
      { // a=ice-lite
        name: 'icelite',
        reg: /^(ice-lite)/
      },
      { // a=ice-ufrag:F7gI
        name: 'iceUfrag',
        reg: /^ice-ufrag:(\S*)/,
        format: 'ice-ufrag:%s'
      },
      { // a=ice-pwd:x9cml/YzichV2+XlhiMu8g
        name: 'icePwd',
        reg: /^ice-pwd:(\S*)/,
        format: 'ice-pwd:%s'
      },
      { // a=fingerprint:SHA-1 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33
        name: 'fingerprint',
        reg: /^fingerprint:(\S*) (\S*)/,
        names: ['type', 'hash'],
        format: 'fingerprint:%s %s'
      },
      {
        // a=candidate:0 1 UDP 2113667327 203.0.113.1 54400 typ host
        // a=candidate:1162875081 1 udp 2113937151 192.168.34.75 60017 typ host generation 0
        // a=candidate:3289912957 2 udp 1845501695 193.84.77.194 60017
        // typ srflx raddr 192.168.34.75 rport 60017 generation 0
        // a=candidate:229815620 1 tcp 1518280447 192.168.150.19 60017
        // typ host tcptype active generation 0
        // a=candidate:3289912957 2 tcp 1845501695 193.84.77.194 60017
        // typ srflx raddr 192.168.34.75 rport 60017 tcptype passive generation 0
        push: 'candidates',
        reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?/,
        names: ['foundation', 'component', 'transport', 'priority', 'ip', 'port', 'type', 'raddr', 'rport', 'tcptype', 'generation'],
        format: function (o) {
          let str = 'candidate:%s %d %s %d %s %d typ %s';

          str += (o.raddr != null) ? ' raddr %s rport %d' : '%v%v';

          // NB: candidate has three optional chunks, so %void middles one if it's missing
          str += (o.tcptype != null) ? ' tcptype %s' : '%v';

          if (o.generation != null) {
            str += ' generation %d';
          }
          return str;
        }
      },
      { // a=end-of-candidates (keep after the candidates line for readability)
        name: 'endOfCandidates',
        reg: /^(end-of-candidates)/
      },
      { // a=remote-candidates:1 203.0.113.1 54400 2 203.0.113.1 54401 ...
        name: 'remoteCandidates',
        reg: /^remote-candidates:(.*)/,
        format: 'remote-candidates:%s'
      },
      { // a=ice-options:google-ice
        name: 'iceOptions',
        reg: /^ice-options:(\S*)/,
        format: 'ice-options:%s'
      },
      { // a=ssrc:2566107569 cname:t9YU8M1UxTF8Y1A1
        push: 'ssrcs',
        reg: /^ssrc:(\d*) ([\w_]*):(.*)/,
        names: ['id', 'attribute', 'value'],
        format: 'ssrc:%d %s:%s'
      },
      { // a=ssrc-group:FEC 1 2
        push: 'ssrcGroups',
        reg: /^ssrc-group:(\w*) (.*)/,
        names: ['semantics', 'ssrcs'],
        format: 'ssrc-group:%s %s'
      },
      { // a=msid-semantic: WMS Jvlam5X3SX1OP6pn20zWogvaKJz5Hjf9OnlV
        name: 'msidSemantic',
        reg: /^msid-semantic:\s?(\w*) (\S*)/,
        names: ['semantic', 'token'],
        format: 'msid-semantic: %s %s' // space after ":" is not accidental
      },
      { // a=group:BUNDLE audio video
        push: 'groups',
        reg: /^group:(\w*) (.*)/,
        names: ['type', 'mids'],
        format: 'group:%s %s'
      },
      { // a=rtcp-mux
        name: 'rtcpMux',
        reg: /^(rtcp-mux)/
      },
      { // a=rtcp-rsize
        name: 'rtcpRsize',
        reg: /^(rtcp-rsize)/
      },
      { // any a= that we don't understand is kepts verbatim on media.invalid
        push: 'invalid',
        names: ['value']
      }
    ]
  };

  // set sensible defaults to avoid polluting the grammar with boring details
  Object.keys(grammar).forEach((key) => {
    const objs = grammar[key];
    objs.forEach((obj) => {
      if (!obj.reg) {
        obj.reg = /(.*)/;
      }
      if (!obj.format) {
        obj.format = '%s';
      }
    });
  });
}, {}],
14: [function (require, module, exports) {
  const parser = require('./parser');
  const writer = require('./writer');

  exports.write = writer;
  exports.parse = parser.parse;
  exports.parseFmtpConfig = parser.parseFmtpConfig;
  exports.parsePayloads = parser.parsePayloads;
  exports.parseRemoteCandidates = parser.parseRemoteCandidates;
}, { './parser': 15, './writer': 16 }],
15: [function (require, module, exports) {
  const toIntIfInt = function (v) {
    return String(Number(v)) === v ? Number(v) : v;
  };

  const attachProperties = function (match, location, names, rawName) {
    if (rawName && !names) {
      location[rawName] = toIntIfInt(match[1]);
    } else {
      for (let i = 0; i < names.length; i += 1) {
        if (match[i + 1] != null) {
          location[names[i]] = toIntIfInt(match[i + 1]);
        }
      }
    }
  };

  const parseReg = function (obj, location, content) {
    const needsBlank = obj.name && obj.names;
    if (obj.push && !location[obj.push]) {
      location[obj.push] = [];
    } else if (needsBlank && !location[obj.name]) {
      location[obj.name] = {};
    }
    const keyLocation = obj.push
      ? {} // blank object that will be pushed
      : needsBlank ? location[obj.name] : location; // otherwise, named location or root

    attachProperties(content.match(obj.reg), keyLocation, obj.names, obj.name);

    if (obj.push) {
      location[obj.push].push(keyLocation);
    }
  };

  const grammar = require('./grammar');
  const validLine = RegExp.prototype.test.bind(/^([a-z])=(.*)/);

  exports.parse = function (sdp) {
    const session = {};
    const media = [];
    let location = session; // points at where properties go under (one of the above)

    // parse lines we understand
    sdp.split(/(\r\n|\r|\n)/).filter(validLine).forEach((l) => {
      const type = l[0];
      const content = l.slice(2);
      if (type === 'm') {
        media.push({ rtp: [], fmtp: [] });
        location = media[media.length - 1]; // point at latest media line
      }

      for (let j = 0; j < (grammar[type] || []).length; j += 1) {
        const obj = grammar[type][j];
        if (obj.reg.test(content)) {
          return parseReg(obj, location, content);
        }
      }
    });

    session.media = media; // link it up
    return session;
  };

  const fmtpReducer = function (acc, expr) {
    const s = expr.split('=');
    if (s.length === 2) {
      acc[s[0]] = toIntIfInt(s[1]);
    }
    return acc;
  };

  exports.parseFmtpConfig = function (str) {
    return str.split(/\;\s?/).reduce(fmtpReducer, {});
  };

  exports.parsePayloads = function (str) {
    return str.split(' ').map(Number);
  };

  exports.parseRemoteCandidates = function (str) {
    const candidates = [];
    const parts = str.split(' ').map(toIntIfInt);
    for (let i = 0; i < parts.length; i += 3) {
      candidates.push({
        component: parts[i],
        ip: parts[i + 1],
        port: parts[i + 2]
      });
    }
    return candidates;
  };
}, { './grammar': 13 }],
16: [function (require, module, exports) {
  const grammar = require('./grammar');

  // customized util.format - discards excess arguments and can void middle ones
  const formatRegExp = /%[sdv%]/g;
  const format = function (formatStr) {
    let i = 1;
    const args = arguments;
    const len = args.length;
    return formatStr.replace(formatRegExp, (x) => {
      if (i >= len) {
        return x; // missing argument
      }
      const arg = args[i];
      i += 1;
      switch (x) {
        case '%%':
          return '%';
        case '%s':
          return String(arg);
        case '%d':
          return Number(arg);
        case '%v':
          return '';
      }
    });
    // NB: we discard excess arguments - they are typically undefined from makeLine
  };

  const makeLine = function (type, obj, location) {
    const str = obj.format instanceof Function
      ? (obj.format(obj.push ? location : location[obj.name]))
      : obj.format;

    const args = [`${type}=${str}`];
    if (obj.names) {
      for (let i = 0; i < obj.names.length; i += 1) {
        const n = obj.names[i];
        if (obj.name) {
          args.push(location[obj.name][n]);
        } else { // for mLine and push attributes
          args.push(location[obj.names[i]]);
        }
      }
    } else {
      args.push(location[obj.name]);
    }
    return format.apply(null, args);
  };

  // RFC specified order
  // TODO: extend this with all the rest
  const defaultOuterOrder = [
    'v', 'o', 's', 'i',
    'u', 'e', 'p', 'c',
    'b', 't', 'r', 'z', 'a'
  ];
  const defaultInnerOrder = ['i', 'c', 'b', 'a'];

  module.exports = function (session, opts) {
    opts = opts || {};
    // ensure certain properties exist
    if (session.version == null) {
      session.version = 0; // "v=0" must be there (only defined version atm)
    }
    if (session.name == null) {
      session.name = ' '; // "s= " must be there if no meaningful name set
    }
    session.media.forEach((mLine) => {
      if (mLine.payloads == null) {
        mLine.payloads = '';
      }
    });

    const outerOrder = opts.outerOrder || defaultOuterOrder;
    const innerOrder = opts.innerOrder || defaultInnerOrder;
    const sdp = [];

    // loop through outerOrder for matching properties on session
    outerOrder.forEach((type) => {
      grammar[type].forEach((obj) => {
        if (obj.name in session && session[obj.name] != null) {
          sdp.push(makeLine(type, obj, session));
        } else if (obj.push in session && session[obj.push] != null) {
          session[obj.push].forEach((el) => {
            sdp.push(makeLine(type, obj, el));
          });
        }
      });
    });

    // then for each media line, follow the innerOrder
    session.media.forEach((mLine) => {
      sdp.push(makeLine('m', grammar.m[0], mLine));

      innerOrder.forEach((type) => {
        grammar[type].forEach((obj) => {
          if (obj.name in mLine && mLine[obj.name] != null) {
            sdp.push(makeLine(type, obj, mLine));
          } else if (obj.push in mLine && mLine[obj.push] != null) {
            mLine[obj.push].forEach((el) => {
              sdp.push(makeLine(type, obj, el));
            });
          }
        });
      });
    });

    return `${sdp.join('\r\n')}\r\n`;
  };
}, { './grammar': 13 }],
17: [function (require, module, exports) {
  /* Copyright @ 2015 Atlassian Pty Ltd
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  module.exports = function arrayEquals(array) {
    // if the other array is a falsy value, return
    if (!array) { return false; }

    // compare lengths - can save a lot of time
    if (this.length != array.length) { return false; }

    for (let i = 0, l = this.length; i < l; i++) {
      // Check if we have nested arrays
      if (this[i] instanceof Array && array[i] instanceof Array) {
        // recurse into the nested arrays
        if (!arrayEquals.apply(this[i], [array[i]])) { return false; }
      } else if (this[i] != array[i]) {
        // Warning - two different object instances will never be equal:
        // {x:20} != {x:20}
        return false;
      }
    }
    return true;
  };
}, {}],
18: [function (require, module, exports) {
  /* Copyright @ 2015 Atlassian Pty Ltd
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  exports.Interop = require('./interop');
}, { './interop': 19 }],
19: [function (require, module, exports) {
  /* Copyright @ 2015 Atlassian Pty Ltd
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /* global RTCSessionDescription */
  /* global RTCIceCandidate */
  /* jshint -W097 */

  'use strict';

  const transform = require('./transform');
  const arrayEquals = require('./array-equals');

  function Interop() {
    /**
     * This map holds the most recent Unified Plan offer/answer SDP that was
     * converted to Plan B, with the SDP type ('offer' or 'answer') as keys and
     * the SDP string as values.
     *
     * @type {{}}
     */
    this.cache = {
      mlB2UMap: {},
      mlU2BMap: {}
    };
  }

  module.exports = Interop;

  /**
   * Changes the candidate args to match with the related Unified Plan
   */
  Interop.prototype.candidateToUnifiedPlan = function (candidate) {
    const cand = new RTCIceCandidate(candidate);

    cand.sdpMLineIndex = this.cache.mlB2UMap[cand.sdpMLineIndex];
    /* TODO: change sdpMid to (audio|video)-SSRC */

    return cand;
  };

  /**
   * Changes the candidate args to match with the related Plan B
   */
  Interop.prototype.candidateToPlanB = function (candidate) {
    const cand = new RTCIceCandidate(candidate);

    if (cand.sdpMid.indexOf('audio') === 0) {
      cand.sdpMid = 'audio';
    } else if (cand.sdpMid.indexOf('video') === 0) {
      cand.sdpMid = 'video';
    } else {
      throw new Error(`candidate with ${cand.sdpMid} not allowed`);
    }

    cand.sdpMLineIndex = this.cache.mlU2BMap[cand.sdpMLineIndex];

    return cand;
  };

  /**
   * Returns the index of the first m-line with the given media type and with a
   * direction which allows sending, in the last Unified Plan description with
   * type "answer" converted to Plan B. Returns {null} if there is no saved
   * answer, or if none of its m-lines with the given type allow sending.
   * @param type the media type ("audio" or "video").
   * @returns {*}
   */
  Interop.prototype.getFirstSendingIndexFromAnswer = function (type) {
    if (!this.cache.answer) {
      return null;
    }

    const session = transform.parse(this.cache.answer);
    if (session && session.media && Array.isArray(session.media)) {
      for (let i = 0; i < session.media.length; i++) {
        if (session.media[i].type == type
        && (!session.media[i].direction
        || /* default to sendrecv */ session.media[i].direction === 'sendrecv'
        || session.media[i].direction === 'sendonly')) {
          return i;
        }
      }
    }

    return null;
  };

  /**
   * This method transforms a Unified Plan SDP to an equivalent Plan B SDP. A
   * PeerConnection wrapper transforms the SDP to Plan B before passing it to the
   * application.
   *
   * @param desc
   * @returns {*}
   */
  Interop.prototype.toPlanB = function (desc) {
    const self = this;
    // #region Preliminary input validation.

    if (typeof desc !== 'object' || desc === null
    || typeof desc.sdp !== 'string') {
      console.warn('An empty description was passed as an argument.');
      return desc;
    }

    // Objectify the SDP for easier manipulation.
    const session = transform.parse(desc.sdp);

    // If the SDP contains no media, there's nothing to transform.
    if (typeof session.media === 'undefined'
    || !Array.isArray(session.media) || session.media.length === 0) {
      console.warn('The description has no media.');
      return desc;
    }

    // Try some heuristics to "make sure" this is a Unified Plan SDP. Plan B
    // SDP has a video, an audio and a data "channel" at most.
    if (session.media.length <= 3 && session.media.every((m) => {
      return ['video', 'audio', 'data'].indexOf(m.mid) !== -1;
    })) {
      console.warn('This description does not look like Unified Plan.');
      return desc;
    }

    // #endregion

    // HACK https://bugzilla.mozilla.org/show_bug.cgi?id=1113443
    let sdp = desc.sdp;
    let rewrite = false;
    for (let i = 0; i < session.media.length; i++) {
      const uLine = session.media[i];
      uLine.rtp.forEach((rtp) => {
        if (rtp.codec === 'NULL') {
          rewrite = true;
          const offer = transform.parse(self.cache.offer);
          rtp.codec = offer.media[i].rtp[0].codec;
        }
      });
    }
    if (rewrite) {
      sdp = transform.write(session);
    }

    // Unified Plan SDP is our "precious". Cache it for later use in the Plan B
    // -> Unified Plan transformation.
    this.cache[desc.type] = sdp;

    // #region Convert from Unified Plan to Plan B.

    // We rebuild the session.media array.
    const media = session.media;
    session.media = [];

    // Associative array that maps channel types to channel objects for fast
    // access to channel objects by their type, e.g. type2bl['audio']->channel
    // obj.
    const type2bl = {};

    // Used to build the group:BUNDLE value after the channels construction
    // loop.
    const types = [];

    media.forEach((uLine) => {
      // rtcp-mux is required in the Plan B SDP.
      if ((typeof uLine.rtcpMux !== 'string'
      || uLine.rtcpMux !== 'rtcp-mux')
      && uLine.direction !== 'inactive') {
        throw new Error('Cannot convert to Plan B because m-lines '
        + 'without the rtcp-mux attribute were found.');
      }

      // If we don't have a channel for this uLine.type OR the selected is
      // inactive, then select this uLine as the channel basis.
      if (typeof type2bl[uLine.type] === 'undefined'
      || type2bl[uLine.type].direction === 'inactive') {
        type2bl[uLine.type] = uLine;
      }

      if (uLine.protocol != type2bl[uLine.type].protocol) {
        throw new Error('Cannot convert to Plan B because m-lines '
        + 'have different protocols and this library does not have '
        + 'support for that');
      }

      if (uLine.payloads != type2bl[uLine.type].payloads) {
        throw new Error('Cannot convert to Plan B because m-lines '
        + 'have different payloads and this library does not have '
        + 'support for that');
      }
    });

    // Implode the Unified Plan m-lines/tracks into Plan B channels.
    media.forEach((uLine) => {
      if (uLine.type === 'application') {
        session.media.push(uLine);
        types.push(uLine.mid);
        return;
      }

      // Add sources to the channel and handle a=msid.
      if (typeof uLine.sources === 'object') {
        Object.keys(uLine.sources).forEach((ssrc) => {
          if (typeof type2bl[uLine.type].sources !== 'object') { type2bl[uLine.type].sources = {}; }

          // Assign the sources to the channel.
          type2bl[uLine.type].sources[ssrc] = uLine.sources[ssrc];

          if (typeof uLine.msid !== 'undefined') {
            // In Plan B the msid is an SSRC attribute. Also, we don't
            // care about the obsolete label and mslabel attributes.
            //
            // Note that it is not guaranteed that the uLine will
            // have an msid. recvonly channels in particular don't have
            // one.
            type2bl[uLine.type].sources[ssrc].msid = uLine.msid;
          }
          // NOTE ssrcs in ssrc groups will share msids, as
          // draft-uberti-rtcweb-plan-00 mandates.
        });
      }

      // Add ssrc groups to the channel.
      if (typeof uLine.ssrcGroups !== 'undefined'
      && Array.isArray(uLine.ssrcGroups)) {
        // Create the ssrcGroups array, if it's not defined.
        if (typeof type2bl[uLine.type].ssrcGroups === 'undefined'
        || !Array.isArray(type2bl[uLine.type].ssrcGroups)) {
          type2bl[uLine.type].ssrcGroups = [];
        }

        type2bl[uLine.type].ssrcGroups = type2bl[uLine.type].ssrcGroups.concat(
          uLine.ssrcGroups
        );
      }

      if (type2bl[uLine.type] === uLine) {
        // Plan B mids are in ['audio', 'video', 'data']
        uLine.mid = uLine.type;

        // Plan B doesn't support/need the bundle-only attribute.
        delete uLine.bundleOnly;

        // In Plan B the msid is an SSRC attribute.
        delete uLine.msid;

        if (uLine.type == media[0].type) {
          types.unshift(uLine.type);
          // Add the channel to the new media array.
          session.media.unshift(uLine);
        } else {
          types.push(uLine.type);
          // Add the channel to the new media array.
          session.media.push(uLine);
        }
      }
    });

    if (typeof session.groups !== 'undefined') {
      // We regenerate the BUNDLE group with the new mids.
      session.groups.some((group) => {
        if (group.type === 'BUNDLE') {
          group.mids = types.join(' ');
          return true;
        }
      });
    }

    // msid semantic
    session.msidSemantic = {
      semantic: 'WMS',
      token: '*'
    };

    const resStr = transform.write(session);

    return new RTCSessionDescription({
      type: desc.type,
      sdp: resStr
    });

    // #endregion
  };

  /* follow rules defined in RFC4145 */
  function addSetupAttr(uLine) {
    if (typeof uLine.setup === 'undefined') {
      return;
    }

    if (uLine.setup === 'active') {
      uLine.setup = 'passive';
    } else if (uLine.setup === 'passive') {
      uLine.setup = 'active';
    }
  }

  /**
   * This method transforms a Plan B SDP to an equivalent Unified Plan SDP. A
   * PeerConnection wrapper transforms the SDP to Unified Plan before passing it
   * to FF.
   *
   * @param desc
   * @returns {*}
   */
  Interop.prototype.toUnifiedPlan = function (desc) {
    const self = this;
    // #region Preliminary input validation.

    if (typeof desc !== 'object' || desc === null
    || typeof desc.sdp !== 'string') {
      console.warn('An empty description was passed as an argument.');
      return desc;
    }

    const session = transform.parse(desc.sdp);

    // If the SDP contains no media, there's nothing to transform.
    if (typeof session.media === 'undefined'
    || !Array.isArray(session.media) || session.media.length === 0) {
      console.warn('The description has no media.');
      return desc;
    }

    // Try some heuristics to "make sure" this is a Plan B SDP. Plan B SDP has
    // a video, an audio and a data "channel" at most.
    if (session.media.length > 3 || !session.media.every((m) => {
      return ['video', 'audio', 'data'].indexOf(m.mid) !== -1;
    })) {
      console.warn('This description does not look like Plan B.');
      return desc;
    }

    // Make sure this Plan B SDP can be converted to a Unified Plan SDP.
    let mids = [];
    session.media.forEach((m) => {
      mids.push(m.mid);
    });

    let hasBundle = false;
    if (typeof session.groups !== 'undefined'
    && Array.isArray(session.groups)) {
      hasBundle = session.groups.every((g) => {
        return g.type !== 'BUNDLE'
        || arrayEquals.apply(g.mids.sort(), [mids.sort()]);
      });
    }

    if (!hasBundle) {
      let mustBeBundle = false;

      session.media.forEach((m) => {
        if (m.direction !== 'inactive') {
          mustBeBundle = true;
        }
      });

      if (mustBeBundle) {
        throw new Error('Cannot convert to Unified Plan because m-lines that'
        + ' are not bundled were found.');
      }
    }

    // #endregion

    // #region Convert from Plan B to Unified Plan.

    // Unfortunately, a Plan B offer/answer doesn't have enough information to
    // rebuild an equivalent Unified Plan offer/answer.
    //
    // For example, if this is a local answer (in Unified Plan style) that we
    // convert to Plan B prior to handing it over to the application (the
    // PeerConnection wrapper called us, for instance, after a successful
    // createAnswer), we want to remember the m-line at which we've seen the
    // (local) SSRC. That's because when the application wants to do call the
    // SLD method, forcing us to do the inverse transformation (from Plan B to
    // Unified Plan), we need to know to which m-line to assign the (local)
    // SSRC. We also need to know all the other m-lines that the original
    // answer had and include them in the transformed answer as well.
    //
    // Another example is if this is a remote offer that we convert to Plan B
    // prior to giving it to the application, we want to remember the mid at
    // which we've seen the (remote) SSRC.
    //
    // In the iteration that follows, we use the cached Unified Plan (if it
    // exists) to assign mids to ssrcs.

    let type;
    if (desc.type === 'answer') {
      type = 'offer';
    } else if (desc.type === 'offer') {
      type = 'answer';
    } else {
      throw new Error(`Type '${desc.type}' not supported.`);
    }

    let cached;
    if (typeof this.cache[type] !== 'undefined') {
      cached = transform.parse(this.cache[type]);
    }

    const recvonlySsrcs = {
      audio: {},
      video: {}
    };

    // A helper map that sends mids to m-line objects. We use it later to
    // rebuild the Unified Plan style session.media array.
    const mid2ul = {};
    let bIdx = 0;
    let uIdx = 0;

    const sources2ul = {};

    let candidates;
    let iceUfrag;
    let icePwd;
    let fingerprint;
    const payloads = {};
    const rtcpFb = {};
    const rtp = {};

    session.media.forEach((bLine) => {
      if ((typeof bLine.rtcpMux !== 'string'
      || bLine.rtcpMux !== 'rtcp-mux')
      && bLine.direction !== 'inactive') {
        throw new Error('Cannot convert to Unified Plan because m-lines '
        + 'without the rtcp-mux attribute were found.');
      }

      if (bLine.type === 'application') {
        mid2ul[bLine.mid] = bLine;
        return;
      }

      // With rtcp-mux and bundle all the channels should have the same ICE
      // stuff.
      const sources = bLine.sources;
      const ssrcGroups = bLine.ssrcGroups;
      const port = bLine.port;

      /* Chrome adds different candidates even using bundle, so we concat the candidates list */
      if (typeof bLine.candidates != 'undefined') {
        if (typeof candidates != 'undefined') {
          candidates = candidates.concat(bLine.candidates);
        } else {
          candidates = bLine.candidates;
        }
      }

      if ((typeof iceUfrag != 'undefined') && (typeof bLine.iceUfrag != 'undefined') && (iceUfrag != bLine.iceUfrag)) {
        throw new Error(`${'Only BUNDLE supported, iceUfrag must be the same for all m-lines.\n'
        + '\tLast iceUfrag: '}${iceUfrag}\n`
        + `\tNew iceUfrag: ${bLine.iceUfrag}`);
      }

      if (typeof bLine.iceUfrag != 'undefined') {
        iceUfrag = bLine.iceUfrag;
      }

      if ((typeof icePwd != 'undefined') && (typeof bLine.icePwd != 'undefined') && (icePwd != bLine.icePwd)) {
        throw new Error(`${'Only BUNDLE supported, icePwd must be the same for all m-lines.\n'
        + '\tLast icePwd: '}${icePwd}\n`
        + `\tNew icePwd: ${bLine.icePwd}`);
      }

      if (typeof bLine.icePwd != 'undefined') {
        icePwd = bLine.icePwd;
      }

      if ((typeof fingerprint != 'undefined') && (typeof bLine.fingerprint != 'undefined')
      && (fingerprint.type != bLine.fingerprint.type
      || fingerprint.hash != bLine.fingerprint.hash)) {
        throw new Error(`${'Only BUNDLE supported, fingerprint must be the same for all m-lines.\n'
        + '\tLast fingerprint: '}${JSON.stringify(fingerprint)}\n`
        + `\tNew fingerprint: ${JSON.stringify(bLine.fingerprint)}`);
      }

      if (typeof bLine.fingerprint != 'undefined') {
        fingerprint = bLine.fingerprint;
      }

      payloads[bLine.type] = bLine.payloads;
      rtcpFb[bLine.type] = bLine.rtcpFb;
      rtp[bLine.type] = bLine.rtp;

      // inverted ssrc group map
      const ssrc2group = {};
      if (typeof ssrcGroups !== 'undefined' && Array.isArray(ssrcGroups)) {
        ssrcGroups.forEach((ssrcGroup) => {
          // XXX This might brake if an SSRC is in more than one group
          // for some reason.
          if (typeof ssrcGroup.ssrcs !== 'undefined'
          && Array.isArray(ssrcGroup.ssrcs)) {
            ssrcGroup.ssrcs.forEach((ssrc) => {
              if (typeof ssrc2group[ssrc] === 'undefined') {
                ssrc2group[ssrc] = [];
              }

              ssrc2group[ssrc].push(ssrcGroup);
            });
          }
        });
      }

      // ssrc to m-line index.
      const ssrc2ml = {};

      if (typeof sources === 'object') {
        // We'll use the "bLine" object as a prototype for each new "mLine"
        // that we create, but first we need to clean it up a bit.
        delete bLine.sources;
        delete bLine.ssrcGroups;
        delete bLine.candidates;
        delete bLine.iceUfrag;
        delete bLine.icePwd;
        delete bLine.fingerprint;
        delete bLine.port;
        delete bLine.mid;

        // Explode the Plan B channel sources with one m-line per source.
        Object.keys(sources).forEach((ssrc) => {
          // The (unified) m-line for this SSRC. We either create it from
          // scratch or, if it's a grouped SSRC, we re-use a related
          // mline. In other words, if the source is grouped with another
          // source, put the two together in the same m-line.
          let uLine;

          // We assume here that we are the answerer in the O/A, so any
          // offers which we translate come from the remote side, while
          // answers are local. So the check below is to make that we
          // handle receive-only SSRCs in a special way only if they come
          // from the remote side.
          if (desc.type === 'offer') {
            // We want to detect SSRCs which are used by a remote peer
            // in an m-line with direction=recvonly (i.e. they are
            // being used for RTCP only).
            // This information would have gotten lost if the remote
            // peer used Unified Plan and their local description was
            // translated to Plan B. So we use the lack of an MSID
            // attribute to deduce a "receive only" SSRC.
            if (!sources[ssrc].msid) {
              recvonlySsrcs[bLine.type][ssrc] = sources[ssrc];
              // Receive-only SSRCs must not create new m-lines. We
              // will assign them to an existing m-line later.
              return;
            }
          }

          if (typeof ssrc2group[ssrc] !== 'undefined'
          && Array.isArray(ssrc2group[ssrc])) {
            ssrc2group[ssrc].some((ssrcGroup) => {
              // ssrcGroup.ssrcs *is* an Array, no need to check
              // again here.
              return ssrcGroup.ssrcs.some((related) => {
                if (typeof ssrc2ml[related] === 'object') {
                  uLine = ssrc2ml[related];
                  return true;
                }
              });
            });
          }

          if (typeof uLine === 'object') {
            // the m-line already exists. Just add the source.
            uLine.sources[ssrc] = sources[ssrc];
            delete sources[ssrc].msid;
          } else {
            // Use the "bLine" as a prototype for the "uLine".
            uLine = Object.create(bLine);
            ssrc2ml[ssrc] = uLine;

            if (typeof sources[ssrc].msid !== 'undefined') {
              // Assign the msid of the source to the m-line. Note
              // that it is not guaranteed that the source will have
              // msid. In particular "recvonly" sources don't have an
              // msid. Note that "recvonly" is a term only defined
              // for m-lines.
              uLine.msid = sources[ssrc].msid;
              delete sources[ssrc].msid;
            }

            // We assign one SSRC per media line.
            uLine.sources = {};
            uLine.sources[ssrc] = sources[ssrc];
            uLine.ssrcGroups = ssrc2group[ssrc];

            // Use the cached Unified Plan SDP (if it exists) to assign
            // SSRCs to mids.
            if (typeof cached !== 'undefined'
            && typeof cached.media !== 'undefined'
            && Array.isArray(cached.media)) {
              cached.media.forEach((m) => {
                if (typeof m.sources === 'object') {
                  Object.keys(m.sources).forEach((s) => {
                    if (s === ssrc) {
                      uLine.mid = m.mid;
                    }
                  });
                }
              });
            }

            if (typeof uLine.mid === 'undefined') {
              // If this is an SSRC that we see for the first time
              // assign it a new mid. This is typically the case when
              // this method is called to transform a remote
              // description for the first time or when there is a
              // new SSRC in the remote description because a new
              // peer has joined the conference. Local SSRCs should
              // have already been added to the map in the toPlanB
              // method.
              //
              // Because FF generates answers in Unified Plan style,
              // we MUST already have a cached answer with all the
              // local SSRCs mapped to some m-line/mid.

              uLine.mid = [bLine.type, '-', ssrc].join('');
            }

            // Include the candidates in the 1st media line.
            uLine.candidates = candidates;
            uLine.iceUfrag = iceUfrag;
            uLine.icePwd = icePwd;
            uLine.fingerprint = fingerprint;
            uLine.port = port;

            mid2ul[uLine.mid] = uLine;
            sources2ul[uIdx] = uLine.sources;

            self.cache.mlU2BMap[uIdx] = bIdx;
            if (typeof self.cache.mlB2UMap[bIdx] === 'undefined') {
              self.cache.mlB2UMap[bIdx] = uIdx;
            }
            uIdx++;
          }
        });
      } else {
        const uLine = bLine;

        uLine.candidates = candidates;
        uLine.iceUfrag = iceUfrag;
        uLine.icePwd = icePwd;
        uLine.fingerprint = fingerprint;
        uLine.port = port;

        mid2ul[uLine.mid] = uLine;

        self.cache.mlU2BMap[uIdx] = bIdx;
        if (typeof self.cache.mlB2UMap[bIdx] === 'undefined') {
          self.cache.mlB2UMap[bIdx] = uIdx;
        }
      }

      bIdx++;
    });

    // Rebuild the media array in the right order and add the missing mLines
    // (missing from the Plan B SDP).
    session.media = [];
    mids = []; // reuse

    if (desc.type === 'answer') {
      // The media lines in the answer must match the media lines in the
      // offer. The order is important too. Here we assume that Firefox is
      // the answerer, so we merely have to use the reconstructed (unified)
      // answer to update the cached (unified) answer accordingly.
      //
      // In the general case, one would have to use the cached (unified)
      // offer to find the m-lines that are missing from the reconstructed
      // answer, potentially grabbing them from the cached (unified) answer.
      // One has to be careful with this approach because inactive m-lines do
      // not always have an mid, making it tricky (impossible?) to find where
      // exactly and which m-lines are missing from the reconstructed answer.

      for (let i = 0; i < cached.media.length; i++) {
        const uLine = cached.media[i];

        delete uLine.msid;
        delete uLine.sources;
        delete uLine.ssrcGroups;

        if (typeof sources2ul[i] === 'undefined') {
          if (!uLine.direction
          || uLine.direction === 'sendrecv') {
            uLine.direction = 'recvonly';
          } else if (uLine.direction === 'sendonly') {
            uLine.direction = 'inactive';
          }
        } else {
          if (!uLine.direction
          || uLine.direction === 'sendrecv') {
            uLine.direction = 'sendrecv';
          } else if (uLine.direction === 'recvonly') {
            uLine.direction = 'sendonly';
          }
        }

        uLine.sources = sources2ul[i];
        uLine.candidates = candidates;
        uLine.iceUfrag = iceUfrag;
        uLine.icePwd = icePwd;
        uLine.fingerprint = fingerprint;

        uLine.rtp = rtp[uLine.type];
        uLine.payloads = payloads[uLine.type];
        uLine.rtcpFb = rtcpFb[uLine.type];

        session.media.push(uLine);

        if (typeof uLine.mid === 'string') {
          // inactive lines don't/may not have an mid.
          mids.push(uLine.mid);
        }
      }
    } else {
      // SDP offer/answer (and the JSEP spec) forbids removing an m-section
      // under any circumstances. If we are no longer interested in sending a
      // track, we just remove the msid and ssrc attributes and set it to
      // either a=recvonly (as the reofferer, we must use recvonly if the
      // other side was previously sending on the m-section, but we can also
      // leave the possibility open if it wasn't previously in use), or
      // a=inactive.

      if (typeof cached !== 'undefined'
      && typeof cached.media !== 'undefined'
      && Array.isArray(cached.media)) {
        cached.media.forEach((uLine) => {
          mids.push(uLine.mid);
          if (typeof mid2ul[uLine.mid] !== 'undefined') {
            session.media.push(mid2ul[uLine.mid]);
          } else {
            delete uLine.msid;
            delete uLine.sources;
            delete uLine.ssrcGroups;

            if (!uLine.direction
            || uLine.direction === 'sendrecv') {
              uLine.direction = 'sendonly';
            }
            if (!uLine.direction
            || uLine.direction === 'recvonly') {
              uLine.direction = 'inactive';
            }

            addSetupAttr(uLine);
            session.media.push(uLine);
          }
        });
      }

      // Add all the remaining (new) m-lines of the transformed SDP.
      Object.keys(mid2ul).forEach((mid) => {
        if (mids.indexOf(mid) === -1) {
          mids.push(mid);
          if (mid2ul[mid].direction === 'recvonly') {
            // This is a remote recvonly channel. Add its SSRC to the
            // appropriate sendrecv or sendonly channel.
            // TODO(gp) what if we don't have sendrecv/sendonly
            // channel?

            let done = false;

            session.media.some((uLine) => {
              if ((uLine.direction === 'sendrecv'
              || uLine.direction === 'sendonly')
              && uLine.type === mid2ul[mid].type) {
                // mid2ul[mid] shouldn't have any ssrc-groups
                Object.keys(mid2ul[mid].sources).forEach(
                  (ssrc) => {
                    uLine.sources[ssrc] = mid2ul[mid].sources[ssrc];
                  }
                );

                done = true;
                return true;
              }
            });

            if (!done) {
              session.media.push(mid2ul[mid]);
            }
          } else {
            session.media.push(mid2ul[mid]);
          }
        }
      });
    }

    // After we have constructed the Plan Unified m-lines we can figure out
    // where (in which m-line) to place the 'recvonly SSRCs'.
    // Note: we assume here that we are the answerer in the O/A, so any offers
    // which we translate come from the remote side, while answers are local
    // (and so our last local description is cached as an 'answer').
    ['audio', 'video'].forEach((type) => {
      if (!session || !session.media || !Array.isArray(session.media)) { return; }

      let idx = null;
      if (Object.keys(recvonlySsrcs[type]).length > 0) {
        idx = self.getFirstSendingIndexFromAnswer(type);
        if (idx === null) {
          // If this is the first offer we receive, we don't have a
          // cached answer. Assume that we will be sending media using
          // the first m-line for each media type.

          for (let i = 0; i < session.media.length; i++) {
            if (session.media[i].type === type) {
              idx = i;
              break;
            }
          }
        }
      }

      if (idx && session.media.length > idx) {
        const mLine = session.media[idx];
        Object.keys(recvonlySsrcs[type]).forEach((ssrc) => {
          if (mLine.sources && mLine.sources[ssrc]) {
            console.warn('Replacing an existing SSRC.');
          }
          if (!mLine.sources) {
            mLine.sources = {};
          }

          mLine.sources[ssrc] = recvonlySsrcs[type][ssrc];
        });
      }
    });

    if (typeof session.groups !== 'undefined') {
      // We regenerate the BUNDLE group (since we regenerated the mids)
      session.groups.some((group) => {
        if (group.type === 'BUNDLE') {
          group.mids = mids.join(' ');
          return true;
        }
      });
    }

    // msid semantic
    session.msidSemantic = {
      semantic: 'WMS',
      token: '*'
    };

    const resStr = transform.write(session);

    // Cache the transformed SDP (Unified Plan) for later re-use in this
    // function.
    this.cache[desc.type] = resStr;

    return new RTCSessionDescription({
      type: desc.type,
      sdp: resStr
    });

    // #endregion
  };
}, { './array-equals': 17, './transform': 20 }],
20: [function (require, module, exports) {
  /* Copyright @ 2015 Atlassian Pty Ltd
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  const transform = require('sdp-transform');

  exports.write = function (session, opts) {
    if (typeof session !== 'undefined'
    && typeof session.media !== 'undefined'
    && Array.isArray(session.media)) {
      session.media.forEach((mLine) => {
        // expand sources to ssrcs
        if (typeof mLine.sources !== 'undefined'
        && Object.keys(mLine.sources).length !== 0) {
          mLine.ssrcs = [];
          Object.keys(mLine.sources).forEach((ssrc) => {
            const source = mLine.sources[ssrc];
            Object.keys(source).forEach((attribute) => {
              mLine.ssrcs.push({
                id: ssrc,
                attribute: attribute,
                value: source[attribute]
              });
            });
          });
          delete mLine.sources;
        }

        // join ssrcs in ssrc groups
        if (typeof mLine.ssrcGroups !== 'undefined'
        && Array.isArray(mLine.ssrcGroups)) {
          mLine.ssrcGroups.forEach((ssrcGroup) => {
            if (typeof ssrcGroup.ssrcs !== 'undefined'
            && Array.isArray(ssrcGroup.ssrcs)) {
              ssrcGroup.ssrcs = ssrcGroup.ssrcs.join(' ');
            }
          });
        }
      });
    }

    // join group mids
    if (typeof session !== 'undefined'
    && typeof session.groups !== 'undefined' && Array.isArray(session.groups)) {
      session.groups.forEach((g) => {
        if (typeof g.mids !== 'undefined' && Array.isArray(g.mids)) {
          g.mids = g.mids.join(' ');
        }
      });
    }

    return transform.write(session, opts);
  };

  exports.parse = function (sdp) {
    const session = transform.parse(sdp);

    if (typeof session !== 'undefined' && typeof session.media !== 'undefined'
    && Array.isArray(session.media)) {
      session.media.forEach((mLine) => {
        // group sources attributes by ssrc
        if (typeof mLine.ssrcs !== 'undefined' && Array.isArray(mLine.ssrcs)) {
          mLine.sources = {};
          mLine.ssrcs.forEach((ssrc) => {
            if (!mLine.sources[ssrc.id]) { mLine.sources[ssrc.id] = {}; }
            mLine.sources[ssrc.id][ssrc.attribute] = ssrc.value;
          });

          delete mLine.ssrcs;
        }

        // split ssrcs in ssrc groups
        if (typeof mLine.ssrcGroups !== 'undefined'
        && Array.isArray(mLine.ssrcGroups)) {
          mLine.ssrcGroups.forEach((ssrcGroup) => {
            if (typeof ssrcGroup.ssrcs === 'string') {
              ssrcGroup.ssrcs = ssrcGroup.ssrcs.split(' ');
            }
          });
        }
      });
    }
    // split group mids
    if (typeof session !== 'undefined'
    && typeof session.groups !== 'undefined' && Array.isArray(session.groups)) {
      session.groups.forEach((g) => {
        if (typeof g.mids === 'string') {
          g.mids = g.mids.split(' ');
        }
      });
    }

    return session;
  };
}, { 'sdp-transform': 14 }],
21: [function (require, module, exports) {
  /*!
   * UAParser.js v0.7.18
   * Lightweight JavaScript-based User-Agent string parser
   * https://github.com/faisalman/ua-parser-js
   *
   * Copyright © 2012-2016 Faisal Salman <fyzlman@gmail.com>
   * Dual licensed under GPLv2 or MIT
   */

  (function (window, undefined) {
    'use strict';

    /// ///////////
    // Constants
    /// //////////

    const LIBVERSION = '0.7.18';
    const EMPTY = '';
    const UNKNOWN = '?';
    const FUNC_TYPE = 'function';
    const UNDEF_TYPE = 'undefined';
    const OBJ_TYPE = 'object';
    const STR_TYPE = 'string';
    const MAJOR = 'major'; // deprecated
    const MODEL = 'model';
    const NAME = 'name';
    const TYPE = 'type';
    const VENDOR = 'vendor';
    const VERSION = 'version';
    const ARCHITECTURE = 'architecture';
    const CONSOLE = 'console';
    const MOBILE = 'mobile';
    const TABLET = 'tablet';
    const SMARTTV = 'smarttv';
    const WEARABLE = 'wearable';
    const EMBEDDED = 'embedded';

    /// ////////
    // Helper
    /// ///////

    const util = {
      extend: function (regexes, extensions) {
        const margedRegexes = {};
        for (const i in regexes) {
          if (extensions[i] && extensions[i].length % 2 === 0) {
            margedRegexes[i] = extensions[i].concat(regexes[i]);
          } else {
            margedRegexes[i] = regexes[i];
          }
        }
        return margedRegexes;
      },
      has: function (str1, str2) {
        if (typeof str1 === 'string') {
          return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1;
        } else {
          return false;
        }
      },
      lowerize: function (str) {
        return str.toLowerCase();
      },
      major: function (version) {
        return typeof (version) === STR_TYPE ? version.replace(/[^\d\.]/g, '').split('.')[0] : undefined;
      },
      trim: function (str) {
        return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
      }
    };

    /// ////////////
    // Map helper
    /// ///////////

    const mapper = {

      rgx: function (ua, arrays) {
        // var result = {},
        let i = 0;
        let j;
        let k;
        let p;
        let q;
        let matches;
        let match;// , args = arguments;

        /* // construct object barebones
        for (p = 0; p < args[1].length; p++) {
            q = args[1][p];
            result[typeof q === OBJ_TYPE ? q[0] : q] = undefined;
        } */

        // loop through all regexes maps
        while (i < arrays.length && !matches) {
          const regex = arrays[i]; // even sequence (0,2,4,..)
          const props = arrays[i + 1]; // odd sequence (1,3,5,..)
          j = k = 0;

          // try matching uastring with regexes
          while (j < regex.length && !matches) {
            matches = regex[j++].exec(ua);

            if (!!matches) {
              for (p = 0; p < props.length; p++) {
                match = matches[++k];
                q = props[p];
                // check if given property is actually array
                if (typeof q === OBJ_TYPE && q.length > 0) {
                  if (q.length == 2) {
                    if (typeof q[1] == FUNC_TYPE) {
                      // assign modified match
                      this[q[0]] = q[1].call(this, match);
                    } else {
                      // assign given value, ignore regex match
                      this[q[0]] = q[1];
                    }
                  } else if (q.length == 3) {
                    // check whether function or regex
                    if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                      // call function (usually string mapper)
                      this[q[0]] = match ? q[1].call(this, match, q[2]) : undefined;
                    } else {
                      // sanitize match using given regex
                      this[q[0]] = match ? match.replace(q[1], q[2]) : undefined;
                    }
                  } else if (q.length == 4) {
                    this[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined;
                  }
                } else {
                  this[q] = match ? match : undefined;
                }
              }
            }
          }
          i += 2;
        }
        // console.log(this);
        // return this;
      },

      str: function (str, map) {
        for (const i in map) {
          // check if array
          if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
            for (let j = 0; j < map[i].length; j++) {
              if (util.has(map[i][j], str)) {
                return (i === UNKNOWN) ? undefined : i;
              }
            }
          } else if (util.has(map[i], str)) {
            return (i === UNKNOWN) ? undefined : i;
          }
        }
        return str;
      }
    };

    /// ////////////
    // String map
    /// ///////////

    const maps = {

      browser: {
        oldsafari: {
          version: {
            '1.0': '/8',
            1.2: '/1',
            1.3: '/3',
            '2.0': '/412',
            '2.0.2': '/416',
            '2.0.3': '/417',
            '2.0.4': '/419',
            '?': '/'
          }
        }
      },

      device: {
        amazon: {
          model: {
            'Fire Phone': ['SD', 'KF']
          }
        },
        sprint: {
          model: {
            'Evo Shift 4G': '7373KT'
          },
          vendor: {
            HTC: 'APA',
            Sprint: 'Sprint'
          }
        }
      },

      os: {
        windows: {
          version: {
            ME: '4.90',
            'NT 3.11': 'NT3.51',
            'NT 4.0': 'NT4.0',
            2000: 'NT 5.0',
            XP: ['NT 5.1', 'NT 5.2'],
            Vista: 'NT 6.0',
            7: 'NT 6.1',
            8: 'NT 6.2',
            8.1: 'NT 6.3',
            10: ['NT 6.4', 'NT 10.0'],
            RT: 'ARM'
          }
        }
      }
    };

    /// ///////////
    // Regex map
    /// //////////

    const regexes = {

      browser: [[

        // Presto based
        /(opera\smini)\/([\w\.-]+)/i, // Opera Mini
        /(opera\s[mobiletab]+).+version\/([\w\.-]+)/i, // Opera Mobi/Tablet
        /(opera).+version\/([\w\.]+)/i, // Opera > 9.80
        /(opera)[\/\s]+([\w\.]+)/i // Opera < 9.80
      ], [NAME, VERSION], [

        /(opios)[\/\s]+([\w\.]+)/i // Opera mini on iphone >= 8.0
      ], [[NAME, 'Opera Mini'], VERSION], [

        /\s(opr)\/([\w\.]+)/i // Opera Webkit
      ], [[NAME, 'Opera'], VERSION], [

        // Mixed
        /(kindle)\/([\w\.]+)/i, // Kindle
        /(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]*)/i,
        // Lunascape/Maxthon/Netfront/Jasmine/Blazer

        // Trident based
        /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,
        // Avant/IEMobile/SlimBrowser/Baidu
        /(?:ms|\()(ie)\s([\w\.]+)/i, // Internet Explorer

        // Webkit/KHTML based
        /(rekonq)\/([\w\.]*)/i, // Rekonq
        /(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark)\/([\w\.-]+)/i
        // Chromium/Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS/Bowser
      ], [NAME, VERSION], [

        /(trident).+rv[:\s]([\w\.]+).+like\sgecko/i // IE11
      ], [[NAME, 'IE'], VERSION], [

        /(edge|edgios|edgea)\/((\d+)?[\w\.]+)/i // Microsoft Edge
      ], [[NAME, 'Edge'], VERSION], [

        /(yabrowser)\/([\w\.]+)/i // Yandex
      ], [[NAME, 'Yandex'], VERSION], [

        /(puffin)\/([\w\.]+)/i // Puffin
      ], [[NAME, 'Puffin'], VERSION], [

        /((?:[\s\/])uc?\s?browser|(?:juc.+)ucweb)[\/\s]?([\w\.]+)/i
        // UCBrowser
      ], [[NAME, 'UCBrowser'], VERSION], [

        /(comodo_dragon)\/([\w\.]+)/i // Comodo Dragon
      ], [[NAME, /_/g, ' '], VERSION], [

        /(micromessenger)\/([\w\.]+)/i // WeChat
      ], [[NAME, 'WeChat'], VERSION], [

        /(qqbrowserlite)\/([\w\.]+)/i // QQBrowserLite
      ], [NAME, VERSION], [

        /(QQ)\/([\d\.]+)/i // QQ, aka ShouQ
      ], [NAME, VERSION], [

        /m?(qqbrowser)[\/\s]?([\w\.]+)/i // QQBrowser
      ], [NAME, VERSION], [

        /(BIDUBrowser)[\/\s]?([\w\.]+)/i // Baidu Browser
      ], [NAME, VERSION], [

        /(2345Explorer)[\/\s]?([\w\.]+)/i // 2345 Browser
      ], [NAME, VERSION], [

        /(MetaSr)[\/\s]?([\w\.]+)/i // SouGouBrowser
      ], [NAME], [

        /(LBBROWSER)/i // LieBao Browser
      ], [NAME], [

        /xiaomi\/miuibrowser\/([\w\.]+)/i // MIUI Browser
      ], [VERSION, [NAME, 'MIUI Browser']], [

        /;fbav\/([\w\.]+);/i // Facebook App for iOS & Android
      ], [VERSION, [NAME, 'Facebook']], [

        /headlesschrome(?:\/([\w\.]+)|\s)/i // Chrome Headless
      ], [VERSION, [NAME, 'Chrome Headless']], [

        /\swv\).+(chrome)\/([\w\.]+)/i // Chrome WebView
      ], [[NAME, /(.+)/, '$1 WebView'], VERSION], [

        /((?:oculus|samsung)browser)\/([\w\.]+)/i
      ], [[NAME, /(.+(?:g|us))(.+)/, '$1 $2'], VERSION], [ // Oculus / Samsung Browser

        /android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)*/i // Android Browser
      ], [VERSION, [NAME, 'Android Browser']], [

        /(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i
        // Chrome/OmniWeb/Arora/Tizen/Nokia
      ], [NAME, VERSION], [

        /(dolfin)\/([\w\.]+)/i // Dolphin
      ], [[NAME, 'Dolphin'], VERSION], [

        /((?:android.+)crmo|crios)\/([\w\.]+)/i // Chrome for Android/iOS
      ], [[NAME, 'Chrome'], VERSION], [

        /(coast)\/([\w\.]+)/i // Opera Coast
      ], [[NAME, 'Opera Coast'], VERSION], [

        /fxios\/([\w\.-]+)/i // Firefox for iOS
      ], [VERSION, [NAME, 'Firefox']], [

        /version\/([\w\.]+).+?mobile\/\w+\s(safari)/i // Mobile Safari
      ], [VERSION, [NAME, 'Mobile Safari']], [

        /version\/([\w\.]+).+?(mobile\s?safari|safari)/i // Safari & Safari Mobile
      ], [VERSION, NAME], [

        /webkit.+?(gsa)\/([\w\.]+).+?(mobile\s?safari|safari)(\/[\w\.]+)/i // Google Search Appliance on iOS
      ], [[NAME, 'GSA'], VERSION], [

        /webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i // Safari < 3.0
      ], [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]], [

        /(konqueror)\/([\w\.]+)/i, // Konqueror
        /(webkit|khtml)\/([\w\.]+)/i
      ], [NAME, VERSION], [

        // Gecko based
        /(navigator|netscape)\/([\w\.-]+)/i // Netscape
      ], [[NAME, 'Netscape'], VERSION], [
        /(swiftfox)/i, // Swiftfox
        /(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,
        // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror
        /(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([\w\.-]+)$/i,

        // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
        /(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i, // Mozilla

        // Other
        /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir)[\/\s]?([\w\.]+)/i,
        // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir
        /(links)\s\(([\w\.]+)/i, // Links
        /(gobrowser)\/?([\w\.]*)/i, // GoBrowser
        /(ice\s?browser)\/v?([\w\._]+)/i, // ICE Browser
        /(mosaic)[\/\s]([\w\.]+)/i // Mosaic
      ], [NAME, VERSION]

        /* /////////////////////
        // Media players BEGIN
        ////////////////////////

        , [

        /(apple(?:coremedia|))\/((\d+)[\w\._]+)/i, // Generic Apple CoreMedia
        /(coremedia) v((\d+)[\w\._]+)/i
        ], [NAME, VERSION], [

        /(aqualung|lyssna|bsplayer)\/((\d+)?[\w\.-]+)/i // Aqualung/Lyssna/BSPlayer
        ], [NAME, VERSION], [

        /(ares|ossproxy)\s((\d+)[\w\.-]+)/i                                 // Ares/OSSProxy
        ], [NAME, VERSION], [

        /(audacious|audimusicstream|amarok|bass|core|dalvik|gnomemplayer|
          music on console|nsplayer|psp-internetradioplayer|videos)\/((\d+)[\w\.-]+)/i,
        // Audacious/AudiMusicStream/Amarok/BASS/OpenCORE/Dalvik/GnomeMplayer/MoC
        // NSPlayer/PSP-InternetRadioPlayer/Videos
        /(clementine|music player daemon)\s((\d+)[\w\.-]+)/i,               // Clementine/MPD
        /(lg player|nexplayer)\s((\d+)[\d\.]+)/i,
        /player\/(nexplayer|lg player)\s((\d+)[\w\.-]+)/i                   // NexPlayer/LG Player
        ], [NAME, VERSION], [
        /(nexplayer)\s((\d+)[\w\.-]+)/i                                     // Nexplayer
        ], [NAME, VERSION], [

        /(flrp)\/((\d+)[\w\.-]+)/i                                          // Flip Player
        ], [[NAME, 'Flip Player'], VERSION], [

        /(fstream|nativehost|queryseekspider|ia-archiver|facebookexternalhit)/i
        // FStream/NativeHost/QuerySeekSpider/IA Archiver/facebookexternalhit
        ], [NAME], [

        /(gstreamer) souphttpsrc (?:\([^\)]+\)){0,1} libsoup\/((\d+)[\w\.-]+)/i
                                                                            // Gstreamer
        ], [NAME, VERSION], [

        /(htc streaming player)\s[\w_]+\s\/\s((\d+)[\d\.]+)/i,              // HTC Streaming Player
        /(java|python-urllib|python-requests|wget|libcurl)\/((\d+)[\w\.-_]+)/i,
        // Java/urllib/requests/wget/cURL
        /(lavf)((\d+)[\d\.]+)/i                                             // Lavf (FFMPEG)
        ], [NAME, VERSION], [

        /(htc_one_s)\/((\d+)[\d\.]+)/i                                      // HTC One S
        ], [[NAME, /_/g, ' '], VERSION], [

        /(mplayer)(?:\s|\/)(?:(?:sherpya-){0,1}svn)(?:-|\s)(r\d+(?:-\d+[\w\.-]+){0,1})/i
                                                                            // MPlayer SVN
        ], [NAME, VERSION], [

        /(mplayer)(?:\s|\/|[unkow-]+)((\d+)[\w\.-]+)/i                      // MPlayer
        ], [NAME, VERSION], [

        /(mplayer)/i, // MPlayer (no other info)
        /(yourmuze)/i,                                                      // YourMuze
        /(media player classic|nero showtime)/i // Media Player Classic/Nero ShowTime
        ], [NAME], [

        /(nero (?:home|scout))\/((\d+)[\w\.-]+)/i                           // Nero Home/Nero Scout
        ], [NAME, VERSION], [

        /(nokia\d+)\/((\d+)[\w\.-]+)/i                                      // Nokia
        ], [NAME, VERSION], [

        /\s(songbird)\/((\d+)[\w\.-]+)/i // Songbird/Philips-Songbird
        ], [NAME, VERSION], [

        /(winamp)3 version ((\d+)[\w\.-]+)/i,                               // Winamp
        /(winamp)\s((\d+)[\w\.-]+)/i,
        /(winamp)mpeg\/((\d+)[\w\.-]+)/i
        ], [NAME, VERSION], [

        /(ocms-bot|tapinradio|tunein radio|unknown|winamp|inlight radio)/i
        // OCMS-bot/tap in radio/tunein/unknown/winamp (no other info)
                                                                            // inlight radio
        ], [NAME], [

        /(quicktime|rma|radioapp|radioclientapplication|soundtap|totem|
          stagefright|streamium)\/((\d+)[\w\.-]+)/i
        // QuickTime/RealMedia/RadioApp/RadioClientApplication/
        // SoundTap/Totem/Stagefright/Streamium
        ], [NAME, VERSION], [

        /(smp)((\d+)[\d\.]+)/i                                              // SMP
        ], [NAME, VERSION], [

        /(vlc) media player - version ((\d+)[\w\.]+)/i,                     // VLC Videolan
        /(vlc)\/((\d+)[\w\.-]+)/i,
        /(xbmc|gvfs|xine|xmms|irapp)\/((\d+)[\w\.-]+)/i, // XBMC/gvfs/Xine/XMMS/irapp
        /(foobar2000)\/((\d+)[\d\.]+)/i,                                    // Foobar2000
        /(itunes)\/((\d+)[\d\.]+)/i                                         // iTunes
        ], [NAME, VERSION], [

        /(wmplayer)\/((\d+)[\w\.-]+)/i,                                     // Windows Media Player
        /(windows-media-player)\/((\d+)[\w\.-]+)/i
        ], [[NAME, /-/g, ' '], VERSION], [

        /windows\/((\d+)[\w\.-]+) upnp\/[\d\.]+ dlnadoc\/[\d\.]+ (home media server)/i
                                                                            // Windows Media Server
        ], [VERSION, [NAME, 'Windows']], [

        /(com\.riseupradioalarm)\/((\d+)[\d\.]*)/i                          // RiseUP Radio Alarm
        ], [NAME, VERSION], [

        /(rad.io)\s((\d+)[\d\.]+)/i,                                        // Rad.io
        /(radio.(?:de|at|fr))\s((\d+)[\d\.]+)/i
        ], [[NAME, 'rad.io'], VERSION]

        //////////////////////
        // Media players END
        //////////////////// */

      ],

      cpu: [[

        /(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i // AMD64
      ], [[ARCHITECTURE, 'amd64']], [

        /(ia32(?=;))/i // IA32 (quicktime)
      ], [[ARCHITECTURE, util.lowerize]], [

        /((?:i[346]|x)86)[;\)]/i // IA32
      ], [[ARCHITECTURE, 'ia32']], [

        // PocketPC mistakenly identified as PowerPC
        /windows\s(ce|mobile);\sppc;/i
      ], [[ARCHITECTURE, 'arm']], [

        /((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i // PowerPC
      ], [[ARCHITECTURE, /ower/, '', util.lowerize]], [

        /(sun4\w)[;\)]/i // SPARC
      ], [[ARCHITECTURE, 'sparc']], [

        /((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+;))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i
        // IA64, 68K, ARM/64, AVR/32, IRIX/64, MIPS/64, SPARC/64, PA-RISC
      ], [[ARCHITECTURE, util.lowerize]]
      ],

      device: [[

        /\((ipad|playbook);[\w\s\);-]+(rim|apple)/i // iPad/PlayBook
      ], [MODEL, VENDOR, [TYPE, TABLET]], [

        /applecoremedia\/[\w\.]+ \((ipad)/ // iPad
      ], [MODEL, [VENDOR, 'Apple'], [TYPE, TABLET]], [

        /(apple\s{0,1}tv)/i // Apple TV
      ], [[MODEL, 'Apple TV'], [VENDOR, 'Apple']], [

        /(archos)\s(gamepad2?)/i, // Archos
        /(hp).+(touchpad)/i, // HP TouchPad
        /(hp).+(tablet)/i, // HP Tablet
        /(kindle)\/([\w\.]+)/i, // Kindle
        /\s(nook)[\w\s]+build\/(\w+)/i, // Nook
        /(dell)\s(strea[kpr\s\d]*[\dko])/i // Dell Streak
      ], [VENDOR, MODEL, [TYPE, TABLET]], [

        /(kf[A-z]+)\sbuild\/.+silk\//i // Kindle Fire HD
      ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [
        /(sd|kf)[0349hijorstuw]+\sbuild\/.+silk\//i // Fire Phone
      ], [[MODEL, mapper.str, maps.device.amazon.model], [VENDOR, 'Amazon'], [TYPE, MOBILE]], [

        /\((ip[honed|\s\w*]+);.+(apple)/i // iPod/iPhone
      ], [MODEL, VENDOR, [TYPE, MOBILE]], [
        /\((ip[honed|\s\w*]+);/i // iPod/iPhone
      ], [MODEL, [VENDOR, 'Apple'], [TYPE, MOBILE]], [

        /(blackberry)[\s-]?(\w+)/i, // BlackBerry
        /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[\s_-]?([\w-]*)/i,
        // BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Meizu/Motorola/Polytron
        /(hp)\s([\w\s]+\w)/i, // HP iPAQ
        /(asus)-?(\w+)/i // Asus
      ], [VENDOR, MODEL, [TYPE, MOBILE]], [
        /\(bb10;\s(\w+)/i // BlackBerry 10
      ], [MODEL, [VENDOR, 'BlackBerry'], [TYPE, MOBILE]], [
        // Asus Tablets
        /android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7|padfone)/i
      ], [MODEL, [VENDOR, 'Asus'], [TYPE, TABLET]], [

        /(sony)\s(tablet\s[ps])\sbuild\//i, // Sony
        /(sony)?(?:sgp.+)\sbuild\//i
      ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Tablet'], [TYPE, TABLET]], [
        /android.+\s([c-g]\d{4}|so[-l]\w+)\sbuild\//i
      ], [MODEL, [VENDOR, 'Sony'], [TYPE, MOBILE]], [

        /\s(ouya)\s/i, // Ouya
        /(nintendo)\s([wids3u]+)/i // Nintendo
      ], [VENDOR, MODEL, [TYPE, CONSOLE]], [

        /android.+;\s(shield)\sbuild/i // Nvidia
      ], [MODEL, [VENDOR, 'Nvidia'], [TYPE, CONSOLE]], [

        /(playstation\s[34portablevi]+)/i // Playstation
      ], [MODEL, [VENDOR, 'Sony'], [TYPE, CONSOLE]], [

        /(sprint\s(\w+))/i // Sprint Phones
      ], [[VENDOR, mapper.str, maps.device.sprint.vendor],
        [MODEL, mapper.str, maps.device.sprint.model], [TYPE, MOBILE]], [

        /(lenovo)\s?(S(?:5000|6000)+(?:[-][\w+]))/i // Lenovo tablets
      ], [VENDOR, MODEL, [TYPE, TABLET]], [

        /(htc)[;_\s-]+([\w\s]+(?=\))|\w+)*/i, // HTC
        /(zte)-(\w*)/i, // ZTE
        /(alcatel|geeksphone|lenovo|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]*)/i
        // Alcatel/GeeksPhone/Lenovo/Nexian/Panasonic/Sony
      ], [VENDOR, [MODEL, /_/g, ' '], [TYPE, MOBILE]], [

        /(nexus\s9)/i // HTC Nexus 9
      ], [MODEL, [VENDOR, 'HTC'], [TYPE, TABLET]], [

        /d\/huawei([\w\s-]+)[;\)]/i,
        /(nexus\s6p)/i // Huawei
      ], [MODEL, [VENDOR, 'Huawei'], [TYPE, MOBILE]], [

        /(microsoft);\s(lumia[\s\w]+)/i // Microsoft Lumia
      ], [VENDOR, MODEL, [TYPE, MOBILE]], [

        /[\s\(;](xbox(?:\sone)?)[\s\);]/i // Microsoft Xbox
      ], [MODEL, [VENDOR, 'Microsoft'], [TYPE, CONSOLE]], [
        /(kin\.[onetw]{3})/i // Microsoft Kin
      ], [[MODEL, /\./g, ' '], [VENDOR, 'Microsoft'], [TYPE, MOBILE]], [

        // Motorola
        /\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?:?(\s4g)?)[\w\s]+build\//i,
        /mot[\s-]?(\w*)/i,
        /(XT\d{3,4}) build\//i,
        /(nexus\s6)/i
      ], [MODEL, [VENDOR, 'Motorola'], [TYPE, MOBILE]], [
        /android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i
      ], [MODEL, [VENDOR, 'Motorola'], [TYPE, TABLET]], [

        /hbbtv\/\d+\.\d+\.\d+\s+\([\w\s]*;\s*(\w[^;]*);([^;]*)/i // HbbTV devices
      ], [[VENDOR, util.trim], [MODEL, util.trim], [TYPE, SMARTTV]], [

        /hbbtv.+maple;(\d+)/i
      ], [[MODEL, /^/, 'SmartTV'], [VENDOR, 'Samsung'], [TYPE, SMARTTV]], [

        /\(dtv[\);].+(aquos)/i // Sharp
      ], [MODEL, [VENDOR, 'Sharp'], [TYPE, SMARTTV]], [

        /android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n\d+|sgh-t8[56]9|nexus 10))/i,
        /((SM-T\w+))/i
      ], [[VENDOR, 'Samsung'], MODEL, [TYPE, TABLET]], [ // Samsung
        /smart-tv.+(samsung)/i
      ], [VENDOR, [TYPE, SMARTTV], MODEL], [
        /((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-\w[\w\d]+))/i,
        /(sam[sung]*)[\s-]*(\w+-?[\w-]*)/i,
        /sec-((sgh\w+))/i
      ], [[VENDOR, 'Samsung'], MODEL, [TYPE, MOBILE]], [

        /sie-(\w*)/i // Siemens
      ], [MODEL, [VENDOR, 'Siemens'], [TYPE, MOBILE]], [

        /(maemo|nokia).*(n900|lumia\s\d+)/i, // Nokia
        /(nokia)[\s_-]?([\w-]*)/i
      ], [[VENDOR, 'Nokia'], MODEL, [TYPE, MOBILE]], [

        /android\s3\.[\s\w;-]{10}(a\d{3})/i // Acer
      ], [MODEL, [VENDOR, 'Acer'], [TYPE, TABLET]], [

        /android.+([vl]k\-?\d{3})\s+build/i // LG Tablet
      ], [MODEL, [VENDOR, 'LG'], [TYPE, TABLET]], [
        /android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i // LG Tablet
      ], [[VENDOR, 'LG'], MODEL, [TYPE, TABLET]], [
        /(lg) netcast\.tv/i // LG SmartTV
      ], [VENDOR, MODEL, [TYPE, SMARTTV]], [
        /(nexus\s[45])/i, // LG
        /lg[e;\s\/-]+(\w*)/i,
        /android.+lg(\-?[\d\w]+)\s+build/i
      ], [MODEL, [VENDOR, 'LG'], [TYPE, MOBILE]], [

        /android.+(ideatab[a-z0-9\-\s]+)/i // Lenovo
      ], [MODEL, [VENDOR, 'Lenovo'], [TYPE, TABLET]], [

        /linux;.+((jolla));/i // Jolla
      ], [VENDOR, MODEL, [TYPE, MOBILE]], [

        /((pebble))app\/[\d\.]+\s/i // Pebble
      ], [VENDOR, MODEL, [TYPE, WEARABLE]], [

        /android.+;\s(oppo)\s?([\w\s]+)\sbuild/i // OPPO
      ], [VENDOR, MODEL, [TYPE, MOBILE]], [

        /crkey/i // Google Chromecast
      ], [[MODEL, 'Chromecast'], [VENDOR, 'Google']], [

        /android.+;\s(glass)\s\d/i // Google Glass
      ], [MODEL, [VENDOR, 'Google'], [TYPE, WEARABLE]], [

        /android.+;\s(pixel c)\s/i // Google Pixel C
      ], [MODEL, [VENDOR, 'Google'], [TYPE, TABLET]], [

        /android.+;\s(pixel xl|pixel)\s/i // Google Pixel
      ], [MODEL, [VENDOR, 'Google'], [TYPE, MOBILE]], [

        /android.+;\s(\w+)\s+build\/hm\1/i, // Xiaomi Hongmi 'numeric' models
        /android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i, // Xiaomi Hongmi
        /android.+(mi[\s\-_]*(?:one|one[\s_]plus|note lte)?[\s_]*(?:\d?\w?)[\s_]*(?:plus)?)\s+build/i, // Xiaomi Mi
        /android.+(redmi[\s\-_]*(?:note)?(?:[\s_]*[\w\s]+))\s+build/i // Redmi Phones
      ], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, MOBILE]], [
        /android.+(mi[\s\-_]*(?:pad)(?:[\s_]*[\w\s]+))\s+build/i // Mi Pad tablets
      ], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, TABLET]], [
        /android.+;\s(m[1-5]\snote)\sbuild/i // Meizu Tablet
      ], [MODEL, [VENDOR, 'Meizu'], [TYPE, TABLET]], [

        /android.+a000(1)\s+build/i, // OnePlus
        /android.+oneplus\s(a\d{4})\s+build/i
      ], [MODEL, [VENDOR, 'OnePlus'], [TYPE, MOBILE]], [

        /android.+[;\/]\s*(RCT[\d\w]+)\s+build/i // RCA Tablets
      ], [MODEL, [VENDOR, 'RCA'], [TYPE, TABLET]], [

        /android.+[;\/\s]+(Venue[\d\s]{2,7})\s+build/i // Dell Venue Tablets
      ], [MODEL, [VENDOR, 'Dell'], [TYPE, TABLET]], [

        /android.+[;\/]\s*(Q[T|M][\d\w]+)\s+build/i // Verizon Tablet
      ], [MODEL, [VENDOR, 'Verizon'], [TYPE, TABLET]], [

        /android.+[;\/]\s+(Barnes[&\s]+Noble\s+|BN[RT])(V?.*)\s+build/i // Barnes & Noble Tablet
      ], [[VENDOR, 'Barnes & Noble'], MODEL, [TYPE, TABLET]], [

        /android.+[;\/]\s+(TM\d{3}.*\b)\s+build/i // Barnes & Noble Tablet
      ], [MODEL, [VENDOR, 'NuVision'], [TYPE, TABLET]], [

        /android.+;\s(k88)\sbuild/i // ZTE K Series Tablet
      ], [MODEL, [VENDOR, 'ZTE'], [TYPE, TABLET]], [

        /android.+[;\/]\s*(gen\d{3})\s+build.*49h/i // Swiss GEN Mobile
      ], [MODEL, [VENDOR, 'Swiss'], [TYPE, MOBILE]], [

        /android.+[;\/]\s*(zur\d{3})\s+build/i // Swiss ZUR Tablet
      ], [MODEL, [VENDOR, 'Swiss'], [TYPE, TABLET]], [

        /android.+[;\/]\s*((Zeki)?TB.*\b)\s+build/i // Zeki Tablets
      ], [MODEL, [VENDOR, 'Zeki'], [TYPE, TABLET]], [

        /(android).+[;\/]\s+([YR]\d{2})\s+build/i,
        /android.+[;\/]\s+(Dragon[\-\s]+Touch\s+|DT)(\w{5})\sbuild/i // Dragon Touch Tablet
      ], [[VENDOR, 'Dragon Touch'], MODEL, [TYPE, TABLET]], [

        /android.+[;\/]\s*(NS-?\w{0,9})\sbuild/i // Insignia Tablets
      ], [MODEL, [VENDOR, 'Insignia'], [TYPE, TABLET]], [

        /android.+[;\/]\s*((NX|Next)-?\w{0,9})\s+build/i // NextBook Tablets
      ], [MODEL, [VENDOR, 'NextBook'], [TYPE, TABLET]], [

        /android.+[;\/]\s*(Xtreme\_)?(V(1[045]|2[015]|30|40|60|7[05]|90))\s+build/i
      ], [[VENDOR, 'Voice'], MODEL, [TYPE, MOBILE]], [ // Voice Xtreme Phones

        /android.+[;\/]\s*(LVTEL\-)?(V1[12])\s+build/i // LvTel Phones
      ], [[VENDOR, 'LvTel'], MODEL, [TYPE, MOBILE]], [

        /android.+[;\/]\s*(V(100MD|700NA|7011|917G).*\b)\s+build/i // Envizen Tablets
      ], [MODEL, [VENDOR, 'Envizen'], [TYPE, TABLET]], [

        /android.+[;\/]\s*(Le[\s\-]+Pan)[\s\-]+(\w{1,9})\s+build/i // Le Pan Tablets
      ], [VENDOR, MODEL, [TYPE, TABLET]], [

        /android.+[;\/]\s*(Trio[\s\-]*.*)\s+build/i // MachSpeed Tablets
      ], [MODEL, [VENDOR, 'MachSpeed'], [TYPE, TABLET]], [

        /android.+[;\/]\s*(Trinity)[\-\s]*(T\d{3})\s+build/i // Trinity Tablets
      ], [VENDOR, MODEL, [TYPE, TABLET]], [

        /android.+[;\/]\s*TU_(1491)\s+build/i // Rotor Tablets
      ], [MODEL, [VENDOR, 'Rotor'], [TYPE, TABLET]], [

        /android.+(KS(.+))\s+build/i // Amazon Kindle Tablets
      ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [

        /android.+(Gigaset)[\s\-]+(Q\w{1,9})\s+build/i // Gigaset Tablets
      ], [VENDOR, MODEL, [TYPE, TABLET]], [

        /\s(tablet|tab)[;\/]/i, // Unidentifiable Tablet
        /\s(mobile)(?:[;\/]|\ssafari)/i // Unidentifiable Mobile
      ], [[TYPE, util.lowerize], VENDOR, MODEL], [

        /(android[\w\.\s\-]{0,9});.+build/i // Generic Android Device
      ], [MODEL, [VENDOR, 'Generic']]

        /* //////////////////////////
            // TODO: move to string map
            ////////////////////////////

            /(C6603)/i // Sony Xperia Z C6603
            ], [[MODEL, 'Xperia Z C6603'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [
            /(C6903)/i                                                          // Sony Xperia Z 1
            ], [[MODEL, 'Xperia Z 1'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [

            /(SM-G900[F|H])/i                                                   // Samsung Galaxy S5
            ], [[MODEL, 'Galaxy S5'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G7102)/i // Samsung Galaxy Grand 2
            ], [[MODEL, 'Galaxy Grand 2'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G530H)/i // Samsung Galaxy Grand Prime
            ], [[MODEL, 'Galaxy Grand Prime'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G313HZ)/i                                                      // Samsung Galaxy V
            ], [[MODEL, 'Galaxy V'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-T805)/i // Samsung Galaxy Tab S 10.5
            ], [[MODEL, 'Galaxy Tab S 10.5'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [
            /(SM-G800F)/i // Samsung Galaxy S5 Mini
            ], [[MODEL, 'Galaxy S5 Mini'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-T311)/i // Samsung Galaxy Tab 3 8.0
            ], [[MODEL, 'Galaxy Tab 3 8.0'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [

            /(T3C)/i // Advan Vandroid T3C
            ], [MODEL, [VENDOR, 'Advan'], [TYPE, TABLET]], [
            /(ADVAN T1J\+)/i // Advan Vandroid T1J+
            ], [[MODEL, 'Vandroid T1J+'], [VENDOR, 'Advan'], [TYPE, TABLET]], [
            /(ADVAN S4A)/i // Advan Vandroid S4A
            ], [[MODEL, 'Vandroid S4A'], [VENDOR, 'Advan'], [TYPE, MOBILE]], [

            /(V972M)/i                                                          // ZTE V972M
            ], [MODEL, [VENDOR, 'ZTE'], [TYPE, MOBILE]], [

            /(i-mobile)\s(IQ\s[\d\.]+)/i                                        // i-mobile IQ
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /(IQ6.3)/i // i-mobile IQ IQ 6.3
            ], [[MODEL, 'IQ 6.3'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
            /(i-mobile)\s(i-style\s[\d\.]+)/i                                   // i-mobile i-STYLE
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /(i-STYLE2.1)/i // i-mobile i-STYLE 2.1
            ], [[MODEL, 'i-STYLE 2.1'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [

            /(mobiistar touch LAI 512)/i // mobiistar touch LAI 512
            ], [[MODEL, 'Touch LAI 512'], [VENDOR, 'mobiistar'], [TYPE, MOBILE]], [

            /////////////
            // END TODO
            /////////// */

      ],

      engine: [[

        /windows.+\sedge\/([\w\.]+)/i // EdgeHTML
      ], [VERSION, [NAME, 'EdgeHTML']], [

        /(presto)\/([\w\.]+)/i, // Presto
        /(webkit|trident|netfront|netsurf|amaya|lynx|w3m)\/([\w\.]+)/i, // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m
        /(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i, // KHTML/Tasman/Links
        /(icab)[\/\s]([23]\.[\d\.]+)/i // iCab
      ], [NAME, VERSION], [

        /rv\:([\w\.]{1,9}).+(gecko)/i // Gecko
      ], [VERSION, NAME]
      ],

      os: [[

        // Windows based
        /microsoft\s(windows)\s(vista|xp)/i // Windows (iTunes)
      ], [NAME, VERSION], [
        /(windows)\snt\s6\.2;\s(arm)/i, // Windows RT
        /(windows\sphone(?:\sos)*)[\s\/]?([\d\.\s\w]*)/i, // Windows Phone
        /(windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i
      ], [NAME, [VERSION, mapper.str, maps.os.windows.version]], [
        /(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i
      ], [[NAME, 'Windows'], [VERSION, mapper.str, maps.os.windows.version]], [

        // Mobile/Embedded OS
        /\((bb)(10);/i // BlackBerry 10
      ], [[NAME, 'BlackBerry'], VERSION], [
        /(blackberry)\w*\/?([\w\.]*)/i, // Blackberry
        /(tizen)[\/\s]([\w\.]+)/i, // Tizen
        /(android|webos|palm\sos|qnx|bada|rim\stablet\sos|meego|contiki)[\/\s-]?([\w\.]*)/i,
        // Android/WebOS/Palm/QNX/Bada/RIM/MeeGo/Contiki
        /linux;.+(sailfish);/i // Sailfish OS
      ], [NAME, VERSION], [
        /(symbian\s?os|symbos|s60(?=;))[\/\s-]?([\w\.]*)/i // Symbian
      ], [[NAME, 'Symbian'], VERSION], [
        /\((series40);/i // Series 40
      ], [NAME], [
        /mozilla.+\(mobile;.+gecko.+firefox/i // Firefox OS
      ], [[NAME, 'Firefox OS'], VERSION], [

        // Console
        /(nintendo|playstation)\s([wids34portablevu]+)/i, // Nintendo/Playstation

        // GNU/Linux based
        /(mint)[\/\s\(]?(\w*)/i, // Mint
        /(mageia|vectorlinux)[;\s]/i, // Mageia/VectorLinux
        /(joli|[kxln]?ubuntu|debian|suse|opensuse|gentoo|(?=\s)arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?(?!chrom)([\w\.-]*)/i,
        // Joli/Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware
        // Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus
        /(hurd|linux)\s?([\w\.]*)/i, // Hurd/Linux
        /(gnu)\s?([\w\.]*)/i // GNU
      ], [NAME, VERSION], [

        /(cros)\s[\w]+\s([\w\.]+\w)/i // Chromium OS
      ], [[NAME, 'Chromium OS'], VERSION], [

        // Solaris
        /(sunos)\s?([\w\.\d]*)/i // Solaris
      ], [[NAME, 'Solaris'], VERSION], [

        // BSD based
        /\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]*)/i // FreeBSD/NetBSD/OpenBSD/PC-BSD/DragonFly
      ], [NAME, VERSION], [

        /(haiku)\s(\w+)/i // Haiku
      ], [NAME, VERSION], [

        /cfnetwork\/.+darwin/i,
        /ip[honead]{2,4}(?:.*os\s([\w]+)\slike\smac|;\sopera)/i // iOS
      ], [[VERSION, /_/g, '.'], [NAME, 'iOS']], [

        /(mac\sos\sx)\s?([\w\s\.]*)/i,
        /(macintosh|mac(?=_powerpc)\s)/i // Mac OS
      ], [[NAME, 'Mac OS'], [VERSION, /_/g, '.']], [

        // Other
        /((?:open)?solaris)[\/\s-]?([\w\.]*)/i, // Solaris
        /(aix)\s((\d)(?=\.|\)|\s)[\w\.])*/i, // AIX
        /(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms)/i,
        // Plan9/Minix/BeOS/OS2/AmigaOS/MorphOS/RISCOS/OpenVMS
        /(unix)\s?([\w\.]*)/i // UNIX
      ], [NAME, VERSION]
      ]
    };

    /// //////////////
    // Constructor
    /// /////////////
    /*
    var Browser = function (name, version) {
        this[NAME] = name;
        this[VERSION] = version;
    };
    var CPU = function (arch) {
        this[ARCHITECTURE] = arch;
    };
    var Device = function (vendor, model, type) {
        this[VENDOR] = vendor;
        this[MODEL] = model;
        this[TYPE] = type;
    };
    var Engine = Browser;
    var OS = Browser;
    */
    const UAParser = function (uastring, extensions) {
      if (typeof uastring === 'object') {
        extensions = uastring;
        uastring = undefined;
      }

      if (!(this instanceof UAParser)) {
        return new UAParser(uastring, extensions).getResult();
      }

      let ua = uastring || ((window && window.navigator && window.navigator.userAgent)
        ? window.navigator.userAgent : EMPTY);
      const rgxmap = extensions ? util.extend(regexes, extensions) : regexes;
      // var browser = new Browser();
      // var cpu = new CPU();
      // var device = new Device();
      // var engine = new Engine();
      // var os = new OS();

      this.getBrowser = function () {
        const browser = { name: undefined, version: undefined };
        mapper.rgx.call(browser, ua, rgxmap.browser);
        browser.major = util.major(browser.version); // deprecated
        return browser;
      };
      this.getCPU = function () {
        const cpu = { architecture: undefined };
        mapper.rgx.call(cpu, ua, rgxmap.cpu);
        return cpu;
      };
      this.getDevice = function () {
        const device = { vendor: undefined, model: undefined, type: undefined };
        mapper.rgx.call(device, ua, rgxmap.device);
        return device;
      };
      this.getEngine = function () {
        const engine = { name: undefined, version: undefined };
        mapper.rgx.call(engine, ua, rgxmap.engine);
        return engine;
      };
      this.getOS = function () {
        const os = { name: undefined, version: undefined };
        mapper.rgx.call(os, ua, rgxmap.os);
        return os;
      };
      this.getResult = function () {
        return {
          ua: this.getUA(),
          browser: this.getBrowser(),
          engine: this.getEngine(),
          os: this.getOS(),
          device: this.getDevice(),
          cpu: this.getCPU()
        };
      };
      this.getUA = function () {
        return ua;
      };
      this.setUA = function (uastring) {
        ua = uastring;
        // browser = new Browser();
        // cpu = new CPU();
        // device = new Device();
        // engine = new Engine();
        // os = new OS();
        return this;
      };
      return this;
    };

    UAParser.VERSION = LIBVERSION;
    UAParser.BROWSER = {
      NAME: NAME,
      MAJOR: MAJOR, // deprecated
      VERSION: VERSION
    };
    UAParser.CPU = {
      ARCHITECTURE: ARCHITECTURE
    };
    UAParser.DEVICE = {
      MODEL: MODEL,
      VENDOR: VENDOR,
      TYPE: TYPE,
      CONSOLE: CONSOLE,
      MOBILE: MOBILE,
      SMARTTV: SMARTTV,
      TABLET: TABLET,
      WEARABLE: WEARABLE,
      EMBEDDED: EMBEDDED
    };
    UAParser.ENGINE = {
      NAME: NAME,
      VERSION: VERSION
    };
    UAParser.OS = {
      NAME: NAME,
      VERSION: VERSION
    };
    // UAParser.Utils = util;

    /// ////////
    // Export
    /// ///////

    // check js environment
    if (typeof (exports) !== UNDEF_TYPE) {
      // nodejs env
      if (typeof module !== UNDEF_TYPE && module.exports) {
        exports = module.exports = UAParser;
      }
      // TODO: test!!!!!!!!
      /*
      if (require && require.main === module && process) {
          // cli
          var jsonize = function (arr) {
              var res = [];
              for (var i in arr) {
                  res.push(new UAParser(arr[i]).getResult());
              }
              process.stdout.write(JSON.stringify(res, null, 2) + '\n');
          };
          if (process.stdin.isTTY) {
              // via args
              jsonize(process.argv.slice(2));
          } else {
              // via pipe
              var str = '';
              process.stdin.on('readable', function() {
                  var read = process.stdin.read();
                  if (read !== null) {
                      str += read;
                  }
              });
              process.stdin.on('end', function () {
                  jsonize(str.replace(/\n$/, '').split('\n'));
              });
          }
      }
      */
      exports.UAParser = UAParser;
    } else {
      // requirejs env (optional)
      if (typeof (define) === FUNC_TYPE && define.amd) {
        define(() => {
          return UAParser;
        });
      } else if (window) {
        // browser env
        window.UAParser = UAParser;
      }
    }

    // jQuery/Zepto specific (optional)
    // Note:
    //   In AMD env the global scope should be kept clean, but jQuery is an exception.
    //   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
    //   and we should catch that.
    const $ = window && (window.jQuery || window.Zepto);
    if (typeof $ !== UNDEF_TYPE) {
      const parser = new UAParser();
      $.ua = parser.getResult();
      $.ua.get = function () {
        return parser.getUA();
      };
      $.ua.set = function (uastring) {
        parser.setUA(uastring);
        const result = parser.getResult();
        for (const prop in result) {
          $.ua[prop] = result[prop];
        }
      };
    }
  })(typeof window === 'object' ? window : this);
}, {}],
22: [function (require, module, exports) {
  (function (global) {
    let rng;

    const crypto = global.crypto || global.msCrypto; // for IE 11
    if (crypto && crypto.getRandomValues) {
      // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
      // Moderately fast, high quality
      const _rnds8 = new Uint8Array(16);
      rng = function whatwgRNG() {
        crypto.getRandomValues(_rnds8);
        return _rnds8;
      };
    }

    if (!rng) {
      // Math.random()-based (RNG)
      //
      // If all else fails, use Math.random().  It's fast, but is of unspecified
      // quality.
      const _rnds = new Array(16);
      rng = function () {
        for (let i = 0, r; i < 16; i++) {
          if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
          _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
        }

        return _rnds;
      };
    }

    module.exports = rng;
  }).call(this, typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : {});
}, {}],
23: [function (require, module, exports) {
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  const _rng = require('./rng');

  // Maps for number <-> hex string conversion
  const _byteToHex = [];
  const _hexToByte = {};
  for (let i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    const i = (buf && offset) || 0;
    let ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, (oct) => {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    let i = offset || 0;
    const bth = _byteToHex;
    return `${bth[buf[i++]] + bth[buf[i++]]
    + bth[buf[i++]] + bth[buf[i++]]}-${
      bth[buf[i++]]}${bth[buf[i++]]}-${
      bth[buf[i++]]}${bth[buf[i++]]}-${
      bth[buf[i++]]}${bth[buf[i++]]}-${
      bth[buf[i++]]}${bth[buf[i++]]
    }${bth[buf[i++]]}${bth[buf[i++]]
    }${bth[buf[i++]]}${bth[buf[i++]]}`;
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  const _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  const _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  let _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  let _lastMSecs = 0;
  let _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    let i = buf && offset || 0;
    const b = buf || [];

    options = options || {};

    let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    let msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    const dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs) / 10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq === undefined) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    const tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    const node = options.node || _nodeId;
    for (let n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    const i = buf && offset || 0;

    if (typeof (options) == 'string') {
      buf = options == 'binary' ? new Array(16) : null;
      options = null;
    }
    options = options || {};

    const rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (let ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  const uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;

  module.exports = uuid;
}, { './rng': 22 }],
24: [function (require, module, exports) {
  /*
  WildEmitter.js is a slim little event emitter by @henrikjoreteg largely based
  on @visionmedia's Emitter from UI Kit.

  Why? I wanted it standalone.

  I also wanted support for wildcard emitters like this:

  emitter.on('*', function (eventName, other, event, payloads) {

  });

  emitter.on('somenamespace*', function (eventName, payloads) {

  });

  Please note that callbacks triggered by wildcard registered events also get
  the event name as the first argument.
  */

  module.exports = WildEmitter;

  function WildEmitter() { }

  WildEmitter.mixin = function (constructor) {
    const prototype = constructor.prototype || constructor;

    prototype.isWildEmitter = true;

    // Listen on the given `event` with `fn`. Store a group name if present.
    prototype.on = function (event, groupName, fn) {
      this.callbacks = this.callbacks || {};
      const hasGroup = (arguments.length === 3);
      const group = hasGroup ? arguments[1] : undefined;
      const func = hasGroup ? arguments[2] : arguments[1];
      func._groupName = group;
      (this.callbacks[event] = this.callbacks[event] || []).push(func);
      return this;
    };

    // Adds an `event` listener that will be invoked a single
    // time then automatically removed.
    prototype.once = function (event, groupName, fn) {
      const self = this;
      const hasGroup = (arguments.length === 3);
      const group = hasGroup ? arguments[1] : undefined;
      const func = hasGroup ? arguments[2] : arguments[1];
      function on() {
        self.off(event, on);
        func.apply(this, arguments);
      }
      this.on(event, group, on);
      return this;
    };

    // Unbinds an entire group
    prototype.releaseGroup = function (groupName) {
      this.callbacks = this.callbacks || {};
      let item;
      let i;
      let len;
      let handlers;
      for (item in this.callbacks) {
        handlers = this.callbacks[item];
        for (i = 0, len = handlers.length; i < len; i++) {
          if (handlers[i]._groupName === groupName) {
            // console.log('removing');
            // remove it and shorten the array we're looping through
            handlers.splice(i, 1);
            i--;
            len--;
          }
        }
      }
      return this;
    };

    // Remove the given callback for `event` or all
    // registered callbacks.
    prototype.off = function (event, fn) {
      this.callbacks = this.callbacks || {};
      const callbacks = this.callbacks[event];
      var i;

      if (!callbacks) return this;

      // remove all handlers
      if (arguments.length === 1) {
        delete this.callbacks[event];
        return this;
      }

      // remove specific handler
      i = callbacks.indexOf(fn);
      callbacks.splice(i, 1);
      if (callbacks.length === 0) {
        delete this.callbacks[event];
      }
      return this;
    };

    /// Emit `event` with the given args.
    // also calls any `*` handlers
    prototype.emit = function (event) {
      this.callbacks = this.callbacks || {};
      const args = [].slice.call(arguments, 1);
      const callbacks = this.callbacks[event];
      const specialCallbacks = this.getWildcardCallbacks(event);
      let i;
      let len;
      let item;
      let listeners;

      if (callbacks) {
        listeners = callbacks.slice();
        for (i = 0, len = listeners.length; i < len; ++i) {
          if (!listeners[i]) {
            break;
          }
          listeners[i].apply(this, args);
        }
      }

      if (specialCallbacks) {
        len = specialCallbacks.length;
        listeners = specialCallbacks.slice();
        for (i = 0, len = listeners.length; i < len; ++i) {
          if (!listeners[i]) {
            break;
          }
          listeners[i].apply(this, [event].concat(args));
        }
      }

      return this;
    };

    // Helper for for finding special wildcard event handlers that match the event
    prototype.getWildcardCallbacks = function (eventName) {
      this.callbacks = this.callbacks || {};
      let item;
      let split;
      let result = [];

      for (item in this.callbacks) {
        split = item.split('*');
        if (item === '*' || (split.length === 2 && eventName.slice(0, split[0].length) === split[0])) {
          result = result.concat(this.callbacks[item]);
        }
      }
      return result;
    };
  };

  WildEmitter.mixin(WildEmitter);
}, {}]
}, {}, [2])(2);
});

/**
 * ACEKurento object.
 * @constructor
 * @param {Object} config - Configuration parameters.
 * @param {String} configuration.connectionId
 * @param {String} configuration.acekurentoSignalingUrl
 * @param {String} configuration.displayName
 * @param {String} configuration.sipUsername
 * @param {String} configuration.sipPassword
 * @param {Boolean} configuration.guestUser
 * @param {String} configuration.sipUri
 * @example
 * // creates a ACEKurento instance that connects to wss://localhost:8443/signaling
 * // websocket server and uses "test" as display name when SIP calling
 *
 * var acekurento = new ACEKurento({
 *   acekurentoSignalingUrl: 'wss://localhost:8443/signaling',
 *   displayName: 'test'
 * });
 * @returns {Object} acekurento
 */
function ACEKurento(config) {
  let ws;
  if (config && config.hasOwnProperty('acekurentoSignalingUrl')) {
    ws = new WebSocket(config.acekurentoSignalingUrl);
  } else {
    ws = new WebSocket(`wss://${window.location.host}/signaling`);
  }
  let selfStream;
  let remoteStream;
  let webRtcPeer;

  const NOT_REGISTERED = 0;
  const REGISTERING = 1;
  const REGISTERED = 2;
  let registerState = NOT_REGISTERED;

  const NO_CALL = 0;
  const PROCESSING_CALL = 1;
  const IN_CALL = 2;
  // var callState = null;
  let holdCb = null;
  let peerOnHold = false;

  /** @member {Object} */
  const acekurento = acekurento || {};

  // extend.js
  // Written by Andrew Dupont, optimized by Addy Osmani
  function extend(destination, source) {
    const toString = Object.prototype.toString;
    const objTest = toString.call({});

    for (const property in source) {
      if (source[property] && objTest === toString.call(source[property])) {
        destination[property] = destination[property] || {};
        extend(destination[property], source[property]);
      } else {
        destination[property] = source[property];
      }
    }
    return destination;
  }

  /**
   * We extend ACEKurento to be a global var to execute ACEKurento functions
   */
  extend(acekurento, {
    /**
     * WebSocket object
     */
    ua: ws,
    /**
     * Indicate if video should be used or not.
     */
    enableVideo: true,
    /**
     * Indicate if audio should be used or not.
     */
    enableAudio: true,
    /**
     * The actual WebRTC session
     */
    rtcSession: {},
    /**
     * The WebRTC local stream
     */
    selfStream: this.selfStream || null,
    /**
     * The WebRTC remote stream
     */
    remoteStream: this.remoteStream || null,
    /**
     * PeerConnection function, returns pc
     */
    pc: function () {
      return webRtcPeer.peerConnection;
    },
    /**
     * Media Stream function, a interface represents a stream of local media content
     */
    mediaStream: function () {
      return webRtcPeer.localVideo.srcObject;
    },
    /**
     * Call id for current session
     */
    callid: '',
    /**
     * Call id of previous session
     */
    previous_callid: '',
    /**
     * Call state string
     */
    callState: this.callState || null,
    /**
     * Call isLoopback boolean
     */
    isLoopback: this.isLoopback || false,
    /**
     * Call IsScreensharing boolean
     */
    isScreensharing: this.isScreensharing || false,
    /**
     * Configuration object use to hold authentication data as well as other config call parameters.
     * You can find the available config options in {@link ACEKurento}
     */
    configuration: {
      connectionId: undefined,
      acekurentoSignalingUrl: this.acekurentoSignalingUrl,
      displayName: this.displayName,
      sipUsername: this.sipUsername,
      sipPassword: this.sipPassword,
      guestUser: false,
      sipUri: this.sipUri
    },
    /**
     * Event handlers. {@link #Events}
     */
    eventHandlers: {
      /**
       * Connected Event
       * @event {Function} connected
       * @example
       * // displays "'--- Connected ---" in console log when connected to asterisk
       * var eventHandlers = {
       *   'connected': function (e) {
       *     console.log('--- Connected ---\n');
       *   }
       * }
       * acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
       */
      connected: function (e) {},
      /**
       * Register Response Event
       * @event {Function} registerResponse
       */
      registerResponse: function (e) {},
      /**
       * Call Response Event
       * @event {Function} callResponse
       */
      callResponse: function (e) {},
      /**
       * Call incoming Event
       * @event {Function} incomingCall
       */
      incomingCall: function (e) {},
      /**
       * Call in progress Event
       * @event {Function} progress
       */
      progress: function (e) {},
      /**
       * Call Accepted Event
       * @event {Function} accepted (20X sent/received)
       */
      accepted: function (e) {},
      /**
       * Call sipConfirmed Event (ACK sent/received)
       * @event {Function} sipConfirmed
       */
      sipConfirmed: function (e) {},
      /**
       * Call error Event
       * @event {Function} callError
       */
      callError: function (e) {},
      /**
       * Call ended Event
       * @event {Function} ended
       */
      ended: function (e) {},
      /**
       * Call queue paused Event
       * @event {Function} pausedQueue
       */
      pausedQueue: function (e) {},
      /**
       * Call queue unpaused Event
       * @event {Function} unpausedQueue
       */
      unpausedQueue: function (e) {},
      /**
       * Call recording started Event
       * @event {Function} callRecording
       */
      startedRecording: function (e) {},
      /**
       * Call recording stopped Event
       * @event {Function} stoppedRecording
       */
      stoppedRecording: function (e) {},
      /**
       * Call invite to another peer response
       * @event {Function} inviteResponse
       */
      inviteResponse: function (e) {},
      /**
       * Call transfer SIP request to peer response
       * @event {Function} callTransferResponse
       */
      callTransferResponse: function (e) {},
      /**
       * Call reinvite to another peer response
       * @event {Function} reinviteResponse
       */
      reinviteResponse: function (e) {},
      /**
       * Call SIP update to another peer response
       * @event {Function} updateResponse
       */
      updateResponse: function (e) {},
      /**
       * Call webrtc peer restart response
       * @event {Function} restartCallResponse
       */
      restartCallResponse: function (e) {},
      /**
       * Invoked when the number of participants on a call changes
       * @event {Function} participantsUpdate
       */
      participantsUpdate: function (e) {},
      /**
       * newMessage Event
       * @event {Function} newMessage
       */
      newMessage: function (e) {}
    },
    /**
     * Connect and call, loopback stream to Kurento
     * @param {Number} ext - It is the extension used for the loopback call
     */
    loopback: function (ext) {
      setCallState(PROCESSING_CALL);
      this.isLoopback = true;
      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');

        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          const message = {
            id: 'loopback',
            ext: ext,
            sdp: offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Connect, register to node backend and Asterisk using JSSIP
     * @param {String} sipUsername - It is your sip uri, the uri of the caller/callee to register
     * @param {String} sipPassword - It is your sip password,
     * the password of the caller/callee to register
     * @param {Boolean} isAgent - Boolean to let backend know if you are an agent
     */
    register: function (sipUsername, sipPassword, isAgent) {
      const ext = sipUsername || this.sipUsername;
      const password = sipPassword || this.sipPassword;

      if (!ext) {
        throw new Error('You must insert your user uri extension');
      }

      setRegisterState(REGISTERING);

      const message = {
        id: 'register',
        ext: ext,
        password: password,
        isAgent: isAgent
      };
      sendMessage(message);
    },
    /**
     * Makes a call
     * @param {String} uri - uri is the callee, the sip uri of the person to call
     * @param {Boolean} skipQueue - Skip queue,
     * if "true" call sending media directly through Kurento (no Asterisk)
     */
    call: function (uri, skipQueue) {
      if (!uri) {
        console.log('You must specify the peer ext');
        return;
      } else if (acekurento.callState === PROCESSING_CALL || acekurento.callState === IN_CALL) {
        console.log('You are already on a call');
        return;
      }
      setCallState(PROCESSING_CALL);

      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');

        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          const message = {
            id: 'call',
            uri: uri,
            sdp: offerSdp,
            skipQueue: skipQueue
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Accepts an incoming call
     */
    acceptCall: function (message) {
      setCallState(PROCESSING_CALL);

      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableAudio,
          video: this.enableVideo
        }
      };

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }

        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          const response = {
            id: 'accept',
            caller: message.caller,
            sdp: offerSdp
          };
          sendMessage(response);
        });
      });
    },
    /**
     * Decline incoming call
     */
    declineCall: function (message) {
      console.log(`Incoming call! Call state: ${this.callState}`);
      setCallState(PROCESSING_CALL);

      const response = {
        id: 'decline',
        caller: message.caller
      };
      sendMessage(response);
      acekurento.stop();
    },
    /**
     * Stops a call
     * @param {Boolean} removeFromQueue - removeFromQueue boolean
     * "true" to send hangup message and leave member queue.
     * Else just hangup
     */
    stop: function (removeFromQueue) {
      (removeFromQueue) ? console.info('stop initiated! (And remove from queue)') : console.log('stop!');
      setCallState(NO_CALL);
      if (webRtcPeer) {
        webRtcPeer.dispose();
        webRtcPeer = null;
        // TODO totally stop media, camera led off
        // acekurento.mediaStream().getTracks().forEach(track => track.stop());
        const message = {
          id: 'stop',
          removeFromQueue: removeFromQueue
        };
        sendMessage(message);
      }
    },
    /**
     * Puts the other peer on hold, if possible
     * @param {acekurento~holdCallback} cb - The callback that handles the hold response.
     */
    hold: function (cb) {
      if (peerOnHold) {
        cb(true);
      } else {
        sendMessage({ id: 'hold' });
        holdCb = cb;
      }
    },
    /**
     * Unholds the peer, if possible
     * @param {acekurento~unholdCallback} cb - The callback that handles the unhold response.
     */
    unhold: function (cb) {
      if (!peerOnHold) {
        cb(true);
      } else {
        sendMessage({ id: 'unhold' });
        holdCb = cb;
      }
    },
    /**
     * Sends private video image to peer instead of local video stream
     * @param {Boolean} enabled - If "true" enables video private mode
     * @param {String} url - The video private mode url
     */
    privateMode: function (enabled, url) {
      sendMessage({ id: 'privacy', enabled: enabled, url: enabled ? url : undefined });
    },
    /**
     * ICE Restart
     */
    iceRestart: function () {
      console.info('pc createOffer restart');
      const pc = this.pc();
      pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true
      }).then((offer) => {
        console.info('Created SDP offer');
        // offer = mangleSdpToAddSimulcast(offer);
        return pc.setLocalDescription(offer);
      }).catch((e) => {
        console.error(e);
      });
    },
    /**
     * Sends SIP Re-Invite
     * @param {String} customSdp - (optional) custom SDP to send for the reinvite
     */
    sipReinvite: function (customSdp) {
      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          const message = {
            id: 'sipReinvite',
            sdp: (customSdp) ? customSdp : offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Sends SIP UPDATE
     * @param {String} customSdp - (optional) custom SDP to send for the SIP update
     */
    sipUpdate: function (customSdp) {
      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          const message = {
            id: 'sipUpdate',
            sdp: (customSdp) ? customSdp : offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Pause Queue
     */
    pauseQueue: function () {
      const message = {
        id: 'pauseQueue'
      };
      sendMessage(message);
    },
    /**
     * Unpause Queue
     */
    unpauseQueue: function () {
      const message = {
        id: 'unpauseQueue'
      };
      sendMessage(message);
    },
    /**
     * Start Recording
     */
    startRecording: function () {
      const message = {
        id: 'startRecording'
      };
      sendMessage(message);
    },
    /**
     * Stop Recording
     */
    stopRecording: function () {
      const message = {
        id: 'stopRecording'
      };
      sendMessage(message);
    },
    /**
     * Start Playing Recording
     */
    startPlayingRecording: function () {
      const message = {
        id: 'startPlayingRecording'
      };
      sendMessage(message);
    },
    /**
     * Stop Playing Recording
     */
    stopPlayingRecording: function () {
      const message = {
        id: 'stopPlayingRecording'
      };
      sendMessage(message);
    },
    /**
     * Invite peer
     * @param {String} ext - ext is the callee extension, the person to call
     */
    invitePeer: function (ext) {
      const message = {
        id: 'invitePeer',
        ext: ext
      };
      sendMessage(message);
    },
    /**
     * Call transfer that allows hot/blind or warm transfer to peer

     * @param {String} ext - ext is the callee extension, the person to call
     * @param {Boolean} isBlind - used to do blind/hot transfer or warm transfer
     * (started after invitePeer())
     */
    callTransfer: function (ext, isBlind) {
      const message = {
        id: 'callTransfer',

        ext: ext,
        isBlind: isBlind
      };
      sendMessage(message);
    },
    /**
     * Enable/Disable video or audio tracks
     * @param {Boolean} isActive - If "true" will disable/pause media type.
     * Otherwise will resume a specified media type.
     * @param {Boolean} isAudio - If "true" will act on the audio media stream type.
     * Otherwise it will act on the video type.
     */
    enableDisableTrack: function (isActive, isAudio) {
      const mediaStream = this.mediaStream();
      console.log(`Set ${isAudio ? 'AUDIO' : 'VIDEO'} ${isActive ? 'ON' : 'OFF'}`);

      if (isAudio) {
        mediaStream.getAudioTracks()[0].enabled = !(mediaStream.getAudioTracks()[0].enabled);
      } else {
        mediaStream.getVideoTracks()[0].enabled = !(mediaStream.getVideoTracks()[0].enabled);
      }

      console.log(`${isAudio ? 'AUDIO' : 'VIDEO'} is ${isActive ? 'ON' : 'OFF'}`);
    },
    /**
     * Screenshare to Kurento
     * @param {Boolean} enable - If "true" will enable screenshare.
     * Otherwise will stop and use camera.
     */
    screenshare: function (enable) {
      const options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        sendSource: enable ? 'screen' : 'webcam',
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        acekurento.isScreensharing = enable;
        this.generateOffer((error, offerSdp) => {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          const message = {
            id: 'restartCall',
            sdp: offerSdp
          };
          sendMessage(message);
        });
      });
    }
  });

  function setRegisterState(nextState) {
    switch (nextState) {
      case NOT_REGISTERED:
        break;

      case REGISTERING:
        break;

      case REGISTERED:
        setCallState(NO_CALL);
        break;

      default:
        return;
    }
    registerState = nextState;
  }

  function setCallState(nextState) {
    switch (nextState) {
      case NO_CALL:
        break;

      case PROCESSING_CALL:
        break;
      case IN_CALL:
        break;
      default:
        return;
    }
    acekurento.callState = nextState;
  }

  window.onbeforeunload = function () {
    ws.close();
  };

  ws.onmessage = function (message) {
    try {
      message = JSON.parse(message.data);
    } catch (e) {
      message = message.data;
    }
    console.info(`Received message data: ${JSON.stringify(message)}`);

    switch (message.id) {
      case 'registerResponse':
        registerResponse(message);
        acekurento.eventHandlers.registerResponse(message.error);
        // acekurento.event.trigger("registerResponse", message);
        break;
      case 'callResponse':
        callResponse(message);
        acekurento.eventHandlers.callResponse(message);
        // acekurento.event.trigger("callResponse", message);
        break;
      case 'incomingCall':
        handleIncomingCall(message);
        // acekurento.event.trigger("incomingCall", message);
        break;
      case 'sdp':
        startCommunication(message);
        acekurento.eventHandlers.progress(message);
        // acekurento.event.trigger("startCommunication", message);
        break;
      case 'sipConfirmed':
        acekurento.eventHandlers.sipConfirmed(message);
        break;
      case 'sessionStopped':
        acekurento.stop();
        acekurento.eventHandlers.ended(message);
        // acekurento.event.trigger("stopCommunication", message);
        break;
      case 'pausedQueue':
        acekurento.eventHandlers.pausedQueue(message);
        break;
      case 'unpausedQueue':
        acekurento.eventHandlers.unpausedQueue(message);
        break;
      case 'startedRecording':
        acekurento.eventHandlers.startedRecording(message);
        break;
      case 'stoppedRecording':
        acekurento.eventHandlers.stoppedRecording(message);
        break;
      case 'ice':
        webRtcPeer.addIceCandidate(message.candidate);
        break;
      case 'holdResult':
        peerOnHold = true;
        holdCb && holdCb(message.success);
        break;
      case 'unholdResult':
        peerOnHold = false;
        holdCb && holdCb(message.success);
        break;
      case 'inviteResponse':
        acekurento.eventHandlers.inviteResponse(message);
        break;
      case 'callTransferResponse':
        acekurento.eventHandlers.callTransferResponse(message);
        break;
      case 'sipReinviteResponse':
        acekurento.eventHandlers.reinviteResponse(message);
        break;
      case 'sipUpdateResponse':
        acekurento.eventHandlers.updateResponse(message);
        break;
      case 'restartCallResponse':
        acekurento.eventHandlers.restartCallResponse(message);
        break;
      case 'participantList':
        acekurento.eventHandlers.participantsUpdate(message);
        break;
      case 'newMessage':
        acekurento.eventHandlers.newMessage(message);
        break;
      default:
        console.error('Unrecognized message', message);
    }
  };

  function registerResponse(message) {
    if (!message.error) {
      setRegisterState(REGISTERED);
    } else {
      setRegisterState(NOT_REGISTERED);
      const errorMessage = message.error || 'Unknown reason for register rejection.';
      console.log(errorMessage);
    }
  }

  function callResponse(message) {
    if (message.response != 'accepted') {
      console.info('Call not accepted by peer. Closing call');
      const errorMessage = message.message ? message.message
        : 'Unknown reason for call rejection.';
      console.log(errorMessage);
      stop();
    } else {
      setCallState(IN_CALL);
      acekurento.eventHandlers.accepted();
      webRtcPeer.processAnswer(message.sdpAnswer);
    }
  }

  function startCommunication(message) {
    setCallState(IN_CALL);
    webRtcPeer.processAnswer(message.sdp);
  }

  function handleIncomingCall(message) {
    // If busy just reject without disturbing user
    if (acekurento.callState !== NO_CALL && !acekurento.isLoopback && !message.isWarmTransfer) {
      return acekurento.declineCall(message);
    }

    acekurento.eventHandlers.incomingCall({
      from: message.caller,
      accept: function () {
        acekurento.acceptCall(message);
      },
      reject: function () {
        acekurento.declineCall(message);
      }
    });
  }

  function sendMessage(message) {
    const jsonMessage = JSON.stringify(message);
    console.log(`Sending message: ${jsonMessage}`);
    ws.send(jsonMessage);
  }

  function onIceCandidate(candidate) {
    console.log(`Local candidate${JSON.stringify(candidate)}`);

    const message = {
      id: 'ice',
      candidate: candidate
    };
    sendMessage(message);
  }

  if (config) {
    if (config.displayName) acekurento.configuration.displayName = config.displayName;
    if (config.sipUsername) acekurento.configuration.sipUsername = config.sipUsername;
    if (config.sipPassword) acekurento.configuration.sipPassword = config.sipPassword;
    if (config.sipUri) acekurento.configuration.sipUri = config.sipUri;
  }

  ws.onopen = function (e) {
    acekurento.eventHandlers.connected(e);
  };

  return acekurento;
}
