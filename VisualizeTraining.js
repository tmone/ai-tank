#!/usr/bin/env node
// ==================== TRAINING VISUALIZATION TOOL =====================
// Visualize training progress, model performance, and learning curves
//
// Usage: node VisualizeTraining.js [--format html|json|text]
// ======================================================================

const fs = require('fs');
const path = require('path');

const config = {
    format: 'text', // html, json, text
    outputDir: './TrainingVisualizations',
};

// Parse arguments
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--format' && i + 1 < process.argv.length) {
        config.format = process.argv[++i];
    }
}

// Ensure output directory
if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
}

// Load all training data
function loadTrainingData() {
    const data = {
        dataCollections: [],
        evaluations: [],
        selfPlayMatches: []
    };

    // Load data collection results
    const trainingDir = './TrainingData/LLM_Training';
    if (fs.existsSync(trainingDir)) {
        const summaryFiles = fs.readdirSync(trainingDir)
            .filter(f => f.startsWith('summary_') && f.endsWith('.json'));

        for (const file of summaryFiles) {
            const content = JSON.parse(fs.readFileSync(path.join(trainingDir, file), 'utf8'));
            data.dataCollections.push(content);
        }
    }

    // Load evaluation results
    const evalDir = './EvaluationResults';
    if (fs.existsSync(evalDir)) {
        const evalFiles = fs.readdirSync(evalDir)
            .filter(f => f.startsWith('evaluation_') && f.endsWith('.json'));

        for (const file of evalFiles) {
            const content = JSON.parse(fs.readFileSync(path.join(evalDir, file), 'utf8'));
            data.evaluations.push(content);
        }
    }

    // Load self-play results
    const dataDir = './TrainingData';
    if (fs.existsSync(dataDir)) {
        const summaryFiles = fs.readdirSync(dataDir)
            .filter(f => f.startsWith('summary_') && f.endsWith('.json'));

        for (const file of summaryFiles) {
            const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
            data.selfPlayMatches.push(content);
        }
    }

    return data;
}

// Generate text visualization
function generateTextVisualization(data) {
    let output = '';

    output += '╔════════════════════════════════════════════════════════╗\n';
    output += '║         TRAINING PROGRESS VISUALIZATION                ║\n';
    output += '╚════════════════════════════════════════════════════════╝\n\n';

    // Data Collection Summary
    output += '📊 DATA COLLECTION SUMMARY\n';
    output += '─'.repeat(60) + '\n';

    if (data.dataCollections.length === 0) {
        output += '  No data collection sessions found.\n';
    } else {
        let totalExamples = 0;
        data.dataCollections.forEach((dc, idx) => {
            totalExamples += dc.totalExamples;
            output += `  Session ${idx + 1}:\n`;
            output += `    Date: ${new Date(dc.timestamp).toLocaleString()}\n`;
            output += `    Expert: ${dc.expertBot}\n`;
            output += `    Matches: ${dc.totalMatches}\n`;
            output += `    Win Rate: ${(dc.winRate * 100).toFixed(1)}%\n`;
            output += `    Examples: ${dc.totalExamples}\n\n`;
        });
        output += `  TOTAL TRAINING EXAMPLES: ${totalExamples}\n`;
    }

    output += '\n';

    // Evaluation Results
    output += '🎯 MODEL EVALUATION RESULTS\n';
    output += '─'.repeat(60) + '\n';

    if (data.evaluations.length === 0) {
        output += '  No evaluation results found.\n';
    } else {
        // Sort by date
        data.evaluations.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        data.evaluations.forEach((eval, idx) => {
            const modelWin = parseFloat(eval.overallModelWinRate);
            const baselineWin = parseFloat(eval.overallBaselineWinRate);
            const improvement = modelWin - baselineWin;

            output += `  Evaluation ${idx + 1}:\n`;
            output += `    Date: ${new Date(eval.timestamp).toLocaleString()}\n`;
            output += `    Model: ${eval.modelBot}\n`;
            output += `    Win Rate: ${eval.overallModelWinRate}% `;
            output += improvement > 0 ? '✅' : (improvement < 0 ? '❌' : '➖');
            output += `\n`;
            output += `    Baseline: ${eval.baselineBot} (${eval.overallBaselineWinRate}%)\n`;
            output += `    Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%\n\n`;
        });

        // Show learning curve
        if (data.evaluations.length > 1) {
            output += '  LEARNING CURVE:\n';
            const maxRate = Math.max(...data.evaluations.map(e => parseFloat(e.overallModelWinRate)));
            data.evaluations.forEach((eval, idx) => {
                const rate = parseFloat(eval.overallModelWinRate);
                const barLength = Math.round((rate / 100) * 40);
                const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);
                output += `    Eval ${idx + 1}: ${bar} ${rate}%\n`;
            });
        }
    }

    output += '\n';

    // Self-Play Statistics
    output += '⚔️  SELF-PLAY STATISTICS\n';
    output += '─'.repeat(60) + '\n';

    if (data.selfPlayMatches.length === 0) {
        output += '  No self-play matches found.\n';
    } else {
        let totalMatches = 0;
        data.selfPlayMatches.forEach(match => {
            totalMatches += match.totalMatches;
        });

        output += `  Total Self-Play Matches: ${totalMatches}\n`;
        output += `  Sessions: ${data.selfPlayMatches.length}\n\n`;

        // Show latest session
        const latest = data.selfPlayMatches[data.selfPlayMatches.length - 1];
        output += `  Latest Session:\n`;
        output += `    ${latest.player1} vs ${latest.player2}\n`;
        output += `    Matches: ${latest.totalMatches}\n`;
        output += `    P1 Wins: ${latest.player1Wins} (${(latest.player1Wins / latest.totalMatches * 100).toFixed(1)}%)\n`;
        output += `    P2 Wins: ${latest.player2Wins} (${(latest.player2Wins / latest.totalMatches * 100).toFixed(1)}%)\n`;
        output += `    Draws: ${latest.draws}\n`;
    }

    output += '\n';

    // Recommendations
    output += '💡 RECOMMENDATIONS\n';
    output += '─'.repeat(60) + '\n';

    const recommendations = [];

    const totalExamples = data.dataCollections.reduce((sum, dc) => sum + dc.totalExamples, 0);
    if (totalExamples < 100) {
        recommendations.push('Collect more training data (current: ' + totalExamples + ', target: 500+)');
    }

    if (data.evaluations.length === 0) {
        recommendations.push('Run model evaluation to measure performance');
    } else if (data.evaluations.length === 1) {
        recommendations.push('Run multiple evaluations to track learning progress');
    }

    if (data.evaluations.length > 0) {
        const latest = data.evaluations[data.evaluations.length - 1];
        const winRate = parseFloat(latest.overallModelWinRate);
        const baselineRate = parseFloat(latest.overallBaselineWinRate);

        if (winRate < baselineRate - 10) {
            recommendations.push('Model significantly underperforms. Consider: more data, better prompts, or different architecture');
        } else if (winRate > baselineRate + 5) {
            recommendations.push('Model shows promising results! Continue training with more data');
        }
    }

    if (totalExamples > 0 && data.evaluations.length === 0) {
        recommendations.push('You have training data but no evaluations. Run evaluation to see if training worked');
    }

    if (recommendations.length === 0) {
        recommendations.push('System looks healthy! Continue collecting data and evaluating regularly');
    }

    recommendations.forEach((rec, idx) => {
        output += `  ${idx + 1}. ${rec}\n`;
    });

    output += '\n';

    return output;
}

// Generate HTML visualization
function generateHTMLVisualization(data) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Tank Training Progress</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1, h2 {
            color: #333;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
            display: inline-block;
            margin: 10px 20px 10px 0;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #2196F3;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 20px;
        }
        .improvement {
            color: #4CAF50;
        }
        .regression {
            color: #f44336;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f8f8;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>🎮 AI Tank Training Progress Dashboard</h1>

    <div class="card">
        <h2>📊 Overview</h2>
        <div class="metric">
            <div class="metric-value">${data.dataCollections.reduce((sum, dc) => sum + dc.totalExamples, 0)}</div>
            <div class="metric-label">Training Examples</div>
        </div>
        <div class="metric">
            <div class="metric-value">${data.evaluations.length}</div>
            <div class="metric-label">Evaluations</div>
        </div>
        <div class="metric">
            <div class="metric-value">${data.selfPlayMatches.reduce((sum, m) => sum + m.totalMatches, 0)}</div>
            <div class="metric-label">Total Matches</div>
        </div>
    </div>

    ${data.evaluations.length > 0 ? `
    <div class="card">
        <h2>🎯 Learning Curve</h2>
        <div class="chart-container">
            <canvas id="learningCurve"></canvas>
        </div>
    </div>
    ` : ''}

    ${data.evaluations.length > 0 ? `
    <div class="card">
        <h2>📈 Evaluation History</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Model</th>
                    <th>Win Rate</th>
                    <th>Baseline</th>
                    <th>Improvement</th>
                </tr>
            </thead>
            <tbody>
                ${data.evaluations.map(eval => {
                    const improvement = parseFloat(eval.overallModelWinRate) - parseFloat(eval.overallBaselineWinRate);
                    return `
                    <tr>
                        <td>${new Date(eval.timestamp).toLocaleString()}</td>
                        <td>${eval.modelBot}</td>
                        <td>${eval.overallModelWinRate}%</td>
                        <td>${eval.overallBaselineWinRate}%</td>
                        <td class="${improvement > 0 ? 'improvement' : 'regression'}">
                            ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="card">
        <h2>📚 Data Collection Sessions</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Expert Bot</th>
                    <th>Matches</th>
                    <th>Win Rate</th>
                    <th>Examples</th>
                </tr>
            </thead>
            <tbody>
                ${data.dataCollections.map(dc => `
                <tr>
                    <td>${new Date(dc.timestamp).toLocaleString()}</td>
                    <td>${dc.expertBot}</td>
                    <td>${dc.totalMatches}</td>
                    <td>${(dc.winRate * 100).toFixed(1)}%</td>
                    <td>${dc.totalExamples}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${data.evaluations.length > 0 ? `
    <script>
        const ctx = document.getElementById('learningCurve').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(data.evaluations.map((e, i) => `Eval ${i + 1}`))},
                datasets: [
                    {
                        label: 'Model Win Rate',
                        data: ${JSON.stringify(data.evaluations.map(e => parseFloat(e.overallModelWinRate)))},
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Baseline Win Rate',
                        data: ${JSON.stringify(data.evaluations.map(e => parseFloat(e.overallBaselineWinRate)))},
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Model Performance Over Time'
                    }
                }
            }
        });
    </script>
    ` : ''}
</body>
</html>`;

    return html;
}

// Main execution
function main() {
    console.log('Loading training data...');
    const data = loadTrainingData();

    console.log(`Found:`);
    console.log(`  - ${data.dataCollections.length} data collection sessions`);
    console.log(`  - ${data.evaluations.length} evaluations`);
    console.log(`  - ${data.selfPlayMatches.length} self-play sessions`);
    console.log();

    let output;
    let filename;

    switch (config.format) {
        case 'html':
            output = generateHTMLVisualization(data);
            filename = path.join(config.outputDir, 'training_progress.html');
            fs.writeFileSync(filename, output);
            console.log(`HTML visualization saved to: ${filename}`);
            console.log(`Open it in your browser to view the dashboard.`);
            break;

        case 'json':
            output = JSON.stringify(data, null, 2);
            filename = path.join(config.outputDir, 'training_data.json');
            fs.writeFileSync(filename, output);
            console.log(`JSON data saved to: ${filename}`);
            break;

        case 'text':
        default:
            output = generateTextVisualization(data);
            filename = path.join(config.outputDir, 'training_progress.txt');
            fs.writeFileSync(filename, output);
            console.log(output);
            console.log(`Text report saved to: ${filename}`);
            break;
    }
}

main();
