var mongoose = require('mongoose')
  , Counter = require('./counter')
  , Event = require('./event')
  , log = require('winston');

var Schema = mongoose.Schema;

var sensorSchema = new Schema({
  name: String,
  urlFragment: String,
  startTime: String,
  endTime: String,
  enabled:Boolean,
  properties: [{name:String, urlFragment:String, enabled:Boolean}]
});

var sensorServerSchema = new Schema({
  _id: {type: Number, required: true, unique: true},
  name: { type: String, required: true, unique: true },
  url: {type: String, required: true },
  description: String,
  sensors: [sensorSchema]
},{
  versionKey:false
});

function transform(sensorServer, ret, options) {
  ret.id = ret._id;
  delete ret._id;

  //var path = options.path || "";
  //if (ret.type === 'Feature') ret.url = [path, ret.id].join("/");
}

sensorServerSchema.set("toObject", {
  transform: transform
});

sensorServerSchema.set("toJSON", {
  transform: transform
});

// Creates the Model for the sensorServer Schema
var SensorServer = mongoose.model('SensorServer', sensorServerSchema);
exports.Model = SensorServer;

exports.create = function(sensorServer, callback) {
  Counter.getNext('sensorserver', function(id) {
    sensorServer._id = id;
    SensorServer.create(sensorServer, function(err, newServer) {
      if (err) return callback(err);

      //if (layer.type === 'Feature' || layer.type === 'Sensor') {
      //  createFeatureCollection(newLayer);
      //}

      callback(err, newServer);
    });
  });
};

exports.update = function(id, sensorserver, callback) {
  SensorServer.findByIdAndUpdate(id, sensorserver, {new: true}, function(err, updatedSensorServer) {
    callback(err, updatedSensorServer);
  });
};

exports.getSensorServers = function(filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = {};
  }

  var conditions = {};
  if (filter.type) conditions.type = filter.type;
  //if (filter.layerIds) conditions._id = {$in: filter.layerIds};

  SensorServer.find(conditions, function (err, sensorservers) {
    callback(err, sensorservers);
  });
};

exports.getById = function(id, callback) {
  SensorServer.findById(id, function (err, server) {
    callback(server);
  });
};

exports.count = function(callback) {
  SensorServer.count({}, function(err, count) {
    callback(err, count);
  });
};

exports.remove = function(server, callback) {
  server.remove(function(err) {
    if (err) return callback(err);
    else
      callback(err, server);
  });
};