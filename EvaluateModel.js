#!/usr/bin/env node
// ==================== MODEL EVALUATION SYSTEM =====================
// Comprehensive evaluation of AI models
//
// Usage: node EvaluateModel.js --model <model_name> --baseline <baseline_bot>
// Example: node EvaluateModel.js --model P_AI_Ollama.js --baseline P_AI_MCTS.js
// ==================================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const args = process.argv.slice(2);
const config = {
	modelBot: 'P_AI_Ollama.js',
	baselineBot: 'P_AI_MCTS.js',
	opponents: ['P1.js', 'P2.js', 'P_AI_MCTS.js'],
	matchesPerOpponent: 20,
	port: 3011,
	verbose: false
};

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--model' && i + 1 < args.length) {
		config.modelBot = args[++i];
	} else if (args[i] === '--baseline' && i + 1 < args.length) {
		config.baselineBot = args[++i];
	} else if (args[i] === '--matches' && i + 1 < args.length) {
		config.matchesPerOpponent = parseInt(args[++i]);
	} else if (args[i] === '--verbose') {
		config.verbose = true;
	}
}

const SERVER_SCRIPT = './Server.js';
const ARENA_DIR = './Arena';
const RESULTS_DIR = './EvaluationResults';

// Ensure directories
if (!fs.existsSync(RESULTS_DIR)) {
	fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Run a match
async function runMatch(player1, player2, matchNum) {
	return new Promise((resolve, reject) => {
		const server = spawn('node', [SERVER_SCRIPT, '-p', config.port.toString()]);
		let serverOutput = '';
		let matchResult = null;
		let startTime = Date.now();

		server.stdout.on('data', (data) => {
			const output = data.toString();
			serverOutput += output;

			if (output.trim().length > 0) {
				const firstChar = output.trim()[0];
				if (firstChar === '1' || firstChar === '2' || firstChar === '3') {
					matchResult = {
						winner: parseInt(firstChar),
						replay: output.trim(),
						duration: Date.now() - startTime
					};
				}
			}
		});

		setTimeout(() => {
			const p1 = spawn('node', [
				path.join(ARENA_DIR, player1),
				'-h', '127.0.0.1',
				'-p', config.port.toString()
			]);

			let p1Logs = '';
			if (config.verbose) {
				p1.stdout.on('data', (data) => {
					p1Logs += data.toString();
					process.stdout.write(`[P1] ${data}`);
				});
			} else {
				p1.stdout.on('data', (data) => { p1Logs += data.toString(); });
			}

			setTimeout(() => {
				const p2 = spawn('node', [
					path.join(ARENA_DIR, player2),
					'-h', '127.0.0.1',
					'-p', config.port.toString()
				]);

				let p2Logs = '';
				if (config.verbose) {
					p2.stdout.on('data', (data) => {
						p2Logs += data.toString();
						process.stdout.write(`[P2] ${data}`);
					});
				} else {
					p2.stdout.on('data', (data) => { p2Logs += data.toString(); });
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
						matchResult.player1Logs = p1Logs;
						matchResult.player2Logs = p2Logs;
						resolve(matchResult);
					} else {
						reject(new Error('No match result'));
					}
				});
			}, 500);
		}, 1000);
	});
}

// Calculate statistics
function calculateStats(results) {
	const total = results.length;
	const wins = results.filter(r => r.winner === 1).length;
	const losses = results.filter(r => r.winner === 2).length;
	const draws = results.filter(r => r.winner === 3).length;

	const durations = results.map(r => r.duration);
	const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

	return {
		total,
		wins,
		losses,
		draws,
		winRate: (wins / total * 100).toFixed(1),
		lossRate: (losses / total * 100).toFixed(1),
		drawRate: (draws / total * 100).toFixed(1),
		avgDuration: Math.round(avgDuration / 1000) // seconds
	};
}

// Run evaluation
async function evaluate() {
	console.log('╔════════════════════════════════════════════════════════╗');
	console.log('║            MODEL EVALUATION SYSTEM                     ║');
	console.log('╚════════════════════════════════════════════════════════╝');
	console.log();
	console.log(`Model to evaluate: ${config.modelBot}`);
	console.log(`Baseline: ${config.baselineBot}`);
	console.log(`Opponents: ${config.opponents.join(', ')}`);
	console.log(`Matches per opponent: ${config.matchesPerOpponent}`);
	console.log();

	const allResults = {
		modelBot: config.modelBot,
		baselineBot: config.baselineBot,
		timestamp: new Date().toISOString(),
		matchesByOpponent: {}
	};

	// Test against each opponent
	for (const opponent of config.opponents) {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`Testing against: ${opponent}`);
		console.log('='.repeat(60));

		const modelResults = [];
		const baselineResults = [];

		// Model vs Opponent
		console.log(`\n[${config.modelBot}] vs [${opponent}]:`);
		for (let i = 1; i <= config.matchesPerOpponent; i++) {
			try {
				process.stdout.write(`  Match ${i}/${config.matchesPerOpponent}... `);
				const result = await runMatch(config.modelBot, opponent, i);
				modelResults.push(result);
				const winnerText = result.winner === 1 ? 'Win' :
				                   result.winner === 2 ? 'Loss' : 'Draw';
				console.log(winnerText);

				await new Promise(resolve => setTimeout(resolve, 1500));
			} catch (error) {
				console.log(`Failed: ${error.message}`);
			}
		}

		// Baseline vs Opponent (for comparison)
		console.log(`\n[${config.baselineBot}] vs [${opponent}]:`);
		for (let i = 1; i <= config.matchesPerOpponent; i++) {
			try {
				process.stdout.write(`  Match ${i}/${config.matchesPerOpponent}... `);
				const result = await runMatch(config.baselineBot, opponent, i);
				baselineResults.push(result);
				const winnerText = result.winner === 1 ? 'Win' :
				                   result.winner === 2 ? 'Loss' : 'Draw';
				console.log(winnerText);

				await new Promise(resolve => setTimeout(resolve, 1500));
			} catch (error) {
				console.log(`Failed: ${error.message}`);
			}
		}

		// Calculate stats
		const modelStats = calculateStats(modelResults);
		const baselineStats = calculateStats(baselineResults);

		allResults.matchesByOpponent[opponent] = {
			model: modelStats,
			baseline: baselineStats
		};

		// Print summary
		console.log('\n' + '-'.repeat(60));
		console.log('RESULTS:');
		console.log('-'.repeat(60));
		console.log(`${config.modelBot}:`);
		console.log(`  Win Rate: ${modelStats.winRate}% (${modelStats.wins}/${modelStats.total})`);
		console.log(`  Loss Rate: ${modelStats.lossRate}%`);
		console.log(`  Draw Rate: ${modelStats.drawRate}%`);
		console.log(`  Avg Duration: ${modelStats.avgDuration}s`);
		console.log();
		console.log(`${config.baselineBot} (baseline):`);
		console.log(`  Win Rate: ${baselineStats.winRate}% (${baselineStats.wins}/${baselineStats.total})`);
		console.log(`  Loss Rate: ${baselineStats.lossRate}%`);
		console.log(`  Draw Rate: ${baselineStats.drawRate}%`);
		console.log(`  Avg Duration: ${baselineStats.avgDuration}s`);
		console.log('-'.repeat(60));
	}

	// Overall summary
	console.log('\n\n');
	console.log('╔════════════════════════════════════════════════════════╗');
	console.log('║              EVALUATION SUMMARY                        ║');
	console.log('╚════════════════════════════════════════════════════════╝');
	console.log();

	let totalModelWins = 0;
	let totalModelGames = 0;
	let totalBaselineWins = 0;
	let totalBaselineGames = 0;

	for (const [opponent, stats] of Object.entries(allResults.matchesByOpponent)) {
		totalModelWins += stats.model.wins;
		totalModelGames += stats.model.total;
		totalBaselineWins += stats.baseline.wins;
		totalBaselineGames += stats.baseline.total;

		console.log(`vs ${opponent}:`);
		console.log(`  ${config.modelBot}: ${stats.model.winRate}%`);
		console.log(`  ${config.baselineBot}: ${stats.baseline.winRate}%`);
		console.log();
	}

	const overallModelWinRate = (totalModelWins / totalModelGames * 100).toFixed(1);
	const overallBaselineWinRate = (totalBaselineWins / totalBaselineGames * 100).toFixed(1);

	console.log('-'.repeat(60));
	console.log('OVERALL:');
	console.log(`  ${config.modelBot}: ${overallModelWinRate}% (${totalModelWins}/${totalModelGames})`);
	console.log(`  ${config.baselineBot}: ${overallBaselineWinRate}% (${totalBaselineWins}/${totalBaselineGames})`);
	console.log('-'.repeat(60));

	// Verdict
	console.log();
	console.log('VERDICT:');
	if (parseFloat(overallModelWinRate) > parseFloat(overallBaselineWinRate)) {
		console.log(`  ✅ ${config.modelBot} OUTPERFORMS baseline by ${(parseFloat(overallModelWinRate) - parseFloat(overallBaselineWinRate)).toFixed(1)}%`);
	} else if (parseFloat(overallModelWinRate) < parseFloat(overallBaselineWinRate)) {
		console.log(`  ❌ ${config.modelBot} UNDERPERFORMS baseline by ${(parseFloat(overallBaselineWinRate) - parseFloat(overallModelWinRate)).toFixed(1)}%`);
	} else {
		console.log(`  ➖ ${config.modelBot} performs EQUAL to baseline`);
	}

	// Save results
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const outputFile = path.join(RESULTS_DIR, `evaluation_${timestamp}.json`);
	allResults.overallModelWinRate = overallModelWinRate;
	allResults.overallBaselineWinRate = overallBaselineWinRate;
	fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2));

	console.log();
	console.log(`Results saved to: ${outputFile}`);
	console.log();
}

// Main
evaluate().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
