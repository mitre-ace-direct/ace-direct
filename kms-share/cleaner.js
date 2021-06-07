const fs = require('fs');
const path = './media/recordings/';

module.exports = function() {
    const now = new Date().getTime(); 

    fs.readdir(path, (err, files) => {
       if (err){
          console.log(err);
	  return;
       }
       files.forEach(file => {
	 if(file != 'README.md'){
	 fs.stat(path + file, (err, stats) => {
            if (err){
	       console.log(err);
	       return;
	    }
            let diff = now - stats.mtimeMs;
            if(diff > 3600000){ 
	       fs.unlink(path + file, (err) => {
                  if (err) {
                     console.error(err);
	             return;
                  }
		  console.log(file + ' deleted');
               });
	    }
         });
	 }
       });
    });

};

