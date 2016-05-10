angular
	.module('mage')
	.factory('SensorServer', SensorServer);

SensorServer.$inject = ['$resource'];

function SensorServer($resource) {
  var SensorServer = $resource('/api/sensorservers/:id', {
    id: '@id'
  },{
    create: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    update: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    queryByEvent: {
      method: 'GET',
      isArray: true,
      url: '/api/events/:eventId/sensorservers'
    },
    count: {
      method: 'GET',
      url: '/api/sensorservers/count',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  });

  SensorServer.prototype.$save = function(params, success, error) {
    if (this.id) {
      this.$update(params, success, error);
    } else {
      this.$create(params, success, error);
    }
  };

  return SensorServer;
}
