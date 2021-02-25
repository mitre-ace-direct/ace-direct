/**
 * New node file
 */

angular.module('csrService', []).factory('socket', ['$rootScope', '$http', '$timeout', '$q', function ($rootScope, _$http, _$timeout, _$q) {
  const socket = io.connect(`https://${window.location.host}`, {
    path: `${nginxPath}/socket.io`,
    query: `token=${socketToken()}`,
    forceNew: true
  });
  return {
    on(eventName, callback) {
      socket.on(eventName, function () {
        const args = arguments;
        $rootScope.$apply(() => {
          callback.apply(socket, args);
        });
      });
    },
    emit(eventName, data, callback) {
      socket.emit(eventName, data, function () {
        const args = arguments;
        $rootScope.$apply(() => {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      });
    }
  };
}]);

function socketToken() {
  let token = '';
  $.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    async: false,
    success(data) {
      if (data.message === 'success') {
        token = data.token;
      }
    }
  });
  return token;
}
