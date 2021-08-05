const { ObjectId } = require('mongodb');
const logger = require('../helpers/logger');

const chartsArray = {
  pliCount: { title: 'pliCount', shortName: 'pliCount', query: '$realtime.googPlisSent' },
  packetsReceived: { title: 'packetsReceived', shortName: 'packetsReceived', query: '$realtime.packetsReceived' },
  'packetsReceived-per-s': { title: 'packetsReceived/s', shortName: 'packetsReceived-per-s', query: '$realtime.packetsReceived' },
  'bytesReceived_in_bits-per-s': { title: 'bytesReceived_in_bits/s', shortName: 'bytesReceived_in_bits-per-s', query: '$realtime.bytesReceived' },
  // 'headerBytesReceived_in_bits-per-s': {
  //  title: 'headerBytesReceived_in_bits/s', shortName: 'headerBytesReceived_in_bits-per-s' },
  jitter: { title: 'jitter', shortName: 'jitter', query: '$realtime.googJitterBufferMs' },
  'framesReceived-per-s': { title: 'framesReceived/s', shortName: 'framesReceived-per-s', query: '$realtime.googFrameRateReceived' },
  'framesDecoded-per-s': { title: 'framesDecoded/s', shortName: 'framesDecoded-per-s', query: '$realtime.googFrameRateDecoded' },
  // 'totalDecodeTime/framesDecoded_in_ms': {
  //   title: 'totalDecodeTime/framesDecoded_in_ms',
  //   shortName: 'totalDecodeTime/framesDecoded_in_ms',
  //   query: ''
  // },
  // totalInterFrameDelay/framesDecoded_in_ms': {
  //   title: 'totalInterFrameDelay/framesDecoded_in_ms',
  //   shortName: 'totalInterFrameDelay/framesDecoded_in_ms',
  //   query: ''
  // },
  // 'interFrameDelayStDev_in_ms: {
  //  title: 'interFrameDelayStDev_in_ms', shortName: 'interFrameDelayStDev_in_ms', query: '' },
  framesPerSecond: { title: 'framesPerSecond', shortName: 'framesPerSecond', query: '$realtime.googFrameRateOutput' }
};

/* This function returns an ObjectId embedded with a given datetime */
/* Accepts both Date object and string input */
function objectIdWithTimestamp(timestampIn) {
  let timestamp = timestampIn;
  /* Convert string date to Date object (otherwise assume timestamp is a date) */
  if (typeof (timestamp) === 'string') {
    timestamp = new Date(timestamp);
  }

  /* Convert date object to hex seconds since Unix epoch */
  const hexSeconds = Math.floor(timestamp / 1000).toString(16);

  /* Create an ObjectId with that hex timestamp */
  const constructedObjectId = ObjectId(`${hexSeconds}0000000000000000`);

  return constructedObjectId;
}

exports.getAgents = function
GetAgents(db, callback) {
  logger.debug('WebRTC Stats GetAgents');

  if (db) {
    db.collection('webRTCStats').distinct('username')
      .then((results) => {
        // logger.debug(`Results from mongodb: ${JSON.stringify(results, null, '\t')}`);
        logger.debug(`WebRTC Stats GetAgents results from mongodb: ${results.length}`);

        const tableData = {};

        if (results.length > 0) {
          tableData.message = 'Success';
          tableData.data = Object.values(results.sort());
          // logger.debug(`Data to browser: ${JSON.stringify(Object.values(results), null, '\t')}`);
        } else {
          tableData.message = '';
          tableData.data = {};
        }

        callback(tableData);
      })
      .catch((err) => {
        logger.error(`WebRTC Stats GetAgents query error: ${err}`);
      });
  }
};

exports.getCalls = function
GetCalls(db, reportStartDate, reportEndDate, timezone, username, callback) {
  logger.debug('WebRTC Stats GetCalls');
  logger.debug(`start and end: ${reportStartDate}, ${reportEndDate}`);
  logger.debug(`start and end: ${new Date(reportStartDate)}, ${new Date(reportEndDate)}`);

  const callListQuery = [
    {
      $match: {
        _id: {
          $gte: objectIdWithTimestamp(reportStartDate),
          $lte: objectIdWithTimestamp(reportEndDate)
        },
        'result.results.googContentType': 'realtime',
        username
      }
    },
    {
      $project: {
        realtime: {
          $filter: {
            input: '$result.results',
            as: 'rt',
            cond: { $eq: ['$$rt.codecImplementationName', 'ExternalDecoder'] }
          }
        },
        _id: 0
      }
    },
    {
      $unwind: {
        path: '$realtime',
        preserveNullAndEmptyArrays: false
      }
    },
    {
      $project: {
        id: '$realtime.id',
        timestamp: '$realtime.timestamp'
      }
    },
    { $sort: { timestamp: 1 } },
    {
      $group:
      {
        _id: '$id',
        start: { $first: '$timestamp' },
        end: { $last: '$timestamp' }
      }
    },
    { $addFields: { id: '$_id' } },
    {
      $project: {
        _id: 0,
        id: '$id',
        start: '$start',
        end: '$end'
      }
    }
  ];

  logger.debug(`WebRTC Stats GetCalls MongoDB Query: ${JSON.stringify(callListQuery, null, '\t')}`);

  if (db) {
    const hrstart = process.hrtime();
    db.collection('webRTCStats').aggregate(
      callListQuery
    )
      .toArray()
      .then((results) => {
        const hrend = process.hrtime(hrstart);
        logger.info('WebRTC Stats GetCalls query time: %ds %dms', hrend[0], hrend[1] / 1000000);

        // logger.debug(`Results from mongodb: ${JSON.stringify(results, null, '\t')}`);
        logger.info(`WebRTC Stats GetCalls results from mongodb: ${results.length}`);

        const tableData = {};

        if (results.length > 0) {
          tableData.message = 'Success';

          tableData.data = Object.values(results);
          // logger.debug(`Data to browser: ${JSON.stringify(Object.values(results), null, '\t')}`);
        } else {
          tableData.message = '';
          tableData.data = {};
        }

        callback(tableData);
      })
      .catch((err) => {
        logger.error(`WebRTC Stats GetCalls query error: ${err}`);
      });
  }
};

exports.getCallDetails = function
GetCallDetails(db, reportStartDate, reportEndDate, timezone, username, callId, chartName,
  callback) {
  logger.debug('WebRTC Stats GetCallDetails');
  logger.debug(`start and end: ${reportStartDate}, ${reportEndDate}`);
  logger.debug(`start and end: ${new Date(reportStartDate)}, ${new Date(reportEndDate)}`);

  // In realtime recv object of results array
  //
  // pliCount --> googPlisSent (always zero? in recv, has non-zero values in send)
  // packetsReceived --> packetsReceived
  // packetsReceived/s --> packetsReceived and calc rate
  // bytesReceived_in_bits/s --> bytesReceived convert from bytes to bits and calc rate
  // jitter --> googJitterBufferMs
  // framesReceived/s --> googFrameRateReceived (already rate)
  // framesDecoded/s --> googFrameRateDecoded (already rate) or calc from framesDecoded?
  // framesPerSecond --> googFrameRateOutput ??? is this already rate ???

  console.log('-----------');
  console.log(`ChartName: ${chartName}`);
  const chart = chartsArray[chartName];
  // logger.debug('Username: ' + username);
  console.log(`CallId: ${callId}`);

  // This gets send and recv realtime sections of results array
  const query = [{
    $match: {
      _id: {
        $gte: objectIdWithTimestamp(reportStartDate),
        $lte: objectIdWithTimestamp(reportEndDate)
      },
      // 'result.results.googContentType': 'realtime',
      'result.results.id': callId,
      username
    }
  },
  {
    $project: {
      realtime: {
        $filter: {
          input: '$result.results',
          as: 'rt',
          // 'codecImplementationName': 'ExternalDecoder' is unique in the realtime array object.
          // No need for 'googContentType': 'realtime' $project step
          // 'realtime' match is in pipeline's first step
          cond: { $eq: ['$$rt.codecImplementationName', 'ExternalDecoder'] }
        }
      },
      _id: 0
    }
  },
  {
    $unwind: {
      path: '$realtime',
      preserveNullAndEmptyArrays: false
    }
  },
  {
    $project: {
      // id: '$realtime.id',
      date: '$realtime.timestamp',
      result: chart.query
      // googPlisSent: '$realtime.googPlisSent',
      // packetsReceived: '$realtime.packetsReceived',
      // bytesReceived: '$realtime.bytesReceived',
      // googJitterBufferMs: '$realtime.googJitterBufferMs',
      // googFrameRateReceived: '$realtime.googFrameRateReceived',
      // googFrameRateDecoded: '$realtime.googFrameRateDecoded',
      // googFrameRateOutput: '$realtime.googFrameRateOutput'
    }
  },
  {
    $sort: { date: 1 }
  }];

  logger.debug(`WebRTC Stats GetCallDetails MongoDB Query: ${JSON.stringify(query, null, '\t')}`);

  if (db) {
    const hrstart = process.hrtime();
    db.collection('webRTCStats').aggregate(
      query
    )
      // .map((u) => {
      //   // chartName
      //   const result = [];
      //   result.result = u.result;
      //   result.date = u.date;
      //   return u;
      // })
      .toArray()
      .then((results) => {
        const hrend = process.hrtime(hrstart);
        logger.info('WebRTC Stats GetCallDetails query time: %ds %dms', hrend[0], hrend[1] / 1000000);
        logger.info(`${chartName} results from mongodb: ${results.length}`);

        logger.trace(`WebRTC Stats GetCallDetails results from mongodb: ${JSON.stringify(results, null, '\t')}`);

        // Chart on frontend uses data in this format
        // [
        //   [
        //     "2021-03-30T16:31:45.184Z",
        //     "0"
        //   ],
        //   [
        //     "2021-03-30T16:31:46.193Z",
        //     "63"
        //   ]
        // }

        const tableData = {};

        if (results.length > 0) {
          tableData.message = 'Success';

          tableData.data = Object.values(results);
          tableData.shortname = chartName;
          tableData.title = chartName;
          // logger.debug(`Data to browser: ${JSON.stringify(Object.values(results), null, '\t')}`);
        } else {
          tableData.message = '';
          tableData.data = {};
        }

        callback(tableData);
      })
      .catch((err) => {
        logger.error(`WebRTC Stats GetCallDetails query error: ${err}`);
      });
  }
};
