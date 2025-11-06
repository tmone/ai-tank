#!/usr/bin/env node
// ==================== TRAINING DEBUG SYSTEM =====================
// Comprehensive debugging tool for AI training pipeline
//
// Usage: node DebugTraining.js --mode <mode> [options]
//
// Modes:
//   collect     - Debug data collection
//   training    - Debug self-play training
//   evaluate    - Debug model evaluation
//   finetune    - Debug finetuning process
//   pipeline    - Debug entire pipeline
//   stats       - Show training statistics
// ================================================================

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const args = process.argv.slice(2);
const config = {
    mode: 'pipeline',
    verbose: true,
    logFile: './debug_training.log',
    dataDir: './TrainingData',
    expert: 'P_AI_MCTS.js',
    matches: 5, // Small number for quick debugging
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && i + 1 < args.length) {
        config.mode = args[++i];
    } else if (args[i] === '--expert' && i + 1 < args.length) {
        config.expert = args[++i];
    } else if (args[i] === '--matches' && i + 1 < args.length) {
        config.matches = parseInt(args[++i]);
    } else if (args[i] === '--quiet') {
        config.verbose = false;
    }
}

// Logging utilities
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data
    };

    // Console output with colors
    const colors = {
        INFO: '\x1b[36m',    // Cyan
        SUCCESS: '\x1b[32m', // Green
        WARNING: '\x1b[33m', // Yellow
        ERROR: '\x1b[31m',   // Red
        DEBUG: '\x1b[35m'    // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level] || reset;

    console.log(`${color}[${level}]${reset} ${timestamp} - ${message}`);
    if (data && config.verbose) {
        console.log(JSON.stringify(data, null, 2));
    }

    // File logging
    fs.appendFileSync(config.logFile, JSON.stringify(logEntry) + '\n');
}

// Check system requirements
async function checkSystemRequirements() {
    log('INFO', 'Checking system requirements...');
    const checks = [];

    // Check Node.js version
    const nodeVersion = process.version;
    checks.push({
        component: 'Node.js',
        status: 'OK',
        version: nodeVersion
    });

    // Check if data directories exist
    const dirs = [
        './TrainingData',
        './TrainingData/LLM_Training',
        './TrainingData/Replays',
        './Arena',
        './EvaluationResults'
    ];

    for (const dir of dirs) {
        const exists = fs.existsSync(dir);
        checks.push({
            component: `Directory: ${dir}`,
            status: exists ? 'OK' : 'MISSING',
            action: exists ? null : 'Will create'
        });

        if (!exists) {
            fs.mkdirSync(dir, { recursive: true });
            log('SUCCESS', `Created directory: ${dir}`);
        }
    }

    // Check if bot files exist
    const bots = ['P1.js', 'P2.js', 'P_AI_MCTS.js', 'P_AI_LLM.js', 'P_AI_Ollama.js'];
    for (const bot of bots) {
        const botPath = path.join('./Arena', bot);
        const exists = fs.existsSync(botPath);
        checks.push({
            component: `Bot: ${bot}`,
            status: exists ? 'OK' : 'MISSING'
        });
    }

    // Check Ollama (optional)
    try {
        const { execSync } = require('child_process');
        const ollamaVersion = execSync('ollama --version', { encoding: 'utf8' });
        checks.push({
            component: 'Ollama',
            status: 'OK',
            version: ollamaVersion.trim()
        });
    } catch (e) {
        checks.push({
            component: 'Ollama',
            status: 'NOT INSTALLED',
            warning: 'Required for LLM training'
        });
    }

    log('SUCCESS', 'System requirements check complete', checks);
    return checks;
}

// Debug data collection
async function debugDataCollection() {
    log('INFO', '========== DEBUG: DATA COLLECTION ==========');

    // Check if expert bot exists
    const expertPath = path.join('./Arena', config.expert);
    if (!fs.existsSync(expertPath)) {
        log('ERROR', `Expert bot not found: ${expertPath}`);
        return false;
    }

    log('INFO', `Testing data collection with ${config.matches} matches...`);
    log('INFO', `Expert bot: ${config.expert}`);

    return new Promise((resolve) => {
        const collector = spawn('node', [
            './DataCollector.js',
            '--expert', config.expert,
            '--matches', config.matches.toString(),
            '--verbose'
        ]);

        let output = '';
        let errorOutput = '';

        collector.stdout.on('data', (data) => {
            output += data.toString();
            if (config.verbose) {
                process.stdout.write(data);
            }
        });

        collector.stderr.on('data', (data) => {
            errorOutput += data.toString();
            log('ERROR', data.toString());
        });

        collector.on('close', (code) => {
            log('INFO', `Data collector exited with code ${code}`);

            // Analyze collected data
            if (code === 0) {
                analyzeCollectedData();
                resolve(true);
            } else {
                log('ERROR', 'Data collection failed', {
                    exitCode: code,
                    stderr: errorOutput
                });
                resolve(false);
            }
        });
    });
}

// Analyze collected training data
function analyzeCollectedData() {
    log('INFO', '========== ANALYZING COLLECTED DATA ==========');

    const dataDir = './TrainingData/LLM_Training';
    if (!fs.existsSync(dataDir)) {
        log('WARNING', 'Training data directory does not exist');
        return;
    }

    // Find all training data files
    const files = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('training_data_') && f.endsWith('.jsonl'))
        .sort()
        .reverse();

    if (files.length === 0) {
        log('WARNING', 'No training data files found');
        return;
    }

    log('INFO', `Found ${files.length} training data files`);

    // Analyze most recent file
    const latestFile = path.join(dataDir, files[0]);
    log('INFO', `Analyzing latest file: ${files[0]}`);

    const content = fs.readFileSync(latestFile, 'utf8');
    const lines = content.trim().split('\n');

    const stats = {
        totalExamples: lines.length,
        validExamples: 0,
        invalidExamples: 0,
        moveDistribution: { LEFT: 0, RIGHT: 0, UP: 0, DOWN: 0 },
        avgPromptLength: 0,
        sampleExamples: []
    };

    let totalPromptLength = 0;

    for (let i = 0; i < lines.length; i++) {
        try {
            const example = JSON.parse(lines[i]);
            stats.validExamples++;

            if (example.messages && example.messages.length >= 2) {
                const response = example.messages[1].content;
                if (stats.moveDistribution[response] !== undefined) {
                    stats.moveDistribution[response]++;
                }

                const promptLength = example.messages[0].content.length;
                totalPromptLength += promptLength;

                // Store first 3 examples
                if (stats.sampleExamples.length < 3) {
                    stats.sampleExamples.push({
                        exampleNumber: i + 1,
                        promptLength,
                        response,
                        promptPreview: example.messages[0].content.substring(0, 200) + '...'
                    });
                }
            }
        } catch (e) {
            stats.invalidExamples++;
        }
    }

    stats.avgPromptLength = Math.round(totalPromptLength / stats.validExamples);

    log('SUCCESS', 'Data analysis complete', stats);

    // Check for issues
    const warnings = [];
    if (stats.validExamples < 50) {
        warnings.push('Low number of examples (< 50). Consider collecting more data.');
    }

    const moves = Object.values(stats.moveDistribution);
    const maxMove = Math.max(...moves);
    const minMove = Math.min(...moves);
    if (maxMove > minMove * 3) {
        warnings.push('Unbalanced move distribution. Model may be biased.');
    }

    if (warnings.length > 0) {
        log('WARNING', 'Data quality issues detected', warnings);
    }

    return stats;
}

// Debug self-play training
async function debugSelfPlayTraining() {
    log('INFO', '========== DEBUG: SELF-PLAY TRAINING ==========');

    log('INFO', `Running ${config.matches} self-play matches...`);

    return new Promise((resolve) => {
        const training = spawn('node', [
            './SelfPlayTraining.js',
            '--player1', 'P1.js',
            '--player2', 'P2.js',
            '--matches', config.matches.toString(),
            '--verbose'
        ]);

        training.stdout.on('data', (data) => {
            if (config.verbose) {
                process.stdout.write(data);
            }
        });

        training.stderr.on('data', (data) => {
            log('ERROR', data.toString());
        });

        training.on('close', (code) => {
            if (code === 0) {
                log('SUCCESS', 'Self-play training completed');
                analyzeSelfPlayResults();
                resolve(true);
            } else {
                log('ERROR', `Self-play training failed with code ${code}`);
                resolve(false);
            }
        });
    });
}

// Analyze self-play results
function analyzeSelfPlayResults() {
    log('INFO', '========== ANALYZING SELF-PLAY RESULTS ==========');

    const dataDir = './TrainingData';
    const summaryFiles = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('summary_') && f.endsWith('.json'))
        .sort()
        .reverse();

    if (summaryFiles.length === 0) {
        log('WARNING', 'No summary files found');
        return;
    }

    const latestSummary = path.join(dataDir, summaryFiles[0]);
    const summary = JSON.parse(fs.readFileSync(latestSummary, 'utf8'));

    log('SUCCESS', 'Self-play results analyzed', {
        player1: summary.player1,
        player2: summary.player2,
        player1WinRate: (summary.player1Wins / summary.totalMatches * 100).toFixed(1) + '%',
        player2WinRate: (summary.player2Wins / summary.totalMatches * 100).toFixed(1) + '%',
        draws: summary.draws,
        totalMatches: summary.totalMatches
    });
}

// Debug model evaluation
async function debugModelEvaluation() {
    log('INFO', '========== DEBUG: MODEL EVALUATION ==========');

    // Check if OLLAMA_MODEL is set
    const ollamaModel = process.env.OLLAMA_MODEL;
    if (!ollamaModel) {
        log('WARNING', 'OLLAMA_MODEL environment variable not set');
        log('INFO', 'Set it with: export OLLAMA_MODEL="qwen3-tank:0.6b"');
    } else {
        log('INFO', `Using Ollama model: ${ollamaModel}`);
    }

    log('INFO', 'Running model evaluation...');

    return new Promise((resolve) => {
        const evaluation = spawn('node', [
            './EvaluateModel.js',
            '--model', 'P_AI_Ollama.js',
            '--baseline', 'P_AI_MCTS.js',
            '--matches', '5',
            '--verbose'
        ]);

        evaluation.stdout.on('data', (data) => {
            if (config.verbose) {
                process.stdout.write(data);
            }
        });

        evaluation.stderr.on('data', (data) => {
            log('ERROR', data.toString());
        });

        evaluation.on('close', (code) => {
            if (code === 0) {
                log('SUCCESS', 'Model evaluation completed');
                analyzeEvaluationResults();
                resolve(true);
            } else {
                log('ERROR', `Model evaluation failed with code ${code}`);
                resolve(false);
            }
        });
    });
}

// Analyze evaluation results
function analyzeEvaluationResults() {
    log('INFO', '========== ANALYZING EVALUATION RESULTS ==========');

    const resultsDir = './EvaluationResults';
    if (!fs.existsSync(resultsDir)) {
        log('WARNING', 'Evaluation results directory does not exist');
        return;
    }

    const resultFiles = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith('evaluation_') && f.endsWith('.json'))
        .sort()
        .reverse();

    if (resultFiles.length === 0) {
        log('WARNING', 'No evaluation result files found');
        return;
    }

    const latestResult = path.join(resultsDir, resultFiles[0]);
    const results = JSON.parse(fs.readFileSync(latestResult, 'utf8'));

    log('SUCCESS', 'Evaluation results analyzed', {
        modelBot: results.modelBot,
        baselineBot: results.baselineBot,
        modelWinRate: results.overallModelWinRate + '%',
        baselineWinRate: results.overallBaselineWinRate + '%',
        timestamp: results.timestamp
    });

    // Determine if model improved
    const modelRate = parseFloat(results.overallModelWinRate);
    const baselineRate = parseFloat(results.overallBaselineWinRate);

    if (modelRate > baselineRate) {
        log('SUCCESS', `Model IMPROVED by ${(modelRate - baselineRate).toFixed(1)}%`);
    } else if (modelRate < baselineRate) {
        log('WARNING', `Model UNDERPERFORMED by ${(baselineRate - modelRate).toFixed(1)}%`);
    } else {
        log('INFO', 'Model performs EQUAL to baseline');
    }
}

// Show training statistics
function showTrainingStats() {
    log('INFO', '========== TRAINING STATISTICS ==========');

    const stats = {
        dataCollected: 0,
        totalExamples: 0,
        evaluationsRun: 0,
        latestModelPerformance: null
    };

    // Count training data
    const trainingDir = './TrainingData/LLM_Training';
    if (fs.existsSync(trainingDir)) {
        const files = fs.readdirSync(trainingDir).filter(f => f.endsWith('.jsonl'));
        stats.dataCollected = files.length;

        // Count total examples
        for (const file of files) {
            const content = fs.readFileSync(path.join(trainingDir, file), 'utf8');
            stats.totalExamples += content.trim().split('\n').length;
        }
    }

    // Count evaluations
    const evalDir = './EvaluationResults';
    if (fs.existsSync(evalDir)) {
        const files = fs.readdirSync(evalDir).filter(f => f.endsWith('.json'));
        stats.evaluationsRun = files.length;

        if (files.length > 0) {
            const latestFile = files.sort().reverse()[0];
            const results = JSON.parse(fs.readFileSync(path.join(evalDir, latestFile), 'utf8'));
            stats.latestModelPerformance = {
                model: results.modelBot,
                winRate: results.overallModelWinRate + '%',
                baseline: results.baselineBot,
                baselineWinRate: results.overallBaselineWinRate + '%',
                date: results.timestamp
            };
        }
    }

    log('SUCCESS', 'Training statistics', stats);

    // Recommendations
    const recommendations = [];

    if (stats.totalExamples < 100) {
        recommendations.push('Collect more training data (target: 500+ examples)');
    }

    if (stats.evaluationsRun === 0) {
        recommendations.push('Run model evaluation to measure performance');
    }

    if (stats.latestModelPerformance) {
        const winRate = parseFloat(stats.latestModelPerformance.winRate);
        if (winRate < 40) {
            recommendations.push('Low win rate. Consider: more training data, different hyperparameters, or better expert bot');
        }
    }

    if (recommendations.length > 0) {
        log('INFO', 'Recommendations', recommendations);
    }
}

// Debug finetuning process
async function debugFinetuning() {
    log('INFO', '========== DEBUG: FINETUNING PROCESS ==========');

    // Check if training data exists
    const dataDir = './TrainingData/LLM_Training';
    const dataFiles = fs.existsSync(dataDir) ?
        fs.readdirSync(dataDir).filter(f => f.endsWith('.jsonl')) : [];

    if (dataFiles.length === 0) {
        log('ERROR', 'No training data found. Run data collection first.');
        return false;
    }

    const latestData = path.join(dataDir, dataFiles.sort().reverse()[0]);
    log('INFO', `Found training data: ${path.basename(latestData)}`);

    // Check if Python is available
    try {
        const { execSync } = require('child_process');
        const pythonVersion = execSync('python3 --version', { encoding: 'utf8' });
        log('SUCCESS', `Python available: ${pythonVersion.trim()}`);

        // Check if requirements are installed
        log('INFO', 'Checking Python dependencies...');
        try {
            execSync('python3 -c "import torch; import transformers"', { encoding: 'utf8' });
            log('SUCCESS', 'PyTorch and Transformers are installed');
        } catch (e) {
            log('WARNING', 'PyTorch or Transformers not installed');
            log('INFO', 'Install with: pip install -r requirements.txt');
        }

    } catch (e) {
        log('WARNING', 'Python3 not found or not in PATH');
        return false;
    }

    log('INFO', 'Finetuning debug check complete');
    return true;
}

// Main execution
async function main() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         TRAINING DEBUG SYSTEM                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    log('INFO', `Debug mode: ${config.mode}`);
    log('INFO', `Log file: ${config.logFile}`);

    // Clear old log file
    if (fs.existsSync(config.logFile)) {
        fs.unlinkSync(config.logFile);
    }

    // Check system requirements
    await checkSystemRequirements();

    // Run specific debug mode
    switch (config.mode) {
        case 'collect':
            await debugDataCollection();
            break;

        case 'training':
            await debugSelfPlayTraining();
            break;

        case 'evaluate':
            await debugModelEvaluation();
            break;

        case 'finetune':
            await debugFinetuning();
            break;

        case 'stats':
            showTrainingStats();
            break;

        case 'pipeline':
            log('INFO', 'Running full pipeline debug...');
            await debugDataCollection();
            await debugSelfPlayTraining();
            await debugFinetuning();
            showTrainingStats();
            break;

        default:
            log('ERROR', `Unknown mode: ${config.mode}`);
            log('INFO', 'Valid modes: collect, training, evaluate, finetune, stats, pipeline');
            process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║         DEBUG COMPLETE                                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\nCheck debug log: ${config.logFile}\n`);
}

main().catch(error => {
    log('ERROR', 'Fatal error', { message: error.message, stack: error.stack });
    process.exit(1);
});
