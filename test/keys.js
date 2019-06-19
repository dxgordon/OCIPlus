var test = require('ava');
var fs = require('fs');
var _ = require('lodash');

test('All JSON files should parse correctly', function (t) {
  var blurbs = fs.readFileSync('../app/assets/data/blurbs.json');
  var oilfields = fs.readFileSync('../app/assets/data/oilfields.geojson');
  var info = fs.readFileSync('../app/assets/data/info.json');
  var metadata = fs.readFileSync('../app/assets/data/metadata.json');
  var prices = fs.readFileSync('../app/assets/data/prices.json');
  var related = fs.readFileSync('../app/assets/data/related.json');
  [ blurbs, oilfields, prices, related, metadata, info ].forEach(function (file) {
    t.notThrows(function () { JSON.parse(file); });
  });
});

test('All possible runs should be readable', function (t) {
  var sliderValues = (base, len) => base.map((b) => Array(len).fill(0).map((a, i) => b + i));
  // Load all data based on metadata
  var metadata = JSON.parse(fs.readFileSync('../app/assets/data/metadata.json'));
  var metadataKeys = Object.keys(metadata);
  metadataKeys.sort();
  var runs = metadataKeys
    .reduce((a, x) => {
      return _.flatten(sliderValues(a, metadata[x].values.split(',').length));
    }, ['']);

  runs.forEach((run) => {
    t.notThrows(() => JSON.parse(fs.readFileSync(`../app/assets/data/runs/run_${run}.json`)));
  });
});
