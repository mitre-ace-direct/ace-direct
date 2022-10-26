const fs = require('fs');

const path = './media/recordings/';

module.exports = () => {
  const now = new Date().getTime();

  fs.readdir(path, (err, files) => {
    if (err) {
      console.log(err);
      return;
    }
    files.forEach((file) => {
      if (file !== 'README.md') {
        fs.stat(path + file, (err1, stats) => {
          if (err1) {
            console.log(err1);
            return;
          }
          const diff = now - stats.mtimeMs;
          if (diff > 3600000) {
            fs.unlink(path + file, (err2) => {
              if (err2) {
                console.error(err2);
                return;
              }
              console.log(`${file} deleted`);
            });
          }
        });
      }
    });
  });
};
