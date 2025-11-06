# 🔍 AI Tank Training & Learning Debug Guide

Hướng dẫn chi tiết để debug toàn bộ quá trình training, learning, và finetuning AI models cho tank game.

## 📑 Table of Contents

1. [Quick Start Debug](#quick-start-debug)
2. [Debug Components](#debug-components)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Performance Metrics](#performance-metrics)
5. [Advanced Debugging](#advanced-debugging)

---

## 🚀 Quick Start Debug

### Bước 1: Kiểm tra hệ thống

```bash
# Chạy debug tool toàn diện
node DebugTraining.js --mode pipeline

# Hoặc check từng component
node DebugTraining.js --mode collect    # Debug data collection
node DebugTraining.js --mode training   # Debug self-play
node DebugTraining.js --mode evaluate   # Debug evaluation
node DebugTraining.js --mode finetune   # Debug finetuning
node DebugTraining.js --mode stats      # Show statistics
```

### Bước 2: Visualize kết quả

```bash
# Text report (console + file)
node VisualizeTraining.js --format text

# HTML dashboard (recommended)
node VisualizeTraining.js --format html
open TrainingVisualizations/training_progress.html

# JSON data export
node VisualizeTraining.js --format json
```

### Bước 3: Xem logs chi tiết

```bash
# Real-time log monitoring
tail -f debug_training.log

# Search for errors
grep ERROR debug_training.log

# Filter by component
grep "DATA COLLECTION" debug_training.log
```

---

## 🔧 Debug Components

### 1. Data Collection (DataCollector.js)

**Mục đích:** Thu thập training data từ expert bots

**Debug checklist:**

```bash
# ✅ Check expert bot exists
ls -la Arena/P_AI_MCTS.js

# ✅ Test data collection với 5 games
node DataCollector.js --expert P_AI_MCTS.js --matches 5 --verbose

# ✅ Verify training data created
ls -lh TrainingData/LLM_Training/

# ✅ Inspect data quality
node DebugTraining.js --mode collect --matches 5
```

**Key metrics to check:**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Expert win rate | > 60% | 40-60% | < 40% |
| Examples per game | 15-30 | 10-15 | < 10 |
| Move distribution balance | Max/Min < 2x | 2-3x | > 3x |
| Invalid examples | 0% | < 5% | > 5% |

**Common issues:**

```bash
# Issue: No training data generated
# Solution: Check if expert bot can run
node Arena/P_AI_MCTS.js -h 127.0.0.1 -p 3011

# Issue: Expert loses too much
# Solution: Use stronger expert or test against weaker opponent
node DataCollector.js --expert P_AI_MCTS.js --opponent P1.js --matches 10

# Issue: Server timeout
# Solution: Increase timeout in DataCollector.js line 343
# Change from 120000 to 180000 (3 minutes)
```

**Debug output interpretation:**

```
[INFO] 2024-01-15T10:30:00.000Z - Starting match: P_AI_MCTS.js vs P2.js
[INFO] 2024-01-15T10:30:15.234Z - Match 1 Complete: Winner = Expert
  → Collected 23 training examples  ✅ Good

[INFO] 2024-01-15T10:30:20.456Z - Match 2 Complete: Winner = Opponent
  → Skipping (expert lost)  ⚠️ Normal, but too many = problem
```

---

### 2. Self-Play Training (SelfPlayTraining.js)

**Mục đích:** Test bots against each other, generate match data

**Debug checklist:**

```bash
# ✅ Run self-play test
node SelfPlayTraining.js --player1 P1.js --player2 P2.js --matches 5 --verbose

# ✅ Check replay data
ls -lh TrainingData/Replays/

# ✅ Verify summary statistics
cat TrainingData/summary_*.json | jq .

# ✅ Debug with tool
node DebugTraining.js --mode training --matches 5
```

**Key metrics:**

| Metric | Expected | Issue |
|--------|----------|-------|
| Match completion rate | 100% | < 90% = server problems |
| Average game length | 20-50 moves | < 10 = bots crash early |
| Win/Loss balance | 40-60% | > 80% = unfair match |

**Debug commands:**

```bash
# Test single match with full verbosity
node SelfPlayTraining.js --player1 P_AI_MCTS.js --player2 P2.js --matches 1 --verbose

# Check if bots can connect
# Terminal 1:
node Server.js -p 3011

# Terminal 2:
node Arena/P1.js -h 127.0.0.1 -p 3011

# Terminal 3:
node Arena/P2.js -h 127.0.0.1 -p 3011
```

---

### 3. Model Evaluation (EvaluateModel.js)

**Mục đích:** Đánh giá performance của model so với baseline

**Debug checklist:**

```bash
# ✅ Set Ollama model
export OLLAMA_MODEL="qwen3-tank:0.6b"

# ✅ Verify model exists
ollama list | grep qwen3-tank

# ✅ Run quick evaluation
node EvaluateModel.js --model P_AI_Ollama.js --baseline P_AI_MCTS.js --matches 5 --verbose

# ✅ Debug evaluation
node DebugTraining.js --mode evaluate
```

**Performance expectations:**

| Stage | vs P1.js | vs P2.js | vs MCTS |
|-------|----------|----------|---------|
| Untrained | 20-30% | 25-35% | 5-15% |
| Custom prompt | 35-45% | 40-50% | 15-25% |
| 100 examples | 40-50% | 45-55% | 20-30% |
| 500+ examples | 50-60% | 55-65% | 30-45% |

**Debug Ollama issues:**

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Test model directly
ollama run qwen3-tank:0.6b "Board:\n. . .\nA . B\n. . .\n\nValid: LEFT, RIGHT, UP\n\nMove:"

# Check model logs
tail -f ~/.ollama/logs/server.log

# Restart Ollama
killall ollama && ollama serve
```

---

### 4. Finetuning Process (TrainWithUnsloth.py)

**Mục đích:** Finetune model với collected data

**Debug checklist:**

```bash
# ✅ Check Python environment
python3 --version
which python3

# ✅ Verify dependencies
python3 -c "import torch; print(torch.__version__)"
python3 -c "import transformers; print(transformers.__version__)"

# ✅ Check training data
ls -lh TrainingData/LLM_Training/*.jsonl
wc -l TrainingData/LLM_Training/*.jsonl

# ✅ Test finetuning (dry run)
python3 TrainWithUnsloth.py --data TrainingData/LLM_Training/training_data_*.jsonl --epochs 1 --batch-size 1

# ✅ Debug finetuning check
node DebugTraining.js --mode finetune
```

**System requirements:**

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU Memory | 4GB | 8GB+ |
| RAM | 8GB | 16GB+ |
| Training data | 50 examples | 500+ examples |
| Python | 3.8+ | 3.10+ |
| PyTorch | 2.0+ | 2.1+ |

**Common finetuning issues:**

```bash
# Issue: CUDA out of memory
# Solution 1: Reduce batch size
python3 TrainWithUnsloth.py --batch-size 1 --data your_data.jsonl

# Solution 2: Reduce sequence length
# Edit TrainWithUnsloth.py line 43: max_seq_length to 1024

# Solution 3: Use Google Colab (free GPU)
# Upload code to Colab, install dependencies, run training

# Issue: "No module named 'unsloth'"
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"

# Issue: Training very slow
# Check if GPU is being used:
python3 -c "import torch; print(torch.cuda.is_available())"
python3 -c "import torch; print(torch.cuda.device_count())"

# Issue: Poor training loss (not decreasing)
# Check: Data quality, learning rate, prompt format
# Try: Lower learning rate (--lr 1e-4 instead of 2e-4)
```

**Monitor training progress:**

```bash
# During training, watch for:
# 1. Loss should decrease over time
# 2. Eval loss should track train loss
# 3. GPU utilization should be high (80%+)

# Check GPU usage (if NVIDIA)
watch -n 1 nvidia-smi

# Training log interpretation:
# Good:
#   Step 10  | Loss: 2.34 | Eval: 2.45
#   Step 20  | Loss: 1.89 | Eval: 2.01  ← Loss decreasing
#   Step 30  | Loss: 1.56 | Eval: 1.78  ← Good progress

# Bad:
#   Step 10  | Loss: 2.34 | Eval: 2.45
#   Step 20  | Loss: 2.31 | Eval: 2.43  ← Loss barely moving
#   Step 30  | Loss: 2.30 | Eval: 2.42  ← Not learning!
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Model không học (Win rate không tăng)

**Symptoms:**
- Win rate stays at 20-30% even after training
- Model keeps choosing same moves
- Evaluation shows no improvement

**Debug steps:**

```bash
# 1. Check training data quality
node DebugTraining.js --mode collect --matches 10
# Look for: Balanced moves, expert wins > 60%

# 2. Verify model is actually using training
ollama show qwen3-tank:0.6b --modelfile

# 3. Test model responses
ollama run qwen3-tank:0.6b "Test prompt from training data"

# 4. Check if using correct model
echo $OLLAMA_MODEL  # Should match your trained model
```

**Solutions:**

1. **More training data:** Collect 500+ examples
```bash
node DataCollector.js --expert P_AI_MCTS.js --matches 100
```

2. **Better expert bot:** Use stronger expert
```bash
# Train MCTS to be stronger first, then collect data
```

3. **Check prompt format:** Ensure consistency
```bash
# Training prompt should match inference prompt
# Check Arena/P_AI_Ollama.js line ~150
```

4. **Actual finetuning:** System prompt alone won't work well
```bash
# Use Unsloth for real parameter updates
python3 TrainWithUnsloth.py --data your_data.jsonl --epochs 3
```

---

### Issue 2: Training quá chậm

**Symptoms:**
- 1 game takes > 1 minute
- Data collection hangs
- Server timeout errors

**Debug:**

```bash
# 1. Check bot thinking time
# In Server.js, line 46: THINKING_TIME = 3000 (3 seconds)
# Reduce to 1000 for faster testing

# 2. Profile bot performance
time node Arena/P_AI_MCTS.js -h 127.0.0.1 -p 3011

# 3. Check CPU usage
top -p $(pgrep -f "node Server.js")

# 4. Monitor game progress
node SelfPlayTraining.js --matches 1 --verbose
# Watch for: "Match timeout" errors
```

**Solutions:**

1. Reduce thinking time for training
2. Use faster bots (P1.js instead of MCTS)
3. Run on better hardware
4. Parallel data collection (multiple ports)

---

### Issue 3: Bots crash hoặc không connect

**Symptoms:**
- "No match result" errors
- Bots timeout
- Server closes immediately

**Debug:**

```bash
# 1. Test server standalone
node Server.js -p 3011
# Should output: "Server running on port 3011"

# 2. Test bot connection
# Terminal 1:
node Server.js -p 3011

# Terminal 2:
node Arena/P1.js -h 127.0.0.1 -p 3011
# Should output: "Connected to server"

# 3. Check for port conflicts
lsof -i :3011
# Kill if something else using port:
kill -9 <PID>

# 4. Try different port
node Server.js -p 3012
node Arena/P1.js -p 3012
```

---

### Issue 4: Ollama model not found

**Symptoms:**
- "Error: model not found"
- Empty responses from Ollama
- Connection refused errors

**Debug:**

```bash
# 1. Check Ollama status
curl http://localhost:11434/api/tags

# 2. List available models
ollama list

# 3. Pull base model if missing
ollama pull qwen3:0.6b

# 4. Recreate custom model
cat > Modelfile << 'EOF'
FROM qwen3:0.6b
PARAMETER temperature 0.3
SYSTEM "You are a tank game AI. Respond only: LEFT, RIGHT, UP, DOWN"
EOF
ollama create qwen3-tank:0.6b -f Modelfile

# 5. Test model
ollama run qwen3-tank:0.6b "test"
```

---

## 📊 Performance Metrics

### Data Quality Metrics

```bash
# Run this to get detailed data analysis
node DebugTraining.js --mode stats
```

**What to look for:**

1. **Training Examples:**
   - ✅ Good: 500+
   - ⚠️ Warning: 100-500
   - ❌ Critical: < 100

2. **Expert Win Rate:**
   - ✅ Good: > 60%
   - ⚠️ Warning: 40-60%
   - ❌ Critical: < 40%

3. **Move Distribution:**
   ```
   LEFT:  25% (250 examples)
   RIGHT: 26% (260 examples)
   UP:    24% (240 examples)
   DOWN:  25% (250 examples)
   ```
   - ✅ Balanced: Each move 20-30%
   - ❌ Unbalanced: One move > 40%

4. **Prompt Length:**
   - ✅ Good: 500-1500 chars
   - ⚠️ Warning: 1500-2500 chars
   - ❌ Critical: > 2500 chars (may exceed context)

---

### Learning Progress Metrics

**Track these over time:**

```bash
# Generate progress report
node VisualizeTraining.js --format html
open TrainingVisualizations/training_progress.html
```

**Key indicators of learning:**

1. **Win Rate Trend:**
   ```
   Eval 1: 25%  (baseline)
   Eval 2: 32%  ↑ 7%   ← Learning!
   Eval 3: 38%  ↑ 6%   ← Still improving
   Eval 4: 41%  ↑ 3%   ← Slowing down
   Eval 5: 42%  ↑ 1%   ← Plateaued (need more data)
   ```

2. **vs Baseline Comparison:**
   - Model should gradually approach baseline performance
   - If model > baseline after 500+ examples = success!

3. **Consistency:**
   - Run multiple evaluations (5-10 games each)
   - Good model: Win rate variance < 10%
   - Unstable model: Win rate varies 20%+

---

## 🔬 Advanced Debugging

### 1. Inspect Training Examples

```bash
# View sample training data
head -3 TrainingData/LLM_Training/training_data_*.jsonl | jq .

# Count examples by response
cat TrainingData/LLM_Training/*.jsonl | \
  jq -r '.messages[1].content' | \
  sort | uniq -c | sort -rn

# Check prompt lengths
cat TrainingData/LLM_Training/*.jsonl | \
  jq -r '.messages[0].content | length' | \
  awk '{sum+=$1; count++} END {print "Avg:", sum/count}'
```

---

### 2. Monitor Live Training

```bash
# Run training with real-time monitoring
node DataCollector.js --expert P_AI_MCTS.js --matches 100 --verbose 2>&1 | \
  tee training_live.log

# In another terminal, watch progress
watch -n 5 "tail -20 training_live.log | grep 'Collected'"

# Track expert win rate
grep "Winner" training_live.log | \
  grep -c "Expert" | \
  xargs -I {} echo "Expert wins: {}"
```

---

### 3. A/B Testing Different Approaches

```bash
# Test different expert bots
node DataCollector.js --expert P_AI_MCTS.js --matches 50
mv TrainingData/LLM_Training/training_data_*.jsonl training_mcts.jsonl

node DataCollector.js --expert P1.js --matches 50
mv TrainingData/LLM_Training/training_data_*.jsonl training_p1.jsonl

# Compare data quality
echo "MCTS data:"
node -e "console.log(require('fs').readFileSync('training_mcts.jsonl','utf8').split('\n').length + ' examples')"

echo "P1 data:"
node -e "console.log(require('fs').readFileSync('training_p1.jsonl','utf8').split('\n').length + ' examples')"

# Train models on each dataset and compare
```

---

### 4. Debug Model Inference

```bash
# Create test script
cat > test_model.js << 'EOF'
const { spawn } = require('child_process');

const prompt = `You are playing a tank game.

Board:
. . . . .
. A . . .
. a . B .
. . . b .
. . . . .

Your position: (1, 1)
Opponent: (3, 2)
Valid moves: LEFT, RIGHT, UP, DOWN

Choose the BEST move:`;

const ollama = spawn('ollama', ['run', process.env.OLLAMA_MODEL || 'qwen3-tank:0.6b', prompt]);

ollama.stdout.on('data', (data) => {
  console.log('Model response:', data.toString());
});

ollama.on('close', (code) => {
  console.log('Done');
});
EOF

# Test model
export OLLAMA_MODEL="qwen3-tank:0.6b"
node test_model.js
```

---

### 5. Benchmark Different Models

```bash
# Create benchmark script
cat > benchmark.sh << 'EOF'
#!/bin/bash

MODELS=("qwen3:0.6b" "qwen3-tank:0.6b" "qwen3-tank-finetuned:0.6b")

for model in "${MODELS[@]}"; do
  echo "Testing $model..."
  export OLLAMA_MODEL="$model"
  node EvaluateModel.js --model P_AI_Ollama.js --baseline P_AI_MCTS.js --matches 10 | \
    grep "OVERALL" -A 5
  echo "---"
done
EOF

chmod +x benchmark.sh
./benchmark.sh
```

---

## 📝 Debug Checklist

Sử dụng checklist này trước khi training:

### Pre-Training Checklist

- [ ] Node.js installed and working
- [ ] All bot files present in Arena/
- [ ] Server.js can start without errors
- [ ] Ollama installed (if using LLM)
- [ ] Base model downloaded (`ollama list`)
- [ ] Data directories created
- [ ] Expert bot can win consistently (> 60%)

### Data Collection Checklist

- [ ] DataCollector.js runs without errors
- [ ] Training data files created
- [ ] At least 100+ examples collected
- [ ] Expert win rate > 60%
- [ ] Move distribution balanced (no move > 40%)
- [ ] No invalid JSON examples

### Training Checklist

- [ ] Training data validated
- [ ] Python environment setup (if finetuning)
- [ ] GPU available (if finetuning)
- [ ] Training runs without errors
- [ ] Loss decreases over time
- [ ] Model checkpoint saved

### Evaluation Checklist

- [ ] OLLAMA_MODEL env var set correctly
- [ ] Model exists in Ollama
- [ ] Evaluation runs without errors
- [ ] Win rate > baseline (or improving)
- [ ] Results saved to EvaluationResults/

---

## 🆘 Getting Help

### Debug Logs

All debug logs saved to:
- `debug_training.log` - Main debug log
- `TrainingVisualizations/` - Visual reports
- `TrainingData/` - Training data and summaries
- `EvaluationResults/` - Evaluation results

### Useful Commands

```bash
# Full system check
node DebugTraining.js --mode pipeline

# Quick statistics
node DebugTraining.js --mode stats

# Visual dashboard
node VisualizeTraining.js --format html
open TrainingVisualizations/training_progress.html

# Monitor logs
tail -f debug_training.log | grep -E "(ERROR|WARNING|SUCCESS)"

# Clean restart
rm -rf TrainingData/* EvaluationResults/* debug_training.log
```

---

## 🎯 Success Criteria

Your training is successful when:

1. ✅ Data collection: 500+ examples, expert > 60% win rate
2. ✅ Model trains without errors
3. ✅ Evaluation shows improvement over untrained model
4. ✅ Win rate vs baseline within 10-20% (for 500 examples)
5. ✅ Model responds consistently and legally (only LEFT/RIGHT/UP/DOWN)

---

## 📚 References

- Main README: `README_AI_BOTS.md`
- Training Guide: `TRAINING_QUICKSTART.md`
- Ollama Guide: `OLLAMA_TRAINING_GUIDE.md`
- Bot Guide: `AI_BOTS_GUIDE.md`

---

Happy debugging! 🐛🔨
