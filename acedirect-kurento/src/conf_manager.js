const debug = require('debug')('ace:conf-man');
const Events = require('events');
const NodeWS = require('jssip-node-websocket');
const SIP = require('jssip');
const param = require('param');
const RTCCall = require('./webrtc_media_session');
const models = require('./dal/models');

class ConfManager extends Events {
  constructor(ix) {
    super();
    this._index = ix;
    this._calls = new Map();
    this._jssipRTCSessions = new Map();
    this._evt = new Map();
  }

  register(user, pass) {
    const host = param('servers.asterisk_fqdn');
    const port = param('app_ports.asterisk_ws').toString();
    const protocol = param('asterisk.sip.protocol');
    const uri = `${protocol}://${host}:${port}/ws`;
    const socket = new NodeWS(uri);
    const ua = new SIP.UA({
      sockets: [socket],
      uri: `sip:${user}@${host}`,
      password: pass,
      registrar_server: `sip:${host}`,
      register: true,
      user_agent: 'JsSIP-ACEKurento',
      rtc: () => ({
        processOffer: async (peer, offer) => {
          debug(`Processing update for ${peer}`);
          const call = this._calls.get(peer);
          if (!call) {
            debug(`Can't find call for ${peer}`);
            throw new Error(`Can't find call for ${peer}`);
          }
          return call.handleReinvite(peer, offer);
        }
      })
    });

    ua.start();

    ua.on('newRTCSession', (evt) => {
      if (evt.originator === 'remote') {
        debug('New RTC session for', user);
        this._evt.set(user, evt);
        this.handleNewSession(user, evt);
      }
    });
    ua.on('newMessage', (evt) => {
      const peer = this._index.getByExt(user);
      debug(`Call New Message by ${evt.originator} to ${user}. Message:`);

      const message = evt.message._request.body;
      debug(message);
      peer.sendNewSipMessage(message);
    });

    return new Promise((success, failure) => {
      ua.once('registered', () => {
        success(ua);
      });
      ua.once('registrationFailed', failure);
    });
  }

  async invitePeer(caller, session, ext, isMonitor) {
    if (session.atMaxCapacity) {
      return false;
    }
    const peer = this._index.getByExt(ext);
    if (!peer) return false;
    const webrtcOffer = await peer.askJoinSession(caller._ext, session);
    if (!webrtcOffer) return false;

    if (isMonitor && peer._isAgent) {
      // adding a monitor to the call
      peer._isMonitoring = true;
      session._hasMonitor = true;
    }

    await session.addWebrtcPeer(peer, webrtcOffer);
    return true;
  }

  async callTransfer(caller, session, ext, isBlind) {
    const jssip_session = this._jssipRTCSessions.get(caller._ext);
    if (ext == 'hangup') {
      jssip_session.sendDTMF('1990#');
      jssip_session.refer('hangup');
    } else if (ext == 'videomail') {
      jssip_session.sendDTMF('1980#');
    } else {
      const calleePeer = this._index.getByExt(ext);
      calleePeer._warmTransfer = !isBlind;
      jssip_session.refer(calleePeer._ext);
    }
    return true;
  }

  async handleRenegotiate(callee, customSdp, isUpdate) {
    const jssip_session = this._jssipRTCSessions.get(callee._ext);
    debug(jssip_session);
    return this.handleRegenerateEndpoints(callee, customSdp, jssip_session, true, isUpdate);
  }

  async hold(calleeExt, onHold) {
    const jssip_session = this._jssipRTCSessions.get(calleeExt);
    return onHold ? jssip_session.hold({ useUpdate: true })
      : jssip_session.unhold({ useUpdate: true });
  }

  async handleRegenerateEndpoints(c, sdpOffer, session, bothPeers, isUpdate) {
    let rtpOffer;
    debug('REGENERATE ENDPOINT FOR:');
    debug(c);
    const call = this._calls.get(c.ext);
    debug('RESTARTING CALL:');
    debug(call);
    await call.restartWebrtcPeer(c, sdpOffer);
    if (bothPeers) {
      rtpOffer = await call.restartRtpPeer(c, this._evt.get(c.ext).request.body, session);
      debug('SIP ReINVITE SEND WITH:');
      debug(rtpOffer);
      if (rtpOffer) {
        debug(rtpOffer);
        return session.renegotiate({
          useUpdate: isUpdate,
          // extraHeaders: {},
          rtcOfferConstraints: rtpOffer
        });
      }
    }
    return true;
  }

  async handleNewSession(calleeExt, evt) {
    const { From: from } = evt.request.headers;
    const { session } = evt;
    const videoMaxBitrate = param('kurento.video_webrtc_max_bitrate') || 300;
    const videoMinBitrate = param('kurento.video_webrtc_min_bitrate') || 50;

    const bitrates = {
      audio: { max: 30, min: 10 },
      video: { max: videoMaxBitrate, min: videoMinBitrate }
    };
    this._jssipRTCSessions.set(calleeExt, session);
    let callerExt = 'Anonymous';
    if (from && from.length) {
      callerExt = from[0].parsed.uri.user;
    }

    const callee = this._index.getByExt(calleeExt);
    const caller = this._index.getByExt(callerExt);
    if (callee && callee.busy && !callee._warmTransfer) {
      /*
      debug('Callee is busy, videomail...');
      const videomail = new VideoMail();
      const answer = await videomail.setPeer(callee, evt.request.body);
      session.on('confirmed', () => {
        videomail.start();
      });
      session.on('newDTMF', evt => {
        videomail.handleDTMF(evt.dtmf);
      });
      session.on('ended', () => {
        videomail.finish();
      });
      videomail.on('finished', () => {
        session.terminate();
      });

      const iceArr = [
        {
          "urls": `${param('asterisk.sip.stun_user')}:
          ${param('servers.stun_fqdn')}:${param('app_ports.stun')}`
        },
        {
          "urls": `${param('asterisk.sip.turn_user')}:
          ${param('servers.turn_fqdn')}:${param('app_ports.turn')}`,
          "username": `${param('asterisk.sip.turn_user')}`,
          "credential": `${param('asterisk.sip.turn_cred')}`
        }
      ];
      session.answer({
        rtcAnswerConstraints: answer,
        pcConfig: {
          iceServers: iceArr
        }
      });
      */
      return;
    }
    if (callee && caller) {
      const call = this._calls.get(caller.ext);
      debug('Incoming call (SIP) from %s to %s', caller.ext, callee.ext);
      const webrtcOffer = await callee.accept(caller.ext, call);
      if (webrtcOffer) {
        const rtpAnswer = await call.addRtpPeer(callee.ext, evt.request.body, session);
        session.answer({
          rtcAnswerConstraints: rtpAnswer
        });
        await call.addWebrtcPeer(callee, webrtcOffer, bitrates);
        this._evt.set(callee.ext, evt);
        this._calls.set(callerExt, call);
        this._calls.set(callee.ext, call);
        call.on('finished', () => {
          this._calls.delete(callerExt);
          this._calls.delete(callee.ext);
          debug(`Calls: ${Array.from(this._calls.keys())}`);
        });
      } else {
        call.finish();
      }
    } else if (callee) {
      const call = new RTCCall('H264');
      this._calls.set(callerExt, call);
      this._calls.set(callee.ext, call);
      debug('Incoming call (SIP with new caller) from %s to %s', callerExt, callee.ext);
      call.on('finished', () => {
        this._calls.delete(callerExt);
        this._calls.delete(callee.ext);
        clearInterval(callee._keyframeInterval)
        debug(`Calls: ${Array.from(this._calls.keys())}`);
      });
      session.on('ended', (evt) => {
        if (evt.originator === 'remote') {
          clearInterval(callee._sipIntervalTimeout);
          clearInterval(callee._keyframeInterval)
          call.leave(callerExt);
        }
      });
      var playing2 = false;
      session.on('newInfo', evt => {
        if (evt.originator == 'remote') {
          const message = evt.request.body;
          if (message.includes('picture_fast_update')) {
            if (!playing2) {
              playing2 = true;
              callee.keyframe();
              setTimeout(() => { playing2 = false }, 4000)
            }
          }
        }
      });
      session.on('confirmed', (evt) => {
        callee.sendSipConfirmedMessage(evt.originator);

        // send keyframe then one every 5 seconds
        const pfuBody = '<?xml version="1.0" encoding="utf-8" ?>'
            + '<media_control>'
            + '<vc_primitive>'
            + '<to_encoder>'
            + '<picture_fast_update/>'
            + '</to_encoder>'
            + '</vc_primitive>'
            + '</media_control>';
        session.sendInfo('application/media_control+xml', pfuBody);
        callee.keyframe();
        setTimeout(()=>{callee.keyframe();session.sendInfo('application/media_control+xml', pfuBody);},1000);
        setTimeout(()=>{callee.keyframe();session.sendInfo('application/media_control+xml', pfuBody);},2000);
        setTimeout(()=>{callee.keyframe();session.sendInfo('application/media_control+xml', pfuBody);},3000);
        setTimeout(()=>{callee.keyframe();session.sendInfo('application/media_control+xml', pfuBody);},4000);
        callee._keyframeInterval = setInterval(()=>{callee.keyframe();},5000)
      });
      await call.init();

      const webrtcOffer = await callee.accept(callerExt, call);
      debug('WEBRTC OFFER FROM CALLEE');
      debug(webrtcOffer);
      debug('AND NOW WE WILL ADD WEBRTC ENDPOINT and FILTER CODECS FROM THIS OFFER...');
      if (webrtcOffer) {
        debug('RTP OFFER');
        debug(evt.request.body);
        this._evt.set(callee.ext, evt);
        debug('AND NOW WE WILL ADD RTP ENDPONT and FILTER CODECS FROM THIS OFFER...');
        const rtpAnswer = await call.addRtpPeer(callerExt, evt.request.body, session);
        debug(rtpAnswer);
        const iceArr = [
          {
            urls: `stun:${param('servers.stun_fqdn')}:${param('app_ports.stun')}`
          },
          {
            urls: `turn:${param('servers.turn_fqdn')}:${param('app_ports.turn')}`,
            username: `${param('asterisk.sip.turn_user')}`,
            credential: `${param('asterisk.sip.turn_cred')}`
          }
        ];
        session.answer({
          rtcAnswerConstraints: rtpAnswer,
          pcConfig: {
            iceServers: iceArr
          }
        });
        await call.addWebrtcPeer(callee, webrtcOffer, bitrates);
        await callee.requestKeyframeAndSleep();
      } else {
        session.terminate();
      }
    } else {
      debug(
        'Can\t handle scenario: caller = %s callee = %s',
        caller ? caller.ext : '(null)',
        callee ? callee.ext : '(null)'
      );
      return;
    }
    // warm transfer allows skip videomail queue once, if skipped get back to normal
    if (callee._warmTransfer) callee._warmTransfer = false;
  }

  async loopbackCall(caller, callerOffer, calleeExt) {
    const videoMaxBitrate = param('kurento.video_webrtc_max_bitrate') || 300;
    const videoMinBitrate = param('kurento.video_webrtc_min_bitrate') || 50;
    const call = new RTCCall('VP8');
    await call.init();
    this._calls.set(caller.ext, call);
    call.on('finished', () => {
      this._calls.delete(caller.ext);
    });
    console.log(this._calls);
    // Modify default codec and bitrate
    const bitrates = {
      audio: { max: 30, min: 10 },
      video: { max: videoMaxBitrate, min: videoMinBitrate }
    };
    debug('Starting WebRTC session %s -> %s', caller.ext, calleeExt);
    await call.addWebrtcPeer(caller, callerOffer, bitrates);
    const calleeOffer = await caller.accept(caller.ext, call);
    if (calleeOffer) {
      caller._ext = calleeExt;
      this._calls.set(caller.ext, call);
      call.on('finished', () => {
        this._calls.delete(caller.ext);
      });
      await call.addWebrtcPeer(caller, calleeOffer, bitrates);
    } else {
      call.finish();
    }
    return call;
  }

  async call(caller, callerOffer, calleeExt, skipQueue) {
    const callee = this._index.getByExt(calleeExt);
    const videoMaxBitrate = param('kurento.video_webrtc_max_bitrate') || 300;
    const videoMinBitrate = param('kurento.video_webrtc_min_bitrate') || 50;

    const bitrates = {
      audio: { max: 30, min: 10 },
      video: { max: videoMaxBitrate, min: videoMinBitrate }
    };
    if (caller.busy) {
      throw new Error(`${callerExt} not available`);
    }
    if (callee && callee.busy) {
      throw new Error(`${calleeExt} not available`);
    }

    const call = new RTCCall(skipQueue && callee ? 'VP8' : 'H264');
    this._calls.set(caller.ext, call);
    this._calls.set(calleeExt, call);
    call.on('finished', () => {
      this._calls.delete(caller.ext);
      this._calls.delete(calleeExt);
    });
    await call.init();
    if (skipQueue && callee) {
      debug('Starting WebRTC session %s -> %s', caller.ext, calleeExt);
      await call.addWebrtcPeer(caller, callerOffer, bitrates);
      const calleeOffer = await callee.accept(caller.ext, call);
      if (calleeOffer) {
        await call.addWebrtcPeer(callee, calleeOffer, bitrates);
        if (param('kurento.monitoring_enabled')) {
          await models.WebrtcSession.create({
            session_id: call.id,
            from: caller.ext,
            to: callee.ext
          });
        }
      } else {
        call.finish();
      }
    } else {
      await call.addWebrtcPeer(caller, callerOffer, bitrates);
      const rtpOffer = await call.addRtpPeer(calleeExt);
      await models.WebrtcSession.create({
        session_id: call.id,
        from: caller.ext,
        to: calleeExt
      });
      let pfuInt;
      const iceArr = [
        {
          urls: `stun:${param('servers.stun_fqdn')}:${param('app_ports.stun')}`
        },
        {
          urls: `turn:${param('servers.turn_fqdn')}:${param('app_ports.turn')}`,
          username: `${param('asterisk.sip.turn_user')}`,
          credential: `${param('asterisk.sip.turn_cred')}`
        }
      ];
      const session = caller.ua.call(calleeExt, {
        eventHandlers: this.callEventHandlers(caller.ext, calleeExt),
        mediaConstraints: { audio: true, video: true },
        rtcOfferConstraints: rtpOffer,
        pcConfig: {
          iceServers: iceArr
        }
      });

      this._jssipRTCSessions.set(caller.ext, session);

      session.on('failed', (e) => {
        if (e.message) {
          call.onFailed(calleeExt, e.message.reason_phrase);
          debug('[%s -> %s] Error: %s %s', caller.ext, calleeExt, JSON.stringify(e.message.status_code), JSON.stringify(e.message.reason_phrase));
        }
      });
      session.on('ended', (evt) => {
        debug(`Call ended by ${evt.originator}`);
        if (evt.originator === 'remote') {
          call.leave(calleeExt);
        }
      });

      session.on('confirmed', (_evt) => {
        this._calls.set(calleeExt, call);

        setTimeout(() => {
          // force pfu at start of the call
          const body = '<?xml version="1.0" encoding="utf-8" ?>'
            + '<media_control>'
            + '<vc_primitive>'
            + '<to_encoder>'
            + '<picture_fast_update/>'
            + '</to_encoder>'
            + '</vc_primitive>'
            + '</media_control>';
          if(session && session._status != 8){ //Check to make sure session isn't terminated
            session.sendInfo('application/media_control+xml', body);

            const ms = param('asteriskss.sip_media_request_interval');
            if (ms) {
              pfuInt = setInterval(() => { session.sendInfo('application/media_control+xml', body); }, ms);
            }
          }
        }, 1000);
        // end
	// Send keyframe then send one every 5 seconds afterwards.
	caller.keyframe()
	caller._keyframeInterval = setInterval(()=>{caller.keyframe();},5000);
     });


      var playing1 = false;
      session.on('newInfo', evt => {
        if (evt.originator == 'remote') {
          const message = evt.request.body;
          if (message.includes('picture_fast_update')) {
            if (!playing1) {
              playing1 = true;
              caller.keyframe();
              setTimeout(() => { playing1 = false }, 4000)
            }
          }
        }
      });

      session.on('accepted', (evt) => {
        this._calls.set(calleeExt, call);

        call.on('finished', () => {
          this._calls.delete(calleeExt);
          clearInterval(pfuInt);
	  clearInterval(caller._keyframeInterval)
        });
        call.handleRtpAnswer(calleeExt, evt.response.body, session);
      });
    }
    return call;
  }

  callEventHandlers(from, to) {
    return {
      progress: () => {
        debug('[%s -> %s] Call is in progress', from, to);
      },
      confirmed: () => {
        debug('[%s -> %s] Call confirmed', from, to);
      },
      update: () => {
        debug('[%s -> %s] Call updated', from, to);
      },
      reinvite: () => {
        debug('[%s -> %s] reinvite', from, to);
      },
      ended: () => {
        debug('[%s -> %s] ended', from, to);
      }
    };
  }
}

module.exports = ConfManager;
