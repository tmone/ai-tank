// ==================== AI MCTS BOT =====================
// This bot uses Monte Carlo Tree Search algorithm
// MCTS is very effective for turn-based games
// Call: "node P_AI_MCTS.js -h [host] -p [port] -k [key]"
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
//                      MCTS AI BOT IMPLEMENTATION                                  //
//////////////////////////////////////////////////////////////////////////////////////

var MAX_THINKING_TIME = 2800; // milliseconds
var EXPLORATION_CONSTANT = 1.414; // UCB1 exploration constant

var directions = [DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP, DIRECTION_DOWN];
var direction_commands = {};
direction_commands[DIRECTION_LEFT] 	= {x : -1, y :  0};
direction_commands[DIRECTION_RIGHT] = {x :  1, y :  0};
direction_commands[DIRECTION_UP] 	= {x :  0, y : -1};
direction_commands[DIRECTION_DOWN] 	= {x :  0, y :  1};

// Game State class for MCTS
function GameState(board, myPos, enemyPos, currentPlayer, myOriginalPlayer) {
	this.board = board;
	this.myPos = {x: myPos.x, y: myPos.y};
	this.enemyPos = {x: enemyPos.x, y: enemyPos.y};
	this.currentPlayer = currentPlayer; // 1 for my turn, -1 for enemy turn
	this.myOriginalPlayer = myOriginalPlayer;
}

GameState.prototype.clone = function() {
	var newBoard = [];
	for (var i = 0; i < MAP_SIZE; i++) {
		newBoard[i] = this.board[i].slice();
	}
	return new GameState(newBoard, this.myPos, this.enemyPos, this.currentPlayer, this.myOriginalPlayer);
};

GameState.prototype.getValidMoves = function() {
	var pos = this.currentPlayer === 1 ? this.myPos : this.enemyPos;
	var validMoves = [];

	for (var i = 0; i < directions.length; i++) {
		var dir = directions[i];
		var cmd = direction_commands[dir];
		var newX = pos.x + cmd.x;
		var newY = pos.y + cmd.y;

		if (newX >= 0 && newX < MAP_SIZE && newY >= 0 && newY < MAP_SIZE && this.board[newX][newY] === BLOCK_EMPTY) {
			validMoves.push(dir);
		}
	}

	return validMoves;
};

GameState.prototype.makeMove = function(direction) {
	var pos = this.currentPlayer === 1 ? this.myPos : this.enemyPos;
	var cmd = direction_commands[direction];
	var newX = pos.x + cmd.x;
	var newY = pos.y + cmd.y;

	if (newX >= 0 && newX < MAP_SIZE && newY >= 0 && newY < MAP_SIZE && this.board[newX][newY] === BLOCK_EMPTY) {
		this.board[newX][newY] = this.currentPlayer;
		pos.x = newX;
		pos.y = newY;
		this.currentPlayer = -this.currentPlayer;
		return true;
	}
	return false;
};

GameState.prototype.isTerminal = function() {
	var myMoves = this.getValidMoves();
	if (myMoves.length === 0) {
		return true;
	}

	// Check if next player has moves
	this.currentPlayer = -this.currentPlayer;
	var opponentMoves = this.getValidMoves();
	this.currentPlayer = -this.currentPlayer;

	return opponentMoves.length === 0;
};

GameState.prototype.getWinner = function() {
	// Returns 1 if I win, -1 if enemy wins, 0 if draw
	var currentMoves = this.getValidMoves();

	this.currentPlayer = -this.currentPlayer;
	var opponentMoves = this.getValidMoves();
	this.currentPlayer = -this.currentPlayer;

	if (currentMoves.length === 0 && opponentMoves.length === 0) {
		return 0; // Draw
	}

	if (currentMoves.length === 0) {
		return -this.currentPlayer; // Current player loses
	}

	if (opponentMoves.length === 0) {
		return this.currentPlayer; // Current player wins
	}

	return null; // Game not over
};

// MCTS Node
function MCTSNode(state, parent, move) {
	this.state = state;
	this.parent = parent;
	this.move = move; // The move that led to this state
	this.children = [];
	this.visits = 0;
	this.wins = 0;
	this.untriedMoves = state.getValidMoves();
}

MCTSNode.prototype.selectChild = function() {
	// UCB1 selection
	var selected = null;
	var bestValue = -Infinity;

	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		var ucb1 = (child.wins / child.visits) +
		           EXPLORATION_CONSTANT * Math.sqrt(Math.log(this.visits) / child.visits);

		if (ucb1 > bestValue) {
			bestValue = ucb1;
			selected = child;
		}
	}

	return selected;
};

MCTSNode.prototype.addChild = function(move, state) {
	var child = new MCTSNode(state, this, move);
	this.untriedMoves.splice(this.untriedMoves.indexOf(move), 1);
	this.children.push(child);
	return child;
};

MCTSNode.prototype.update = function(result) {
	this.visits++;
	this.wins += result;
};

// Main MCTS algorithm
function MCTS(rootState, timeLimit) {
	var startTime = Date.now();
	var rootNode = new MCTSNode(rootState, null, null);
	var iterations = 0;

	while (Date.now() - startTime < timeLimit) {
		iterations++;

		// Selection
		var node = rootNode;
		var state = rootState.clone();

		while (node.untriedMoves.length === 0 && node.children.length > 0) {
			node = node.selectChild();
			state.makeMove(node.move);
		}

		// Expansion
		if (node.untriedMoves.length > 0) {
			var move = node.untriedMoves[Math.floor(Math.random() * node.untriedMoves.length)];
			state.makeMove(move);
			node = node.addChild(move, state);
		}

		// Simulation (rollout)
		var simulationState = state.clone();
		var depth = 0;
		var maxDepth = 50; // Prevent infinite loops

		while (!simulationState.isTerminal() && depth < maxDepth) {
			var moves = simulationState.getValidMoves();
			if (moves.length === 0) break;

			// Use heuristic for simulation instead of pure random
			var move = selectMoveWithHeuristic(simulationState, moves);
			simulationState.makeMove(move);
			depth++;
		}

		// Get result
		var winner = simulationState.getWinner();
		var result = winner === 1 ? 1 : (winner === -1 ? 0 : 0.5);

		// Backpropagation
		while (node !== null) {
			node.update(result);
			result = 1 - result; // Flip for opponent
			node = node.parent;
		}
	}

	console.log("MCTS iterations:", iterations);

	// Select best move based on visit count
	var bestChild = null;
	var mostVisits = -1;

	for (var i = 0; i < rootNode.children.length; i++) {
		var child = rootNode.children[i];
		if (child.visits > mostVisits) {
			mostVisits = child.visits;
			bestChild = child;
		}
	}

	return bestChild ? bestChild.move : null;
}

// Heuristic move selection for simulation
function selectMoveWithHeuristic(state, moves) {
	// Prefer moves that:
	// 1. Don't lead to corners
	// 2. Maximize available space
	// 3. Move towards center

	var bestMove = moves[0];
	var bestScore = -Infinity;

	for (var i = 0; i < moves.length; i++) {
		var move = moves[i];
		var pos = state.currentPlayer === 1 ? state.myPos : state.enemyPos;
		var cmd = direction_commands[move];
		var newX = pos.x + cmd.x;
		var newY = pos.y + cmd.y;

		var score = 0;

		// Count adjacent empty cells (freedom)
		var freedom = 0;
		for (var j = 0; j < directions.length; j++) {
			var checkCmd = direction_commands[directions[j]];
			var checkX = newX + checkCmd.x;
			var checkY = newY + checkCmd.y;
			if (checkX >= 0 && checkX < MAP_SIZE && checkY >= 0 && checkY < MAP_SIZE &&
			    state.board[checkX][checkY] === BLOCK_EMPTY) {
				freedom++;
			}
		}
		score += freedom * 10;

		// Prefer center over edges
		var distFromCenter = Math.abs(newX - MAP_SIZE/2) + Math.abs(newY - MAP_SIZE/2);
		score -= distFromCenter;

		if (score > bestScore) {
			bestScore = score;
			bestMove = move;
		}
	}

	return bestMove;
}

// Convert board format
function convertBoardFormat(board, myPos, enemyPos) {
	var newBoard = [];
	for (var i = 0; i < MAP_SIZE; i++) {
		newBoard[i] = [];
		for (var j = 0; j < MAP_SIZE; j++) {
			if (i === myPos.x && j === myPos.y) {
				newBoard[i][j] = 1;
			} else if (i === enemyPos.x && j === enemyPos.y) {
				newBoard[i][j] = -1;
			} else if (board[i][j] === BLOCK_EMPTY) {
				newBoard[i][j] = BLOCK_EMPTY;
			} else {
				newBoard[i][j] = -100; // Blocked
			}
		}
	}
	return newBoard;
}

// Main turn handler
function MyTurn() {
	console.log("\n=== My Turn (MCTS) ===");

	var convertedBoard = convertBoardFormat(board, myPosition, enemyPosition);
	var initialState = new GameState(convertedBoard, myPosition, enemyPosition, 1, index);

	var startTime = Date.now();
	var bestMove = MCTS(initialState, MAX_THINKING_TIME);
	var elapsed = Date.now() - startTime;

	if (bestMove === null) {
		// Fallback to any valid move
		var validMoves = initialState.getValidMoves();
		if (validMoves.length > 0) {
			bestMove = validMoves[0];
		}
	}

	console.log("MCTS decision time:", elapsed, "ms");
	console.log("Chosen move:", bestMove);

	if (bestMove !== null) {
		Command(bestMove);
	}
}

function TheirTurn() {
	// Do nothing
}
