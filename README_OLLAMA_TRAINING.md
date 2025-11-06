# 🤖 Training Qwen3 Model cho Tank Game

Hướng dẫn nhanh để training mô hình Qwen3:0.6b local với Ollama.

## 🚀 Quick Start (10 phút)

### 1. Cài đặt Ollama

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download từ https://ollama.ai/download

# Verify
ollama --version
```

### 2. Pull base model

```bash
ollama pull qwen3:0.6b
```

### 3. Chạy pipeline tự động

```bash
chmod +x FinetunePipeline.sh

# Full pipeline: collect data (100 games) -> prepare -> train -> evaluate
./FinetunePipeline.sh --stage all --matches 100

# Hoặc chạy từng bước:
./FinetunePipeline.sh --stage collect --matches 100
./FinetunePipeline.sh --stage prepare
./FinetunePipeline.sh --stage finetune
./FinetunePipeline.sh --stage evaluate
```

## 📊 Quy trình Training

```
┌─────────────────┐
│ 1. Thu thập data│  ← Chạy MCTS bot, lưu training examples
│   DataCollector │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ 2. Chuẩn bị data│  ← Format JSONL cho training
│   Data Formatter│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ 3. Finetune     │  ← Train với Unsloth (hoặc custom Ollama)
│   TrainWithUnsl │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ 4. Đánh giá     │  ← Test model vs baseline
│   EvaluateModel │
└─────────────────┘
```

## 📁 Files quan trọng

### Training Scripts:
- `DataCollector.js` - Thu thập training data từ expert bot
- `TrainWithUnsloth.py` - Finetune model với Unsloth
- `FinetunePipeline.sh` - Pipeline tự động toàn bộ
- `EvaluateModel.js` - Đánh giá model performance

### Bot Implementation:
- `Arena/P_AI_Ollama.js` - Bot sử dụng Ollama model
- `Arena/P_AI_MCTS.js` - Expert bot (để thu thập data)

### Documentation:
- `OLLAMA_TRAINING_GUIDE.md` - Hướng dẫn chi tiết
- `README_OLLAMA_TRAINING.md` - File này (quick reference)

## 💻 Các lệnh quan trọng

### Thu thập training data:

```bash
# Collect 100 games từ MCTS expert bot
node DataCollector.js --expert P_AI_MCTS.js --matches 100

# Output: TrainingData/LLM_Training/training_data_*.jsonl
```

### Test Ollama bot:

```bash
# Set model to use
export OLLAMA_MODEL="qwen3:0.6b"

# Test manually (terminal 1: server, terminal 2: bot)
node Server.js
node Arena/P_AI_Ollama.js

# Test tự động
node SelfPlayTraining.js --player1 P_AI_Ollama.js --player2 P2.js --matches 10
```

### Evaluate model:

```bash
# So sánh với baseline
export OLLAMA_MODEL="qwen3-tank:0.6b"
node EvaluateModel.js --model P_AI_Ollama.js --baseline P_AI_MCTS.js --matches 20

# Output: EvaluationResults/evaluation_*.json
```

### Training với Unsloth (Advanced):

```bash
# Cần Python 3.10+ và CUDA GPU

# Setup environment
python -m venv venv
source venv/bin/activate
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"

# Train
python TrainWithUnsloth.py \
    --data TrainingData/LLM_Training/training_data_*.jsonl \
    --output qwen3-tank-finetuned \
    --epochs 3

# Export to GGUF for Ollama
python TrainWithUnsloth.py \
    --data TrainingData/LLM_Training/training_data_*.jsonl \
    --output qwen3-tank-finetuned \
    --export-gguf

# Import to Ollama
ollama create qwen3-tank:0.6b -f Modelfile
```

## 📈 Expected Performance

| Training Data | Win Rate vs P2 | Notes |
|---------------|----------------|-------|
| Base model (no training) | 20-30% | Chỉ dựa vào prompt |
| 50 games | 35-45% | Cải thiện nhẹ |
| 100 games | 45-55% | Tốt |
| 500 games | 55-65% | Rất tốt |
| 1000+ games | 60-70% | Gần MCTS level |

## 🎯 Tips để model tốt hơn

### 1. Thu thập data chất lượng cao
```bash
# Chỉ collect từ winning games
# Collect từ nhiều opponents khác nhau
node DataCollector.js --expert P_AI_MCTS.js --opponent P1.js --matches 50
node DataCollector.js --expert P_AI_MCTS.js --opponent P2.js --matches 50
```

### 2. Augment data
```bash
# Collect từ nhiều perspective
# Flip board, rotate positions
# (implement trong DataCollector.js nếu cần)
```

### 3. Iterative improvement
```bash
# 1. Train v1
./FinetunePipeline.sh --stage all --matches 100

# 2. Use v1 để collect thêm data
export OLLAMA_MODEL="qwen3-tank-v1:0.6b"
node DataCollector.js --expert P_AI_Ollama.js --matches 100

# 3. Train v2 với combined data
cat training_data_v1.jsonl training_data_v2.jsonl > combined.jsonl
python TrainWithUnsloth.py --data combined.jsonl --output qwen3-tank-v2
```

## 🐛 Troubleshooting

### Ollama không chạy:
```bash
# Check if running
ollama list

# Restart (Mac/Linux)
brew services restart ollama
# hoặc
systemctl restart ollama
```

### Model response sai format:
```bash
# Test model trực tiếp
ollama run qwen3-tank:0.6b "Valid moves: LEFT, RIGHT, UP. Choose:"

# Nếu sai -> cần train thêm với prompt rõ ràng hơn
```

### Out of memory khi train:
```python
# Trong TrainWithUnsloth.py:
# - Giảm batch_size từ 2 -> 1
# - Giảm max_seq_length từ 2048 -> 1024
# - Enable gradient checkpointing
```

### Win rate thấp:
```bash
# 1. Collect thêm data (ít nhất 100 games)
# 2. Check data quality (expert bot có win rate cao không?)
# 3. Train longer (thêm epochs)
# 4. Tune hyperparameters (learning rate, LoRA rank)
```

## 🔗 Resources

### Quick Links:
- [Ollama Docs](https://github.com/ollama/ollama/blob/main/docs/README.md)
- [Unsloth GitHub](https://github.com/unslothai/unsloth)
- [Qwen Models](https://huggingface.co/Qwen)

### Detailed Guides:
- `OLLAMA_TRAINING_GUIDE.md` - Complete training guide
- `AI_BOTS_GUIDE.md` - All AI bots documentation

### Video Tutorials:
- [Finetuning with Unsloth](https://www.youtube.com/watch?v=yGm87f8uScU)
- [Ollama Setup](https://www.youtube.com/results?search_query=ollama+tutorial)

## 📞 Next Steps

Sau khi train xong:

1. **Test thoroughly**
   ```bash
   node EvaluateModel.js --model P_AI_Ollama.js --matches 50
   ```

2. **Analyze results**
   - Xem model học được gì?
   - Sai ở pattern nào?
   - Cần thêm data cho case nào?

3. **Iterate**
   - Collect thêm data từ failure cases
   - Retrain với combined dataset
   - Compare v1 vs v2 vs v3

4. **Share**
   - Export model to GGUF
   - Upload to Hugging Face
   - Contribute back to Ollama library

Good luck! 🚀

## ⚡ One-liner để bắt đầu ngay

```bash
# Install Ollama + Pull model + Train + Evaluate (all in one!)
curl -fsSL https://ollama.ai/install.sh | sh && \
ollama pull qwen3:0.6b && \
chmod +x FinetunePipeline.sh && \
./FinetunePipeline.sh --stage all --matches 100
```

Enjoy training! 🎮
