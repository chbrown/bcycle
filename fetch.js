/*globals phantom, document, window */
var system = require('system');
var page = require('webpage').create();

// example:
// phantomjs --ignore-ssl-errors true fetch.js https://austin.bcycle.com/stations/station-locations

// system.args[0] === 'fetch.js'
var map_url = system.args[1];

page.onResourceError = function(resourceError) {
  console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
  console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
};

page.open(map_url, function(status) {
  if (status !== 'success') {
    console.error('Status: ' + status + ' for page: ' + JSON.stringify(page));
  }
  var markers = page.evaluate(function() {
    var created_markers = [];
    window.createMarker = function(point, html, icon, back, hasTrikes) {
      var element = document.createElement('div');
      element.innerHTML = html;
      created_markers.push({
        // station
        title: element.querySelector('.markerTitle').textContent,
        description: element.querySelector('.markerPublicText').textContent,
        address: element.querySelector('.markerAddress').innerHTML.replace('<br>', '\n').replace('&amp;', '&'),
        latitude: point.lat(),
        longitude: point.lng(),
        has_trikes: hasTrikes,
        // status
        docks: parseInt(element.querySelector('.markerAvail div:last-child h3').textContent, 10),
        bikes: parseInt(element.querySelector('.markerAvail div:first-child h3').textContent, 10),
        icon: icon.match(/\/([-_0-9A-Za-z]+)\.png/)[1],
        back: back,
      });
    };
    window.LoadKiosks();
    return created_markers;
  });
  console.log(JSON.stringify(markers));
  phantom.exit();
});
