angular
  .module('mage')
  .controller('AdminSensorServersController', AdminSensorServersController);

AdminSensorServersController.$inject = ['$scope', '$filter', '$uibModal', '$location', 'SensorServer'];

function AdminSensorServersController($scope, $filter, $uibModal, $location, SensorServer) {
  $scope.filter = "all";
  $scope.sensorServers = [];
  $scope.page = 0;
  $scope.itemsPerPage = 10;

  SensorServer.query(function(sensorServers) {
    $scope.sensorServers = sensorServers;
  });

  $scope.filterSensorServers = function(server) {
    var filteredSensorServers = $filter('filter')([server], $scope.sensorServerSearch);
    return filteredSensorServers && filteredSensorServers.length;
  };

  $scope.filterType = function (sensorServer) {
    switch ($scope.filter) {
    case 'all': return true;
    }
  };

  $scope.reset = function() {
    $scope.page = 0;
    $scope.filter = 'all';
    $scope.sensorServerSearch = '';
  };

  $scope.newSensorServer = function() {
    $location.path('/admin/sensorservers/new');
  };

  $scope.gotoSensorServer = function(server) {
    $location.path('/admin/sensorservers/' + server.id);
  };

  $scope.editSensorServer = function($event, server) {
    $event.stopPropagation();

    $location.path('/admin/sensorservers/' + server.id + '/edit');
  };

  $scope.deleteSensorServer = function($event, server) {
    $event.stopPropagation();

    var modalInstance = $uibModal.open({
      templateUrl: '/app/admin/sensorservers/sensorserver-delete.html',
      resolve: {
        sensorServer: function () {
          return server;
        }
      },
      controller: ['$scope', '$uibModalInstance', 'sensorServer', function ($scope, $uibModalInstance, sensorServer) {
        $scope.sensorServer = sensorServer;

        $scope.deleteSensorServer = function(s) {
          s.$delete(function() {
            $uibModalInstance.close(s);
          });
        };

        $scope.cancel = function () {
          $uibModalInstance.dismiss('cancel');
        };
      }]
    });

    modalInstance.result.then(function (sensorServer) {
      $scope.sensorServers = _.without($scope.sensorServers, sensorServer);
    });
  };
}
