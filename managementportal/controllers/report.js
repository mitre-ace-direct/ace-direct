const util = require('util');
const AreaCodes = require('areacodes');
const logger = require('../helpers/logger');

const areaCodes = new AreaCodes();
const areaCodesPromise = util.promisify(areaCodes.get);

let dt;
function GetDaysArray(start, end) {
  let arr;
  for (arr = [], dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    arr.push(new Date(dt));
  }
  return arr;
}

function formatDate(date) {
  const d = new Date(date);
  let month = `${d.getMonth() + 1}`;
  let day = `${d.getDate()}`;
  const year = d.getFullYear();

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return [year, month, day].join('-');
}

exports.createReport = function
CreateReport(db, reportStartDate, reportEndDate, timezone, callback) {
  logger.debug('CreateReport');
  logger.debug(`start and end: ${reportStartDate}, ${reportEndDate}`);
  logger.debug(`start and end: ${new Date(reportStartDate)}, ${new Date(reportEndDate)}`);

  if (db) {
    // A record from ACE Direct in mongodb.
    //
    // {
    // "Timestamp" : ISODate("2020-4-25T17:04:47.995Z"),
    // "Event" : "Web"
    // }
    //
    // Event is one of type "Handled", "Abandoned", "Videomail", or "Web"

    // MongoDB query for report data
    db.collection('calldata').aggregate(
      [
        {
          $match: { Timestamp: { $gte: new Date(reportStartDate), $lte: new Date(reportEndDate) } }
        },
        { $match: { Event: { $exists: true } } },
        // timezone in $dateToString requires mongodb 3.6 or higher
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$Timestamp', timezone } }, event: '$Event' } },
        {
          $group: {
            _id: { date: '$day', event: '$event' },
            number: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $project: { _id: 0, date: '$_id.date', type: { $concat: ['$_id.event', ':', { $substr: ['$number', 0, -1] }] } } }
      ]
    )
      .toArray()
      .then((results) => {
        // console.log("Results " + JSON.stringify(results, null,'\t'));

        const tableData = {};
        const report = {};
        let handled = 0;
        let abandoned = 0;
        let videomails = 0;
        let webcalls = 0;

        if (results[0]) {
          // Create an array of dates between report start and end.
          const daylist = GetDaysArray(new Date(reportStartDate), new Date(reportEndDate));
          const dates = daylist.map((v) => v.toISOString().slice(0, 10));

          // Create a report with zeros for all days and types in the date range.
          // MongoDB query only returns data for days and event types with activity.
          dates.forEach((item) => {
            report[item] = {
              date: item, callshandled: 0, callsabandoned: 0, videomails: 0, webcalls: 0
            };
          });

          // Add the actual counts from mongo data. Also reformat it in this step.
          results.forEach((item) => {
            const split = item.type.split(':');
            const date = formatDate(new Date(item.date));
            const count = split[1];
            switch (split[0]) {
              case 'Handled':
                report[date].callshandled = count;
                handled += parseInt(count, 10);
                break;
              case 'Abandoned':
                report[date].callsabandoned = count;
                abandoned += parseInt(count, 10);
                break;
              case 'Videomail':
                report[date].videomails = count;
                videomails += parseInt(count, 10);
                break;
              case 'Web':
                report[date].webcalls = count;
                webcalls += parseInt(count, 10);
                break;
              default:
                break;
            }
          });

          tableData.message = 'Success';
          tableData.data = Object.values(report);
          tableData.handled = handled;
          tableData.abandoned = abandoned;
          tableData.videomails = videomails;
          tableData.webcalls = webcalls;
          // console.log(JSON.stringify(Object.values(report), null, '\t'));
        } else {
          tableData.message = '';
          tableData.data = {};
          tableData.handled = 0;
          tableData.abandoned = 0;
          tableData.videomails = 0;
          tableData.webcalls = 0;
        }

        callback(tableData);
      })
      .catch((err) => {
        logger.error(`Report query error: ${err}`);
      });
  }
};

/**
  * @param items An array of items.
  * @param fn A function that accepts an item from the array and returns a promise.
  * @returns {Promise}
  */
function forEachPromise(items, fn) {
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve());
}

function getItemStateCode(itemIn) {
  const item = itemIn;
  return new Promise((resolve, _reject) => {
    process.nextTick(() => {
      areaCodesPromise(item.vrs)
        .then((data) => {
          item.stateCode = data.stateCode;
          item.city = data.city;
          if (item.stateCode == null) {
            // Happens with area code 888
            // Area code 888 not assigned to a geographical area. Make state code Unknown
            logger.debug(`State code null for ${item.vrs}`);
            item.stateCode = 'Unknown';
          }
          resolve();
        })
        .catch((_err) => {
          // None found. This opten happens with testing numbers such as 111-111-1111
          // where the first three numbers are not area codes.
          // logger.debug(`State code not found for ${item.vrs}`);
          item.stateCode = 'Unknown';
          resolve();
        });
    });
  });
}

exports.createVrsReport = function
CreateVrsReport(db, reportStartDate, reportEndDate, timezone, callback) {
  logger.debug('CreateVrsReport');
  logger.debug(`start and end: ${reportStartDate}, ${reportEndDate}`);
  logger.debug(`start and end: ${new Date(reportStartDate)}, ${new Date(reportEndDate)}`);

  if (db) {
    // MongoDB query for report data
    db.collection('calldata').aggregate(
      [
        {
          $match: { Timestamp: { $gte: new Date(reportStartDate), $lte: new Date(reportEndDate) } }
        },
        { $match: { Event: { $exists: true }, vrs: { $exists: true } } },
        { $match: { $or: [{ Event: 'Handled' }, { Event: 'Abandoned' }, { Event: 'Videomail' }] } },
        { $sort: { vrs: 1, Timestamp: -1 } },
        // timezone in $dateToString requires mongodb 3.6 or higher
        {
          $project: {
            _id: 0, vrs: '$vrs', date: { $dateToString: { format: '%Y-%m-%d', date: '$Timestamp', timezone: 'GMT' } }, status: '$Event'
          }
        }
      ]
    )
      .toArray()
      .then((results) => {
        const tableData = {};
        // const report = {};

        if (results[0]) {
          // Add state codes from vrs area code.
          forEachPromise(results, getItemStateCode)
            .then(() => {
              // console.log(JSON.stringify(results, null, '\t'));

              const reducedStates = results.map((x) => x.stateCode)
                .reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
              const topTenStates = new Map([...reducedStates.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 10));
              console.log([...topTenStates.entries()]);

              const reducedAreaCodes = results.map((x) => x.vrs.substring(0, 3))
                .reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
              const topTenAreaCodes = new Map([...reducedAreaCodes.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 10));
              console.log([...topTenAreaCodes.entries()]);

              const reducedVrsNumbers = results.map((x) => x.vrs)
                .reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
              const topTenVrsNumbers = new Map([...reducedVrsNumbers.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 10));
              console.log([...topTenVrsNumbers.entries()]);

              tableData.message = 'Success';
              tableData.data = Object.values(results);
              tableData.topTenStates = Array.from(topTenStates);
              tableData.topTenAreaCodes = Array.from(topTenAreaCodes);
              tableData.topTenVrsNumbers = Array.from(topTenVrsNumbers);

              callback(tableData);
            });
        } else {
          tableData.message = '';
          tableData.data = {};
          tableData.topTenStates = {};
          tableData.topTenAreaCodes = {};
          tableData.topTenVrsNumbers = {};
          callback(tableData);
        }
      })
      .catch((err) => {
        logger.error(`Report query error: ${err}`);
      });
  }
};

// Get number of records of each event type. Change
// {
//  "status": "Web",
//  "number":"3119.0"
// },
//  "status": "Abandoned",
//  "number":"539.0"
// },

// db.getCollection('calldata').aggregate(
// [
// //{ $match:{"Timestamp":{$gte:new Date(reportStartDate), $lte:new Date(reportEndDate)}}},
//  { $match : { Event : {$exists:true} } },
//   {
//     $group: {
//     id: "$Event" ,
//     number: { $sum: 1 }
//    }
//  },
//  { $project: { _id: 0, status: "$_id", number: "$number" } }
// ]
// )
