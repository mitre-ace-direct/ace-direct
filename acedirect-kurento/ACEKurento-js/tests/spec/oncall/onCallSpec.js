describe('ACEKurento oncall outbound', () => {
  let acekurento;
  const ext = '1000';
  let WSSpy;
  const NO_CALL = 0;
  const PROCESSING_CALL = 1;
  const IN_CALL = 2;
  // mock credentials
  const address = 'wss://localhost:8443/signaling';
  const uri = 'sip:1000@acekurento-test.com:5060';
  const username = 'username';
  const password = 'af8KSZQREMwov';
  const sessionStoppedMessage = {
    data: {
      id: 'sessionStopped',
      session: '1234'
    }
  };

  beforeEach((done) => {
    const realWS = WebSocket;
    WSSpy = spyOn(window, 'WebSocket').and.callFake((url, protocols) => {
      return new realWS(url, protocols);
    });
    acekurento = new ACEKurento({ acekurentoSignalingUrl: address });
    spyOn(console, 'log');
    setTimeout(() => {
      console.info('rendering time...');
      acekurento.call(uri, true);
      done();
    }, 1000);
  });

  it('should know when the call is in progress', () => {
    expect(acekurento.callState).toEqual(PROCESSING_CALL);
  });

  it('should not be possible to call while on call', () => {
    acekurento.call(uri, true);
    expect(console.log).toHaveBeenCalledWith('You are already on a call');
  });

  describe('stop', () => {
    it('should set call state to ended', (done) => {
      setTimeout(() => {
        acekurento.stop(true);
        console.log(acekurento.callState);
        expect(acekurento.callState).toEqual(NO_CALL);
        done();
      }, 500);
    });
  });
});
