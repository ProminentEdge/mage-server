(function () {
  var leafletDirective = angular.module("leaflet-directive", ["mage.***REMOVED***s"]);

  leafletDirective.directive("leaflet", function ($http, $log, $compile, $timeout, appConstants) {
    return {
      restrict: "A",
      replace: true,
      transclude: true,
      scope: {
        markerLocation: "=markerLocation",
        message: "=message",
        baseLayer: "=baselayer",
        layer: "=layer",
        currentLayerId: "=currentlayerid",
        position: "=position",
        positionBroadcast: "=positionBroadcast",
        locations: "=locations",
        activeFeature: "=activefeature",
        newFeature: "=newfeature"
      },
      template: '<div cl***REMOVED***="map"></div>',
      link: function (scope, element, attrs, ctrl) {
        // Create the map
        var $el = element[0];
        var map = new L.Map("map");
        map.setView([0, 0], 3);

        var marker = new L.marker([0,0], {
          draggable: attrs.markcenter ? false:true
        });
        map.addLayer(marker);
        scope.markerLocation = marker.toGeoJSON();

        map.on("click", function(e) {
          marker.setLatLng(e.latlng);
          scope.markerLocation = e.latlng;
        });

        var baseLayer = {};
        var layers = {};

        var greenIcon = L.icon({
          iconUrl: appConstants.rootUrl + '/js/lib/leaflet/images/marker-icon-green.png',
          shadowUrl: appConstants.rootUrl + '/js/lib/leaflet/images/marker-shadow.png',

          iconSize:     [25, 41], // size of the icon
          shadowSize:   [41, 41], // size of the shadow
          iconAnchor:   [12, 41], // point of the icon which will correspond to marker's location
          shadowAnchor: [12, 41],  // the same for the shadow
          popupAnchor:  [1, -34] // point from which the popup should open relative to the iconAnchor
        });

        var yellowIcon = L.icon({
          iconUrl: appConstants.rootUrl + '/js/lib/leaflet/images/marker-icon-yellow.png',
          shadowUrl: appConstants.rootUrl + '/js/lib/leaflet/images/marker-shadow.png',

          iconSize:     [25, 41], // size of the icon
          shadowSize:   [41, 41], // size of the shadow
          iconAnchor:   [12, 41], // point of the icon which will correspond to marker's location
          shadowAnchor: [12, 41],  // the same for the shadow
          popupAnchor:  [1, -34] // point from which the popup should open relative to the iconAnchor
        });

        var myLocationIcon = L.AwesomeMarkers.icon({
          icon: 'male',
          color: 'blue'
        });
        var myLocationMarker = new L.marker([0,0], {icon: myLocationIcon});

        var locationIcon = L.AwesomeMarkers.icon({
          icon: 'male',
          color: 'cadetblue'
        });

        scope.$watch("position", function(p) {
          if (!p) return;

          var coords = [p.coords.latitude, p.coords.longitude];
          marker.setLatLng(coords);
          map.setView(coords, 16);
          scope.markerLocation = {lat: p.coords.latitude, lng: p.coords.longitude};
        });

        scope.$watch("positionBroadcast", function(p) {
          if (!p) return;

          myLocationMarker.setLatLng([p.coords.latitude, p.coords.longitude]);
          map.addLayer(myLocationMarker);
          myLocationMarker
            .bindPopup("<div><h4>You were here</h4> This location was successfully broadcasted to the server.</div>")
            .openPopup();

          $timeout(function() {
            myLocationMarker.closePopup();
          },5000);
        });

        scope.$watch("baseLayer", function(layer) {
          if (!layer) return;

          map.removeLayer(baseLayer);
          if (layer.format == 'XYZ' || layer.format == 'TMS') {
            baseLayer = new L.TileLayer(layer.url, { tms: layer.format == 'TMS', maxZoom: 18});
          } else if (layer.format == 'WMS') {
            var options = {
              layers: layer.wms.layers,
              version: layer.wms.version,
              format: layer.wms.format,
              transparent: layer.wms.transparent            };
            if (layer.wms.styles) options.styles = layer.wms.styles;
            baseLayer = new L.TileLayer.WMS(layer.url, options);
          }
          baseLayer.addTo(map).bringToBack();
        });

        var currentLocationMarkers = {};
        var locationLayerGroup = new L.LayerGroup().addTo(map);
        scope.$watch("locations", function(users) {
          if (users.length == 0) {
            locationLayerGroup.clearLayers();
            currentLocationMarkers = {};
            return;
          }

          var locationMarkers = {};
          _.each(users, function(user) {
            var u = user;
            if (user.locations.length > 0) {
              var l = u.locations[0];
              var marker = currentLocationMarkers[u.user];
              if (marker) {
                delete currentLocationMarkers[u.user];
                locationMarkers[u.user] = marker;
                // Just update the location
                marker.setLatLng([l.geometry.coordinates[1], l.geometry.coordinates[0]]);
                return;
              }

              var layer = new L.GeoJSON(u.locations[0], {
                pointToLayer: function (feature, latlng) {
                  var marker = new L.CircleMarker(latlng, {color: '#f00'}).setRadius(5);

                  var e = angular.element("<div user-location></div>");
                  var newScope = scope.$new();
                  $compile(e)(newScope, function(clonedElement, scope) {
                    // TODO this sucks but for now set a min width
                    marker.bindPopup(clonedElement[0], {minWidth: 150});

                    marker.on('click', function() {
                      angular.element(clonedElement).scope().getUser(u.user);
                    });
                  });

                  locationMarkers[u.user] = marker;
                  return marker;
                }
              });

              locationLayerGroup.addLayer(layer);
            }
          });

          _.each(currentLocationMarkers, function(marker, user) {
            locationLayerGroup.removeLayer(marker);
          });

          currentLocationMarkers = locationMarkers;
        });

        scope.$watch("layer", function(one, two, three, four, five) {
            var layer = scope.layer;
            if (!layer) return;

            if (layer.checked) {
              // add to map
              var newLayer = null;
              if (layer.type === 'Imagery') {
                if (layer.format == 'XYZ' || layer.format == 'TMS') {
                  newLayer = new L.TileLayer(layer.url, { tms: layer.format == 'TMS', maxZoom: 18});
                } else if (layer.format == 'WMS') {
                  var options = {
                    layers: layer.wms.layers,
                    version: layer.wms.version,
                    format: layer.wms.format,
                    transparent: layer.wms.transparent
                  };
                  if (layer.wms.styles) options.styles = layer.wms.styles;
                  newLayer = new L.TileLayer.WMS(layer.url, options);
                }
                newLayer.addTo(map).bringToFront();
              } else {
                newLayer = new L.GeoJSON(layer.features, {
                  pointToLayer: function (feature, latlng) {
                    var iconUrl = feature.properties.icon_url;
                    var icon = greenIcon;
                    if (iconUrl) {
                      icon = L.icon({iconUrl: feature.properties.icon_url});
                    } else {
                      icon = greenIcon;
                    }

                    var marker = new L.marker(latlng, {
                      icon:  icon
                    });

                    marker.on("click", function(e) {
                      scope.$apply(function(s) {
                        scope.activeFeature = {layerId: layer.id, featureId: feature.properties.OBJECTID};
                      });
                    });

                    return marker;
                  }
                }).addTo(map).bringToFront(); 
              }

              layers[layer.id] = newLayer;
            } else {
              // remove from map
              map.removeLayer(layers[layer.id]);
              delete layers[layer.id];
            }
        }); // watch layer

        scope.$watch("newFeature", function(feature) {
          if (!feature) return;

          var layer = layers[scope.currentLayerId];
          if (layer) {
            layer.addData(scope.newFeature);
          }
        }); // watch newFeature

      } // end of link function
    };
  });
}());