/**
 * New node file
 */
const acrApp = angular.module('acrcsr-dashboard',
  ['csrService',
    'filterModule',
    'dashboardModule',
    'ngRoute'
  ]);

acrApp.config(['$routeProvider', function ($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'dashboard'
    });
}]);
