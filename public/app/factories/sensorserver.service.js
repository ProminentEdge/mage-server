angular
  .module('mage')
  .factory('SensorServerService', SensorServerService);

SensorServerService.$inject = ['$q', 'SensorServer'];

function SensorServerService($q, SensorServer) {
  var service = {
    getSensorServersForEvent: getSensorServersForEvent
  };

  return service;

  function getSensorServersForEvent(event) {
    var deferred = $q.defer();
    SensorServer.queryByEvent({eventId: event.id}, function(servers) {
      deferred.resolve(servers);
    });

    return deferred.promise;
  }
}
