var fs = require('fs');
var utils = require('./utils');

global.Oci = {};
Oci.data = {}
Oci.data.metadata = JSON.parse(fs.readFileSync('app/assets/data/metadata.json'))
Oci.data.info = JSON.parse(fs.readFileSync('app/assets/data/info.json'))
Oci.data.globalExtents = {}

var ratios = ['perBarrel'];
var minMaxes = ['min', 'max'];
var components = ['ghgTotal', 'total', 'downstream', 'upstream', 'midstream'];
var oils = Object.keys(Oci.data.info);

ratios.forEach(function (ratio, i) {
  minMaxes.forEach(function (minMax, j) {
    components.forEach(function (component, k) {
      oils.forEach(function (oil) {
        utils.getGlobalExtent(ratio, minMax, component, oil, true);
      });
      console.log(i, j, k);
      utils.getGlobalExtent(ratio, minMax, component, null, true);
    });
  });
});

fs.writeFileSync('app/assets/data/global-extents.json', JSON.stringify(Oci.data.globalExtents));
