var request = require('supertest');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

describe('loading express', function () {
  var server;

  before(function() {
    //run before all tests
  });

  after(function() {
    //run after all tests
    console.log('tests completed.');
  });

  beforeEach(function () {
    //run before each test
    server = require('../app');
    console.log('tests starting...');
  });
  afterEach(function () {
    //run after each test
    server.myCleanup();
    server.close();
  });

  //test 1
  it('responds to /getallagentrecs', function (done) {
    request(server).get('/getallagentrecs').expect(200, done);
  });

  //test 2
  it('responds to /', function (done) {
    request(server).get('/').expect(200, done);
  });

});

