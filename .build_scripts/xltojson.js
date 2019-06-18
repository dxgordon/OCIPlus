/* Written by Development Seed for OCI+ data processing.
Reads in two CSV files and one JSON:
- JSON with all oil info for default runs
- two CSVs with headers "slider", "value", "stage", and all oil names indicating the changes made by moving each slider
- the CSVs are distinguished by their Global Warming Potential values (20year vs 100year)
Outputs JSON files for all possible slider combinations
*/
const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const _ = require('lodash')

const metadata = JSON.parse(fs.readFileSync('./app/assets/data/metadata.json'))
const oilRecords = JSON.parse(fs.readFileSync('./app/assets/data/info.json'))

const sliderData20 = fs.readFileSync(process.argv[2]).toString()
const sliderRecords20 = parse(sliderData20, { columns: true })

const sliderData100 = fs.readFileSync(process.argv[3]).toString()
const sliderRecords100 = parse(sliderData100, { columns: true })

var sliderValues = (base, len) => base.map((b) => Array(len).fill(0).map((a, i) => b + i));
var metadataKeys = Object.keys(metadata);
metadataKeys.sort();
var runs = metadataKeys
  .reduce((a, x) => {
    return _.flatten(sliderValues(a, metadata[x].values.split(',').length));
  }, ['']);
runs.forEach((run, i) => {
  console.log(run);
  const params = runToParams(run, metadata)
  const sliderRecords = params.gwp === 20
    ? sliderRecords20
    : sliderRecords100
  const runData = Object.keys(oilRecords).reduce((accumluator, key) => {
    const oil = oilRecords[key]
    const name = oil['Field Name']
    return Object.assign({}, accumluator, { [name]: {
      Upstream: +oil[`gwp${params.gwp}`]['Upstream Emissions'] + paramsToDiff(params, sliderRecords, name, 'upstream'),
      Midstream: +oil[`gwp${params.gwp}`]['Midstream Emissions'] + paramsToDiff(params, sliderRecords, name, 'midstream'),
      Downstream: +oil[`gwp${params.gwp}`]['Downstream Emissions'] + paramsToDiff(params, sliderRecords, name, 'downstream')
    }})
  }, {})
  fs.writeFileSync(`app/assets/data/runs/run_${run}.json`, JSON.stringify(runData))
})

// convert a run (e.g. "01202122") to a metadata parameter object
function runToParams (run, metadata) {
  const metadataKeys = Object.keys(metadata);
  metadataKeys.sort();
  return metadataKeys.reduce((accumluator, key, i) => {
    return Object.assign({}, accumluator, { [key]: Number(metadata[key].values.split(',')[Number(run[i])]) })
  }, {})
}

// given an oil name, set of parameters, stage, and diffs, apply all the relevant diffs to the total
function paramsToDiff(params, sliderRecords, oil, stage) {
  return Object.keys(params).reduce((accumluator, param) => {
    // filter slider records to only the applicable ones
    const fsr = sliderRecords.filter(r => r.slider === param && Number(r.value) === params[param] && r.stage === stage)
    if (fsr.length) {
      return accumluator + Number(fsr[0][oil])
    }
    return accumluator
  }, 0)
}
