const fs = require('fs');
const randgen = require('randgen');
const tools = require('./tools');

// if the output file already exists then delete it
if (fs.existsSync('./gumbelmaxout.txt')) {
  fs.unlink('gumbelmaxout.txt');
}

const mu = 9.02; // continuous location parameter
const sigma = 1.1659; // continuous scale parameter
const outfile = fs.createWriteStream('gumbelmaxout.txt');
// change the number of iterations for this loop if you want more or less data
for (let x = 0; x < 10000; x += 1) {
  // creates a random sample in the range 6 < x < 23, following
  // the Gumbel Max distribution with mu, sigma
  const p = randgen.runif(0, 1, false);
  const sample = mu - sigma * Math.log(-1 * Math.log(p));
  outfile.write(`${sample}\r\n`);
}
outfile.end(() => {
  // create an array of records from the list of values from gumbelmaxout
  const rec = tools.createArrayOfRecords();
  /* This line is inserting all of the data into mongo.
    The second parameter is the path to your running mongo database which can be changed
    to your personal path */
  tools.addToMongo(rec, 'mongodb://localhost/test');
});
