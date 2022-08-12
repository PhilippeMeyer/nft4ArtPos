const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");


let filename1 = "./Gemini_BTCUSD_2021_1min.csv";
let filename2 = "./BTC-2021min.csv";
let prices1 = new Array();
let prices2 = new Map();
let loaded1 = false;
let loaded2 = false;

fs.createReadStream(filename1)
  .pipe(parse({ delimiter: ",", from_line: 3 }))
  .on("data", function (row) {
    prices1.push([row[0], parseFloat(row[6])]);
  })
  .on("end", function () {
    console.log("finished");
    loaded1 = true;
    compare();
  })
  .on("error", function (error) {
    console.log(error.message);
  });

fs.createReadStream(filename2)
  .pipe(parse({ delimiter: ",", from_line: 2 }))
  .on("data", function (row) {
    prices2.set(row[0] + '000', parseFloat(row[6]));
  })
  .on("end", function () {
    console.log("finished");
    loaded2 = true;
    compare();
  })
  .on("error", function (error) {
    console.log(error.message);
  });

function compare() {
    let delta;
    if (! loaded1 && loaded2 ) return;

    prices1.forEach((row) => {
        data = prices2.get(row[0]);
        if (data == null) console.log('No data for: ', row[0]);
        else {
            delta = (row[1] - data) / data;
            if ((delta > 0.01) || (delta < -0.01)) console.log('delta: ', delta, ' at: ', row[0])
        }
    })
}