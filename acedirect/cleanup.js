function noOp() {}

exports.Cleanup = function Cleanup(callback) {
  const callbackInt = callback || noOp;
  process.on('cleanup', callbackInt);
  process.on('exit', () => {
    process.emit('cleanup');
  });
  process.on('SIGINT', () => {
    process.exit(2);
  });
  process.on('SIGUSR1', () => {
    process.exit(3);
  });
  process.on('SIGUSR2', () => {
    process.exit(4);
  });
  process.on('SIGTERM', () => {
    process.exit(5);
  });
  process.on('uncaughtException', () => {
    process.exit(99);
  });
};
