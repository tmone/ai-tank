#!/usr/bin/env node
// ==================== TRAINING DATA COLLECTOR =====================
// Collect high-quality training data from expert bots playing
// This creates conversation-style training data for LLM finetuning
//
// Usage: node DataCollector.js --expert <bot> --matches <num>
// Example: node DataCollector.js --expert P_AI_MCTS.js --matches 100
// ==================================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_PORT = 3011;
const SERVER_SCRIPT = './Server/Server.js';
const ARENA_DIR = './Arena';
const OUTPUT_DIR = './TrainingData/LLM_Training';
const RAW_DATA_DIR = './TrainingData/LLM_Training/raw';

// Parse arguments
const args = process.argv.slice(2);
const config = {
	expertBot: 'P_AI_MCTS.js',
	opponentBot: 'P2.js',
	matches: 10,
	port: DEFAULT_PORT,
	verbose: false
};

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--expert' && i + 1 < args.length) {
		config.expertBot = args[++i];
	} else if (args[i] === '--opponent' && i + 1 < args.length) {
		config.opponentBot = args[++i];
	} else if (args[i] === '--matches' && i + 1 < args.length) {
		config.matches = parseInt(args[++i]);
	} else if (args[i] === '--verbose') {
		config.verbose = true;
	}
}

// Constants for game
const MAP_SIZE = 11;
const BLOCK_EMPTY = 0;
const BLOCK_PLAYER_1 = 1;
const BLOCK_PLAYER_1_TRAIL = 2;
const BLOCK_PLAYER_2 = 3;
const BLOCK_PLAYER_2_TRAIL = 4;
const BLOCK_OBSTACLE = 5;

const DIRECTION_LEFT = 1;
const DIRECTION_UP = 2;
const DIRECTION_RIGHT = 3;
const DIRECTION_DOWN = 4;

const DIRECTION_NAMES = {
	1: 'LEFT',
	2: 'UP',
	3: 'RIGHT',
	4: 'DOWN'
};

// Ensure directories
function ensureDirectories() {
	[OUTPUT_DIR, RAW_DATA_DIR].forEach(dir => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});
}

// Parse replay string from server
function parseReplay(replayString) {
	let pos = 0;
	const result = {
		initialMap: [],
		firstPlayer: 0,
		moves: []
	};

	// First character is winner
	const winner = parseInt(replayString[pos++]);

	// Next MAP_SIZE * MAP_SIZE characters are the initial map
	for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
		result.initialMap.push(parseInt(replayString[pos++]));
	}

	// Next character is who goes first
	result.firstPlayer = parseInt(replayString[pos++]);

	// Rest are moves
	while (pos < replayString.length) {
		const move = parseInt(replayString[pos++]);
		if (!isNaN(move)) {
			result.moves.push(move);
		}
	}

	result.winner = winner;
	return result;
}

// Create board state representation
function createBoardState(map) {
	let board = '';
	for (let y = 0; y < MAP_SIZE; y++) {
		for (let x = 0; x < MAP_SIZE; x++) {
			const cell = map[y * MAP_SIZE + x];
			if (cell === BLOCK_EMPTY) {
				board += '. ';
			} else if (cell === BLOCK_PLAYER_1) {
				board += 'A ';
			} else if (cell === BLOCK_PLAYER_2) {
				board += 'B ';
			} else if (cell === BLOCK_PLAYER_1_TRAIL) {
				board += 'a ';
			} else if (cell === BLOCK_PLAYER_2_TRAIL) {
				board += 'b ';
			} else if (cell === BLOCK_OBSTACLE) {
				board += '# ';
			} else {
				board += '? ';
			}
		}
		board += '\n';
	}
	return board;
}

// Simulate game to get board states
function simulateGame(replay) {
	const map = [...replay.initialMap];
	const states = [];

	let currentPlayer = replay.firstPlayer;
	let positions = {
		1: null,
		2: null
	};

	// Find initial positions
	for (let i = 0; i < map.length; i++) {
		if (map[i] === BLOCK_PLAYER_1) {
			positions[1] = { x: i % MAP_SIZE, y: Math.floor(i / MAP_SIZE) };
		} else if (map[i] === BLOCK_PLAYER_2) {
			positions[2] = { x: i % MAP_SIZE, y: Math.floor(i / MAP_SIZE) };
		}
	}

	// Record initial state
	states.push({
		player: currentPlayer,
		board: createBoardState(map),
		move: null,
		positions: { ...positions },
		mapCopy: [...map]
	});

	// Simulate each move
	for (let i = 0; i < replay.moves.length; i++) {
		const move = replay.moves[i];
		const pos = positions[currentPlayer];

		let newX = pos.x;
		let newY = pos.y;

		switch (move) {
			case DIRECTION_LEFT: newX--; break;
			case DIRECTION_UP: newY--; break;
			case DIRECTION_RIGHT: newX++; break;
			case DIRECTION_DOWN: newY++; break;
		}

		// Update map
		const oldPos = pos.y * MAP_SIZE + pos.x;
		const newPos = newY * MAP_SIZE + newX;

		if (currentPlayer === 1) {
			map[oldPos] = BLOCK_PLAYER_1_TRAIL;
			map[newPos] = BLOCK_PLAYER_1;
		} else {
			map[oldPos] = BLOCK_PLAYER_2_TRAIL;
			map[newPos] = BLOCK_PLAYER_2;
		}

		positions[currentPlayer] = { x: newX, y: newY };

		// Record state after move
		states.push({
			player: currentPlayer,
			board: createBoardState(map),
			move: move,
			moveName: DIRECTION_NAMES[move],
			positions: JSON.parse(JSON.stringify(positions)),
			mapCopy: [...map]
		});

		// Switch player
		currentPlayer = currentPlayer === 1 ? 2 : 1;
	}

	return states;
}

// Get valid moves for a position
function getValidMoves(map, pos) {
	const moves = [];
	const directions = [
		{ dir: DIRECTION_LEFT, dx: -1, dy: 0, name: 'LEFT' },
		{ dir: DIRECTION_UP, dx: 0, dy: -1, name: 'UP' },
		{ dir: DIRECTION_RIGHT, dx: 1, dy: 0, name: 'RIGHT' },
		{ dir: DIRECTION_DOWN, dx: 0, dy: 1, name: 'DOWN' }
	];

	for (const d of directions) {
		const newX = pos.x + d.dx;
		const newY = pos.y + d.dy;
		if (newX >= 0 && newX < MAP_SIZE && newY >= 0 && newY < MAP_SIZE) {
			const cell = map[newY * MAP_SIZE + newX];
			if (cell === BLOCK_EMPTY) {
				moves.push({ direction: d.dir, name: d.name, x: newX, y: newY });
			}
		}
	}

	return moves;
}

// Convert game to training examples
function gameToTrainingExamples(replay, expertPlayer) {
	const states = simulateGame(replay);
	const examples = [];

	for (let i = 0; i < states.length; i++) {
		const state = states[i];

		// Only create examples for expert player's moves
		if (state.player === expertPlayer && state.move !== null) {
			const validMoves = getValidMoves(state.mapCopy, state.positions[state.player]);

			if (validMoves.length === 0) continue;

			const validMovesStr = validMoves.map(m => m.name).join(', ');

			// Create prompt
			const prompt = `You are playing a strategic tank game on an 11x11 grid.

Game Rules:
- Two players take turns moving (LEFT/RIGHT/UP/DOWN)
- You cannot move to cells you or your opponent have visited
- The game ends when a player cannot move (they lose)
- Strategy: Control more space, cut off opponent, avoid dead ends

Current Board (A=you, B=opponent, a/b=trails, #=obstacle, .=empty):
${state.board}

Your position: (${state.positions[state.player].x}, ${state.positions[state.player].y})
Opponent position: (${state.positions[3 - state.player].x}, ${state.positions[3 - state.player].y})

Valid moves: ${validMovesStr}

Choose the BEST move to win. Consider:
1. Controlling more territory
2. Cutting off opponent's escape routes
3. Avoiding corners and dead ends
4. Maximizing your future move options

Respond with ONLY the direction: LEFT, RIGHT, UP, or DOWN`;

			examples.push({
				prompt: prompt,
				response: state.moveName,
				metadata: {
					moveNumber: i,
					validMoves: validMovesStr,
					boardState: state.board
				}
			});
		}
	}

	return examples;
}

// Run a match and collect data
async function runMatch(expertBot, opponentBot, matchNum) {
	return new Promise((resolve, reject) => {
		console.log(`\n[Match ${matchNum}] Starting: ${expertBot} vs ${opponentBot}`);

		const server = spawn('node', [SERVER_SCRIPT, '-p', config.port.toString()]);
		let serverOutput = '';
		let matchResult = null;

		server.stdout.on('data', (data) => {
			const output = data.toString();
			serverOutput += output;

			if (output.trim().length > 0) {
				const firstChar = output.trim()[0];
				if (firstChar === '1' || firstChar === '2' || firstChar === '3') {
					matchResult = {
						winner: parseInt(firstChar),
						replay: output.trim()
					};
				}
			}
		});

		if (config.verbose) {
			server.stderr.on('data', (data) => {
				console.error(`[Server] ${data}`);
			});
		}

		setTimeout(() => {
			const p1 = spawn('node', [
				path.join(ARENA_DIR, expertBot),
				'-h', '127.0.0.1',
				'-p', config.port.toString()
			]);

			if (config.verbose) {
				p1.stdout.on('data', (data) => process.stdout.write(`[Expert] ${data}`));
			}

			setTimeout(() => {
				const p2 = spawn('node', [
					path.join(ARENA_DIR, opponentBot),
					'-h', '127.0.0.1',
					'-p', config.port.toString()
				]);

				if (config.verbose) {
					p2.stdout.on('data', (data) => process.stdout.write(`[Opponent] ${data}`));
				}

				const timeout = setTimeout(() => {
					p1.kill();
					p2.kill();
					server.kill();
					reject(new Error('Match timeout'));
				}, 120000);

				server.on('close', () => {
					clearTimeout(timeout);
					p1.kill();
					p2.kill();

					if (matchResult) {
						const winnerText = matchResult.winner === 1 ? 'Expert' :
						                   matchResult.winner === 2 ? 'Opponent' : 'Draw';
						console.log(`[Match ${matchNum}] Complete: Winner = ${winnerText}`);
						resolve(matchResult);
					} else {
						reject(new Error('No match result'));
					}
				});
			}, 500);
		}, 1000);
	});
}

// Main execution
async function main() {
	console.log('========== LLM TRAINING DATA COLLECTOR ==========');
	console.log(`Configuration:`);
	console.log(`  Expert Bot: ${config.expertBot}`);
	console.log(`  Opponent Bot: ${config.opponentBot}`);
	console.log(`  Matches: ${config.matches}`);
	console.log('=================================================\n');

	ensureDirectories();

	let allExamples = [];
	let successfulMatches = 0;
	let expertWins = 0;

	for (let i = 1; i <= config.matches; i++) {
		try {
			const result = await runMatch(config.expertBot, config.opponentBot, i);

			// Parse replay
			const replay = parseReplay(result.replay);

			// Determine which player was the expert (player 1)
			const expertPlayer = 1;

			// Only collect data from winning games
			if (result.winner === expertPlayer) {
				const examples = gameToTrainingExamples(replay, expertPlayer);
				allExamples.push(...examples);
				expertWins++;
				console.log(`  → Collected ${examples.length} training examples`);
			} else {
				console.log(`  → Skipping (expert lost)`);
			}

			successfulMatches++;

			// Small delay between matches
			await new Promise(resolve => setTimeout(resolve, 2000));

		} catch (error) {
			console.error(`[Match ${i}] Failed:`, error.message);
		}
	}

	if (allExamples.length > 0) {
		// Save training data
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const outputFile = path.join(OUTPUT_DIR, `training_data_${timestamp}.jsonl`);

		// Save as JSONL (one JSON per line)
		const jsonlData = allExamples.map(ex => JSON.stringify({
			messages: [
				{ role: 'user', content: ex.prompt },
				{ role: 'assistant', content: ex.response }
			]
		})).join('\n');

		fs.writeFileSync(outputFile, jsonlData);

		console.log('\n========== COLLECTION COMPLETE ==========');
		console.log(`Total matches: ${successfulMatches}`);
		console.log(`Expert wins: ${expertWins} (${(expertWins/successfulMatches*100).toFixed(1)}%)`);
		console.log(`Training examples: ${allExamples.length}`);
		console.log(`Output file: ${outputFile}`);
		console.log('==========================================\n');

		// Save summary
		const summary = {
			timestamp: new Date().toISOString(),
			expertBot: config.expertBot,
			opponentBot: config.opponentBot,
			totalMatches: successfulMatches,
			expertWins: expertWins,
			winRate: expertWins / successfulMatches,
			totalExamples: allExamples.length,
			outputFile: outputFile
		};

		fs.writeFileSync(
			path.join(OUTPUT_DIR, `summary_${timestamp}.json`),
			JSON.stringify(summary, null, 2)
		);

	} else {
		console.error('No training data collected!');
		process.exit(1);
	}
}

main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
