const request = require('supertest');
const server = require('../app');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

describe('loading express', () => {
  before(() => {
    // run before all tests
  });

  after(() => {
    // run after all tests
    console.log('tests completed.');
  });

  beforeEach(() => {
    // run before each test
    console.log('tests starting...');
  });
  afterEach(() => {
    // run after each test
    server.close();
  });

  // test 1
  it('responds to /api/v2/tickets/ticketdoesnotexist.json', (done) => {
    request(server).get('/api/v2/tickets/ticketdoesnotexist.json').expect(404, done);
  });

  // test 2
  it('responds to /', (done) => {
    request(server).get('/').expect(200, done);
  });
});
