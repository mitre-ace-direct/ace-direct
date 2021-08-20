describe('ACEDirect-Kurento before on call', () => {
  let acekurento;
  let failed;
  // mock credentials
  const address = 'wss://localhost:8443/signaling';
  const username = 'username';
  const password = 'af8KSZQREMwov';
  const registerErrorResponse = {
    data: {
      id: 'registerResponse',
      error: 'Unauthorized'
    }
  };
  const registerSuccessResponse = {
    data: {
      id: 'registerResponse'
    }
  };

  beforeEach((done) => {
    spyOn(console, 'log');
    setTimeout(() => {
      console.info('rendering time...');
      done();
    }, 2500);
  });

  it('should call WebSocket constructor and connect to address', (done) => {
    const realWS = WebSocket;
    const WSSpy = spyOn(window, 'WebSocket').and.callFake((url, protocols) => {
      return new realWS(url, protocols);
    });
    acekurento = new ACEKurento({ acekurentoSignalingUrl: address });
    expect(WSSpy).toHaveBeenCalledWith(address);
    done();
  });

  it('should be able to send/receive WebSocket messages', (done) => {
    const onmessageCallbackSpy = jasmine.createSpy('onmessageCallback');
    spyOn(WebSocket.prototype, 'send').and.callFake(function (outMsg) {
      if (outMsg == 'outgoing message') {
        this.onmessage('incoming message');
      }
    });
    acekurento = new ACEKurento({ acekurentoSignalingUrl: address });
    acekurento.ua.onmessage = onmessageCallbackSpy;
    acekurento.ua.send('outgoing message');

    expect(onmessageCallbackSpy).toHaveBeenCalledWith('incoming message');
    done();
  });

  it('should be able to start registration sending register message', (done) => {
    spyOn(WebSocket.prototype, 'send').and.callFake((outMsg) => {
      const msg = JSON.parse(outMsg);
      if (msg.id === 'register' && msg.ext === username && msg.password === password) {
        done();
      }
    });
    acekurento = new ACEKurento({ acekurentoSignalingUrl: address });
    acekurento.register(username, password, false);
  });

  describe('when registering', () => {
    it('should be able to process successful registration response', (done) => {
      const onmessageCallbackSpy = jasmine.createSpy('onmessageCallback');
      spyOn(WebSocket.prototype, 'send').and.callFake(function (outMsg) {
        console.info(`message: ${outMsg}`);
        const msg = JSON.parse(outMsg);
        if (msg.id === 'register') {
          console.info(`Simulating server register response: ${JSON.stringify(registerSuccessResponse)}`);
          this.onmessage(registerSuccessResponse);
        }
      });
      acekurento = new ACEKurento({ acekurentoSignalingUrl: address });

      const eventHandlers = {
        registerResponse: function (e) {
          console.info('--- Register response:', e || 'Success ---');
          onmessageCallbackSpy(e || 'Success');
        }
      };

      acekurento.eventHandlers.registerResponse = onmessageCallbackSpy;
      acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
      acekurento.register(username, password, false);

      expect(onmessageCallbackSpy).toHaveBeenCalled();
      expect(onmessageCallbackSpy.calls.count()).toEqual(1);
      expect(onmessageCallbackSpy).toHaveBeenCalledWith('Success');
      done();
    });

    describe('when failing authenticating', () => {
      it('should send a failed event with error', (done) => {
        spyOn(WebSocket.prototype, 'send').and.callFake(function (outMsg) {
          const msg = JSON.parse(outMsg);
          if (msg.id === 'register') {
            // console.info(registerErrorResponse)
            this.onmessage(registerErrorResponse);
          }
        });
        acekurento = new ACEKurento({ acekurentoSignalingUrl: address });

        acekurento.eventHandlers.registerResponse = function (e) {
          console.info('--- Register response:', e || 'Success ---');
          // console.info('---> ' + JSON.stringify(registerErrorResponse.data.error))
          if (e === registerErrorResponse.data.error) {
            done();
          }
        };

        acekurento.register(username, password, false);
      });
    });
  });

  describe('when inbound call', () => {
    beforeEach((done) => {
      acekurento = new ACEKurento({ acekurentoSignalingUrl: address });
      acekurento.register(username, password, false);
      setTimeout(() => {
        console.info('Simulate incoming call');
        // TODO
        done();
      }, 3000);
    });

    // afterEach(function (done) {
    //   console.info('cleanup');
    //   setTimeout(function() {
    //     acekurento.stop();
    //     done();
    //   }, 1000);
    // });

    xit('should be able to receive a incoming call event', (_done) => {
    //  TODO
    //   done();
    });

    describe('when receiving an incoming call', () => {
      xit('should be able to accept', (_done) => {
        // TODO
      });
    });
  });
});
