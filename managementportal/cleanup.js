function noOp() { }
exports.Cleanup = function Cleanup(callback) {
  const callbackInt = callback || noOp;
  process.on('cleanup', callbackInt);
  process.on('exit', () => {
    process.emit('cleanup');
  });
  process.on('SIGINT', () => {
    console.log('Ctrl-C...');
    process.exit(2);
  });
  process.on('SIGUSR1', () => {
    console.log('Kill 1 caught...');
    process.exit(3);
  });
  process.on('SIGUSR2', () => {
    console.log('Kill 2 caught...');
    process.exit(4);
  });
  process.on('SIGTERM', () => {
    console.log('SIGTERM...');
    process.exit(5);
  });
  process.on('uncaughtException', (e) => {
    console.log('Uncaught Exception...');
    console.log(e.stack);
    process.exit(99);
  });
};
