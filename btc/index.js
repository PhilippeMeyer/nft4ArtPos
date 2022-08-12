const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");


let filename = "./BTC-2021min.csv";
//let filename = "./Gemini_BTCUSD_2022_1min.csv";
let prices = new Array();
let profits = new Array();

var i;
var count = 0;
let entryLevel = 29083.47;
let readyToSell = false;
let readyToBuy = false;
let sellLevel = 0.0;
let soldLevel = 0.0;
let position = 1.0;
let profit = 0.0;

let stopLoss = -0.02            // If the prices decrease more than this parameter -> sell to stop the loss
let takeProfit = 0.03           // If the prices increase more than this parameter -> prepare to sell to take profit
let deltaTopUp = 0.004          // If the prices increase has been lowered by this factor -> sell to take profit
let deltaTopDown = 0.005        // If the prices increase in a bear market more than this factor -> buy
let marketDown = -0.06          // If the price decrease is more than this factor -> prepare to buy

fs.createReadStream(filename)
  .pipe(parse({ delimiter: ",", from_line: 3 }))
  .on("data", function (row) {
    prices.push([row[0], parseFloat(row[6])]);
  })
  .on("end", function () {
    console.log("finished");
    prices.reverse();

    for (stopLoss = -0.01 ; stopLoss > -0.2 ; stopLoss-=0.005)
        for (takeProfit = 0.01 ; takeProfit < 0.2 ; takeProfit+= 0.005)
            for (deltaTopUp = 0.001 ; deltaTopUp < 0.008 ; deltaTopUp+= 0.001)
                for (deltaTopDown = 0.001 ; deltaTopDown < 0.008 ; deltaTopDown+= 0.001)
                    for (marketDown = -0.01 ; marketDown > -0.1 ; marketDown-=0.005)
                    {
                       entryLevel = 29083.47;
                        readyToSell = false;
                        readyToBuy = false;
                        sellLevel = 0.0;
                        soldLevel = 0.0;
                        position = 1.0;
                        profit = 0.0;
                        simulate();
                        profits.push({'sl': stopLoss, 'tp': takeProfit, 'dd': deltaTopDown, 'du': deltaTopUp, 'md': marketDown, 'p': profit});
                    }
    fs.writeFileSync('profits.txt', JSON.stringify(profits));
  })
  .on("error", function (error) {
    console.log(error.message);
  });

function simulate() {
    console.log('stopLoss: ', stopLoss, 'takeProfit: ', takeProfit, 'deltaTopUp: ', deltaTopUp, 'deltaTopDown: ', deltaTopDown, 'marketDown: ', marketDown);
    for(var i = prices.length -1 ; i >= 0  ; i--) {
    let price = prices[i][1];
	    if (readyToSell) {
	        if (price > sellLevel) sellLevel = price;
	        else if ((sellLevel - price)/price > deltaTopUp) {
	            profit += price - entryLevel;
		        //console.log("take profit at ", price, " Profit : ", price - entryLevel, " Time: ", prices[i][0], ' SellLevel: ', sellLevel);
		        readyToSell = false;
		        position = 0.0;
		        soldLevel = price;
	        }
	    }
	    else if (readyToBuy) {
            if (price < buyLevel) { buyLevel = price; }
            else if ((price - buyLevel) / price > deltaTopDown) {
                //console.log("buy at ", price, ' Time: ', prices[i][0], ' BuyLevel: ', buyLevel);
                readyToBuy = false;
                position = 1.0;
                entryLevel = price;
            }
        }
	    else {
	        if (position > 0) {
	            if ((price - entryLevel)/entryLevel > takeProfit) { readyToSell = true; sellLevel = price; }
	            if ((price - entryLevel)/entryLevel < stopLoss) { readyToSell = true; sellLevel = price; }
	        }
	        else if (soldLevel > 0) {
	            let delta = (price - soldLevel)/price;
	            if (delta < marketDown) { readyToBuy = true; buyLevel = price; }
	        }
	    }
    }
    console.log('Profit: ', profit);
}