/*global Oci, wNumb */
'use strict';

const Backbone = require('backbone');
const $ = require('jquery');
import _ from 'lodash';
const noUiSlider = require('nouislider');

const utils = require('../utils');
const template = require('../templates/modelparameters.ejs');

const ModelParameters = Backbone.View.extend({

  template: template,

  el: '#model-parameters',

  events: {
    'click .toggle': 'toggleModelParameters',
    'change input': 'updateSummary',
    'change .slider': 'updateSummary',
    'change select': 'updateSummary'
  },

  render: function () {
    this.$el.html(this.template({ metadata: Oci.data.metadata }));
    this.addSliders();
    this.updateSummary();
    this.listenTo(this, 'sliderUpdate', this.updateSummary);
  },

  getModelValues: function () {
    // create an object with keys for each slider/toggle
    // values return a value for matching to the metadata.json
    return Object.keys(Oci.data.metadata)
      .reduce((accumulator, key) => {
        const m = Oci.data.metadata[key];
        return Object.assign({}, accumulator, {
          [key]: m.type === 'slider'
            ? this[`${key}slider`].get() / 100
            : Number($(`#toggle-${key}`).is(':checked') ? m.values.split(',')[1] : m.values.split(',')[0])
        });
      }, {});
  },

  // Used to set values on load
  setModelParameters: function (urlParams) {
    if (urlParams.model) {
      try {
        // convert our url parameter representing the model (e.g.e 01000200)
        // into a set of metadata parameters
        const params = utils.runToParams(urlParams.model[0]);
        // use these parameters to set the slider or switche values
        Object.keys(params).forEach((param) => {
          if (Oci.data.metadata[param].type === 'slider') {
            const value = parseFloat(params[param]) * 100;
            this[`${param}slider`].set(value);
          } else {
            // if the value is first, we are unchecked (default), otherwise checked
            const checked = Oci.data.metadata[param].values.split(',').map(Number).indexOf(params[param]);
            $(`#toggle-${param}`).attr('checked', Boolean(checked));
          }
        });
      } catch (e) {
        console.warn('bad input parameter', e);
      }
    }

    this.updateSummary();
  },

  updateSummary: function () {
    Object.keys(Oci.data.metadata)
      .filter((key) => Oci.data.metadata[key].type === 'slider')
      .forEach((key) => {
        const val = parseInt(this[`${key}slider`].get());
        $(`.value.${key} span`).html(val + '%');
      });

    var gwp = $('#toggle-gwp').is(':checked') ? '20' : '100';
    $('.value.gwp span').html(gwp);
  },

  addSliders: function () {
    Object.keys(Oci.data.metadata)
      .filter((key) => Oci.data.metadata[key].type === 'slider')
      .forEach((key) => {
        const m = Oci.data.metadata[key];
        const labels = this.formatMetadataValues(m.values);
        const values = this.sliderHelper(labels);
        const range = _.zipObject(values, labels);
        this[`${key}slider`] = noUiSlider.create($(`#slider-${key}`)[0], {
          start: +m.values.split(',')[0] * 100,
          connect: 'lower',
          snap: true,
          range: range,
          pips: {
            mode: 'values',
            values: labels,
            density: 10,
            format: wNumb({
              postfix: '%'
            }),
            stepped: true
          }
        });
        this[`${key}slider`].on('update', (value) => {
          this.trigger('sliderUpdate', value);
        });
      });
  },

  toggleModelParameters: function (e) {
    e.preventDefault();
    $('#model-parameters').toggleClass('open');
  },

  // helper function for noUiSliders
  sliderHelper: function (array) {
    var min = Math.min(...array);
    var max = Math.max(...array);
    var tempArray = array.map(function (val) {
      return ((val - min) / ((max - min) / 100)).toFixed(0) + '%';
    });
    tempArray[0] = 'min';
    tempArray[tempArray.length - 1] = 'max';
    return tempArray;
  },

  formatMetadataValues: function (values) {
    return values.split(',').sort(function (a, b) {
      return Number(a) - Number(b);
    }).map(function (val) { return Number(val) * 100; });
  }
});

module.exports = ModelParameters;
