import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket} from 'ws';
import {Wallet, Contract, utils, providers, getDefaultProvider} from 'ethers';
import fs from 'fs';
import winston from 'winston';
import expressWinston  from 'express-winston';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from "uuid";
import Loki from 'lokijs';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import 'dotenv/config';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const webSite: string = 'http://192.168.1.5:8999';
const imgUrl: string = webSite + '/image?id=';
const iconUrl: string = webSite + '/icon?id=';
const jwtExpiry: number = 60 * 60;

var config : any = {};
config.secret = "nft4Artsessionsecret";
config.walletFileName = 'wallet.json';
config.database = 'nft4Art.json';
config.infuraKey = '1d5baee48e63437682fcd58d6b1ad730';
config.network = 'rinkeby';
config.addressToken = '0xCd4BE43E6200e894e2F2DFCF9737726015ced3e2';

const ERC1155ABI = [{"inputs":[{"internalType":"string","name":"name_","type":"string"},{"internalType":"string","name":"symbol_","type":"string"},{"internalType":"address","name":"proxyAddr_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"TransferBatch","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"TransferSingle","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"value","type":"string"},{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"URI","type":"event"},{"inputs":[],"name":"BOUQUET","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"COFFEE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FLOWER","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"GLOBAL","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SUNSET","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"accounts","type":"address[]"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"}],"name":"balanceOfBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeBatchTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"uri","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}];

export interface RequestCustom extends Request
{
    deviceId?: string;
	manager?: string;
}

// Global variables

let passHash: string = "";					// Hash of the password. If empty, means that the wallet has not been loaded
var databaseInitialized = false;			// Is the database initialized? Used to wait for the database init before starting the server
var registeredPoS: any;						// Database collection of registered point of sale
var tokens: any;							// Database collection of tokens
var wallet: Wallet;							// Wallet 
let ethProvider: providers.JsonRpcProvider;	// Connection provider to Ethereum
let token: Contract;						// Proxy to the Nft
let metas: Object[] = [];					// list of the Nfts loaded from the smart contract
let metasMap = new Map();					// Same but as a map
let icons = new Map();						// Icons of the Nfts
let images = new Map();						// Images of the Nfts
var wait_on = 0;							// pdf files synchronization

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize and configure the logger (winston)

const logConf = {
	transports: [
	  new winston.transports.Console()
	],
	format: winston.format.combine(
	  winston.format.splat(),
	  winston.format.colorize(),
	  winston.format.simple()
	),
	meta: false,
	msg: "HTTP  ",
	expressFormat: true,
	colorize: false,
	ignoreRoute: function (req :Request, res :Response) { return false; }
  };
  const logger = winston.createLogger(logConf);
  
// Database creation

var db = new Loki( config.database, {
	autoload: true, autoloadCallback : loadHandler,
	autosave: true, 
	autosaveInterval: 4000, // 4 seconds
  }); 

// Database initialization, creating the PoS and tokens collections if they are not already existing
// When the database is initialized, the flag is set so that the server can start

function loadHandler() {
  // if database did not exist it will be empty so I will intitialize here
  registeredPoS = db.getCollection('registeredPoS');
  if (registeredPoS === null) registeredPoS = db.addCollection('registeredPoS');
  tokens = db.getCollection('tokens');
  if (tokens === null) tokens = db.addCollection('tokens'); 

  databaseInitialized = true;
}


function noOp() {};

// Express cleanup function. Saving the database when the server terminates

function Cleanup(callback :any) {

  callback = callback || noOp;
  process.on('exit', callback);
  

  // catch ctrl+c event and exit normally
  process.on('SIGINT', function () {
    logger.info('server %s', 'Ctrl-C...');
    process.exit(2);
  });

  //catch uncaught exceptions, trace, then exit normally
  process.on('uncaughtException', function(e) {
    logger.error('server %s', 'Uncaught Exception...');
    logger.error('server %s', e.stack);
    process.exit(99);
  });
}

function exitHandler() {

	db.saveDatabase();
	console.log('Server stopping...saved database');
}

Cleanup(exitHandler);


//
// Server Init:
//
// For security reasosns, the server does not store the wallet's password. 
// Therefore, no action can be performed before loading the wallet with /loadWAllet where the wallet owner enters interactively the passwaord
// This passwoard is used to unlock the wallet and the hash of this passwoard is kept in memory so that further admin functions can be checked 
// against this password. If a wrong passwaord is given to unlock the wallet, this generates an arror an the passwoard hash is empty blocking 
// any further operation.
//
// Client Connections:
//
// Each Point of Sale has to be registered first. The registration is performed on the PoS side by genereting a key pair and sending to the server 
// the mobile unique Id encrypted with the priavte key together with the public key. The server stores in lowDb the mobile Id and its associated 
// public key. The server's admin is then invited to validate this registration.
// 
// Once a PoS registered, the connection is performed sending a signature of the mobile unique Id when the biometrics on the PoS have been validated
// When this signature is received, the server creates then a JWT which is used between the PoS and the server
//


init();


const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocketServer({ noServer: true });

app.use(express.static('public'));
app.use(express.static('build'));
app.use(cors());
//app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(expressWinston.logger(logConf));

waitFor(() => databaseInitialized == true).then(() =>
	server.listen(process.env.PORT || 8999, () => {
	    //console.log(`Server started on port ${server.address().port} :)`);
		logger.info('server.started %s', `on port ${process.env.PORT || 8999}`);
	})
);

function waitFor(conditionFunction :() => boolean) {
	return new Promise<void>((resolve) => {
		const interval = setInterval(() => {
		  if (conditionFunction()) {
			clearInterval(interval);
			resolve();
		  }
		}, 500);
	  });
  }
/*
app.get('/*', function (req :Request, res :Response) {
	res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
*/	
//
// verifyToken
// Helper function to verify a token. This is called by the end points to verify if the JWT is valid
//
// When the token is expired, the PoS will reinitiate a login procedure which is simply performed through 
// a biometric check
//
const verifyToken = (req :RequestCustom, res :Response, next :NextFunction) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(' ')[1]

	if (!token) {
		logger.info('server.verifyToken.missingToken');
	  	return res.status(401).json({
			error: { message: "No token provided!", name: "NoTokenProvided" }
	  	});
	}
	jwt.verify(token, config.secret, (err :any, decoded :any) => {
	  	if (err) {
			const status = err.name == 'TokenExpiredError' ? 401 : 403;
		
			return res.status(status).json({
		  		error: err
			});
	  	}

		req.deviceId = decoded.id;
		req.manager = decoded.manager;
		next();
	});
};

//
// verifyTokenManager
// Helper function to verify if a token belongs to a manager This is called by the end points to verify if the JWT is valid and owned by a manager
//
// When the token is expired, the PoS will reinitiate a login procedure which is simply performed through 
// a biometric check
//
const verifyTokenManager = (req :RequestCustom, res :Response, next :NextFunction) => {

	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(' ')[1]

	if (!token) {
		logger.info('server.verifyToken.missingToken');
	  	return res.status(401).json({
			error: { message: "No token provided!", name: "NoTokenProvided" }
	  	});
	}
	jwt.verify(token, config.secret, (err :any, decoded :any) => {
	  	if (err) {
			const status = err.name == 'TokenExpiredError' ? 401 : 403;
		
			return res.status(status).json({
		  		error: err
			});
	  	}

		req.deviceId = decoded.id;
		req.manager = decoded.manager;
		if (!req.manager) return res.status(403).json({
			error: { message: "Not authorized !", name: "NotAuthorized" }
	  	});

		next();
	});
};

 
//
// /apiV1/auth/authorizePoS
// Authorize or not a registered Point of Sale
//
// This end point receives the public key the PoS has generated and the encrypted mobile unique Id
//
app.post('/apiV1/auth/registerPoS', function (req :Request, res :Response) {

});

//
// /apiV1/auth/sigin
// Signin into the server
//
// For this the client is sending the unique mobile Id and some devices characteristics.
// The server is then able to identify the registered PoS and sends back a JWT to the PoS
// In case the login is requested on a manager role, a password is provided in the object
// When no device have been registered and the manager's password is valid (as it unlocks 
// the wallet), the device is automatically registered.
// For the following devices, the manager registration will be required
//
// In the case, a regular login is attempted, while the wallet has not been provided to the 
// server to unlock the wallet, the ende point returns a 403
//
app.post('/apiV1/auth/signin', function (req :Request, res :Response) {
	logger.info('server.signin %s', req.body.device.deviceId);
	// Check if a password has been provided
	if (req.body.password) {
		let pass: string = req.body.password as string;

		if (passHash == "") {    // The password has not been provided yet -> try to unlock the wallet
			let jsonWallet = fs.readFileSync(config.walletFileName);
			
			Wallet.fromEncryptedJson(jsonWallet.toString(), pass)
				.then(function(data) { 
					loadWallet(data, pass);
					req.body.device.authorized = true;
					registerPoS(req.body.device, pass, res);
				})
				.catch(function(data) { 
					logger.info('server.signin.wrongCredentials');
					res.status(403).send({error: {name: 'walletPassError', message: 'Wrong credentials for the wallet password'}}); 
				});
		} else {				// The password has already been provided, the wallet is unlocked. Verify if the passwaord is Ok
			if (passHash != utils.keccak256(utils.toUtf8Bytes(pass))) {
				logger.info('server.signin.wrongCredentials');
				res.status(403).send({error: {name: 'walletPassError', message: 'Wrong credentials for the wallet password'}}); 
			}
			else {				// The credentials are Ok -> register the device
				logger.info('server.signin.registerPoS');
				req.body.device.authorized = true;
				registerPoS(req.body.device, req.body.password, res);
			}
		}
	} else {
		if (passHash == "") {	// The wallet has not been loaded, the server is not ready and cannot accept PoS connections
			logger.info('server.signin.walletNotLoaded');
			res.status(403).json({error: {name: 'walletNotLoaded', message: 'The server\'s wallet has not been loaded, manager\'s login required'}});
		}
		else {					// The wallet is loaded, the server can accept connections. We verify that this PoS has been registered
			logger.info('server.signin.registerPoS');
			registerPoS(req.body.device, req.body.password, res);
		}
	}
});

function loadWallet(w: Wallet, pass: string) {
	wallet = w;
	logger.info('server.signin.loadedWallet');
	passHash = utils.keccak256(utils.toUtf8Bytes(pass));

	metas.forEach( async (nft: any) => {
		let balance = await token.balanceOf(wallet.address, nft.tokenId);
		console.log('balance: ' + nft.tokenId)
		nft.availableTokens = balance.toString();
		if (balance.isZero()) nft.isLocked = true;
	});
}

//
// registerPoS, parameters: the device to be registered, the password if the user is a manager and the result object
//
// This function registers a new PoS in the database
// If the PoS does not exists, it is created if a manager's password has been provided and in that case, it sends back a Jwt
// If the PoS has already been registered and authorized, it simply sends back a token
//
function registerPoS(device: any, pass: string, res: any) {
	var manager: boolean;

	if (!device.authorized) device.authorized = false;
	manager = typeof pass === 'undefined' ? false : true;

	var pos: any  = registeredPoS.findOne({deviceId: device.deviceId});
	if (pos == null) {
		if (!device.authorized) {		// The PoS has not been registered and no password has been provided -> reject
			logger.info('server.signin.posNotAuthorized');
			res.status(403).json({error: {name: 'posNotAuthorized', message: 'The Point of Sale has not been authorized'}});
			return;
		} else {						// This is a new PoS connected with the manager's login -> register
			logger.info('server.signin.newPoS', device);
			device.authorized = true;
			registeredPoS.insert(device);
			var token = jwt.sign({ id: device.deviceId, manager: manager }, config.secret, { expiresIn: jwtExpiry });
			res.status(200).send({ id: device.deviceId, accessToken: token });
			return;
		}
	} else {							// The PoS has been registered
		if (!pos.authorized) {
			logger.info('server.signin.posNotAuthorized');
			res.status(403).json({error: {name: 'posNotAuthorized', message: 'The Point of Sale has not been authorized'}});
			return;
		}
		else {							// The PoS is authorized -> Ok
			logger.info('server.signin.success', device);
			var token = jwt.sign({ id: device.deviceId, manager: manager}, config.secret, { expiresIn: jwtExpiry });
			res.status(200).send({ id: device.deviceId, accessToken: token });
			return;
		}
	}
}

app.get('/tokens', verifyToken, function (req :Request, res :Response) {
	res.status(200).json(metas);
});

app.get('/map', function (req :Request, res :Response) {
	res.sendFile(path.join(__dirname, 'public/mapping_rects.json'));
});

app.get('/icon', function (req :Request, res :Response) {
	res.type('png');
	res.status(200).send(icons.get(req.query.id));
});

app.get('/image', function (req :Request, res :Response) {
	res.type('jpeg');
	res.status(200).send(images.get(req.query.id));
});

//
// /apiV1/price/update
// Update the price of a token
//
// This is an endpoint used when the manager updates the price of a token
// The parameters are:
// 	- the token identifier (which is the concatenation of the token's address and the token's id)
//	- the price
//
app.put('/apiV1/price/update', verifyTokenManager, function(req :Request, res :Response) {
	if (typeof req.query.tokenId === 'undefined') {
		res.status(400).json({error: {name: 'noTokenIdSpecified', message: 'The token Id is missing'}});
		return;
	}
	if (typeof req.query.price === 'undefined') {
		res.status(400).json({error: {name: 'noPriceSpecified', message: 'The price is missing'}});
		return;
	}

	var token: any = tokens.findOne({id: req.query.tokenId});
	if (token == null) {
		res.status(404).json({error: {name: 'tokenNotFound', message: 'The specified token is not in the database'}});
		return;
	}

	token.price = req.query.price;
	tokens.update(token);
	res.sendStatus(200);
	sendPrice(token.id, token.price);
});

//
// /apiV1/price/updates
// Update the price of a list of tokens
//
// This is an endpoint used when the manager updates the token prices
// The parameters are:
// 	- a Json object containing the id and the price
//
app.put('/apiV1/price/updates', verifyTokenManager, function(req :Request, res :Response) {
	var tokensUpdate = req.body;
	console.log(tokensUpdate);
	if (tokensUpdate.length == 0) { res.sendStatus(400); return; }

	for (let i = 0 ; i < tokensUpdate.length ; i++) {
		var token: any = tokens.findOne({id: tokensUpdate[i].id});
		if (token == null) {
			res.status(404).json({error: {name: 'tokenNotFound', message: `The specified token ${tokensUpdate[i].tokenId} is not in the database`}});
			return;
		}

		token.price = tokensUpdate[i].price;
		tokens.update(token);
		sendPrice(token.id, token.price);
	}
	res.sendStatus(200);
});

//
// /apiV1/auth/registeredPoS
//
// This end point sends back the registered PoS
//
app.get('/apiV1/auth/registeredPoS', verifyTokenManager, function(req :Request, res :Response) {
	res.status(200).json(registeredPoS.find());
});

//
// /apiV1/auth/authorizePoS, parameter: PoS, the name of the PoS, authorized: true or false
//
// This end point sends back the registered PoS
//
app.put('/apiV1/auth/authorizePoS', verifyTokenManager, function(req :Request, res :Response) {
	if (typeof req.query.PoS === 'undefined') {
		res.sendStatus(400).json({error: {name: 'noPoSSpecified', message: 'The Point of Sale is missing'}});
		return;
	}
	if (typeof req.query.authorized === 'undefined') {
		res.sendStatus(400).json({error: {name: 'noAuthorizationSpecified', message: 'The Point of Sale authorization is missing'}});
		return;
	}

	var pos = registeredPoS.findOne({deviceId: req.query.PoS});
	if (pos == null) {
		res.sendStatus(400).json({error: {name: 'nonExistingPoS', message: 'The Point of Sale does not exist'}});
		return;
	}
	pos.authorized = req.query.authorized == 'true' ? true : false;
	registeredPoS.update(pos);
	res.sendStatus(200);
});

app.get('/apiV1/generateWallets', verifyTokenManager, async function(req :Request, res :Response) {
	let nbWallets = 10;
	if (req.query.nbWallets !== undefined) nbWallets = parseInt(req.query.nbWallets as string);

	var env = new PDFDocument({size: [649.134, 323.15], autoFirstPage: false, margins: {top:10, bottom:10, right:50, left:50 }});
	var doc = new PDFDocument({size: 'A4', autoFirstPage: false });
	var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nft4Art"));
	const envFile = fs.createWriteStream(path.join(tmpDir, 'enveloppes.pdf'));
	const docFile = fs.createWriteStream(path.join(tmpDir, 'wallets.pdf'));
	envFile.on('finish', () => { fileWritten(); });
	docFile.on('finish', () => { fileWritten(); });
	env.pipe(envFile);
	doc.pipe(docFile);

	for (var i = 0 ; i < nbWallets ; i++) {
		let w = Wallet.createRandom();

		let res = await QRCode.toFile(path.join(tmpDir, 'addr' + i +'.png'), w.address);
		env.font('Helvetica').fontSize(10);
		env.addPage();
		env.image('./public/nft4Art.png', 20, 20, {width: 120});
		env.image(path.join(tmpDir, 'addr' + i +'.png'), 400, 30, {width: 200});
		env.fontSize(10).text('Ethereum address:', 0, 240, {align: 'right'});
		env.font('Courier').fontSize(10).text(w.address, {align: 'right'});
	
		doc.addPage();
		doc.image('./public/nft4Art.png', 20, 20, {width: 150});
		doc.moveDown(8);
		doc.font('Helvetica-Bold').fontSize(25).text('Your personnal Ethereum Wallet', {align: 'center'});
		doc.moveDown(3);
		doc.font('Times-Roman').fontSize(12);
		doc.text('You\'ll find below the mnemonic words that you will insert in any Ethereum compatible wallet. This list of words represents the secret which enables you to access your newly purchased piece of art. Do not communicate this information to anybody!');
		doc.moveDown(2);
		doc.font('Times-Bold').fontSize(12).text(w.mnemonic.phrase, {align: 'center'});
		doc.moveDown(2);
		doc.fontSize(12).text('The Ethereum address of this wallet is: ', {continued: true});
		doc.font('Courier').fontSize(12).text(w.address);
		let qr = await QRCode.toFile(path.join(tmpDir, 'phrase' + i + '.png'), w.mnemonic.phrase);
		doc.moveDown(2);
		doc.font('Times-Roman').fontSize(12).text('In the Nft4ART app you\'ll be invited to scan your secret phrase:');
		doc.moveDown(2);
		doc.image(path.join(tmpDir, 'phrase' + i + '.png'), 200, 500, {width: 200});
	}
	doc.end();
	env.end();

	//
	// fileWritten
	// 
	// This is a callback on the write streams closing for the streams used by pdfkit.
	// This function is called when each stream is closing. A global variable ensures that the zip archive is produced only when the 2 files have been closed.
	//
	function fileWritten() {
		wait_on++;
		if (wait_on % 2 != 0) return;

		const archive = archiver("zip");
		archive.pipe(res);
		archive.on('error', function(err) {
			res.status(500).send({error: err.message});
		});
		res.attachment('paperWallets.zip').type('zip');
		archive.on('finish', () => { res.status(200).end(); fs.rmSync(tmpDir, { recursive: true }); });
		archive.file(path.join(tmpDir, 'enveloppes.pdf'), {name: 'enveloppes.pdf'});
		archive.file(path.join(tmpDir, 'wallets.pdf'), {name: 'wallets.pdf'});
		archive.finalize();
	};
});


interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
}

function sendLock(id: string, isLocked: boolean) {
    sendMessage(JSON.stringify(new LockMessage(id, isLocked)));
}
function sendPrice(id: string, price: number) {
    sendMessage(JSON.stringify(new PriceMessage(id, price)));
}

function sendMessage(msg: string) {
	setTimeout(() => {
		wss.clients.forEach(client => { console.log('send ' + msg + client); client.send(msg); });
	}, 1000);
}

export class LockMessage {
    constructor(
        public id: string,
		public isLocked : boolean= true
    ) { }
}
export class PriceMessage {
    constructor(
        public id: string,
		public price : number
    ) { }
}

wss.on('connection', (ws: WebSocket) => {
    const extWs = ws as ExtWebSocket;

	logger.info('server.ws.connection %s', extWs);
    extWs.isAlive = true;

    ws.on('pong', () => {
        extWs.isAlive = true;
    });

 	ws.on('error', (err) => {
        logger.warn('server.ws.disconnection %s', err);
    })
});

setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {

        const extWs = ws as ExtWebSocket;

        if (!extWs.isAlive) return ws.terminate();

        extWs.isAlive = false;
        ws.ping(null, undefined);
    });
}, 10000);


app.put('/lockUnlock', async (req :Request, res :Response) => {
	let meta: any = metasMap.get(req.query.id);

	if (typeof meta == undefined) {
		console.log('error: non existing token ' + req.query.id);
		res.status(404).send();
		return;
	}

	console.log('put : ' + req.query.id);

	meta.isLocked = !meta.isLocked;
	sendLock(req.query.id as string, meta.isLocked);
	res.status(204).send();
});

//
// Server initialization 
//
// This function retrieves the tokens' information on Ethereum via Infura and caches the images in alocal directory
// If the images have not been cached, it rerieves those from Ipfs
//
// This function fills:
// 	- the meta global variable with the tokens' data
//	- the icons map (global variable) with the icons
//	- the image map (global variable) with the images
//
async function init() {
	// Connect to Infura and connect to the token
	ethProvider = await new providers.InfuraProvider(config.network, config.infuraKey);
	token = await new Contract(config.addressToken, ERC1155ABI, ethProvider);
	logger.info('server.init %s', await token.name());
	
	let i: number = 0;
	let str: string;
	let data: any;
	let loop: boolean = true;
	let errTimeout: number = 0;

	// Retrieve the past events on this contract to find out which id have been minted
	// Mints are coming from address '0x0000000000000000000000000000000000000000' and can be performed by any operator (first topic)

	const events = await token.queryFilter(token.filters.TransferSingle(null, '0x0000000000000000000000000000000000000000'), 0, 'latest');
	
	for(i = 0 ; i < events.length ; i++) {
		str = await token.uri(events[i]?.args?.id);

		if (errTimeout == 2) break;														// If we face a timeout we retry twice

		try {
		
			data = tokens.findOne({id: config.addressToken + events[i]?.args?.id});		// Store information in the database if not existing
			if (data == null) {
				logger.info('server.init.loadTokens.fromIpfs %s', str)
				let resp = await axios.get(str);										// The data is not in cache, we retrive the JSON from Ipfs
				data = resp.data;
				data.id = config.addressToken + events[i]?.args?.id;
				data.tokenIdStr = events[i]?.args?.id.toString();
				data.tokenId = events[i]?.args?.id;
				data.addr = config.addressToken;
				data.isLocked = false;
				data.price = 0
				tokens.insert(data);
			}
			else logger.info('server.init.loadTokens.fromCache %s', str);

		} catch(error) {
			const err = error as any;
			if (typeof err.response != 'undefined') {							// We have receieved a proper response but containing an error	
				logger.warn('server.init.loadTokens %s', str, err.response.status);
				if (err.response.status == 504) { errTimeout++; continue; }		// 504 = Gateway timeout
				if (err.response.status == 408) { errTimeout++; continue; }		// 408 = Request timeout
				if (err.response.status == 404) break;							// 404 = not found, we stop as the information is not available
			}
			else logger.error('server.init.loadTokens %s', err);												// We log here network errors
		}
		
		metas.push(data);
		metasMap.set(data.addr + data.id, data);

		errTimeout = 0;
	}
	
	//
	// Retrieve the icons, looking at the cache in case the icon has been already retrieved
	//
	let buf: Buffer;
	for (i = 0; i < metas.length ; i++) {
		const meta: any = metas[i];
		let cid = './cache/' + meta.image.replace('ipfs://', '');						// We remove the ipfs prefix to only keep the cid
		let icon = meta.image.replace('ipfs', 'https').concat('.ipfs.dweb.link');		// We form an url for dweb containing the ipfs cid
		try {
			if (fs.existsSync(cid)) {													// We try to find this cid in the cache
				logger.info('server.init.loadIcons.cache %s', cid);
				buf = Buffer.from(fs.readFileSync(cid, {encoding:'binary'}), 'binary');
			}
			else {																		// Not available in the cache, we get it from ipfs
				logger.info('server.init.loadIcons.ipfs %s', cid);
				const resp = await axios.get(icon, { responseType: 'arraybuffer' });
				buf = Buffer.from(resp.data, 'binary');
				fs.writeFileSync(cid, buf, {flag: "w", encoding: "binary"} );			// Save the file in cache
			}

			icons.set(meta.addr + meta.id, buf);										// Store the icon in memory 

		} catch(error) { logger.error('server.init.loadIcons %s', error); }
		
		meta.iconUrl = iconUrl + meta.addr + meta.id; 									// Reference the icon's url
	}

	//
	// Retrieve the images, looking at the cache in case the image has been already retrieved
	//
	for (i = 0; i < metas.length ; i++) {
		const meta: any = metas[i];
		let cid = './cache/' + meta.image_raw.replace('ipfs://', '');
		try {

			if (fs.existsSync(cid)) {
				logger.info('server.init.loadImages.cache %s', cid);
				buf = Buffer.from(fs.readFileSync(cid, {encoding:'binary'}), 'binary');
			}
			else {
				logger.info('server.init.loadImages.ipfs %s', cid);
				let image = meta.image_raw.replace('ipfs', 'https').concat('.ipfs.dweb.link');
				const resp = await axios.get(image, { responseType: 'arraybuffer' });
				buf = Buffer.from(resp.data, 'binary');
				fs.writeFileSync(cid, buf, {flag: "w", encoding: "binary"} );
			} 

			images.set(meta.addr + meta.id, buf);

		} catch(error) { logger.error('server.init.loadIcons %s', error); }

		meta.imgUrl = imgUrl + meta.addr + meta.id; 
	}
}