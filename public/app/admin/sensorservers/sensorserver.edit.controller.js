angular
  .module('mage')
  .controller('AdminSensorServerEditController', AdminSensorServerEditController);

AdminSensorServerEditController.$inject = ['$scope', '$http', '$location', '$routeParams', 'LocalStorageService', 'SensorServer'];

function AdminSensorServerEditController($scope, $http, $location, $routeParams, LocalStorageService, SensorServer) {
  $scope.wmsFormats = ['image/jpeg', 'image/png'];
  $scope.wmsVersions = ['1.1.1', '1.3.0'];
  $scope.uploads = [{}];
  $scope.sensors = [];
  $scope.selectedSensor = {name:"default", options:[] };

  if ($routeParams.sensorServerId) {
    SensorServer.get({id: $routeParams.sensorServerId}, function(server) {
      $scope.sensorserver = server;
       if( $scope.sensorserver.url) {
        //the layer.url property holds onto the url as well as the sensor offer and parameters
        //everything is separated by & when the data is saved out. We cannot use the url as it is
        //and need to parse out the sensor and observable properties ourselves
        var strs = $scope.sensorserver.url.split('&');

        //extract the base url for the server e.g. http://sensiasoft.net:8181
        if(strs[0][strs[0].length - 1] === '/')
          $scope.sensorserver.url = strs[0].substring(0, strs[0].length - 1);
        else
          $scope.sensorserver.url = strs[0].substring(0, strs[0].length);

        //get capabilities from the server and update UI items
        $http.get($scope.sensorserver.url+'/sensorhub/sos?service=SOS&version=2.0&request=GetCapabilities', {
            headers: {"Content-Type": "application/json"},
            ignoreAuthModule: true,
            withCredentials: false
          }).then(function(response) {

          //parse the xml string
          var xmlDoc = $.parseXML( response.data );
          //jsonixParseSensors(response);
          parseSensors(xmlDoc, $scope.sensors);
          $scope.sensors.forEach(function (sensor) {
            if(strs[1] && strs[1].indexOf(sensor.name) != -1) {
              $scope.selectedSensor.name = sensor.name;

              //look for the enabled sensor 'observable properties'
              for(var p = 0; p < sensor.properties.length; p++) {
                for(var strIndex = 0; strIndex < strs.length; strIndex++) {
                  if(strs[strIndex].indexOf(sensor.properties[p].name) != -1) {
                    sensor.properties[p].enabled = true;
                  }
                }
              }
            }
          });
        }, function(err) { alert('url is invalid or server is down'); });
      }
    });
  } else {
    $scope.sensorserver = new Layer();
  }

  $scope.saveSensorServer = function (sensorserver) {
    if(sensorserver.type == 'Sensor') {
       for(var i = 0; i < $scope.sensors.length; i++) {
        if($scope.sensors[i].name === $scope.selectedSensor.name) {
          sensorserver.url = sensorserver.url + "/&offering="+$scope.selectedSensor.name;
          for(var p = 0; p <$scope.sensors[i].properties.length; p++) {
            if($scope.sensors[i].properties[p].enabled) {
              sensorserver.url = sensorserver.url + "&observedProperty="+$scope.sensors[i].properties[p].name;
            }
          }
          sensorserver.url = sensorserver.url + $scope.sensors[i].timePiece;
          break;
        }
      }
    }

    sensorserver.$save({}, function() {
      $location.path('/admin/sensorservers/' + sensorserver.id);
    });
  };

  $scope.cancel = function() {
    $location.path('/admin/layers/' + $scope.sensorserver.id);
  };

  $scope.getSensorProperties = function() {
    $http.get($scope.sensorserver.url+'/sensorhub/sos?service=SOS&version=2.0&request=GetCapabilities', {
        headers: {"Content-Type": "application/json"},
        ignoreAuthModule: true,
        withCredentials: false
      }).then(function(response) {

      //parse the xml string
      var xmlDoc = $.parseXML( response );
      parseSensors(xmlDoc, $scope.sensors);
    }, function(err) {
      alert("url is invalid or server is down");
    });
  };


  $scope.selectedSensorChanged = function() {
    for(var i = 0; i < $scope.sensors.length; i++) {
      if($scope.sensors[i].name === $scope.selectedSensor.name) {
        //alert($scope.sensors[i].name);
      } else {
        if($scope.sensors[i].properties != null) {
          for(var p = 0; p <$scope.sensors[i].properties.length; p++) {
            $scope.sensors[i].properties[p].enabled = false;
          }
        }
      }
    }
  }
}

function jsonixParseSensors(xmlStr) {
  var MyModule = {
    name: 'MyModule',
    typeInfos: [{
        type: 'classInfo',
        localName: 'AnyElementType',
        propertyInfos: [{
            type: 'anyElement',
            allowDom: true,
            allowTypedObject:true,
            name: 'any',
            collection: false
        }]
    }],
    elementInfos: [{
        elementName: 'sos:Capabilities',
        typeInfo: 'MyModule.AnyElementType'
    }]
  };

  var context = new Jsonix.Context([MyModule], {namespacePrefixes: {'http://www.opengis.net/sos/2.0':'sos'}});
  var unmarshaller = context.createUnmarshaller();
  var data = unmarshaller.unmarshalString('<sos:Capabilities version=\"2.0.0\" >hello</sos:Capabilities>');
  return data;
}

function parseSensors(root, collection) {
  for(var i = 0; i < root.children.length; i++) {
    if(root.children[i].nodeName !== 'sos:ObservationOffering') {
      parseSensors(root.children[i], collection);
    }
    else {
      var sensor = {};

      sensorXMLNode = root.children[i];
      for(var k = 0 ; k < sensorXMLNode.children.length; k++) {
        if(sensorXMLNode.children[k].nodeName === 'swes:identifier') {
          sensor.name = sensorXMLNode.children[k].innerHTML;
        }else if(sensorXMLNode.children[k].nodeName === 'swes:description') {
          sensor.description = sensorXMLNode.children[k].innerHTML;
        }else if(sensorXMLNode.children[k].nodeName === 'swes:observableProperty') {
          if(sensor.properties) {
            sensor.properties.push({name:sensorXMLNode.children[k].innerHTML, enabled:false });
          }
          else {
            sensor.properties = [];
            sensor.properties.push({name:sensorXMLNode.children[k].innerHTML, enabled:false });
          }
        } else if(sensorXMLNode.children[k].nodeName === 'sos:phenomenonTime') {

          sensor.timePiece = '&temporalFilter=phenomenonTime,';
          //get actual start and end time for the data

          //3 cases
          //immediate - (just now)
          //archived - time in past, time in past + duration
          //mixed - time in past, now

          //check number of entries in time phenom's child
          if(sensorXMLNode.children[k].children[0].children.length > 1 &&
            (sensorXMLNode.children[k].children[0].children[0].innerHTML != "now")) {
            //archived or mixed case
            //either way get start and end times
            sensor.startTime =  sensorXMLNode.children[k].children[0].children[0].innerHTML;
            sensor.timePiece += sensor.startTime + '/';

            if(sensorXMLNode.children[k].children[0].children[1].innerHTML === "") {
              sensor.endTime = 'now';
              sensor.timePiece += 'now&replaySpeed=2';
            } else {
              sensor.endTime = sensorXMLNode.children[k].children[0].children[1].innerHTML;
              sensor.timePiece += sensor.endTime + '&replaySpeed=2';
            }
          } else {
            //immediate case
            sensor.startTime = 'now';
            sensor.endTime = '2099-08-29T16:17:29.783Z';
            sensor.timePiece += sensor.startTime+'/'+sensor.endTime;
          }

          /*// if "now" is anywhere in the time rage, then assume it is a live query from now to future
          if($(sensorXMLNode.children[k].children[0]).find('[indeterminatePosition="now"]')) {
             sensor.timePiece += 'now/2020-08-29T16:17:29.783Z';
          }
          else {
            //otherwise get the start time
            sensor.timePiece += sensorXMLNode.children[k].children[0].children[0].innerHTML + '/';

            //if no ending time is specified then just choose to make the duration five minutes from the start
            if (sensorXMLNode.children[k].children[0].children.length < 2 || sensorXMLNode.children[k].children[0].children[1].innerHTML === "") {
              var toks = sensorXMLNode.children[k].children[0].children[0].innerHTML.split(':');
              var startMinute = Number(toks[1]);
              startMinute += 5;
              toks[1] = startMinute.toString();
              sensor.timePiece += toks[0] + ":" + toks[1] + ":" + toks[2] + '&replaySpeed=2';

            }
            else {

              sensor.timePiece += sensorXMLNode.children[k].children[0].children[1].innerHTML + '&replaySpeed=2';

            }
          }*/
        }
      }
      collection.push(sensor);
    }
  }
  return;
}
