// Define the different REST service routes in this file.
const json2csv = require('json2csv');

const appRouter = (app, connection, logger, cdrTable) => {
  /**
  * Get to show server is running. This will not show if APIDoc is run.
  */
  app.get('/', (req, res) => {
    logger.info('GET /');
    return res.status(200).send({ message: 'Welcome to the CDR report portal.' });
  });

  /**
   * @api {get} /getallcdrrecs Get all CDR database records
   * @apiName GetAllCDRRecs
   * @apiGroup GetAllCDRRecs
   * @apiVersion 1.0.0
   *
   * @apiParam {Date} [start]      Start date for cdr records (format YYYY-MM-DD)
   * @apiParam {Date} [end]      End date for cdr records (format YYYY-MM-DD)
   * @apiParam {String} [format]    Format results are returned in. Defaults to JSON, accepts csv.
   *
   * @apiSuccessExample Success-Response:
   *   HTTP/1.1 200 OK
   *  {
   *    "message":"Success",
   *    "data":[
   *       {
   *        "calldate":"2016-08-24T02:05:30.000Z",
   *        "clid":"\"\" <6004>",
   *        "src":"6004",
   *        "dst":"agents",
   *        "dcontext":"from-internal",
   *        "channel":"SIP/6004-00000000",
   *        "dstchannel":"",
   *        "lastapp":"Playback",
   *        "lastdata":"moh14",
   *        "duration":14,
   *        "billsec":14,
   *        "disposition":"ANSWERED",
   *        "amaflags":3,
   *        "accountcode":"",
   *        "userfield":"",
   *        "uniqueid":"1471979130.0",
   *        "linkedid":"1471979130.0",
   *        "sequence":"0",
   *        "peeraccount":""
   *      }]
   *  }
   * @apiErrorExample Error-Response
   *   HTTP/1.1 500 Internal Server Error
   *   {
   *    'message': 'MySQL error'
   *   }
   */
  app.get('/getallcdrrecs', (req, res) => {
    logger.info('GET /getallcdrrecs');
    let query = `SELECT * FROM ${cdrTable} ORDER BY calldate`;
    if (req.query.start && req.query.end) {
      query = `SELECT * FROM ${cdrTable} WHERE (calldate BETWEEN ${connection.escape(req.query.start)} AND ${connection.escape(req.query.end)} )`;
    }
    // Query for all records sorted by the id
    connection.query(query, (err, rows, _fields) => {
      if (err) {
        logger.error('/getallcdrrecs an error has occurred');
        return res.status(500).send({ message: 'MySQL error' });
      }

      if (rows.length > 0) {
        // success
        if (req.query.format === 'csv') {
          JSON.stringify(rows);

          // Column names for the CSV file.
          const csvFields = ['calldate', 'clid', 'src',
            'dst', 'dcontext', 'channel',
            'dstchannel', 'lastapp', 'lastdata',
            'duration', 'billsec', 'disposition',
            'amaflags', 'accountcode', 'userfield',
            'uniqueid', 'linkedid', 'sequence',
            'peeraccount'];

          const csv = json2csv({ data: rows, fields: csvFields });
          res.setHeader('Content-disposition', 'attachment; filename=cdr.csv');
          res.set('Content-Type', 'text/csv');
          return res.status(200).send(csv);
        }
        return res.status(200).send({ message: 'Success', data: rows });
      }
      return res.status(200).send({ message: 'No cdr records', data: rows });
    });
  });
};

module.exports = appRouter;
