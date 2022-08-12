const fs = require("fs");

let dataRaw = fs.readFileSync('profits.txt');
let data = JSON.parse(dataRaw);

data.sort(function(a,b) { return (b.p - a.p); });
console.log('number of samples: ', data.length);
for (let i = 0 ; i < 20 ; i++) console.log('profit: ', data[i].p, 'stopLoss: ', data[i].sl, 'takeProfit: ', data[i].tp, 'deltaTopDown: ', data[i].dd, 'deltaTopUp: ', data[i].du, 'marketDown: ' , data[i].md);

let content = "profit,stopLoss,takeProfit,deltaTopDown,deltaTopUp,marketDown\n";
data.forEach((row) => { content+= row.p + ',' + row.sl + ',' + row.tp + ',' + row.dd + ',' + row.du + ',' + row.md + '\n'; })
fs.writeFileSync('profits.csv', content);