const execLib = require('child_process');

// function to execute shell command as a promise
// cmd is the shell command
// wdir is the working dir
// return a Promise
function execCommand(cmd, wdir) {
  console.log(`executing ${cmd} ...`);
  return new Promise((resolve, _reject) => {
    execLib.exec(cmd, { cwd: wdir }, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        process.exit(99);
      }
      resolve(stdout || stderr);
    });
  });
}

async function go() {
  await execCommand('rm -rf node_modules >/dev/null  2>&1 || true ', '.');
  await execCommand('npm install >/dev/null ', '.');
}

go(); // MAIN
