var app = angular.module('myApp', ['ng-button-autocomplete']);

app.controller('MyCtrl', function ($scope) {
    $scope.xs = ['abc', 'acd', 'bcd'];
    $scope.x = 123;
});
