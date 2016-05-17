angular
  .module('mage')
  .controller('AdminSensorServerEditController', AdminSensorServerEditController);

AdminSensorServerEditController.$inject = ['$scope', '$http', '$location', '$routeParams', 'LocalStorageService', 'SensorServer'];

function AdminSensorServerEditController($scope, $http, $location, $routeParams, LocalStorageService, SensorServer) {
  $scope.wmsFormats = ['image/jpeg', 'image/png'];
  $scope.wmsVersions = ['1.1.1', '1.3.0'];
  $scope.uploads = [{}];
  $scope.sensors = [];


  if ($routeParams.sensorServerId) {
    SensorServer.get({id: $routeParams.sensorServerId}, function(server) {
      $scope.sensorserver = server;
       if( $scope.sensorserver.url) {
        //the sensorserver.url property holds onto the url as well as the sensor offer and parameters
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
          //jsonixParseSensors(response.data);
          parseSensors(xmlDoc, $scope.sensors);
          
          //iterate over all the sensors we got from GetCapabilities and mark
          //the checkbox for the ones that are enabled (from the database)
          $scope.sensors.forEach(function (sensor) {
            $scope.sensorserver.sensors.forEach(function (serverSensor) {
              
              /* Test case for sensor disconnection
              if(serverSensor.name === 'urn:mysos:offering03') {
                return;
              }*/
              
              if(sensor.name === serverSensor.name) {
                //we need to keep check to see if there are any sensors stored in the database that
                //don't exist in the get capabilities and notify the user
                serverSensor.exists = true; 
                sensor.enabled = serverSensor.enabled;
                sensor.userStartTime = serverSensor.userStartTime ? serverSensor.userStartTime : serverSensor.startTime;
                sensor.userEndTime = serverSensor.userEndTime ? serverSensor.userEndTime : serverSensor.endTime;
                //handle properties/checkbox enabling
                for(var p = 0; p < sensor.properties.length; p++) {
                  for(var k = 0; k < serverSensor.properties.length; k++) {
                    if(sensor.properties[p].name === serverSensor.properties[k].name) {
                      sensor.properties[p].enabled = serverSensor.properties[k].enabled;
                    }
                  }
                }
              }
            });
          });

          var disconnectedSensorsMsg = 'MAGE has detected the following sensors have been disconnected since the last configuration was saved: ';
          var showAlert = false;
          $scope.sensorserver.sensors.forEach(function (serverSensor) {
            if(!serverSensor.exists) {
              disconnectedSensorsMsg += serverSensor.name + '\n';
              showAlert = true;
            }
          });
          if(showAlert)
            alert(disconnectedSensorsMsg);
        }, function(err) { alert('url is invalid or server is down'); });
      }
    });
  } else {
    $scope.sensorserver = new SensorServer();
  }

  $scope.saveSensorServer = function (sensorserver) {
    //Note: saving does not check any diffs between the original server data from the database
    //it overwrites all the data for this server with what exists in the UI. This ensures data is exactly what the user expects.
    sensorserver.sensors = null;
    for(var i = 0; i < $scope.sensors.length; i++) {
      if($scope.sensors[i].enabled) {
        var currsensor = {  
          name:$scope.sensors[i].name, 
          urlFragment: "&offering="+$scope.sensors[i].name,
          startTime:$scope.sensors[i].startTime, 
          endTime:$scope.sensors[i].endTime,
          userStartTime:$scope.sensors[i].userStartTime,
          userEndTime:$scope.sensors[i].userEndTime,
          enabled: true,
          properties:[]
        };

        for(var p = 0; p <$scope.sensors[i].properties.length; p++) {
          if($scope.sensors[i].properties[p].enabled) {
            var propName =  $scope.sensors[i].properties[p].name;
            currsensor.properties.push({ name: propName, urlFragment: "&observedProperty="+propName, enabled: true });
          }
        }

        if(!sensorserver.lastSensorList)
          sensorserver.lastSensorList = [];
        sensorserver.lastSensorList.push(currsensor.name);
        
        if(!sensorserver.sensors)
          sensorserver.sensors = [];
        sensorserver.sensors.push(currsensor);
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
      var xmlDoc = $.parseXML( response.data );

      parseSensors(xmlDoc, $scope.sensors);
      var recentSensorNames = [];

      if(!$scope.sensorserver.lastSensorList)
        $scope.sensorserver.lastSensorList = [];
      
      $scope.sensors.forEach(function (sensor) {
        recentSensorNames.push(sensor.name);
        var newFound = true;
        for(var lsIndex = 0; lsIndex < $scope.sensorserver.lastSensorList.length; lsIndex++) {
          if($scope.sensorserver.lastSensorList[lsIndex] === sensor.name) {
            sensor.isNew = false;
            newFound = false
          }
        }
        if(newFound && $scope.sensorserver.lastSensorList.length > 0)
          sensor.isNew = true;
      });
      $scope.sensorserver.lastSensorList = recentSensorNames;
      
      if(!$scope.sensorserver.sensors) 
          return;

      $scope.sensorserver.sensors.forEach(function (serverSensor) {
        var serverSensorExistsInGetCapabilitiesSensors = false;
        // Test for sensor disconnection
        $scope.sensors.forEach(function (sensor) {
          if(sensor.name === serverSensor.name) {
            //we need to check to see if there are any sensors stored in the database that
            //don't exist in the get capabilities and notify the user
            serverSensorExistsInGetCapabilitiesSensors = true;
          }
        }); 
        if(!serverSensorExistsInGetCapabilitiesSensors) {
          serverSensor.exists = false;
        }
      });

      var disconnectedSensorsMsg = 'MAGE has detected the following sensors have been disconnected since the last configuration was saved: ';
      var showAlert = false;
      $scope.sensorserver.sensors.forEach(function (serverSensor) {
        if(!serverSensor.exists) {
          disconnectedSensorsMsg += serverSensor.name + '\n';
          showAlert = true;
        }
      });
      if(showAlert)
        alert(disconnectedSensorsMsg);

    }, function(err) {
      alert("url is invalid or server is down");
    });
  };


  $scope.sensorEnabledChanged = function(sensor) {
    
    sensor.enabled = !sensor.enabled;
    
    if(sensor.enabled) {
      if(!sensor.userStartTime) {
        sensor.userStartTime = sensor.startTime;
      }
      if(!sensor.userEndTime) {
        sensor.userEndTime = sensor.endTime;
      }
    } else {
      if(sensor.properties != null) {
        for(var p = 0; p <sensor.properties.length; p++) {
          sensor.properties[p].enabled = false;
        }
      }
    }
  }
}

function jsonixParseSensors(xmlStr) {
  var module = SOS_2_0_Module_Factory();
  var context = new Jsonix.Context([SOS_2_0_Module_Factory]);
  var unmarshaller = context.createUnmarshaller();
  var data = unmarshaller.unmarshalString(xmlStr,{namespacePrefixes: {'http://www.opengis.net/sos/2.0':'sos'}});
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
            
            //only initialize these values if they are not already set
            // if(!sensor.userStartTime) {
            //   sensor.userStartTime = sensor.startTime;
            // }
            // if(!sensor.userEndTime) {
            //   sensor.userEndTime = sensor.endTime;
            //}
          } else {
            //immediate case
            sensor.startTime = 'now';
            sensor.endTime = '2099-08-29T16:17:29.783Z';
            sensor.timePiece += sensor.startTime+'/'+sensor.endTime;

            // if(!sensor.userStartTime) {
            //   sensor.userStartTime = sensor.startTime;
            // }
            // if(!sensor.userEndTime) {
            //   sensor.userEndTime = sensor.endTime;
            // }
          }
        }
      }
      var found = false;
      for(var c = 0; c < collection.length; c++) {
        if(collection[c].name === sensor.name) {
          found = true;
          break;
        }
      }
      if(!found)
        collection.push(sensor);
    }
  }
  return;
}
