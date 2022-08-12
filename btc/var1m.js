const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");


//let filename = "./Gemini_BTCUSD_2021_1min.csv";
let filename = "./BTC-2021min.csv";
let prices = new Array();
let profits = new Array();

const timePeriod = [1,2,5,10,30,60,120,180,300,720, 1440, 3780];
let content = "minutes,Time delta minus,delta minus,price minus,time delta plus,delta plus,price plus\n";

var i;

fs.createReadStream(filename)
  .pipe(parse({ delimiter: ",", from_line: 3 }))
  .on("data", function (row) {
    prices.push([row[0], parseFloat(row[6])]);
  })
  .on("end", function () {
    console.log("finished");
    prices = prices.reverse();
    timePeriod.forEach((inc) => content += simulate(inc));
    fs.writeFileSync('maxVar.csv', content);
  })
  .on("error", function (error) {
    console.log(error.message);
  });

function simulate(inc) {
    var deltaPlus = 0.0;
    var pricePlus = 0.0;
    var deltaMinus = 0.0;
    var priceMinus = 0.0;
    var timeDeltaPlus = 0;
    var timeDeltaMinus = 0;
    var delta = 0.0;

    for(i = 0 ; i < prices.length - inc ; i++) {
        for(j = 1 ; j <= inc ; j++) {
            delta = (prices[i+j][1] - prices[i][1]) / prices[i][1];
            if (delta < deltaMinus) { deltaMinus = delta; timeDeltaMinus = prices[i+j][0]; priceMinus = prices[i+j][1]; }
            if (delta > deltaPlus) { deltaPlus = delta; timeDeltaPlus = prices[i+j][0];  pricePlus = prices[i+j][1];}
        }
    }

    console.log('For ', inc, 'minutes-> ', 'Time delta minus: ', timeDeltaMinus - (inc*60), timeDeltaMinus, ' delta minus: ', deltaMinus, ' price minus: ', priceMinus, ' time delta plus: ', timeDeltaPlus - (inc*60), timeDeltaPlus, ' delta plus: ', deltaPlus, ' price plus: ', pricePlus);
    return(inc + ',' + new Date(parseInt(timeDeltaMinus*1000)).toLocaleString() + ',' +  deltaMinus + ',' + priceMinus + ',' + new Date(parseInt(timeDeltaPlus*1000)).toLocaleString() + ',' + deltaPlus + ',' + pricePlus + '\n');
}