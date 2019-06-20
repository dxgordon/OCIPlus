/* global Oci */
'use strict';

var $ = require('jquery');
var d3 = require('d3');
var _ = require('lodash');
var RunModel = require('./models/run');

const allKeys = {
  ghgPerMJ: { key: 'Total Emissions (MJ)', name: 'Total Emissions (MJ)', units: 'kg CO\u2082 eq./MJ' },
  ghgTotal: { key: 'Total Emissions', name: 'Total Emissions', units: 'kg CO\u2082 eq./barrel oil equivalent oil and gas' },
  upstream: { key: 'Upstream Emissions', name: 'Upstream Emissions', units: 'kg CO\u2082 eq./barrel oil equivalent oil and gas' },
  midstream: { key: 'Midstream Emissions', name: 'Midstream Emissions', units: 'kg CO\u2082 eq./barrel oil equivalent oil and gas' },
  downstream: { key: 'Downstream Emissions', name: 'Downstream Emissions', units: 'kg CO\u2082 eq./barrel oil equivalent oil and gas' },
  methaneFV: { key: 'Methane Fugitives + Venting tonnes methane per day', name: 'Methane Fugitives + Venting', units: 'tonnes methane per day' },
  co2FV: { key: 'CO2 Fugitives + Venting tonnes CO2e per day', name: 'CO2 Fugitives + Venting', units: 'tonnes CO\u2082 eq. per day' },
  leakage: { key: 'Methane Leakage Rate tonnes methane per tonnes wellbore gas', name: 'Methane Leakage Rate', units: 'tonnes methane per tonnes wellbore gas' },
  heatingValue: { key: 'Heating Value Processed Oil and Gas', name: 'Heating Value Processed Oil and Gas', units: '' },
  years: { key: 'Years in Production', name: 'Years in Production', units: 'years' },
  depth: { key: 'Depth', name: 'Depth', units: 'feet' },
  wells: { key: 'Number of Producing Wells', name: 'Number of Producing Wells', units: '' },
  gasRatio: { key: 'Gas-to-Oil Ratio', name: 'Gas-to-Oil Ratio', units: '' },
  flaringRatio: { key: 'Flaring-to-Oil Ratio', name: 'Flaring-to-Oil Ratio', units: '' },
  steamRatio: { key: 'Steam-to-Oil Ratio', name: 'Steam-to-Oil Ratio', units: '' },
  apiGravity: { key: 'API Gravity', name: 'API Gravity', units: 'Deg API' },
  sulfurContent: { key: 'Sulfur Content Weight Percent', name: 'Sulfur Content Weight Percent', units: '%' },
  production: { key: '2017 Crude Production Volume', name: '2017 Crude Production Volume', units: '' },
  totalProcessed: { key: 'Estimated Total Processed Oil, NGLs, and Gas', name: 'Estimated Total Processed Oil, NGLs, and Gas', units: '' },
  gasonline: { key: 'Gasoline Volume', name: 'Gasoline Volume', units: '' },
  jetFuel: { key: 'Jet Fuel Volume', name: 'Jet Fuel Volume', units: '' },
  diesel: { key: 'Diesel Volume', name: 'Diesel Volume', units: '' },
  fuelOil: { key: 'Fuel Oil Volume', name: 'Fuel Oil Volume', units: '' },
  petcoke: { key: 'Petroleum Coke Volume', name: 'Petroleum Coke Volume', units: '' },
  heavyEnds: { key: 'Liquid Heavy Ends Volume', name: 'Liquid Heavy Ends Volume', units: '' },
  naturalGas: { key: 'Natural Gas Liquids Volume', name: 'Natural Gas Liquids Volume', units: '' },
  LPG: { key: 'Liquefied Petroleum Gases Volume', name: 'Liquefied Petroleum Gases Volume', units: '' },
  feedstocks: { key: 'Petrochemical Feedstocks Volume', name: 'Petrochemical Feedstocks Volume', units: '' },
  industryGHG: { key: 'Industry GHG Responsibility', name: 'Industry GHG Responsibility', units: '' },
  consumerGHG: { key: 'Consumer GHG Responsibility', name: 'Consumer GHG Responsibility', units: '' },
  methaneco2: { key: 'Methane Fugitives + Venting kg CO2e per BOE', name: 'Methane Fugitives + Venting', units: 'kg CO\u2082 eq. per BOE' },
  flaringco2: { key: 'Flaring kg CO2e per BOE', name: 'Flaring', units: 'kg CO\u2082 eq. per BOE' },
  carbonFee10: { key: '$10 per tonne Carbon Fee Total GHG Emissions', name: '$10 per tonne Carbon Fee Total GHG Emissions', units: '$/kg CO\u2082' },
  carbonFee: { key: 'Carbon Fee on Total GHG Emissions', name: 'Carbon Fee on Total GHG Emissions', units: '$/kg CO\u2082' },
  carbonFee40: { key: '$40 per tonne Carbon Fee Total GHG Emissions', name: '$40 per tonne Carbon Fee Total GHG Emissions', units: '$/kg CO\u2082' },
  productionVolume: { key: '2017 Total Oil and Gas Production Volume ', name: '2017 Total Oil and Gas Production Volume', units: 'barrel oil equivalent oil and gas' },
  emissionRate: { units: 'barrel oil equivalent per day' }
};

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
    // special case for perDollar where we only return if the prices.json match
    if (Oci.data.globalExtents[ratio] &&
        Oci.data.globalExtents[ratio][oilLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax]) {
      if (!(ratio === 'perDollar' && !_.isEqual(Oci.prices, Oci.origPrices))) {
        return Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax];
      }
    }

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
    for (var key in oils) {
      var sliderValues = (base, len) => base.map((b) => Array(len).fill(0).map((a, i) => b + i));
      var metadataKeys = Object.keys(data.metadata);
      metadataKeys.sort();
      var runs = metadataKeys
        .reduce((a, x) => {
          return _.flatten(sliderValues(a, data.metadata[x].values.split(',').length));
        }, ['']);
      runs.forEach((run) => {
        if (!Oci.Collections.runs.get(run)) {
          console.log('fetching');
          var model = new RunModel({ id: run });
          model.fetch({ async: false, success: function (data) {
            Oci.Collections.runs.add(data);
          }});
        }
        var oilValues = Oci.Collections.runs.get(run).toJSON()[key];
        if (oilValues) {
          var total = d3.sum(Object.values(oilValues));

          if (!extent || (total * minMaxMultiplier > extent * minMaxMultiplier)) {
            extent = total;
          }
        }
      });
    }

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

  // Generate social sharing links
  generateSocialLinks: function (pageURL) {
    var summary = 'Explore the true cost of technological advancements across the complete oil supply chain.';
    var title = 'The Oil-Climate Index';

    // Twitter
    var twitter = 'https://twitter.com/share?' +
      'text=' + summary + '&' +
      'url=' + pageURL;

    // LinkedIn
    var linkedIn = 'http://www.linkedin.com/shareArticle?mini=true&' +
    'summary=' + summary + '&' +
    'title=' + title + '&' +
    'url=' + pageURL;

    // Mail
    var mail = 'mailto:?subject=' + title + '&' +
    'body=' + summary + '\n\n' + pageURL;

    return {
      twitter: twitter,
      linkedIn: linkedIn,
      mail: mail
    };
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

  getMJPerBarrel: function (prelim, showCoke, info) {
    return info['Heating Value Processed Oil and Gas'];
  },

  categoryColorForType: function (oilType) {
    const colors = ['#231F20', '#645A4F', '#006838', '#009444', '#8DC63F',
                    '#003A63', '#006AA7',
                 '#4B0082', '#9467bd', '#e377c2', '#B0E0E6', '#8B0000',
                 '#A9A9A9', '#D3D3D3'
               ];
    switch (oilType) {
      case 'Extra-Heavy':
        return colors[0];
      case 'Heavy Oil':
        return colors[1];
      case 'Medium Oil':
        return colors[2];
      case 'Light Oil':
        return colors[3];
      case 'Ultra-Light Oil':
        return colors[4];
      case 'Depleted Oil':
        return colors[5];
      case 'CO2 EOR Oil':
        return colors[6];
      case 'Depleted Gas':
        return colors[7];
      case 'Shale Gas':
        return colors[8];
      case 'Sour Gas':
        return colors[9];
      case 'Wet Gas':
        return colors[10];
      case 'Coal-bed Gas':
        return colors[11];
      case 'Condensate':
        return colors[12];
      case 'Dry Gas':
        return colors[13];
      default:
        console.warn('Invalid oil type for color', oilType);
        return '#ccc';
    }
  },

  // Build up a querystring from view parameters
  buildShareURLFromParameters: function (params) {
    if (!params || params === '') {
      return '';
    }

    var arr = [];
    for (var k in params) {
      arr.push(k + '=' + params[k]);
    }
    var qs;
    if (arr.length === 0) {
      qs = '';
    } else {
      qs = '?' + arr.join('&');
    }
    var hash = window.location.hash.split('?')[0];
    var path = window.location.pathname;
    var url = window.location.origin + path + hash + qs;

    return url;
  },

  // Build up a querystring from view parameters
  parseParametersFromShareURL: function (url) {
    if (!url || url === '') {
      return {};
    }

    var qs = url.split('?');
    if (qs.length !== 2) {
      return {};
    }

    var arr = qs[1].split('&');
    var params = {};
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i].split('=');
      if (item.length !== 2) {
        return {};
      }
      params[item[0]] = decodeURIComponent(item[1]).split(',');
    }

    return params;
  },

  // Send an oil name, get a unique ID
  makeId: function (unique) {
    return unique.toLowerCase().replace(/ /g, '-');
  },

  // Return a string with first letter uppercased
  capitalize: function (s) {
    if (!s) {
      return '';
    }

    return s[0].toUpperCase() + s.slice(1);
  },

  numberWithCommas: function (x) {
    if (typeof x === 'string') { x = Number(x.split(',').join('')); }

    // Always allow three significant digits
    var powerOfTen = x.toFixed(0).length - 1;
    var powerToRoundTo = Math.max(powerOfTen - 2, 0);
    var roundingFactor = Math.pow(10, powerToRoundTo);
    x = Math.round(x / roundingFactor) * roundingFactor;

    // Always round to nearest integer
    // This will also remove any decimals, which is intended
    x = String(Math.round(Number(x)));

    // Add commas
    x = x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return x;
  },

  // Find and set option for an input or select field
  setInputFieldOption: function (inputField, options) {
    var inputElems = document.getElementsByName(inputField);
    if (inputElems[0].nodeName === 'INPUT' && (
      inputElems[0].type === 'radio' ||
      (inputElems.length > 1 && inputElems[0].type === 'checkbox')
    )) {
      for (var i = 0; i < inputElems.length; i++) {
        options.forEach(function (option) {
          if (inputElems[i].value === option) {
            inputElems[i].checked = true;
          }
        });
      }
    } else if (inputElems[0].nodeName === 'INPUT' && inputElems.length === 1 && inputElems[0].type === 'checkbox') {
      if (options[0] === 'on') {
        inputElems[0].checked = true;
      } else {
        inputElems[0].checked = false;
      }
    } else if (inputElems[0].nodeName === 'INPUT' && inputElems[0].type === 'text') {
      inputElems[0].value = options[0];
    } else if (inputElems[0].nodeName === 'SELECT') {
      var selectedOption = options[0];
      $('[name=' + inputField + ']').val(selectedOption);
    } else {
      console.warn('Unexpected element type found when setting input field');
    }
  },

  // Get dataset key for a given programmatic-friendly key
  getDatasetKey: function (key) {
    try {
      return allKeys[key].key;
    } catch (e) {
      console.error(e, key);
      return 'KEY ERROR, KEY';
    }
  },

  // Get dataset name for a given programmatic-friendly key
  getDatasetName: function (key) {
    try {
      return allKeys[key].name;
    } catch (e) {
      console.error(e, key);
      return 'KEY ERROR, NAME';
    }
  },

  // Get units for a given programmatic-friendly key
  getUnits: function (key) {
    try {
      return allKeys[key].units;
    } catch (e) {
      console.error(e, key);
      return 'KEY ERROR, UNITS';
    }
  },

  // Get the current model based on model parameters
  getModel: function (params) {
    var metadata = Oci.data.metadata;
    var metadataKeys = Object.keys(metadata);
    metadataKeys.sort();
    var model = metadataKeys.map((key) => {
      let index = metadata[key].values.split(',').map(Number).indexOf(params[key]);
      if (index === -1) index = 0;
      return index;
    }).reduce((a, x) => a + x, '');
    return model;
  },

  // Trim metadata arrays
  trimMetadataArray: function (indices) {
    return indices.map(function (index) {
      return index.trim();
    });
  },

  // Create the tooltip html given a title, a type, an array
  // of values like [{name: foo, value: 12, units: bbl}, {name: bar, value: 123, units: bbl}],
  // an oil name, and a link
  createTooltipHtml: function (title, type, values, link, text, icons, showCarbon, zoom, dataQuality, extraThousander) {
    var valuesString = '';
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      valuesString += '<dt>' + v.name + '<small class="units">' + v.units + '</small></dt>';
      if (showCarbon) {
        // extraThousander handles conversion of grams to kgs for certain ratios
        valuesString += '<dd class="value-oil-detail">$' +
          (Math.round(v.value / (1000 * (extraThousander ? 1000 : 1)) * Oci.carbonTax * 20) / 20)
          .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</dd>';
      } else {
        valuesString += '<dd class="value-oil-detail">' + this.numberWithCommas(v.value) + '</dd>';
      }
    }
    var iconString = '';
    if (icons) {
      iconString = '<div class="card-details-drivers"><h6>Emissions Drivers:</h6>' +
        '<ul>' + icons.split(',').filter((f) => {
          return f.trim();
        }).map((m, i, arr) => {
          return '<li>' + this.capitalize(m.trim());
        }).join(', </li>') + '</li></ul></div>';
    }
    var zoomString = (zoom)
    ? '<a  title="Zoom to Field" class="zoom-field button button-small button-tertiary ' + link + '">Zoom to Field</a>'
    : '';
    var html = '<div class="popover top in popover-main">' +
      '<div class="popover-inner">' +
        '<div class="popover-header">' +
          '<p class="popover-meta oil-type"><span><span class="swatch" style="background-color:' + this.categoryColorForType(type) + '"></span>' + type + '</span></p>' +
          '<h3 class="popover-title">' + title + '</h3>' +
          (text ? '<p class="description">' + text + '</p>' : '') +
          iconString +
        '</div>' +
        '<div class="popover-body clearfix">' +
          '<dl class="stats-list">' +
          valuesString +
          '</dl>' +
        '</div>' +
        '<div class="popover-footer">' +
          (dataQuality ? '<span class="data-quality units-description">Data Quality: ' + dataQuality + '</span>' : '') +
          '<a href="#oil/' + link + '" title="View oil profile" class="button button-small button-tertiary button-tertiary_arrow">View details</a>' +
          zoomString +
        '</div>' +
      '</div>' +
    '</div>';

    return html;
  },

  // send x and y coordinates
  // returns a boolean to determine if they are inside the tooltip
  // a bit of buffer on left and bottom for arrows and such
  insideTooltip: function (x, y) {
    var box = $('.d3-tip')[0].getBoundingClientRect();
    return (x > box.left - 30 && x < box.right && y < box.bottom + 30 && y > box.top);
  },

  preorderedSort: function (array, step) {
    return _.sortBy(array, function (sort) {
      return Oci.order[step].indexOf(sort.name);
    });
  },

  // https://clipboardjs.com/assets/scripts/tooltips.js
  fallbackMessage: function (action) {
    var actionMsg = '';
    var actionKey = (action === 'cut' ? 'X' : 'C');
    if (/iPhone|iPad/i.test(navigator.userAgent)) {
      actionMsg = 'No support :(';
    } else if (/Mac/i.test(navigator.userAgent)) {
      actionMsg = 'Press ⌘-' + actionKey + ' to ' + action;
    } else {
      actionMsg = 'Press Ctrl-' + actionKey + ' to ' + action;
    }
    return actionMsg;
  },

  getOilfield: function (unique) {
    // argument is an Oci.data.info property key
    var oil = Oci.data.info[unique];
    var oilFieldName = oil['Field Name'];
    return _.find(Oci.oilfields.features, function (feature) {
      return oilFieldName === feature.properties['Field Name Match'];
    });
  },

  generateOilInfo: function (oilKey) {
    // Get the oil info
    var oil = Oci.data.info[oilKey];
    if (!oil) {
      // If we're here, something went wrong
      console.warn('Unable to find oil for id:', oilKey);
    }

    var makeCategoryTitle = function (sulfur) {
      return 'Sulfur: ' + parseFloat(sulfur).toFixed(2) + '%';
    };

    var makeDepthTitle = (depth) => {
      return this.numberWithCommas(parseInt(depth)) + ' feet | ' + this.numberWithCommas(parseInt(depth * 0.3048)) + ' meters';
    };

    // Create return object
    var obj = {
      name: utils.prettyOilName(oil),
      Unique: oil.Unique,
      keyStats: [
        {
          key: 'Resource Type',
          value: oil['Resource Type']
        },
        {
          key: 'API Gravity',
          value: Number(oil['API Gravity'])
        },
        {
          key: 'Location',
          value: oil['Location']
        },
        {
          key: 'Sulfur Content',
          value: oil['Sulfur Content Weight Percent'],
          'data-title': makeCategoryTitle(oil['Sulfur Content Weight Percent'])
        },
        {
          key: 'Depth',
          value: oil['Field Depth'],
          'data-title': makeDepthTitle(oil['Depth'])
        },
        {
          key: 'Production Volume',
          value: this.numberWithCommas(oil['2017 Total Oil and Gas Production Volume '])
        },
        {
          key: 'Flare Rate',
          value: oil['Flare Rate']
        }, {
          key: 'Water Content',
          value: oil['Water Content']
        }, {
          key: 'Methane Leakage Rate',
          value: oil['Methane Leakage Rate']
        }, {
          key: 'Heating Value Processed Oil and Gas',
          value: oil['Heating Value Processed Oil and Gas']
        }
      ]
    };
    if (Oci.blurbs[oil['Overall Crude Category']]) {
      obj.keyStats[0]['data-title'] = Oci.blurbs[oil['Overall Crude Category']].description;
    }
    // add asterisks for methodology/glossary note
    obj.keyStats[6].value += '*';
    obj.keyStats[7].value += '*';
    obj.keyStats[8].value += '*';
    return obj;
  },

  // Generates an oil object for plotting, potentially using default values
  generateOilObject: function (oilKey, modelData, isComparison, carbonMultiplier) {
    // if the oil key is a group instead of an oil...
    if (Object.keys(Oci.data.info).indexOf(oilKey) === -1) {
      // gather all matching oils
      var matchingLength;
      var sumObject = _.filter(Oci.data.info, function (oil) {
        return oil['Region'] === utils.groupIDtoName(oilKey) ||
          oil['Resource Type'] === utils.groupIDtoName(oilKey);
      // generate objects for them
      }).map(function (oil, key, arr) {
        matchingLength = arr.length;
        return utils.generateOilObject(oil.Unique, modelData, isComparison);
      // sum + average
      }).reduce(function (a, b) {
        return {
          'isComparison': isComparison,
          'id': oilKey,
          'name': utils.capitalize(oilKey),
          'ghgTotal': a.ghgTotal + b.ghgTotal,
          'upstream': a.upstream + b.upstream,
          'midstream': a.midstream + b.midstream,
          'downstream': a.downstream + b.downstream,
          'type': 'aggregated'
        };
      });
      return {
        'isComparison': sumObject.isComparison,
        'id': sumObject.id,
        'name': sumObject.name,
        'ghgTotal': sumObject.ghgTotal / matchingLength * carbonMultiplier,
        'upstream': sumObject.upstream / matchingLength * carbonMultiplier,
        'midstream': sumObject.midstream / matchingLength * carbonMultiplier,
        'downstream': sumObject.downstream / matchingLength * carbonMultiplier,
        'type': sumObject.type
      };
    } else {
      // Get basic properties from model data
      var info = modelData.info[oilKey];

      var upstream = +modelData.oilValues[oilKey].Upstream;
      var midstream = +modelData.oilValues[oilKey].Midstream;
      var downstream = +modelData.oilValues[oilKey].Downstream;

      // Sum up for total
      var ghgTotal = d3.sum([upstream, midstream, downstream]);

      // Create oil object
      return {
        'isComparison': isComparison,
        'id': utils.makeId(info.Unique),
        'name': utils.prettyOilName(info),
        'ghgTotal': ghgTotal * carbonMultiplier,
        'upstream': upstream * carbonMultiplier,
        'midstream': midstream * carbonMultiplier,
        'downstream': downstream * carbonMultiplier,
        'type': info['Resource Type'].trim()
      };
    }
  },

  groupIDtoName: function (id) {
    // Find the group name from the id
    for (var i = 0; i < Oci.regions.concat(Oci.types).length; i++) {
      if (utils.makeId(Oci.regions.concat(Oci.types)[i]) === id) {
        return Oci.regions.concat(Oci.types)[i];
      }
    }
  },

  arrayObjSum: function (array, array2) {
    // make a list of all possible keys in case the arrays have different ones
    var possibleKeys = _.uniq(_.map(array, 'name').concat(_.map(array2, 'name')));
    return possibleKeys.map(function (key) {
      var arrayMatch = array.filter(function (a) { return a.name === key; });
      var array2Match = array2.filter(function (a) { return a.name === key; });
      return {
        name: key,
        value: (arrayMatch.length ? Number(arrayMatch[0].value) : 0) +
          (array2Match.length ? Number(array2Match[0].value) : 0)
      };
    });
  },

  arrayObjDiv: function (array, divisor) {
    return array.map(function (a) {
      return {
        name: a.name,
        value: a.value / divisor
      };
    });
  },

  scrollToElementWithID: function (elementID) {
    $('html, body').animate({
      scrollTop: $('#' + elementID).offset().top - 66
    }, 1000);

    // Then scroll down slightly to make the OCI navbar smaller
    $('html, body').animate({
      scrollTop: $('#' + elementID).offset().top - 65
    }, 1);
  },

  getDataQuality: function (key) {
    function numberToQuality (num) {
      if (num > 2.5) {
        return 'High';
      } else if (num > 1.85) {
        return 'Medium';
      } else if (num > 0) {
        return 'Low';
      } else {
        return 'N/A';
      }
    }
    var oil = Oci.data.info[key];
    var upstreamQuality = +oil['OPGEE Data Quality'];
    var midstreamQuality = +oil['PRELIM Data Quality'];
    var downstreamQuality = +oil['OPEM Data Quality'];
    return {
      total: numberToQuality(((upstreamQuality || 0) + (midstreamQuality || 0) + (downstreamQuality || 0)) /
      ((upstreamQuality ? 1 : 0) + (midstreamQuality ? 1 : 0) + (downstreamQuality ? 1 : 0))),
      upstream: numberToQuality(upstreamQuality),
      midstream: numberToQuality(midstreamQuality),
      downstream: numberToQuality(downstreamQuality)
    };
  },

  printDataQualityComponents: function (obj) {
    return _.map(obj, function (value, key) {
      if (key === 'total') {
        return '';
      } else {
        return utils.capitalize(key) + ': ' + utils.capitalize(value);
      }
    }).filter(function (str) {
      return str;
    }).join(', ');
  },

  // convert a run (e.g. "01202122") to a metadata parameter object
  runToParams: function (run) {
    const metadataKeys = Object.keys(Oci.data.metadata);
    metadataKeys.sort();
    return metadataKeys.reduce((accumluator, key, i) => {
      return Object.assign({}, accumluator, { [key]: Number(Oci.data.metadata[key].values.split(',')[Number(run[i])]) });
    }, {});
  }
};

module.exports = utils;
