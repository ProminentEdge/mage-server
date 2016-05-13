//TODO change permissions to specify sensorserver as opposed to layer

module.exports = function(app, security) {
  var SensorServer = require('../models/sensorserver')
    , Event = require('../models/event')
    , access = require('../access')
    , api = require('../api')
    , sensorserverXform = require('../transformers/sensorserver');

  var passport = security.authentication.passport;
  app.all('/api/sensorservers*', passport.authenticate('bearer'));

  function validateSensorServerParams(req, res, next) {
    var sensorserver = req.body;

    if (!sensorserver.url) {
      return res.send(400, "cannot create sensorserver 'url' param not specified");
    }

    if (!sensorserver.name) {
      return res.send(400, "cannot create sensorserver 'name' param not specified");
    }

    // TODO error check / validate that if WMS proper things are provided

    req.newSensorServer = sensorserver;
    next();
  }

  function validateEventAccess(req, res, next) {
    if (access.userHasPermission(req.user, 'READ_SENSORSERVER_ALL')) {
      next();
    } else if (access.userHasPermission(req.user, 'READ_LAYER_EVENT')) {
      // Make sure I am part of this event
      Event.eventHasUser(req.event, req.user._id, function(err, eventHasUser) {
        if (eventHasUser) {
          return next();
        } else {
          return res.sendStatus(403);
        }
      });
    } else {
      res.sendStatus(403);
    }
  }

  function parseQueryParams(req, res, next) {
    var parameters = {};
    parameters.type = req.param('type');

    req.parameters = parameters;

    next();
  }

  // get all sensorservers
  app.get(
    '/api/sensorservers',
    access.authorize('READ_SENSORSERVER_ALL'),
    parseQueryParams,
    function (req, res, next) {
      SensorServer.getSensorServers({type: req.parameters.type}, function (err, sensorservers) {
        if (err) return next(err);

        var response = sensorserverXform.transform(sensorservers, {path: req.getPath()});
        res.json(response);
      });
    }
  );

  app.get(
    '/api/sensorservers/count',
    access.authorize('READ_SENSORSERVER_ALL'),
    function (req, res, next) {
      SensorServer.count(function (err, count) {
        if (err) return next(err);

        res.json({count: count});
      });
    }
  );

  // get features for sensorserver (must be a feature sensorserver)
  app.get(
    '/api/sensorservers/:sensorserverId/features',
    access.authorize('READ_SENSORSERVER_ALL'),
    function (req, res) {
      if (req.sensorserver.type !== 'Feature' && req.sensorserver.type !== 'Sensor') return res.status(400).send('cannot get features, sensorserver type is not "Feature"');

      new api.Feature(req.sensorserver).getAll(function(err, features) {
        features = features.map(function(f) { return f.toJSON(); });
        res.json({
          type: 'FeatureCollection',
          features: features
        });
      });
    }
  );


  app.get(
    '/api/events/:eventId/sensorservers',
    passport.authenticate('bearer'),
    validateEventAccess,
    parseQueryParams,
    function(req, res, next) {
      SensorServer.getSensorServers({sensorserverIds: req.event.sensorserverIds, type: req.parameters.type}, function(err, sensorservers) {
        if (err) return next(err);

        var response = sensorserverXform.transform(sensorservers, {path: req.getPath()});
        res.json(response);
      });
    }
  );

  // get sensorserver
  app.get(
    '/api/sensorservers/:sensorserverId',
    access.authorize('READ_SENSORSERVER_ALL'),
    function (req, res) {
      console.log(req.sensorserver);

      var response = sensorserverXform.transform(req.sensorserver, {path: req.getPath()});
      res.json(response);
    }
  );

  // get features for sensorserver (must be a feature sensorserver)
  app.get(
    '/api/events/:eventId/sensorservers/:sensorserverId/features',
    passport.authenticate('bearer'),
    validateEventAccess,
    function (req, res) {
      if (req.sensorserver.type !== 'Feature' && req.sensorserver.type !== 'Sensor') return res.status(400).send('cannot get features, sensorserver type is not "Feature"');
      if (req.event.sensorserverIds.indexOf(req.sensorserver._id) === -1) return res.status(400).send('sensorserver requested is not in event ' + req.event.name);

      new api.Feature(req.sensorserver).getAll(function(err, features) {
        features = features.map(function(f) { return f.toJSON(); });
        res.json({
          type: 'FeatureCollection',
          features: features
        });
      });
    }
  );

  // Create a new sensorserver
  app.post(
    '/api/sensorservers',
    access.authorize('CREATE_SENSORSERVER'),
    validateSensorServerParams,
    function(req, res, next) {
      SensorServer.create(req.newSensorServer, function(err, sensorserver) {
        if (err) return next(err);

        var response = sensorserverXform.transform(sensorserver, {path: req.getPath()});
        res.location(sensorserver._id.toString()).json(response);
      });
    }
  );

  // Update a sensorserver
  app.put(
    '/api/sensorservers/:sensorserverId',
    access.authorize('UPDATE_SENSORSERVER'),
    validateSensorServerParams,
    function(req, res, next) {
      SensorServer.update(req.sensorserver.id, req.newSensorServer, function(err, sensorserver) {
        if (err) return next(err);

        var response = sensorserverXform.transform(sensorserver, {path: req.getPath()});
        res.json(response);
      });
    }
  );

  // Delete a sensorserver
  app.delete(
    '/api/sensorservers/:sensorserverId',
    access.authorize('DELETE_SENSORSERVER'),
    function(req, res) {
      var sensorserver = req.sensorserver;

      SensorServer.remove(sensorserver, function(err, sensorserver) {
        var response = {};
        if (err) {
          response.success = false;
          response.message = err;
        } else {
          response.succes = true;
          response.message = 'SensorServer ' + sensorserver.name + ' has been removed.';
        }

        res.json(response);
      });
    }
  );
};
