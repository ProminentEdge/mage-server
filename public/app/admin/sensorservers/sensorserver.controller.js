angular
  .module('mage')
  .controller('AdminSensorServerController', AdminSensorServerController);

AdminSensorServerController.$inject = ['$scope', '$uibModal', '$routeParams', '$location', '$filter', 'SensorServer', 'Event', 'LocalStorageService'];

function AdminSensorServerController($scope, $uibModal, $routeParams, $location, $filter, SensorServer, Event, LocalStorageService) {

  $scope.sensorserverEvents = [];
  $scope.nonTeamEvents = [];
  $scope.eventsPage = 0;
  $scope.eventsPerPage = 10;

  $scope.fileUploadOptions = {
    acceptFileTypes: /(\.|\/)(kml)$/i,
    url: '/api/sensorservers/' + $routeParams.sensorServerId + '/kml?access_token=' + LocalStorageService.getToken()
  };

  $scope.uploads = [{}];
  $scope.uploadConfirmed = false;

  SensorServer.get({id: $routeParams.sensorServerId}, function(sensorserver) {
    $scope.sensorserver = sensorserver;

    Event.query(function(events) {
      $scope.event = {};
      $scope.sensorserverEvents = _.filter(events, function(event) {
        return _.some(event.sensorservers, function(sensorserver) {
          return $scope.sensorserver.id === sensorserver.id;
        });
      });

      $scope.nonSensorServerEvents = _.reject(events, function(event) {
        return _.some(event.sensorservers, function(sensorserver) {
          return $scope.sensorserver.id === sensorserver.id;
        });
      });
    });
  });

  $scope.filterEvents = function(event) {
    var filteredEvents = $filter('filter')([event], $scope.eventSearch);
    return filteredEvents && filteredEvents.length;
  };

  $scope.addEventToSensorServer = function(event) {
    Event.addSensorServer({id: event.id}, $scope.sensorserver, function(event) {
      $scope.sensorserverEvents.push(event);
      $scope.nonSensorServerEvents = _.reject($scope.nonSensorServerEvents, function(e) { return e.id === event.id; });

      $scope.event = {};
    });
  };

  $scope.removeEventFromSensorServer = function($event, event) {
    $event.stopPropagation();

    Event.removeSensorServer({id: event.id, sensorserverId: $scope.sensorserver.id}, function(event) {
      $scope.sensorserverEvents = _.reject($scope.sensorserverEvents, function(e) { return e.id === event.id; });
      $scope.nonSensorServerEvents.push(event);
    });
  };

  $scope.editSensorServer = function(sensorserver) {
    $location.path('/admin/sensorservers/' + sensorserver.id + '/edit');
  };

  $scope.gotoEvent = function(event) {
    $location.path('/admin/events/' + event.id);
  };

  $scope.deleteSensorServer = function() {
    var modalInstance = $uibModal.open({
      templateUrl: '/app/admin/sensorservers/sensorserver-delete.html',
      resolve: {
        sensorserver: function () {
          return $scope.sensorserver;
        }
      },
      controller: ['$scope', '$uibModalInstance', 'sensorserver', function ($scope, $uibModalInstance, sensorserver) {
        $scope.sensorServer = sensorserver;

        $scope.deleteSensorServer = function(sensorserver) {
          sensorserver.$delete(function() {
            $uibModalInstance.close(sensorserver);
          });
        };

        $scope.cancel = function () {
          $uibModalInstance.dismiss('cancel');
        };
      }]
    });

    modalInstance.result.then(function() {
      $location.path('/admin/sensorservers');
    });
  };

  $scope.addUploadFile = function() {
    $scope.uploads.push({});
  };

  $scope.confirmUpload = function() {
    $scope.uploadConfirmed = true;
  };
}
