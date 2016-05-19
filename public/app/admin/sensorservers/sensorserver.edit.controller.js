angular
  .module('mage')
  .controller('AdminSensorServerEditController', AdminSensorServerEditController);

AdminSensorServerEditController.$inject = ['$scope', '$http', '$location', '$routeParams', 'LocalStorageService', 'SensorServer'];

function AdminSensorServerEditController($scope, $http, $location, $routeParams, LocalStorageService, SensorServer) {
  $scope.wmsFormats = ['image/jpeg', 'image/png'];
  $scope.wmsVersions = ['1.1.1', '1.3.0'];
  $scope.uploads = [{}];
  $scope.sensors = [];
  $scope.datePopup = {open: false};
  
  $scope.openDate = function($event) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.datePopup.open = true;
  };

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
            SetSensorTimeDateProperties(sensor);
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
            SetSensorUserTimeDateProperties(sensor);
            
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
    var noPropSensors = [];
    var invalidTimeSensors = [];
    for(var i = 0; i < $scope.sensors.length; i++) {
      if($scope.sensors[i].enabled) {
        if($scope.sensors[i].userStartTimeObj)
          $scope.sensors[i].userStartTime = $scope.sensors[i].userStartTimeObj.toISOString();
        if($scope.sensors[i].userEndTimeObj)
          $scope.sensors[i].userEndTime = $scope.sensors[i].userEndTimeObj.toISOString();
        
        var userEnd = $scope.sensors[i].userEndTime;
        if($scope.sensors[i].liveStream) {
          if($scope.sensors[i].endTime === 'now') {
            userEnd ='2099-01-01T00:00:00';
          }
          else {
            userEnd = $scope.sensors[i].endTime;
          }
        }
        else {
          userEnd = $scope.sensors[i].userEndTime;
          
          //if the sensor is archived then we also need to ensure all time ranges are valid
          if($scope.sensors[i].userEndTimeObj.getTime() < $scope.sensors[i].startTimeObj.getTime() 
            || $scope.sensors[i].userEndTimeObj.getTime() > $scope.sensors[i].endTimeObj.getTime() 
            || $scope.sensors[i].userEndTimeObj.getTime() < $scope.sensors[i].userStartTimeObj.getTime() 
            || $scope.sensors[i].userStartTimeObj.getTime() < $scope.sensors[i].startTimeObj.getTime() 
            || $scope.sensors[i].userStartTimeObj.getTime() > $scope.sensors[i].endTimeObj.getTime()) {
            invalidTimeSensors.push($scope.sensors[i].name);
            continue;
          }
        }
        
        //create the sensor data to save
        var currsensor = {  
          name:$scope.sensors[i].name, 
          urlFragment: "&offering="+$scope.sensors[i].name,
          startTime:$scope.sensors[i].startTime, 
          endTime:$scope.sensors[i].endTime,
          userStartTime:($scope.sensors[i].liveStream ? 'now' : $scope.sensors[i].userStartTime),
          userEndTime:userEnd,
          enabled: true,
          properties:[]
        };
       
        //iterate over and fetch all the enabled properties
        for (var p = 0; p < $scope.sensors[i].properties.length; p++) {
          if ($scope.sensors[i].properties[p].enabled) {
            var propName = $scope.sensors[i].properties[p].name;
            currsensor.properties.push({name: propName, urlFragment: "&observedProperty=" + propName, enabled: true});
          }
        }

        if(!currsensor.properties|| currsensor.properties.length == 0)
          noPropSensors.push($scope.sensors[i].name);
        else {
          if (!sensorserver.lastSensorList)
            sensorserver.lastSensorList = [];
          sensorserver.lastSensorList.push(currsensor.name);
        }
        
        if(!sensorserver.sensors)
          sensorserver.sensors = [];
        sensorserver.sensors.push(currsensor);
      }
    }

    if(noPropSensors.length != 0) {
      var msg = "Error - The following sensors have no properties selected:\n";
      for(var npIndex = 0; npIndex < noPropSensors.length; npIndex ++) {
        msg+=noPropSensors[npIndex]+'\n';
      }
      alert(msg);
      return;
    }
    
    if(invalidTimeSensors.length != 0) {
      var msg = "Error - The following sensors have invalid time ranges defined:\n";
      for(var npIndex = 0; npIndex < invalidTimeSensors.length; npIndex ++) {
        msg+=invalidTimeSensors[npIndex]+'\n';
      }
      alert(msg);
      return;
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
        if(newFound)
          sensor.isNew = true;
        SetSensorUserTimeDateProperties(sensor);
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
    if(!sensor.properties || sensor.properties.length == 0) {
      alert('Can\'t enable sensor, no observable properties available')
      return;
    }
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
          //sensor.properties[p].enabled = false;
        }
      }
    }
  };
  
  $scope.openStartDate = function(sensor, $event) {
    sensor.startDateOpen = true;
  };

  $scope.openEndDate = function(sensor, $event) {
    sensor.endDateOpen = true;
  };
  
  $scope.onLiveStreamChanged = function(sensor) {
    if(!sensor.liveStream) {
      SetSensorUserTimeDateProperties(sensor);
    }
  };
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
            SetSensorTimeDateProperties(sensor);
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
            SetSensorTimeDateProperties(sensor);
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

function SetSensorTimeDateProperties(sensor)
{
  if(sensor.startTime) {
    var startToks = sensor.startTime.split('T');
    if (startToks.length > 1) {
      var startDateTokens = startToks[0].split('-');
      var startTimeTokens = startToks[1].split(':');

      var d = new Date();
      d.setUTCDate(startDateTokens[2]);
      d.setUTCMonth(parseInt(startDateTokens[1]) - 1);
      d.setUTCFullYear(startDateTokens[0]);

      d.setUTCSeconds(parseInt(startTimeTokens[2].split('.')[0]));
      d.setUTCMinutes(startTimeTokens[1]);
      d.setUTCHours(startTimeTokens[0]);

      sensor.startTimeObj = d;
      sensor.liveStream = false;

    } else {
      sensor.liveStream = true;
    }
  }
  
  if(sensor.endTime) {
    var endToks = sensor.endTime.split('T');
    if (endToks.length > 1) {
      var endDateTokens = endToks[0].split('-');
      var endTimeTokens = endToks[1].split(':');

      var d = new Date();
      d.setUTCDate(endDateTokens[2]);
      d.setUTCMonth(parseInt(endDateTokens[1]) - 1);
      d.setUTCFullYear(endDateTokens[0]);

      d.setUTCSeconds(parseInt(endTimeTokens[2].split('.')[0]));
      d.setUTCMinutes(endTimeTokens[1]);
      d.setUTCHours(endTimeTokens[0]);

      sensor.endTimeObj = d;

    }
  }
}

function SetSensorUserTimeDateProperties(sensor)
{
  //handle case for FLIR storage currently has no time domain
  if(!sensor.startTime)
      return;
  if(!sensor.userStartTime)
    sensor.userStartTime = sensor.startTime;
  var startToks = sensor.userStartTime.split('T');
  if (startToks.length > 1) {
    var startDateTokens = startToks[0].split('-');
    var startTimeTokens = startToks[1].split(':');

    var d = new Date();
    d.setUTCDate(startDateTokens[2]);
    d.setUTCMonth(parseInt(startDateTokens[1]) - 1);
    d.setUTCFullYear(startDateTokens[0]);

    d.setUTCSeconds(parseInt(startTimeTokens[2].split('.')[0]));
    d.setUTCMinutes(startTimeTokens[1]);
    d.setUTCHours(startTimeTokens[0]);

    sensor.userStartTimeObj = d;
    //sensor.liveStream = false;

  } else {
    //if the time value is now
    //just use the start time from the archive piece
    sensor.userStartTimeObj = sensor.startTimeObj;
  }
  
  
  if(!sensor.userEndTime) 
    sensor.userEndTime = sensor.endTime;
  
  var endToks = sensor.userEndTime.split('T');
  if (endToks.length > 1) {
    var endDateTokens = endToks[0].split('-');
    var endTimeTokens = endToks[1].split(':');

    var d = new Date();
    d.setUTCDate(endDateTokens[2]);
    d.setUTCMonth(parseInt(endDateTokens[1]) - 1);
    d.setUTCFullYear(endDateTokens[0]);

    d.setUTCSeconds(parseInt(endTimeTokens[2].split('.')[0]));
    d.setUTCMinutes(endTimeTokens[1]);
    d.setUTCHours(endTimeTokens[0]);

    sensor.userEndTimeObj = d;
  }
  else {
    //if the time value is now
    var d = new Date();
    sensor.userEndTimeObj = d;
  }
  
}
