const path = require('path');
const fs = require('fs');
const execLib = require('child_process');

const CSS = [
  'bootstrap/dist/css/bootstrap.min.css',
  'bootstrap/dist/css/bootstrap.min.css.map',
  'bootstrap-toggle/css/bootstrap-toggle.css',
  'font-awesome/css/font-awesome.min.css',
  'inputmask/css/inputmask.css',
  'admin-lte/dist/css/AdminLTE.min.css',
  'admin-lte/dist/css/skins/skin-blue.min.css',
  'admin-lte/dist/css/skins/skin-purple.min.css',
  'ionicons/dist/css/ionicons.min.css',
  'ionicons/dist/css/ionicons.min.css.map',
  'gridstack/dist/gridstack.min.css',
  'datatables.net-bs/css/dataTables.bootstrap.min.css'

  /*
    'admin-lte/plugins/bootstrap-slider/slider.css',
    'bootstrap-daterangepicker/daterangepicker.css',
    */
];
const FONT = [
  'font-awesome/fonts/fontawesome-webfont.woff2',
  'bootstrap/fonts/glyphicons-halflings-regular.woff',
  'bootstrap/fonts/glyphicons-halflings-regular.woff2',
  'bootstrap/fonts/glyphicons-halflings-regular.ttf'
];

const JS = [
  'bootstrap/dist/js/bootstrap.js',
  'bootstrap-toggle/js/bootstrap-toggle.js',
  'jquery/dist/jquery.min.js',
  'inputmask/dist/min/inputmask/inputmask.min.js',
  'inputmask/dist/min/inputmask/jquery.inputmask.min.js',
  'jwt-decode/build/jwt-decode.js',
  'jwt-decode/build/jwt-decode.js.map',
  'moment/moment.js',
  'admin-lte/dist/js/adminlte.min.js',
  'admin-lte/plugins/jQueryUI/jquery-ui.min.js',
  'gridstack/dist/gridstack.min.js',
  'gridstack/dist/gridstack.min.map',
  'gridstack/dist/gridstack.jQueryUI.min.js',
  'lodash/lodash.min.js',
  'datatables.net/js/jquery.dataTables.min.js',
  'datatables.net-bs/js/dataTables.bootstrap.min.js',
  'getstats/getStats.js'
  /*
    'admin-lte/plugins/bootstrap-slider/bootstrap-slider.js',
    'bootstrap-daterangepicker/daterangepicker.js',
    'jquery-form-validator/form-validator/jquery.form-validator.min.js',
    'jquery-form-validator/form-validator/toggleDisabled.js',
    */
];

function buildAssets() {
  if (!fs.existsSync('./public/assets')) {
    fs.mkdirSync('./public/assets');
  }
  if (!fs.existsSync('./public/assets/js')) {
    fs.mkdirSync('./public/assets/js');
  }
  if (!fs.existsSync('./public/assets/css')) {
    fs.mkdirSync('./public/assets/css');
  }
  if (!fs.existsSync('./public/assets/fonts')) {
    fs.mkdirSync('./public/assets/fonts');
  }
  JS.map((asset) => {
    const filename = asset.substring(asset.lastIndexOf('/') + 1);
    const from = path.resolve(__dirname, `./node_modules/${asset}`);
    const to = path.resolve(__dirname, `./public/assets/js/${filename}`);
    if (fs.existsSync(from)) {
      return fs.createReadStream(from).pipe(fs.createWriteStream(to));
    }
    console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
    return process.exit(1);
  });

  CSS.map((asset) => {
    const filename = asset.substring(asset.lastIndexOf('/') + 1);
    const from = path.resolve(__dirname, `./node_modules/${asset}`);
    const to = path.resolve(__dirname, `./public/assets/css/${filename}`);
    if (fs.existsSync(from)) {
      return fs.createReadStream(from).pipe(fs.createWriteStream(to));
    }
    console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
    return process.exit(1);
  });

  FONT.map((asset) => {
    const filename = asset.substring(asset.lastIndexOf('/') + 1);
    const from = path.resolve(__dirname, `./node_modules/${asset}`);
    const to = path.resolve(__dirname, `./public/assets/fonts/${filename}`);
    if (fs.existsSync(from)) {
      return fs.createReadStream(from).pipe(fs.createWriteStream(to));
    }
    console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
    return process.exit(1);
  });
}

// function to execute shell command as a promise
// cmd is the shell command
// wdir is the working dir
// return a Promise
function execCommand(cmd, wdir, expected, _hint) {
  console.log(`executing  ${cmd}  ...`);
  const { exec } = execLib;
  return new Promise((resolve, _reject) => {
    exec(cmd, { cwd: wdir }, (error, stdout, stderr) => {
      if (error) {
        console.log();
        console.error(`FAILED! Please resolve: ${error.cmd}`);
        console.log();
        process.exit(99);
      } else if (expected) {
        const expectedVal = expected.trim();
        const stdoutVal = stdout.trim();
        if (stdoutVal !== expectedVal) {
          console.log(`FAILED! Incorrect version: ${stdout}. expected: ${expected}`);
          process.exit(99);
        }
      }
      resolve(stdout || stderr);
    });
  });
}

async function go() {
  console.log('Building acedirect...');
  console.log('checking for dat/ configuration files...');
  await execCommand('ls config.json', '../dat', null, 'ERROR: ../dat/config.json is missing!');
  await execCommand('ls default_color_config.json', '../dat', null, 'ERROR: ../dat/default_color_config.json is missing!');
  await execCommand('ls color_config.json', '../dat', null, 'ERROR: ../dat/color_config.json is missing!');

  await execCommand('rm -rf node_modules >/dev/null 2>&1 || true ', '.', null, null);
  await execCommand('npm install ', '.', null, null);
  await execCommand('rm -f public/assets/css/* public/assets/fonts/* public/assets/js/* public/assets/webfonts/* > /dev/null 2>&1 || true ', '.', null, null);

  buildAssets();
  console.log('SUCCESS!');
}

go(); // MAIN
