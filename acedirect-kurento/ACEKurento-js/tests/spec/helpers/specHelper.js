beforeEach(() => {
  jasmine.addMatchers({
    // FIXME TO use in onCall Spec
    toBeCalling: function () {
      setTimeout(() => {
        let callstarted = false;
        const eventHandlers = {
          accepted: function (_e) {
            console.log('Call started');
            callstarted = true;
          }
        };
        acekurento.customEventHandler = Object.assign(acekurento.customEventHandler, eventHandlers);
        return {
          pass: callstarted
        };
      }, 4000);
    },
    toBeSendingLocalAudio: function () {
      return {
        compare: function (_voxbone) {
          const streams = acekurento.selfStream;
          let sending = false;
          for (let i = 0; i < streams.length; i++) {
            for (let j = 0; j < streams[i].getAudioTracks().length; j++) {
              console.info(`sending:${sending}`);
              sending = sending ? sending : streams[i].getAudioTracks()[j].enabled;
            }
          }
          const result = { pass: sending !== false };

          if (result.pass) {
            result.message = 'Audio being sent.';
          } else {
            result.message = 'Audio deactivated.';
          }
          return result;
        }
      };
    }
  });
});
