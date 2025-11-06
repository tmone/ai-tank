# 🚀 Quick Start: Training Qwen3 cho Tank Game

Hướng dẫn nhanh nhất để bắt đầu training AI model cho game trong 15 phút!

## ⚡ Super Quick Start (Copy & Paste)

```bash
# 1. Install Ollama (nếu chưa có)
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull base model
ollama pull qwen3:0.6b

# 3. Make scripts executable
chmod +x FinetunePipeline.sh DataCollector.js EvaluateModel.js

# 4. Run full training pipeline!
./FinetunePipeline.sh --stage all --matches 100
```

Chờ 30-60 phút, bạn sẽ có model riêng! 🎉

## 📖 Chi tiết từng bước

### Bước 1: Setup Ollama (2 phút)

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download từ https://ollama.ai/download

# Verify
ollama --version
ollama list
```

### Bước 2: Pull base model (2 phút)

```bash
# Qwen3 0.6B - nhỏ, nhanh, chạy được trên laptop
ollama pull qwen3:0.6b

# Verify
ollama run qwen3:0.6b "Hello"
```

### Bước 3: Thu thập training data (10-20 phút)

```bash
# Collect 100 games từ MCTS expert bot
node DataCollector.js --expert P_AI_MCTS.js --matches 100

# Sẽ tạo file: TrainingData/LLM_Training/training_data_*.jsonl
```

**Trong khi chờ:**
- Script tự động chạy MCTS bot
- Mỗi game ~10-30 giây
- Chỉ lưu winning games
- Tạo ~2000-3000 training examples

### Bước 4: Tạo custom model (1 phút)

```bash
# Tạo Modelfile với optimized parameters
cat > Modelfile << 'EOF'
FROM qwen3:0.6b

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40

SYSTEM """
You are an expert tank game player. You always choose the best move.
Respond with ONLY: LEFT, RIGHT, UP, or DOWN
"""
EOF

# Create model
ollama create qwen3-tank:0.6b -f Modelfile
```

### Bước 5: Test model! (2 phút)

```bash
# Set model
export OLLAMA_MODEL="qwen3-tank:0.6b"

# Terminal 1: Start server
node Server.js

# Terminal 2: Run bot
node Arena/P_AI_Ollama.js

# Terminal 3: Opponent
node Arena/P2.js
```

### Bước 6: Evaluate (5 phút)

```bash
export OLLAMA_MODEL="qwen3-tank:0.6b"
node EvaluateModel.js --model P_AI_Ollama.js --baseline P_AI_MCTS.js --matches 10
```

## 🎯 Kết quả mong đợi

| Stage | Win Rate | Time |
|-------|----------|------|
| Base Qwen3 (no training) | 20-30% | 0 min |
| Custom prompt | 35-45% | 2 min |
| With 100 games data* | 45-55% | 30 min |
| With 500 games data* | 55-65% | 2 hours |
| With 1000+ games data* | 60-70% | 4 hours |

*Requires actual finetuning với Unsloth (xem phần Advanced)

## 🚀 Advanced: Training thật với Unsloth

### Setup Python environment (5 phút)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

### Train model (20-60 phút, tùy GPU)

```bash
# Activate venv
source venv/bin/activate

# Train với collected data
python TrainWithUnsloth.py \
    --data TrainingData/LLM_Training/training_data_*.jsonl \
    --output qwen3-tank-finetuned \
    --epochs 3 \
    --export-gguf

# Export to Ollama
cat > Modelfile << 'EOF'
FROM ./qwen3-tank-finetuned_gguf/model.gguf
PARAMETER temperature 0.3
SYSTEM "Expert tank game AI"
EOF

ollama create qwen3-tank-finetuned:0.6b -f Modelfile
```

### Test finetuned model

```bash
export OLLAMA_MODEL="qwen3-tank-finetuned:0.6b"
node EvaluateModel.js --model P_AI_Ollama.js --matches 20
```

## 📊 So sánh các approach

| Method | Time | Difficulty | Win Rate | Cost |
|--------|------|-----------|----------|------|
| Custom prompt | 2 min | Dễ | 35-45% | $0 |
| 100 games + prompt | 30 min | Dễ | 40-50% | $0 |
| Finetune 100 games | 1 hour | Trung bình | 45-55% | $0 (cần GPU) |
| Finetune 500+ games | 3 hours | Trung bình | 55-65% | $0 (cần GPU) |
| LLM API (GPT-4) | 0 min | Dễ | 40-50% | $$$$ |
| MCTS (baseline) | 0 min | Dễ | 65-75% | $0 |

## 💡 Tips để model tốt hơn

### 1. Collect thêm data

```bash
# Từ nhiều expert khác nhau
node DataCollector.js --expert P_AI_MCTS.js --matches 100
node DataCollector.js --expert P1.js --matches 50

# Merge data
cat TrainingData/LLM_Training/*.jsonl > combined_data.jsonl
```

### 2. Better prompts

```javascript
// Trong P_AI_Ollama.js, thử prompt khác nhau:

// Option 1: Concise
"Board:\n${board}\n\nValid: ${moves}\n\nBest move:"

// Option 2: Chain-of-thought
"Board:\n${board}\n\nThink step by step:\n1. Analyze position\n2. Consider opponent\n3. Choose best move\n\nMove:"

// Option 3: Few-shot
"Example:\nBoard: ...\nBest: LEFT (controls center)\n\nYour turn:\n${board}\n\nBest:"
```

### 3. Iterative training

```bash
# Round 1: Train with MCTS data
./FinetunePipeline.sh --stage all --matches 100

# Round 2: Self-play with trained model
export OLLAMA_MODEL="qwen3-tank:0.6b"
node DataCollector.js --expert P_AI_Ollama.js --matches 50

# Round 3: Combine and retrain
cat round1_data.jsonl round2_data.jsonl > combined.jsonl
python TrainWithUnsloth.py --data combined.jsonl --output qwen3-v2
```

## 🐛 Common Issues

### "Ollama not found"

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Or download: https://ollama.ai/download
```

### "Model not found"

```bash
# List models
ollama list

# Pull if missing
ollama pull qwen3:0.6b
```

### "No training data"

```bash
# Check data directory
ls -lh TrainingData/LLM_Training/

# If empty, collect data first
node DataCollector.js --expert P_AI_MCTS.js --matches 100
```

### "Python import error"

```bash
# Make sure virtual env is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### "CUDA out of memory"

```python
# In TrainWithUnsloth.py:
# Reduce batch_size from 2 to 1
# Reduce max_seq_length from 2048 to 1024
# Or use Google Colab (free GPU)
```

## 📚 Next Steps

Sau khi train xong:

1. **Read full guides:**
   - `OLLAMA_TRAINING_GUIDE.md` - Chi tiết 10 trang
   - `README_OLLAMA_TRAINING.md` - Quick reference
   - `AI_BOTS_GUIDE.md` - Tất cả bots

2. **Experiment:**
   - Thử different hyperparameters
   - Collect more diverse data
   - Test against all bots

3. **Share:**
   - Export to GGUF
   - Upload to Hugging Face
   - Share with community

## 🎮 Play Now!

```bash
# Quick test
export OLLAMA_MODEL="qwen3-tank:0.6b"

# Terminal 1
node Server.js

# Terminal 2
node Arena/P_AI_Ollama.js

# Terminal 3
node Arena/P_AI_MCTS.js

# Watch them battle! 🎮
```

## 📞 Help & Resources

- 📖 Full docs: `OLLAMA_TRAINING_GUIDE.md`
- 🤖 All bots: `AI_BOTS_GUIDE.md`
- 🚀 Main README: `README_AI_BOTS.md`
- 💬 Issues: Create GitHub issue
- 🌐 Ollama: https://ollama.ai
- 🦙 Unsloth: https://github.com/unslothai/unsloth

Happy training! 🚀🎮
