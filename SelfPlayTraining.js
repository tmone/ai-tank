#!/usr/bin/env node
// ==================== SELF-PLAY TRAINING SYSTEM =====================
// This system runs bots against each other to:
// 1. Generate training data
// 2. Evaluate bot performance
// 3. Create replay datasets
//
// Usage: node SelfPlayTraining.js --player1 <bot1> --player2 <bot2> --matches <num>
// Example: node SelfPlayTraining.js --player1 P1.js --player2 P2.js --matches 10
// ====================================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_PORT = 3011;
const SERVER_SCRIPT = './Server/Server.js';
const ARENA_DIR = './Arena';
const RESULTS_DIR = './TrainingData';
const REPLAY_DIR = './TrainingData/Replays';

// Command line arguments
const args = process.argv.slice(2);
const config = parseArguments(args);

function parseArguments(args) {
	const config = {
		player1: 'P1.js',
		player2: 'P2.js',
		matches: 1,
		port: DEFAULT_PORT,
		verbose: false,
		saveReplays: true
	};

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--player1' && i + 1 < args.length) {
			config.player1 = args[++i];
		} else if (args[i] === '--player2' && i + 1 < args.length) {
			config.player2 = args[++i];
		} else if (args[i] === '--matches' && i + 1 < args.length) {
			config.matches = parseInt(args[++i]);
		} else if (args[i] === '--port' && i + 1 < args.length) {
			config.port = parseInt(args[++i]);
		} else if (args[i] === '--verbose') {
			config.verbose = true;
		} else if (args[i] === '--no-replay') {
			config.saveReplays = false;
		}
	}

	return config;
}

// Ensure directories exist
function ensureDirectories() {
	if (!fs.existsSync(RESULTS_DIR)) {
		fs.mkdirSync(RESULTS_DIR, { recursive: true });
	}
	if (!fs.existsSync(REPLAY_DIR)) {
		fs.mkdirSync(REPLAY_DIR, { recursive: true });
	}
}

// Run a single match
function runMatch(player1Path, player2Path, port) {
	return new Promise((resolve, reject) => {
		console.log(`\nStarting match: ${path.basename(player1Path)} vs ${path.basename(player2Path)}`);

		// Start server
		const server = spawn('node', [SERVER_SCRIPT, '-p', port.toString()]);

		let serverOutput = '';
		let matchResult = null;

		server.stdout.on('data', (data) => {
			const output = data.toString();
			serverOutput += output;
			if (config.verbose) {
				process.stdout.write(`[Server] ${output}`);
			}

			// Check if match ended
			if (output.trim().length > 0) {
				// Server outputs winner + replay data
				const firstChar = output.trim()[0];
				if (firstChar === '1' || firstChar === '2' || firstChar === '3') {
					matchResult = {
						winner: parseInt(firstChar),
						replay: output.trim()
					};
				}
			}
		});

		server.stderr.on('data', (data) => {
			if (config.verbose) {
				console.error(`[Server Error] ${data}`);
			}
		});

		// Wait a bit for server to start
		setTimeout(() => {
			// Start player 1
			const p1 = spawn('node', [
				path.join(ARENA_DIR, player1Path),
				'-h', '127.0.0.1',
				'-p', port.toString()
			]);

			if (config.verbose) {
				p1.stdout.on('data', (data) => {
					process.stdout.write(`[P1] ${data}`);
				});
				p1.stderr.on('data', (data) => {
					console.error(`[P1 Error] ${data}`);
				});
			}

			// Start player 2
			setTimeout(() => {
				const p2 = spawn('node', [
					path.join(ARENA_DIR, player2Path),
					'-h', '127.0.0.1',
					'-p', port.toString()
				]);

				if (config.verbose) {
					p2.stdout.on('data', (data) => {
						process.stdout.write(`[P2] ${data}`);
					});
					p2.stderr.on('data', (data) => {
						console.error(`[P2 Error] ${data}`);
					});
				}

				// Set timeout for match completion
				const matchTimeout = setTimeout(() => {
					console.log('Match timeout - killing processes');
					p1.kill();
					p2.kill();
					server.kill();
					reject(new Error('Match timeout'));
				}, 120000); // 2 minutes

				// Wait for server to finish
				server.on('close', (code) => {
					clearTimeout(matchTimeout);
					p1.kill();
					p2.kill();

					if (matchResult) {
						resolve(matchResult);
					} else {
						reject(new Error('No match result'));
					}
				});
			}, 500);
		}, 1000);
	});
}

// Save replay data
function saveReplay(matchNum, result, player1, player2) {
	if (!config.saveReplays) return;

	const timestamp = new Date().toISOString().replace(/:/g, '-');
	const filename = `match_${matchNum}_${timestamp}.txt`;
	const filepath = path.join(REPLAY_DIR, filename);

	const replayData = {
		matchNumber: matchNum,
		timestamp: new Date().toISOString(),
		player1: player1,
		player2: player2,
		winner: result.winner,
		replayString: result.replay
	};

	fs.writeFileSync(filepath, JSON.stringify(replayData, null, 2));
}

// Save summary statistics
function saveSummary(results, player1, player2) {
	const timestamp = new Date().toISOString().replace(/:/g, '-');
	const filename = `summary_${timestamp}.json`;
	const filepath = path.join(RESULTS_DIR, filename);

	const summary = {
		timestamp: new Date().toISOString(),
		player1: player1,
		player2: player2,
		totalMatches: results.length,
		player1Wins: results.filter(r => r.winner === 1).length,
		player2Wins: results.filter(r => r.winner === 2).length,
		draws: results.filter(r => r.winner === 3).length,
		results: results
	};

	fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
	console.log(`\nSummary saved to: ${filepath}`);

	return summary;
}

// Print results
function printResults(summary) {
	console.log('\n========== MATCH RESULTS ==========');
	console.log(`Player 1 (${summary.player1}): ${summary.player1Wins} wins`);
	console.log(`Player 2 (${summary.player2}): ${summary.player2Wins} wins`);
	console.log(`Draws: ${summary.draws}`);
	console.log(`Total matches: ${summary.totalMatches}`);

	const p1WinRate = (summary.player1Wins / summary.totalMatches * 100).toFixed(1);
	const p2WinRate = (summary.player2Wins / summary.totalMatches * 100).toFixed(1);

	console.log(`\nWin rates:`);
	console.log(`Player 1: ${p1WinRate}%`);
	console.log(`Player 2: ${p2WinRate}%`);
	console.log('===================================\n');
}

// Main execution
async function main() {
	console.log('========== SELF-PLAY TRAINING SYSTEM ==========');
	console.log(`Configuration:`);
	console.log(`  Player 1: ${config.player1}`);
	console.log(`  Player 2: ${config.player2}`);
	console.log(`  Matches: ${config.matches}`);
	console.log(`  Port: ${config.port}`);
	console.log(`  Save replays: ${config.saveReplays}`);
	console.log('===============================================\n');

	ensureDirectories();

	const results = [];
	let successfulMatches = 0;

	for (let i = 1; i <= config.matches; i++) {
		try {
			console.log(`\n[${i}/${config.matches}] Running match...`);

			const result = await runMatch(config.player1, config.player2, config.port);

			const winnerText = result.winner === 1 ? 'Player 1' :
			                   result.winner === 2 ? 'Player 2' : 'Draw';

			console.log(`Match ${i} complete: Winner = ${winnerText}`);

			results.push({
				matchNumber: i,
				winner: result.winner,
				timestamp: new Date().toISOString()
			});

			saveReplay(i, result, config.player1, config.player2);
			successfulMatches++;

			// Small delay between matches
			await new Promise(resolve => setTimeout(resolve, 2000));

		} catch (error) {
			console.error(`Match ${i} failed:`, error.message);
		}
	}

	if (successfulMatches > 0) {
		const summary = saveSummary(results, config.player1, config.player2);
		printResults(summary);
	} else {
		console.error('No successful matches completed.');
		process.exit(1);
	}
}

// Run the training system
main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
