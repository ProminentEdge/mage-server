var util = require('util');

function transformSensorServers(sensorServers, options) {
  return sensorServers.map(function(server) {
    return server.toJSON({transform: true, path: options.path});
  });
}

exports.transform = function(sensorServers, options) {
  options = options || {};

  return util.isArray(sensorServers) ?
    transformSensorServers(sensorServers, options) :
    sensorServers.toJSON({transform: true, path: options.path});
};
