var Backbone = require('backbone');

var Run = Backbone.Model.extend({
  url: function () {
    return 'assets/data/runs/run_' + this.id + '.json';
  }
});

module.exports = Run;
