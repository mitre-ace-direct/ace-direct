const fs = require('fs');
const mongoose = require('mongoose');

module.exports = {
  createArrayOfRecords() {
    // Read from the newly created output file and store each entry into an array
    const distributionArray = fs.readFileSync('./gumbelmaxout.txt', 'utf8').toString().split('\r\n');
    // This handles the case for the very last newline character
    if (distributionArray[distributionArray.length - 1] === '') {
      distributionArray.pop();
    }
    // Get actual date values and set the start and end times for the day
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const counter = new Date(startDate.getTime());
    startDate /= 1000;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 0);
    endDate /= 1000;

    // Get the range of values to create the array of seconds for the entire day
    const range = (endDate - startDate) + 1;
    // Use the start date as the offset into the time index array
    const offset = startDate;

    /* Create time array and set its length to the previously found
        range; fill the array with zeroes  */
    const timeIndexArray = [];
    timeIndexArray.length = range;
    timeIndexArray.fill(0);

    for (let index = 0; index < distributionArray.length; index += 1) {
      const element = distributionArray[index];
      parseFloat(element);
      const second = Math.floor(Math.random() * 59);
      const hour = Math.floor(element);
      const minute = Math.floor((element - Math.floor(element)) * 59);

      // create new Date Object with these generated values
      let dateToBeInserted = new Date();
      dateToBeInserted.setHours(hour, minute, second, 0);
      dateToBeInserted /= 1000;
      // calculate new offset for the time index array and increment the value at that offset
      const offsetIndex = dateToBeInserted - offset;
      timeIndexArray[offsetIndex] += 1;
    }
    console.log(timeIndexArray.indexOf(1));

    // create record collection
    const recordArray = [];
    recordArray.length = range;
    // fill the record array with instances of records
    for (let i = 0; i < recordArray.length; i += 1) {
      recordArray[i] = {
        timestamp: 0,
        event: 'QueueSummary',
        queue: 'ComplaintsQueue',
        loggedin: 0,
        available: 0,
        callers: 0,
        holdtime: 0,
        longestholdtime: 0
      };
      counter.setSeconds(counter.getSeconds() + 1);
      recordArray[i].timestamp = counter.getTime();
      recordArray[i].callers = timeIndexArray[i];
    }
    return recordArray;
  },
  addToMongo(arrayOfRecords, serverPath) {
    // open a connection to the test database
    mongoose.connect(serverPath);
    // notifies a successful connection
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', () => {
      // we're connected!
      // insert recordArray into the database
      db.collection('records').insert(arrayOfRecords, () => {
        db.close();
        console.log('Done.');
      });
    });
  }
};
