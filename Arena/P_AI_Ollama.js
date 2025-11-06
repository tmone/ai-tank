// ==================== AI OLLAMA BOT =====================
// This bot uses local Ollama models (like qwen3:0.6b)
// Call: "node P_AI_Ollama.js -h [host] -p [port] -k [key]"
// Set environment variable: OLLAMA_MODEL (default: qwen3:0.6b)
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

// Ollama Configuration
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:0.6b';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const http = require('http');

// ================== BEHIND THE SCENE STUFF =================
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

var myPosition = new Position(0, 0);
var enemyPosition = new Position(0, 0);
var board = new Array();
for (var i=0; i<MAP_SIZE; i++) {
	board[i] = new Array();
	for (var j=0; j<MAP_SIZE; j++) {
		board[i][j] = 0;
	}
}

function Position(x, y) {
	this.x = x;
	this.y = y;
}

function OnUpdatePacket(data, offset) {
	var i = offset;
	gameState = data[i].charCodeAt(0); i ++;
	turn = data[i].charCodeAt(0); i ++;
	winner = data[i].charCodeAt(0); i ++;
	for (var j=0; j<MAP_SIZE * MAP_SIZE; j++) {
		map[j] = data[i].charCodeAt(0); i ++;
	}

	if (gameState == GAMESTATE_COMMENCING && turn == index) {
		ConvertVariable();
		MyTurn();
	}
	else {
		ConvertVariable();
		TheirTurn();
	}
}

function Command(dir) {
	if (gameState == GAMESTATE_COMMENCING && turn == index) {
		var data = "";
		data += String.fromCharCode(COMMAND_SEND_DIRECTION);
		data += String.fromCharCode(dir);
		Send (data);
	}
}

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

var socketStatus = 0;
var SOCKET_STATUS_ONLINE = 1;
var SOCKET_STATUS_OFFLINE = 0;

var ws;
try {
	ws = require("./NodeWS");
}
catch (e) {
	ws = require("./../NodeWS");
}

var socket = ws.connect ("ws://" + host + ":" + port, [], function () {
	socketStatus = SOCKET_STATUS_ONLINE;

	var data = "";
	data += String.fromCharCode(COMMAND_SEND_KEY);
	data += String.fromCharCode(key);
	data += String.fromCharCode(VERSION);
	Send (data);
});

socket.on("text", function (data) {
	var command = data[0].charCodeAt(0);
	if (command == COMMAND_SEND_INDEX) {
		index = data[1].charCodeAt(0);
		console.log("Using Ollama model:", OLLAMA_MODEL);
	}
	else if (command == COMMAND_SEND_STAGE) {
		OnUpdatePacket(data, 1);
	}
});

socket.on("error", function (code, reason) {
	socketStatus = SOCKET_STATUS_OFFLINE;
});

function Send(data) {
	if (socketStatus == SOCKET_STATUS_ONLINE) {
		socket.sendText(data);
	}
}

//////////////////////////////////////////////////////////////////////////////////////
//                           OLLAMA AI BOT IMPLEMENTATION                           //
//////////////////////////////////////////////////////////////////////////////////////

var directions = [DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP, DIRECTION_DOWN];
var direction_commands = {};
direction_commands[DIRECTION_LEFT] 	= {x : -1, y :  0, name: "LEFT"};
direction_commands[DIRECTION_RIGHT] = {x :  1, y :  0, name: "RIGHT"};
direction_commands[DIRECTION_UP] 	= {x :  0, y : -1, name: "UP"};
direction_commands[DIRECTION_DOWN] 	= {x :  0, y :  1, name: "DOWN"};

function boardToString() {
	var result = "Current Board (11x11):\n";

	for (var j = 0; j < MAP_SIZE; j++) {
		for (var i = 0; i < MAP_SIZE; i++) {
			var cell = board[i][j];
			if (i === myPosition.x && j === myPosition.y) {
				result += "A ";
			} else if (i === enemyPosition.x && j === enemyPosition.y) {
				result += "B ";
			} else if (cell === BLOCK_EMPTY) {
				result += ". ";
			} else if (cell === BLOCK_PLAYER_1_TRAIL) {
				result += "a ";
			} else if (cell === BLOCK_PLAYER_2_TRAIL) {
				result += "b ";
			} else if (cell === BLOCK_OBSTACLE) {
				result += "# ";
			} else {
				result += "# ";
			}
		}
		result += "\n";
	}

	return result;
}

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

// Call Ollama API
function callOllamaAPI(prompt, callback) {
	const url = new URL('/api/generate', OLLAMA_HOST);

	const postData = JSON.stringify({
		model: OLLAMA_MODEL,
		prompt: prompt,
		stream: false,
		options: {
			temperature: 0.3,
			top_p: 0.9,
			top_k: 40
		}
	});

	const options = {
		hostname: url.hostname,
		port: url.port || 11434,
		path: url.pathname,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(postData)
		}
	};

	const req = http.request(options, (res) => {
		let data = '';
		res.on('data', (chunk) => { data += chunk; });
		res.on('end', () => {
			try {
				const response = JSON.parse(data);
				if (response.response) {
					callback(null, response.response);
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
		return m.name;
	}).join(', ');

	var prompt = `You are playing a strategic tank game on an 11x11 grid.

Game Rules:
- Two players take turns moving (LEFT/RIGHT/UP/DOWN)
- You cannot move to cells you or your opponent have visited
- The game ends when a player cannot move (they lose)
- Strategy: Control more space, cut off opponent, avoid dead ends

${boardState}

Your position (A): (${myPosition.x}, ${myPosition.y})
Opponent position (B): (${enemyPosition.x}, ${enemyPosition.y})

Valid moves: ${validMovesStr}

Choose the BEST move to win. Consider:
1. Controlling more territory
2. Cutting off opponent's escape routes
3. Avoiding corners and dead ends
4. Maximizing your future move options

Respond with ONLY the direction: LEFT, RIGHT, UP, or DOWN
Your move:`;

	console.log("\n=== Calling Ollama ===");
	console.log("Model:", OLLAMA_MODEL);

	callOllamaAPI(prompt, function(err, response) {
		if (err) {
			console.error("Ollama API Error:", err.message);
			// Fallback to random valid move
			var randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
			callback(null, randomMove.direction);
			return;
		}

		console.log("Ollama Response:", response.substring(0, 100));

		// Parse the response to get direction
		var upperResponse = response.toUpperCase().trim();
		var chosenMove = null;

		for (var i = 0; i < validMoves.length; i++) {
			if (upperResponse.indexOf(validMoves[i].name) !== -1) {
				chosenMove = validMoves[i].direction;
				break;
			}
		}

		// If response is invalid, use first valid move
		if (chosenMove === null) {
			console.log("Invalid response, using first valid move");
			chosenMove = validMoves[0].direction;
		}

		callback(null, chosenMove);
	});
}

// Main turn handler
function MyTurn() {
	console.log("\n=== My Turn ===");

	makeAIDecision(function(err, move) {
		if (err) {
			console.error("Decision error:", err);
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
