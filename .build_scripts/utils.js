/* global Oci */
'use strict';

var $ = require('jquery');
var d3 = require('d3');
var _ = require('lodash');
var fs = require('fs')

var utils = {
  // Get global extents for dataset
  // send ratio, min/max
  // optional component and oil
  // store them and return so we only have to calculate once per session
  // separate option for running this out of browser (preCalc)
  getGlobalExtent: function (ratio, minMax, component, selectedOil, preCalc) {
    // handle this one input differently
    if (component === 'ghgTotal') {
      component = null;
    }

    // check if this already exists and return if so
    var oilLookup = selectedOil || 'global';
    var componentLookup = component || 'total';

    var data = Oci.data;

    // filter data if only one oil is selected
    var oils = data.info;
    if (selectedOil) {
      oils = _.zipObject([selectedOil], _.filter(oils, function (obj, key) { return key === selectedOil; }));
    }

    // figure out whether to calculate mins or maxs
    var minMaxMultiplier = (minMax === 'min') ? -1 : 1;
    var extent = null;

    // Loop
    var sliderValues = (base, len) => base.map((b) => Array(len).fill(0).map((a, i) => b + i));
    var metadataKeys = Object.keys(data.metadata);
    metadataKeys.sort();
    var runs = metadataKeys
      .reduce((a, x) => {
        return _.flatten(sliderValues(a, data.metadata[x].values.split(',').length));
      }, ['']);
    runs.forEach((run, i) => {
      const runData = fs.readFileSync(`./app/assets/data/runs/run_${run}.json`)
      for (var key in oils) {
          var oilValues = JSON.parse(runData)[key];
          if (oilValues) {
            var total = d3.sum(Object.values(oilValues));
            if (!extent || (total * minMaxMultiplier > extent * minMaxMultiplier)) {
              extent = total;
            }
          }
        }
    });


    // store for later
    if (!Oci.data.globalExtents[ratio]) {
      Oci.data.globalExtents[ratio] = {};
    }
    if (!Oci.data.globalExtents[ratio][oilLookup]) {
      Oci.data.globalExtents[ratio][oilLookup] = {};
    }
    if (!Oci.data.globalExtents[ratio][oilLookup][componentLookup]) {
      Oci.data.globalExtents[ratio][oilLookup][componentLookup] = {};
    }
    Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax] = extent;
    return extent;
  },

  // Make a pretty oil name
  prettyOilName: function (oil) {
    return oil.Unique;
  },

  // Clone an object
  cloneObject: function (obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    var temp = obj.constructor(); // give temp the original obj's constructor
    for (var key in obj) {
      temp[key] = this.cloneObject(obj[key]);
    }

    return temp;
  },

  // Convert the original value to a new value based on desired ratio type
  getValueForRatio: function (originalValue, ratio, prelim, showCoke, info) {
    switch (ratio) {
      case 'perBarrel':
        return originalValue;
      case 'perMJ':
        // GHG/barrel * barrel/MJ * g/kg
        return originalValue * (1.0 / utils.getMJPerBarrel(prelim, showCoke, info)) * 1000;
      case 'perDollar':
        // GHG/barrel * barrel/$ * g/kg
        return originalValue * (1.0 / this.getPricePerBarrel(prelim, showCoke, info)) * 1000;
      case 'perCurrent':
        // GHG/barrel * barrel/currentPrice * g/kg
        return originalValue * (1.0 / info['Per $ Crude Oil - Current']) * 1000;
      case 'perHistoric':
        // GHG/barrel * barrel/historicPrice * g/kg
        return originalValue * (1.0 / info['Per $ Crude Oil - Historic']) * 1000;
      default:
        return originalValue;
    }
  },

  // Use prelim data and pricing info to determing blended MJ per barrel
  getMJPerBarrel: function (prelim, showCoke, info) {
    return info['Heating Value Processed Oil and Gas'];
  },

  // Send an oil name, get a unique ID
  makeId: function (unique) {
    return unique.toLowerCase().replace(/ /g, '-');
  },

  // Get the current model based on model parameters
  getModel: function (params) {
    var metadata = Oci.data.metadata;
    var model = Object.keys(params).map((param) => {
      let index = metadata[param].values.split(',').map(Number).indexOf(params[param]);
      if (index === -1) index = 0;
      return index;
    }).reduce((a, x) => a + x, '');

    return model;
  },

  // Sum up combustion fields
  getCombustionTotal: function (prelim, showCoke) {
    return prelim['Downstream'];
  },

  // Trim metadata arrays
  trimMetadataArray: function (indices) {
    return indices.map(function (index) {
      return index.trim();
    });
  },

  preorderedSort: function (array, step) {
    return _.sortBy(array, function (sort) {
      return Oci.order[step].indexOf(sort.name);
    });
  }
};

module.exports = utils;
