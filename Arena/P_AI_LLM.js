// ==================== AI LLM BOT =====================
// This bot uses Language Model API (Claude/GPT) to make decisions
// Call: "node P_AI_LLM.js -h [host] -p [port] -k [key]"
// Set environment variable: AI_API_KEY and AI_API_TYPE (claude or openai)
// ===========================================================

// Get the host and port from argument
var VERSION = 1;

var host = "127.0.0.1";
var port = 3011;
var key = 0;
for (var i=0; i<process.argv.length; i++) {
	if (process.argv[i] == "-h") {
		host = process.argv[i + 1];
	}
	else if (process.argv[i] == "-p") {
		port = process.argv[i + 1];
	}
	else if (process.argv[i] == "-k") {
		key = process.argv[i + 1];
	}
}
if (host == null) host = "127.0.0.1";
if (port == null) port = 3011;
if (key == null) key = 0;

// AI API Configuration
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_API_TYPE = process.env.AI_API_TYPE || 'claude'; // 'claude' or 'openai'
const https = require('https');

// ================== BEHIND THE SCENE STUFF =================
// Game definition
var GAMESTATE_WAIT_FOR_PLAYER = 0;
var GAMESTATE_COMMENCING = 1;
var GAMESTATE_END = 2;

var COMMAND_SEND_KEY = 1;
var COMMAND_SEND_INDEX = 2;
var COMMAND_SEND_DIRECTION = 3;
var COMMAND_SEND_STAGE = 4;

var TURN_PLAYER_1 = 1;
var TURN_PLAYER_2 = 2;

var BLOCK_EMPTY = 0;
var BLOCK_PLAYER_1 = 1;
var BLOCK_PLAYER_1_TRAIL = 2;
var BLOCK_PLAYER_2 = 3;
var BLOCK_PLAYER_2_TRAIL = 4;
var BLOCK_OBSTACLE = 5;

var DIRECTION_LEFT = 1;
var DIRECTION_UP = 2;
var DIRECTION_RIGHT = 3;
var DIRECTION_DOWN = 4;

var turn = TURN_PLAYER_1;
var gameState = GAMESTATE_WAIT_FOR_PLAYER;

var MAP_SIZE = 11;

var map = new Array();
var winner = null;
var index = 0;

// These are friendly variable for user only
var myPosition = new Position(0, 0);
var enemyPosition = new Position(0, 0);
var board = new Array();
for (var i=0; i<MAP_SIZE; i++) {
	board[i] = new Array();
	for (var j=0; j<MAP_SIZE; j++) {
		board[i][j] = 0;
	}
}

// Position object
function Position(x, y) {
	this.x = x;
	this.y = y;
}

// When receive a packet from server
function OnUpdatePacket(data, offset) {
	// Update all variable
	var i = offset;
	gameState = data[i].charCodeAt(0); i ++;
	turn = data[i].charCodeAt(0); i ++;
	winner = data[i].charCodeAt(0); i ++;
	for (var j=0; j<MAP_SIZE * MAP_SIZE; j++) {
		map[j] = data[i].charCodeAt(0); i ++;
	}

	// If it's player turn, notify them to get their input
	if (gameState == GAMESTATE_COMMENCING && turn == index) {
		ConvertVariable();
		MyTurn();
	}
	else {
		// Do something while waiting for your opponent
		ConvertVariable();
		TheirTurn();
	}
}

// Player need to give a command here
function Command(dir) {
	if (gameState == GAMESTATE_COMMENCING && turn == index) {
		var data = "";
		data += String.fromCharCode(COMMAND_SEND_DIRECTION);
		data += String.fromCharCode(dir);
		Send (data);
	}
}

// Helper
function ConvertCoord (x, y) {
	return y * MAP_SIZE + x;
}

function ConvertVariable () {
	for (var i=0; i<MAP_SIZE; i++) {
		board[i] = new Array();
		for (var j=0; j<MAP_SIZE; j++) {
			board[i][j] = map[ConvertCoord(i, j)];

			if (board[i][j] == BLOCK_PLAYER_1) {
				if (index == TURN_PLAYER_1) {
					myPosition.x = i;
					myPosition.y = j;
				}
				else {
					enemyPosition.x = i;
					enemyPosition.y = j;
				}
			}
			else if (board[i][j] == BLOCK_PLAYER_2) {
				if (index == TURN_PLAYER_2) {
					myPosition.x = i;
					myPosition.y = j;
				}
				else {
					enemyPosition.x = i;
					enemyPosition.y = j;
				}
			}
		}
	}
}

// Engine
var socketStatus = 0;
var SOCKET_STATUS_ONLINE = 1;
var SOCKET_STATUS_OFFLINE = 0;

// Start new connection to server
var ws;
try {
	ws = require("./NodeWS");
}
catch (e) {
	ws = require("./../NodeWS");
}

var socket = ws.connect ("ws://" + host + ":" + port, [], function () {
	socketStatus = SOCKET_STATUS_ONLINE;

	// Send your key (even if you don't have one)
	var data = "";
	data += String.fromCharCode(COMMAND_SEND_KEY);
	data += String.fromCharCode(key);
	data += String.fromCharCode(VERSION);
	Send (data);
});

socket.on("text", function (data) {
	var command = data[0].charCodeAt(0);
	if (command == COMMAND_SEND_INDEX) {
		// Server send you your index, update it
		index = data[1].charCodeAt(0);
	}
	else if (command == COMMAND_SEND_STAGE) {
		OnUpdatePacket(data, 1);
	}
});

socket.on("error", function (code, reason) {
	socketStatus = SOCKET_STATUS_OFFLINE;
});

// Send data through socket
function Send(data) {
	if (socketStatus == SOCKET_STATUS_ONLINE) {
		socket.sendText(data);
	}
}
// ===========================================================

//////////////////////////////////////////////////////////////////////////////////////
//                           AI LLM BOT IMPLEMENTATION                              //
//////////////////////////////////////////////////////////////////////////////////////

var directions = [DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP, DIRECTION_DOWN];
var direction_commands = {};
direction_commands[DIRECTION_LEFT] 	= {x : -1, y :  0, name: "LEFT"};
direction_commands[DIRECTION_RIGHT] = {x :  1, y :  0, name: "RIGHT"};
direction_commands[DIRECTION_UP] 	= {x :  0, y : -1, name: "UP"};
direction_commands[DIRECTION_DOWN] 	= {x :  0, y :  1, name: "DOWN"};

// Convert board state to readable format for AI
function boardToString() {
	var result = "Current Board State (11x11):\n";
	result += "Legend: . = empty, M = you, E = enemy, # = obstacle/trail\n\n";

	for (var j = 0; j < MAP_SIZE; j++) {
		for (var i = 0; i < MAP_SIZE; i++) {
			var cell = board[i][j];
			if (i === myPosition.x && j === myPosition.y) {
				result += "M ";
			} else if (i === enemyPosition.x && j === enemyPosition.y) {
				result += "E ";
			} else if (cell === BLOCK_EMPTY) {
				result += ". ";
			} else {
				result += "# ";
			}
		}
		result += "\n";
	}

	result += "\nYour position: (" + myPosition.x + ", " + myPosition.y + ")\n";
	result += "Enemy position: (" + enemyPosition.x + ", " + enemyPosition.y + ")\n";

	return result;
}

// Get valid moves
function getValidMoves() {
	var validMoves = [];
	for (var i = 0; i < directions.length; i++) {
		var dir = directions[i];
		var cmd = direction_commands[dir];
		var newX = myPosition.x + cmd.x;
		var newY = myPosition.y + cmd.y;

		if (newX >= 0 && newX < MAP_SIZE && newY >= 0 && newY < MAP_SIZE && board[newX][newY] === BLOCK_EMPTY) {
			validMoves.push({direction: dir, name: cmd.name, x: newX, y: newY});
		}
	}
	return validMoves;
}

// Call Claude API
function callClaudeAPI(prompt, callback) {
	const postData = JSON.stringify({
		model: "claude-3-5-sonnet-20241022",
		max_tokens: 1024,
		messages: [{
			role: "user",
			content: prompt
		}]
	});

	const options = {
		hostname: 'api.anthropic.com',
		path: '/v1/messages',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': AI_API_KEY,
			'anthropic-version': '2023-06-01',
			'Content-Length': Buffer.byteLength(postData)
		}
	};

	const req = https.request(options, (res) => {
		let data = '';
		res.on('data', (chunk) => { data += chunk; });
		res.on('end', () => {
			try {
				const response = JSON.parse(data);
				if (response.content && response.content[0] && response.content[0].text) {
					callback(null, response.content[0].text);
				} else {
					callback(new Error('Invalid response format'));
				}
			} catch (e) {
				callback(e);
			}
		});
	});

	req.on('error', callback);
	req.write(postData);
	req.end();
}

// Call OpenAI API
function callOpenAIAPI(prompt, callback) {
	const postData = JSON.stringify({
		model: "gpt-4",
		messages: [{
			role: "user",
			content: prompt
		}],
		max_tokens: 1024,
		temperature: 0.7
	});

	const options = {
		hostname: 'api.openai.com',
		path: '/v1/chat/completions',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + AI_API_KEY,
			'Content-Length': Buffer.byteLength(postData)
		}
	};

	const req = https.request(options, (res) => {
		let data = '';
		res.on('data', (chunk) => { data += chunk; });
		res.on('end', () => {
			try {
				const response = JSON.parse(data);
				if (response.choices && response.choices[0] && response.choices[0].message) {
					callback(null, response.choices[0].message.content);
				} else {
					callback(new Error('Invalid response format'));
				}
			} catch (e) {
				callback(e);
			}
		});
	});

	req.on('error', callback);
	req.write(postData);
	req.end();
}

// Main AI decision function
function makeAIDecision(callback) {
	var boardState = boardToString();
	var validMoves = getValidMoves();

	if (validMoves.length === 0) {
		callback(new Error('No valid moves available'));
		return;
	}

	var validMovesStr = validMoves.map(function(m) {
		return m.name + " -> (" + m.x + ", " + m.y + ")";
	}).join(", ");

	var prompt = `You are playing a strategic tank game on an 11x11 grid. The rules:
1. You and your enemy take turns moving (LEFT/RIGHT/UP/DOWN)
2. You cannot move to cells you or your enemy have visited (they leave trails)
3. The game ends when someone cannot move (they lose)
4. Strategy: Control more space, cut off enemy, avoid getting trapped

${boardState}

Valid moves: ${validMovesStr}

Analyze the board carefully and choose the BEST move. Consider:
- Controlling more territory
- Cutting off the enemy's escape routes
- Avoiding corners and dead ends
- Maximizing your future move options

Respond with ONLY ONE WORD from: LEFT, RIGHT, UP, or DOWN
Your move:`;

	console.log("Calling AI API for decision...");

	var apiCall = AI_API_TYPE === 'openai' ? callOpenAIAPI : callClaudeAPI;

	apiCall(prompt, function(err, response) {
		if (err) {
			console.error("AI API Error:", err.message);
			// Fallback to random valid move
			var randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
			callback(null, randomMove.direction);
			return;
		}

		console.log("AI Response:", response);

		// Parse the response to get direction
		var upperResponse = response.toUpperCase().trim();
		var chosenMove = null;

		for (var i = 0; i < validMoves.length; i++) {
			if (upperResponse.indexOf(validMoves[i].name) !== -1) {
				chosenMove = validMoves[i].direction;
				break;
			}
		}

		// If AI response is invalid, use first valid move
		if (chosenMove === null) {
			console.log("AI gave invalid response, using first valid move");
			chosenMove = validMoves[0].direction;
		}

		callback(null, chosenMove);
	});
}

// Main turn handler
function MyTurn() {
	console.log("\n=== My Turn ===");

	// Check if API key is configured
	if (!AI_API_KEY) {
		console.log("Warning: AI_API_KEY not set, using fallback strategy");
		// Use simple heuristic as fallback
		var validMoves = getValidMoves();
		if (validMoves.length > 0) {
			Command(validMoves[0].direction);
		}
		return;
	}

	makeAIDecision(function(err, move) {
		if (err) {
			console.error("Decision error:", err);
			// Fallback to first valid move
			var validMoves = getValidMoves();
			if (validMoves.length > 0) {
				Command(validMoves[0].direction);
			}
		} else {
			console.log("Chosen move:", direction_commands[move].name);
			Command(move);
		}
	});
}

function TheirTurn() {
	// Do nothing
}
