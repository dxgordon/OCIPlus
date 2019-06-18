var Backbone = require('backbone');
var model = require('../models/run.js');

var Run = Backbone.Collection.extend({
  model: model
});

module.exports = Run;
