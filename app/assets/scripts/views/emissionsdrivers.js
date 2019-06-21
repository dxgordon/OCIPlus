/*global Oci */
'use strict';
var d3 = require('d3');
var d3tip = require('d3-tip');
d3tip(d3);
var $ = require('jquery');
import _ from 'lodash';

var utils = require('../utils');
var ss = require('simple-statistics');

var template = require('../templates/emissionsdrivers.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var EmissionsDrivers = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'click #emissions-drivers-share': 'handleShare',
    'click': 'hideTip',
    'change #toggle-gwp': 'handleParametersChange',
    'change .config-dropdown': 'handleDropdown',
    'change #oiltype-select': function () { this.handleFilter('oiltype-select', 'Resource Type'); }
  },

  hideTip: function () {
    this.tip.hide();
  },

  initialize: function () {
    // set view properties
    this.chartElement = '#emissions-drivers';
    this.margin = {top: 85, right: 28, bottom: 72, left: 84};
    this.aspectRatio = 1.5;
    this.xProperty = 'upstream';
    this.yProperty = 'ghgTotal';
    this.transitionDuration = 1000;
    this.extentBuffer = 0.1;
    this.filters = {};
    this.hasShareLinkBeenParsed = false;
    // this is used to decide which properties of the internal state should be
    // shared; when the url is parsed, we will also set input fields based on
    // these
    this.shareParams = [
      { name: 'xSelect', input: 'x-select' },
      { name: 'ySelect', input: 'y-select' },
      { name: 'oiltypeSelect', input: 'oiltype-select' }
    ];

    // add window resizing listeners
    this._windowSizing();

    // tooltip
    this.tip = d3.tip().attr('class', 'd3-tip').html((d) => {
      var values = [
        {
          name: utils.getDatasetName(this.xProperty),
          value: utils.numberWithCommas(d[this.xProperty]),
          units: utils.getUnits(this.xProperty)
        },
        {
          name: utils.getDatasetName(this.yProperty),
          value: utils.numberWithCommas(d[this.yProperty]),
          units: utils.getUnits(this.yProperty)
        },
        {
          name: utils.getDatasetName('productionVolume'),
          value: utils.numberWithCommas(d.productionVolume),
          units: utils.getUnits('productionVolume')
        }
      ];
      return utils.createTooltipHtml(d.name, d.type, values, d.id, '', Oci.data.info[d.name]['Absolute Emissions Icons'], false, false, utils.getDataQuality(d.name).total);
    }).offset([0, 20]).direction('e');

    this.render();
  },

  render: function () {
    this.$el.html(this.template({
      blueBar: blueBar(),
      types: Oci.types,
      getColor: utils.categoryColorForType
    }));

    // For responsiveness
    var margin = this.margin;
    this.width = $(this.chartElement).width() - margin.left - margin.right;
    this.height = Math.round(this.width / this.aspectRatio);

    this.chartInit();
    this._setupShare();
    this._activateSearchBar();

    // If any of the parameters are set in the URL, have to apply those filters
    this._parseURLAndSetState();
    this.changeAxisCategory('x');
    this.changeAxisCategory('y');
    this.handleFilter('oiltype-select', 'Resource Type');
    this.hasShareLinkBeenParsed = true;
  },

  addExtentBuffer: function (extent) {
    // sometimes only receives a max number and then we shouldn't try to access array elements
    var extentBuffer = this.extentBuffer;
    if (typeof extent === 'object') {
      // flip our lower extent buffer for negative values
      extent[0] = extent[0] * (1 - extentBuffer * (extent[0] > 0 ? 1 : -1));
      extent[1] = extent[1] * (1 + extentBuffer);
    } else {
      extent = extent * (1 + extentBuffer);
    }
    return extent;
  },

  createScales: function () {
    // Create scale functions
    var xMin = d3.min(this.chartData, (d) => d[this.xProperty]);
    var xMax = d3.max(this.chartData, (d) => d[this.xProperty]);
    var xExtent = this.addExtentBuffer([xMin, xMax]);
    this.xScale = d3.scale.linear()
               .domain(xExtent)
               .range([0, this.width])
               .nice();

    var yMin = d3.min(this.chartData, (d) => d[this.yProperty]);
    var yMax = d3.max(this.chartData, (d) => d[this.yProperty]);
    var yExtent = this.addExtentBuffer([yMin, yMax]);

    this.yScale = d3.scale.linear()
               .domain(yExtent)
               .range([this.height, 0])
               .nice();

    var rExtent = this.addExtentBuffer(d3.extent(this.chartData, function (d) {
      return d.productionVolume;
    }));

    this.rScale = d3.scale.sqrt()
                  .domain(rExtent)
                  .range([4, 42]);
  },

  createAxes: function () {
    var margin = this.margin;
    var height = this.height;
    var width = this.width;
    // Define X axis
    this.xAxis = d3.svg.axis()
              .scale(this.xScale)
              .orient('bottom')
              .ticks(5);

    // Define Y axis
    this.yAxis = d3.svg.axis()
              .scale(this.yScale)
              .orient('left')
              .ticks(4);

    // Create X axis
    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (height + 4) + ')')
      .call(this.xAxis);

    // X axis title
    var g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        (height + margin.bottom - 25) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title')
      .text(utils.getDatasetName(this.xProperty));
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        (height + margin.bottom - 5) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title subtitle')
      .text(utils.getUnits(this.xProperty));

    // Create Y axis
    this.svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(' + (-4) + ',0)')
      .call(this.yAxis);

    // Y axis title
    g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left)
      .attr('x', -(height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title')
      .text(utils.getDatasetName(this.yProperty));
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -(height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title subtitle')
      .text(utils.getUnits(this.yProperty));
  },

  createData: function () {
    // Selection
    var circles = this.svg.selectAll('circle')
       .data(this.chartData, function (oil) { return oil.name; });

    // Update
    circles.transition()
        .duration(this.transitionDuration)
        .attr('cx', (d) => { return this.xScale(d[this.xProperty]); })
        .attr('cy', (d) => { return this.yScale(d[this.yProperty]); })
        .attr('opacity', 0.8);

    // Enter
    circles.enter()
       .append('circle')
       .attr('fill', (d) => { return utils.categoryColorForType(d.type); })
       .attr('opacity', 0)
       .attr('cx', (d) => { return this.xScale(d[this.xProperty]); })
       .attr('cy', (d) => { return this.yScale(d[this.yProperty]); })
       .attr('r', (d) => { return this.rScale(d.productionVolume); })
       .attr('clip-path', 'url(#chart-area)')
       .on('mouseover', (d) => { this.tip.show(d); })
       .on('mouseout', () => {
         if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
           $('.d3-tip').on('mouseleave', () => {
             this.tip.hide();
           });
         } else {
           this.tip.hide();
         }
       })
       .transition()
       .duration(this.transitionDuration)
       .attr('opacity', 0.8);

    // Exit
    circles.exit()
        .transition()
        .duration(this.transitionDuration)
        .attr('opacity', 0)
        .remove();
  },

  createLegend: function () {
    var margin = this.margin;
    var width = this.width;

    // The circle legend
    // these purposefully reference the main svg (d3.select('svg')) rather
    // than the <g> (this.svg) so they are written in relation to the non-margin
    // portion
    d3.select('svg').selectAll('.circle-legend')
       .data([55, 68, 86])
       .enter()
       .append('circle')
       .classed('circle-legend', true)
       .attr('fill-opacity', '0')
       .attr('stroke', '#777')
       .attr('cx', function (d) {
         return width + margin.left + margin.right - 57;
       })
       .attr('cy', function (d) { return d; })
       .attr('r', (d, i) => this.rScale([5000000, 2000000, 100000][i]));

    d3.select('svg').selectAll('.circle-text')
      .data([{text: '5M', y: 10}, {text: '2M', y: 38}, {text: '100k', y: 73}])
      .enter()
      .append('text')
      .attr('class', 'circle-text')
      .attr('x', function (d) { return width + margin.left + margin.right - 57; })
      .attr('y', function (d) { return d.y; })
      .attr('text-anchor', 'middle')
      .style('fill', '#777')
      .text(function (d) { return d.text; });

    d3.select('svg').append('text')
      .attr('x', function (d) { return width + margin.left + margin.right - 105; })
      .attr('y', 12)
      .attr('text-anchor', 'end')
      .attr('class', 'circle-text')
      .style('fill', '#777')
      .text('Production Volume');

    d3.select('svg').append('text')
      .attr('x', function (d) { return width + margin.left + margin.right - 105; })
      .attr('y', 27)
      .attr('text-anchor', 'end')
      .attr('class', 'circle-text')
      .style('fill', '#777')
      .text('Barrels per Day');
  },

  createLine: function () {
    // map our data to the style needed for simple-statistics
    // also apply our scaling
    var mapped = this.chartData.map((obj) => {
      return [this.xScale(obj[this.xProperty]), this.yScale(obj[this.yProperty])];
    });

    // If all X values are the same, then can't calculate a line
    var xMin = d3.min(this.chartData, (d) => d[this.xProperty]);
    var xMax = d3.max(this.chartData, (d) => d[this.xProperty]);
    if (xMin === xMax) {
      return this.svg.selectAll('.trend')
        .transition()
        .duration(this.transitionDuration)
        .attr('opacity', 0)
        .remove();
    }

    var linearRegression = ss.linearRegressionLine(ss.linearRegression(mapped));

    var rSquared = ss.rSquared(mapped, linearRegression);

    this.line = d3.svg.line()
           .x(function (d) { return d; })
           .y(function (d) { return linearRegression(d); });

    // Selection
    var trendLine = this.svg.selectAll('.trend')
       .data([[]]);

    // Enter
    trendLine.enter()
       .append('path')
       .attr('clip-path', 'url(#chart-area)')
       .attr('d', this.line(this.xScale.range()))
       .attr('class', 'trend')
       .attr('opacity', Math.min(rSquared + 0.2, 1));

    // Update
    trendLine.transition()
       .duration(this.transitionDuration)
       .attr('d', this.line(this.xScale.range()))
       .attr('opacity', Math.min(rSquared + 0.2, 1));
  },

  chartInit: function () {
    var margin = this.margin;
    var width = this.width;
    var height = this.height;
    // Create SVG element
    this.svg = d3.select(this.chartElement)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    // Invoke the tooltip
    this.svg.call(this.tip);

    // Define clipping path
    this.svg.append('clipPath')             // Make a new clipPath
        .attr('id', 'chart-area')           // Assign an ID
        .append('rect')                     // Within the clipPath, create a new rect
        .attr('width', width)
        .attr('height', height);

    this.createChartData();
    this.createScales();
    this.createAxes();
    this.createLine();
    this.createData();
    this.createLegend();
  },

  // Will generate chart data for current model and ratio
  createChartData: function () {
    // we rely soley on data from info.json, the only toggle is the GWP key
    const gwp = $('#toggle-gwp').is(':checked') ? 20 : 100;

    const info = Oci.data.info;
    // Apply filters to the oils
    const filteredOils = _.pickBy(info, (oil) => {
      return Object.keys(this.filters).reduce((accumulator, filter) => {
        return accumulator && this.filters[filter].includes(oil[filter]);
      }, true);
    });

    this.chartData = Object.keys(filteredOils).map((key) => {
      const oil = filteredOils[key];
      return {
        id: utils.makeId(oil.Unique),
        name: utils.prettyOilName(oil),
        type: oil['Resource Type'].trim(),
        ghgTotal: +oil[`gwp${gwp}`][utils.getDatasetKey('ghgTotal')],
        productionVolume: +oil[utils.getDatasetKey('productionVolume')],
        ghgPerMJ: +oil[`gwp${gwp}`][utils.getDatasetKey('ghgPerMJ')],
        upstream: +oil[`gwp${gwp}`][utils.getDatasetKey('upstream')],
        midstream: +oil[`gwp${gwp}`][utils.getDatasetKey('midstream')],
        downstream: +oil[`gwp${gwp}`][utils.getDatasetKey('downstream')],
        methaneFV: +oil[utils.getDatasetKey('methaneFV')],
        co2FV: +oil[utils.getDatasetKey('co2FV')],
        leakage: +oil[utils.getDatasetKey('leakage')],
        heatingValue: +oil[utils.getDatasetKey('heatingValue')],
        years: +oil[utils.getDatasetKey('years')],
        depth: +oil[utils.getDatasetKey('depth')],
        wells: +oil[utils.getDatasetKey('wells')],
        gasRatio: +oil[utils.getDatasetKey('gasRatio')],
        flaringRatio: +oil[utils.getDatasetKey('flaringRatio')],
        steamRatio: +oil[utils.getDatasetKey('steamRatio')],
        apiGravity: +oil[utils.getDatasetKey('apiGravity')],
        sulfurContent: +oil[utils.getDatasetKey('sulfurContent')],
        totalProcessed: +oil[utils.getDatasetKey('totalProcessed')],
        gasonline: +oil[utils.getDatasetKey('gasonline')],
        jetFuel: +oil[utils.getDatasetKey('jetFuel')],
        diesel: +oil[utils.getDatasetKey('diesel')],
        fuelOil: +oil[utils.getDatasetKey('fuelOil')],
        petcoke: +oil[utils.getDatasetKey('petcoke')],
        heavyEnds: +oil[utils.getDatasetKey('heavyEnds')],
        naturalGas: +oil[utils.getDatasetKey('naturalGas')],
        LPG: +oil[utils.getDatasetKey('LPG')],
        feedstocks: +oil[utils.getDatasetKey('feedstocks')],
        industryGHG: +oil[`gwp${gwp}`][utils.getDatasetKey('industryGHG')],
        consumerGHG: +oil[`gwp${gwp}`][utils.getDatasetKey('consumerGHG')],
        methaneco2: +oil[`gwp${gwp}`][utils.getDatasetKey('methaneco2')],
        flaringco2: +oil[`gwp${gwp}`][utils.getDatasetKey('flaringco2')],
        carbonFee10: +oil[`gwp${gwp}`][utils.getDatasetKey('carbonFee10')],
        carbonFee40: +oil[`gwp${gwp}`][utils.getDatasetKey('carbonFee40')]
      };
    });

    // Also filter out X axis values that are `NaN`s
    this.chartData = this.chartData.filter((oil) => {
      var xIsNull = isNaN(oil[this.xProperty]);
      var yIsNull = isNaN(oil[this.yProperty]);

      if (xIsNull || yIsNull) {
        return false;
      } else {
        return true;
      }
    });

    // Sort chart data so that higher production volume is last
    this.chartData.sort(function (a, b) {
      return b.productionVolume - a.productionVolume;
    });
  },

  changeAxisCategory: function (axis) {
    this[axis + 'Property'] = $('#' + axis + '-select').val();
    this.updateChart(axis);
  },

  updateAxes: function (changedAxis) {
    var transitionDuration = this.transitionDuration;
    if (!changedAxis || changedAxis === 'x') {
      // Update x-axis
      this.xAxis = d3.svg.axis()
        .scale(this.xScale)
        .orient('bottom')
        .ticks(5);
      this.svg.select('.x.axis')
        .transition()
        .duration(transitionDuration)
        .call(this.xAxis);

      // Update x title
      $('.x.axis.title').fadeOut(transitionDuration / 2, () => {
        this.svg.select('.x.axis.subtitle').text(utils.getUnits(this.xProperty));
        this.svg.select('.x.axis.title').text(utils.getDatasetName(this.xProperty));
        $(this).fadeIn(transitionDuration / 2);
      });
    }

    if (!changedAxis || changedAxis === 'y') {
      // Update y-axis
      this.yAxis = d3.svg.axis()
        .scale(this.yScale)
        .orient('left')
        .ticks(5);
      this.svg.select('.y.axis')
        .transition()
        .duration(transitionDuration)
        .call(this.yAxis);

      // Update y title
      $('.y.axis.title').fadeOut(transitionDuration / 2, () => {
        this.svg.select('.y.axis.subtitle').text(utils.getUnits(this.yProperty, 'perBarrel'));
        this.svg.select('.y.axis.title').text(utils.getDatasetName(this.yProperty, 'perBarrel', true));
        $(this).fadeIn(transitionDuration / 2);
      });
    }
  },

  handleShare: function (e) {
    e.preventDefault();
  },

  updateChart: function (changedAxis) {
    this.createChartData();
    this.createScales();
    this.updateAxes(changedAxis);
    this.createLine();
    this.createData();
    this._updateCopyLink();
  },

  handleFilter: function (elementName, propertyName) {
    var options = document.getElementsByName(elementName);
    var checked = [];
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      if (option.checked) { checked.push(option.value); }
    }

    if (checked.length === 0) {
      delete this.filters[propertyName];
    } else {
      this.filters[propertyName] = checked;
    }
    this.updateChart();
  },

  showPrices: function (e) {
    e.preventDefault();
    Oci.showPricesModal(true);
  },

  updatePrices: function () {
    // We have new prices, recreate chartData and update chart
    this.updateChart('y');
  },

  handleDropdown: function (e) {
    if (e.target.id === 'x-select') { return this.changeAxisCategory('x'); }
    if (e.target.id === 'y-select') { return this.changeAxisCategory('y'); }
    $('.config-dropdown').blur();
    this.handleParametersChange();
  },

  handleParametersChange: function () {
    this.updateChart();
  }
});

module.exports = EmissionsDrivers;
