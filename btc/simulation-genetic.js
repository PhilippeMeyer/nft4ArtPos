const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");


let filename = "./BTC-2021min.csv";
//let filename = "./Gemini_BTCUSD_2022_1min.csv";
let prices = new Array();
let profits = new Array();

var i;
var count = 0;
let startingPoint = 29083.47;
let stopLoss = -0.02            // If the prices decrease more than this parameter -> sell to stop the loss
let takeProfit = 0.03           // If the prices increase more than this parameter -> prepare to sell to take profit
let deltaTopUp = 0.004          // If the prices increase has been lowered by this factor -> sell to take profit
let deltaTopDown = 0.005        // If the prices increase in a bear market more than this factor -> buy
let marketDown = -0.06          // If the price decrease is more than this factor -> prepare to buy


function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    // The maximum is exclusive and the minimum is inclusive
    return Math.floor(Math.random() * (max - min)) + min;
}


class Member {
    constructor(el, st, tp, du, dd, md) {
        this.el = el;
        this.st = st;
        this.tp = tp
        this.du = du;
        this.dd = dd;
        this.md = md;
        this.profit = simulate(el, st, tp, du, dd, md);
    }

    fitness() {
        return this.profit;
    }

    crossover(partner) {
        let factor = 0.0;
        let st, tp, du, dd, md;

        if (partner.profit > this.profit) {
            factor = this.profit/partner.profit;
            st = Math.random() * factor > 0.5 ? partner.st : this.st;
            tp = Math.random() * factor > 0.5 ? partner.tp : this.tp;
            du = Math.random() * factor > 0.5 ? partner.du : this.du;
            dd = Math.random() * factor > 0.5 ? partner.dd : this.dd;
            md = Math.random() * factor > 0.5 ? partner.md : this.md;
        } else {
            factor = partner.profit/this.profit;
            st = Math.random() * factor > 0.5 ? this.st : partner.st;
            tp = Math.random() * factor > 0.5 ? this.tp : partner.tp;
            du = Math.random() * factor > 0.5 ? this.du : partner.du;
            dd = Math.random() * factor > 0.5 ? this.dd : partner.dd;
            md = Math.random() * factor > 0.5 ? this.md : partner.md;
        }

        const child = new Member(this.el, st, tp, du, dd, md);
        console.log('P1: ',this.profit,' P2: ', partner.profit,' Child: ', child.profit);
        if ((child.profit > this.profit) && (child.profit > partner.profit)) {console.log('child'); return child; }
        else return partner.profit > this.profit ? partner : this;
        //return child;
    }

    mutate(mutationRate) {
        if (Math.random() < mutationRate) this.st = random(-0.2, -0.01);
        if (Math.random() < mutationRate) this.tp = random(0.01, 0.2);
        if (Math.random() < mutationRate) this.du = random(0.001, 0.008);
        if (Math.random() < mutationRate) this.dd = random(0.001, 0.008);
        if (Math.random() < mutationRate) this.md = random(-0.1, -0.01);
    }

    parameters() {
        return {'entryLevel': this.el, 'stopLoss': this.st, 'takeProfit': this.tp, 'deltaTopUp': this.du, 'deltaTopDown': this.dd, 'marketDown': this.md, 'profit': this.profit };
    }
}

class Population {
    constructor(size, el, mutationRate) {
        size = size || 1;
        this.mutationRate = mutationRate
        this.members = [];

        for (let i = 0; i < size; i++) {
            let st = random(-0.2, -0.01);
            let tp = random(0.01, 0.2);
            let du = random(0.001, 0.008);
            let dd = random(0.001, 0.008);
            let md = random(-0.1, -0.01);

            this.members.push(new Member(el, st, tp, du, dd, md));
        }
    }

    _selectMembersForMating() {
        const matingPool = [];
        const fit = [];

        // find the minimum of the positive profits and copy all the profits in the fit array
        let min = 100000000000.0;
        this.members.forEach((m) => {
            let f = m.fitness();
            fit.push(f);
            if ((f > 0) && (f < min)) min = f;
        });

        fit.forEach((f, i) => {
            //if (f < 0) matingPool.push(this.members[i]);            // We insert the negative profit only once
            //else
            if (f > 0) {
                let j = Math.ceil(f/min) || 1;                     // We insert the best performing multiple times
                for(let k = 0 ; k < j ; k++) matingPool.push(this.members[i]);
            }
        });
        return matingPool;
    }

    _reproduce(matingPool) {
        for (let i = 0; i < this.members.length; i += 1) {
            // Pick 2 random members/parents from the mating pool
            const parentA = matingPool[randomInt(0, matingPool.length)];
            const parentB = matingPool[randomInt(0, matingPool.length)];

            // Perform crossover
            const child = parentA.crossover(parentB);

            // Perform mutation
            child.mutate(this.mutationRate);

            this.members[i] = child;
        }
    }

    evolve(generations) {
        let max = 0.0;
        let maxParams;

        for (let i = 0; i < generations; i += 1) {
            const pool = this._selectMembersForMating();
            this._reproduce(pool);
            let profit = this.maxProfit();
            if (profit.max > max) { max = profit.max; maxParams = profit; }
            console.log('Generation:', i, ' Profit: ', profit.max);
        }
        return maxParams;
    }

    fitness() {
        let ret = [];
        this.members.forEach((m) => {
            ret.push([m.fitness(), m.parameters()]);
        });
        return ret;
    }

    maxProfit() {
        let max = 0.0;
        let maxParams;

        this.members.forEach((m) => {
            let f = m.fitness();
            if(f > max) { max = f; maxParams = m.parameters(); }
        });
        return { 'max': max, 'maxParams': maxParams };
    }
}
function generate(populationSize, entryLevel, mutationRate, generations) {
    // Create a population and evolve for N generations
    const population = new Population(populationSize, entryLevel, mutationRate);
    res = population.evolve(generations);
    console.log(res);
}

fs.createReadStream(filename)
  .pipe(parse({ delimiter: ",", from_line: 3 }))
  .on("data", function (row) {
    prices.push([row[0], parseFloat(row[6])]);
  })
  .on("end", function () {
    console.log("finished");
    prices.reverse();
    generate(20, startingPoint, 0.05, 30);
  })
  .on("error", function (error) {
    console.log(error.message);
  });

function simulate(entryLevel, stopLoss, takeProfit, deltaTopUp, deltaTopDown, marketDown) {
    //console.log('stopLoss: ', stopLoss, 'takeProfit: ', takeProfit, 'deltaTopUp: ', deltaTopUp, 'deltaTopDown: ', deltaTopDown, 'marketDown: ', marketDown);
    let readyToSell = false;
    let readyToBuy = false;
    let sellLevel = 0.0;
    let soldLevel = 0.0;
    let position = 1.0;
    let profit = 0.0;

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
    //console.log('Profit: ', profit);
    return profit;
}