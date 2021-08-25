/*
* (C) Copyright 2014-2015 Kurento (http://kurento.org/)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
*/

function getopts(args, opts) {
  const result = opts.default || {};
  args.replace(
    new RegExp('([^?=&]+)(=([^&]*))?', 'g'),
    (_$0, $1, _$2, $3) => { result[$1] = decodeURI($3); }
  );

  return result;
}

const args = getopts(location.search,
  {
    default:
  {
    ws_uri: 'wss://webrtcvasterisk.webvenace.com:8433/kurento',
    file_uri: 'file://' + '/tmp/rec_99001_20190425_015515.webm', // file to be stored in media server
    ice_servers: undefined
  }
  });

function setIceCandidateCallbacks(webRtcPeer, webRtcEp, onerror) {
  webRtcPeer.on('icecandidate', (candidate) => {
    console.log('Local candidate:', candidate);

    candidate = kurentoClient.getComplexType('IceCandidate')(candidate);

    webRtcEp.addIceCandidate(candidate, onerror);
  });

  webRtcEp.on('OnIceCandidate', (event) => {
    const candidate = event.candidate;

    console.log('Remote candidate:', candidate);

    webRtcPeer.addIceCandidate(candidate, onerror);
  });
}

window.addEventListener('load', (_event) => {
  console = new Console();

  const startRecordButton = document.getElementById('start');
  startRecordButton.addEventListener('click', startRecording);
});

function startRecording() {
  console.log('onClick');

  const videoInput = document.getElementById('videoInput');
  const videoOutput = document.getElementById('videoOutput');

  showSpinner(videoInput, videoOutput);

  const stopRecordButton = document.getElementById('stop');

  const options = {
    localVideo: videoInput,
    remoteVideo: videoOutput
  };

  if (args.ice_servers) {
    console.log(`Use ICE servers: ${args.ice_servers}`);
    options.configuration = {
      iceServers: JSON.parse(args.ice_servers)
    };
  } else {
    console.log('Use freeice');
  }

  webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
    if (error) return onError(error);

    this.generateOffer(onOffer);
  });

  function onOffer(error, offer) {
    if (error) return onError(error);

    console.log('Offer...');

    kurentoClient(args.ws_uri, (error, client) => {
      if (error) return onError(error);

      client.create('MediaPipeline', (error, pipeline) => {
        if (error) return onError(error);

        console.log('Got MediaPipeline');

        const elements = [
          { type: 'RecorderEndpoint', params: { uri: args.file_uri } },
          { type: 'WebRtcEndpoint', params: {} }
        ];

        pipeline.create(elements, (error, elements) => {
          if (error) return onError(error);

          const recorder = elements[0];
          const webRtc = elements[1];

          setIceCandidateCallbacks(webRtcPeer, webRtc, onError);

          webRtc.processOffer(offer, (error, answer) => {
            if (error) return onError(error);

            console.log('offer');

            webRtc.gatherCandidates(onError);
            webRtcPeer.processAnswer(answer);
          });

          client.connect(webRtc, recorder, (error) => {
            if (error) return onError(error);

            console.log('Connected');

            recorder.record((error) => {
              if (error) return onError(error);

              console.log('record');

              stopRecordButton.addEventListener('click', (_event) => {
                recorder.stop();
                pipeline.release();
                webRtcPeer.dispose();
                videoInput.src = '';
                videoOutput.src = '';

                hideSpinner(videoInput, videoOutput);

                const playButton = document.getElementById('play');
                playButton.addEventListener('click', startPlaying);
              });
            });
          });
        });
      });
    });
  }
}

window.onload = function () {
  const a = new ACEKurento({ acekurentoSignalingUrl: 'wss://localhost:8443/signaling' });
  const playButton = document.getElementById('play');
  playButton.addEventListener('click', startPlaying(a));
};

function startPlaying(ace) {
  console.log('Start playing');

  const videoPlayer = document.getElementById('videoOutput');
  showSpinner(videoPlayer);

  const options = {
    remoteVideo: videoPlayer
  };

  if (args.ice_servers) {
    console.log(`Use ICE servers: ${args.ice_servers}`);
    options.configuration = {
      iceServers: JSON.parse(args.ice_servers)
    };
  } else {
    console.log('Use freeice');
  }

  ace.startPlaying();

  const webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
    function (error) {
      if (error) return onError(error);

      this.generateOffer(onPlayOffer);
    });

  function onPlayOffer(error, offer) {
    if (error) return onError(error);

    kurentoClient(args.ws_uri, (error, client) => {
      if (error) return onError(error);

      client.create('MediaPipeline', (error, pipeline) => {
        if (error) return onError(error);

        pipeline.create('WebRtcEndpoint', (error, webRtc) => {
          if (error) return onError(error);

          setIceCandidateCallbacks(webRtcPeer, webRtc, onError);

          webRtc.processOffer(offer, (error, answer) => {
            if (error) return onError(error);

            webRtc.gatherCandidates(onError);

            webRtcPeer.processAnswer(answer);
          });

          const options = { uri: args.file_uri };

          pipeline.create('PlayerEndpoint', options, (error, player) => {
            if (error) return onError(error);

            player.on('EndOfStream', (_event) => {
              pipeline.release();
              videoPlayer.src = '';

              hideSpinner(videoPlayer);
            });

            player.connect(webRtc, (error) => {
              if (error) return onError(error);

              player.play((error) => {
                if (error) return onError(error);
                console.log('Playing ...');
              });
            });

            document.getElementById('stop').addEventListener('click',
              (_event) => {
                pipeline.release();
                webRtcPeer.dispose();
                videoPlayer.src = '';

                hideSpinner(videoPlayer);
              });
          });
        });
      });
    });
  }
}

function onError(error) {
  if (error) console.log(error);
}

function showSpinner() {
  for (let i = 0; i < arguments.length; i++) {
    arguments[i].poster = 'img/transparent-1px.png';
    arguments[i].style.background = "center transparent url('img/spinner.gif') no-repeat";
  }
}

function hideSpinner() {
  for (let i = 0; i < arguments.length; i++) {
    arguments[i].src = '';
    arguments[i].poster = 'img/webrtc.png';
    arguments[i].style.background = '';
  }
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function (event) {
  event.preventDefault();
  $(this).ekkoLightbox();
});
