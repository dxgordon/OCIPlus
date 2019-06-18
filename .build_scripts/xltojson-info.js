/* Written by Development Seed for OCI+ data processing.
Reads in three CSV files and outputs as JSON
*/
const fs = require('fs')
const parse = require('csv-parse/lib/sync')

const oilData = fs.readFileSync(process.argv[2]).toString()
const oilRecords = parse(oilData, { columns: true })

const oilData20 = fs.readFileSync(process.argv[3]).toString()
const oilRecords20 = parse(oilData20, { columns: true })

const oilData100 = fs.readFileSync(process.argv[4]).toString()
const oilRecords100 = parse(oilData100, { columns: true })

const info = oilRecords.reduce((accumluator, oil) => {
  const name = oil['Field Name']
  return Object.assign(
    {},
    accumluator,
    { [name]: Object.assign(
      {},
      oil,
      { Unique: name },
      { gwp20: oilRecords20.find(o => o['Field Name'] === name) },
      { gwp100: oilRecords100.find(o => o['Field Name'] === name) }
    )}
  )
}, {})
fs.writeFileSync('app/assets/data/info.json', JSON.stringify(info))
