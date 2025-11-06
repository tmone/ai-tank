# 🎓 Hướng dẫn Training Qwen3:0.6b cho Tank Game

Hướng dẫn chi tiết cách finetune mô hình Qwen3:0.6b để chơi game tank.

## 📋 Tổng quan

Quy trình training gồm 4 bước chính:
1. **Thu thập dữ liệu** - Chạy expert bot và thu thập training examples
2. **Chuẩn bị dữ liệu** - Format data cho finetuning
3. **Finetune model** - Train model với dữ liệu đã thu thập
4. **Đánh giá** - Test model đã train

## 🚀 Quick Start (5 phút)

### Bước 1: Cài đặt Ollama

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Tải từ https://ollama.ai/download

# Verify installation
ollama --version
```

### Bước 2: Pull base model

```bash
# Pull Qwen3 0.6B model
ollama pull qwen3:0.6b

# Verify
ollama list
```

### Bước 3: Chạy pipeline tự động

```bash
# Make script executable
chmod +x FinetunePipeline.sh

# Run full pipeline (collect 100 games, prepare, finetune, evaluate)
./FinetunePipeline.sh --stage all --matches 100

# Or run stages separately:
./FinetunePipeline.sh --stage collect --matches 100
./FinetunePipeline.sh --stage finetune
./FinetunePipeline.sh --stage evaluate
```

## 📚 Chi tiết từng bước

### BƯỚC 1: Thu thập Training Data

```bash
# Collect data from MCTS bot (expert)
node DataCollector.js --expert P_AI_MCTS.js --matches 100

# Options:
#   --expert <bot>      Expert bot to learn from (default: P_AI_MCTS.js)
#   --opponent <bot>    Opponent bot (default: P2.js)
#   --matches <num>     Number of matches (default: 10)
#   --verbose           Show detailed output
```

**Output:**
- Training data: `TrainingData/LLM_Training/training_data_*.jsonl`
- Summary: `TrainingData/LLM_Training/summary_*.json`

**Format JSONL:**
```json
{
  "messages": [
    {"role": "user", "content": "Board state and question..."},
    {"role": "assistant", "content": "LEFT"}
  ]
}
```

**Tips:**
- Collect ít nhất 100 matches để có data tốt
- Chỉ collect từ winning games
- Expert bot nên win rate > 70%
- Mỗi game cho ~20-30 training examples

### BƯỚC 2: Chuẩn bị Data

Data đã được format sẵn ở bước 1. Kiểm tra:

```bash
# Check data quality
ls -lh TrainingData/LLM_Training/training_data_*.jsonl

# View sample
head -5 TrainingData/LLM_Training/training_data_*.jsonl | jq
```

### BƯỚC 3: Finetune Model

Có 2 cách finetune:

#### Cách 1: Tạo Custom Model với Ollama (Nhanh, không train thật)

```bash
# Create Modelfile
cat > Modelfile << 'EOF'
FROM qwen3:0.6b

PARAMETER temperature 0.3
PARAMETER top_p 0.9

SYSTEM """
You are an expert tank game player. Always respond with only: LEFT, RIGHT, UP, or DOWN
"""
EOF

# Create model
ollama create qwen3-tank:0.6b -f Modelfile

# Test
ollama run qwen3-tank:0.6b "Choose direction: LEFT, RIGHT, UP, DOWN"
```

#### Cách 2: Training thật với Unsloth (Khuyến nghị)

**Yêu cầu:**
- Python 3.10+
- GPU với CUDA (hoặc dùng Google Colab)
- 8GB+ RAM

**Cài đặt:**

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install unsloth
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install --no-deps xformers trl peft accelerate bitsandbytes
```

**Training Script:**

Tôi đã tạo sẵn file `TrainWithUnsloth.py`. Chạy:

```bash
python TrainWithUnsloth.py \
    --data TrainingData/LLM_Training/training_data_*.jsonl \
    --output qwen3-tank-finetuned

# Options:
#   --data <file>        Training data file (JSONL)
#   --base-model <name>  Base model (default: Qwen/Qwen2.5-0.5B-Instruct)
#   --output <dir>       Output directory
#   --epochs <num>       Number of epochs (default: 3)
#   --batch-size <num>   Batch size (default: 2)
#   --lr <float>         Learning rate (default: 2e-4)
```

**Export to Ollama:**

```bash
# After training, convert to GGUF
python TrainWithUnsloth.py --export-gguf --model qwen3-tank-finetuned

# Create Modelfile
cat > Modelfile << EOF
FROM ./qwen3-tank-finetuned/model.gguf

PARAMETER temperature 0.3
PARAMETER top_p 0.9

SYSTEM """Expert tank game player"""
EOF

# Import to Ollama
ollama create qwen3-tank:0.6b -f Modelfile

# Verify
ollama list | grep qwen3-tank
```

### BƯỚC 4: Test và Đánh giá

```bash
# Set model to use
export OLLAMA_MODEL="qwen3-tank:0.6b"

# Test bot manually
node Arena/P_AI_Ollama.js

# Automated evaluation (10 matches vs P2.js)
node SelfPlayTraining.js \
    --player1 P_AI_Ollama.js \
    --player2 P2.js \
    --matches 10

# Compare with baseline
node SelfPlayTraining.js \
    --player1 P_AI_Ollama.js \
    --player2 P_AI_MCTS.js \
    --matches 20
```

## 📊 Đánh giá Model

### Metrics quan trọng:

1. **Win Rate** - Tỷ lệ thắng
2. **Average Game Length** - Độ dài trung bình (longer = better)
3. **Invalid Moves** - Số nước đi sai
4. **Response Time** - Thời gian phản hồi

### Expected Performance:

| Model | Win Rate vs P2 | Avg Response Time |
|-------|----------------|-------------------|
| Base qwen3:0.6b | 20-30% | 1-2s |
| Custom prompt | 35-45% | 1-2s |
| Finetuned (100 games) | 45-55% | 1-2s |
| Finetuned (1000 games) | 60-70% | 1-2s |
| MCTS (baseline) | 65-75% | 2.5s |

## 🔧 Tối ưu hóa

### Cải thiện data quality:

```bash
# Collect from multiple expert bots
node DataCollector.js --expert P_AI_MCTS.js --matches 50
node DataCollector.js --expert P1.js --matches 50

# Merge data files
cat TrainingData/LLM_Training/training_data_*.jsonl > combined_data.jsonl
```

### Hyperparameter tuning:

```python
# In TrainWithUnsloth.py, adjust:
learning_rate = 2e-4      # Lower for stable, higher for fast
num_epochs = 3            # More epochs = better fit, risk overfit
batch_size = 2            # Higher if you have more VRAM
max_seq_length = 2048     # Adjust based on prompt length
```

### Data augmentation:

```bash
# Collect from different opponents
node DataCollector.js --expert P_AI_MCTS.js --opponent P1.js --matches 50
node DataCollector.js --expert P_AI_MCTS.js --opponent P2.js --matches 50
node DataCollector.js --expert P_AI_MCTS.js --opponent P_AI_LLM.js --matches 20
```

## 🐛 Troubleshooting

### Model không load được:

```bash
# Check Ollama is running
ollama list

# Restart Ollama
# Mac/Linux:
systemctl restart ollama

# Check model file
ls -lh ~/.ollama/models/
```

### Bot chọn nước đi sai:

```bash
# Test model directly
ollama run qwen3-tank:0.6b

# Check prompt format
# Make sure training data matches inference prompt
```

### Training quá chậm:

```bash
# Use smaller model
ollama pull qwen3:0.5b

# Reduce batch size
python TrainWithUnsloth.py --batch-size 1

# Use Colab with GPU
# Upload notebook to Google Colab
```

### Out of memory:

```python
# In training script, use 4-bit quantization:
model = FastLanguageModel.from_pretrained(
    model_name = "Qwen/Qwen2.5-0.5B-Instruct",
    load_in_4bit = True,  # Enable 4-bit
    ...
)
```

## 🚀 Advanced Topics

### 1. Curriculum Learning

Train từ dễ đến khó:

```bash
# Stage 1: Easy opponents
node DataCollector.js --opponent P2.js --matches 50

# Train first model
python TrainWithUnsloth.py --data easy_data.jsonl --output stage1

# Stage 2: Harder opponents
node DataCollector.js --opponent P_AI_MCTS.js --matches 50

# Train second model (starting from stage1)
python TrainWithUnsloth.py --data hard_data.jsonl --base-model ./stage1 --output stage2
```

### 2. Multi-task Learning

Train model để làm nhiều task:

```jsonl
{"messages": [{"role": "user", "content": "Task: play\n..."}, {"role": "assistant", "content": "LEFT"}]}
{"messages": [{"role": "user", "content": "Task: explain\n..."}, {"role": "assistant", "content": "I chose LEFT because..."}]}
```

### 3. Self-play Improvement

```bash
# 1. Train initial model
./FinetunePipeline.sh --stage all --matches 100

# 2. Use finetuned model as expert
export OLLAMA_MODEL="qwen3-tank:0.6b"
node DataCollector.js --expert P_AI_Ollama.js --matches 100

# 3. Retrain with new data
python TrainWithUnsloth.py --data new_data.jsonl --output v2

# 4. Repeat
```

### 4. Ensemble Methods

```javascript
// In P_AI_Ollama.js, combine multiple models:
function ensembleDecision() {
    // Get predictions from 3 models
    const pred1 = callOllama("qwen3-tank-v1:0.6b", prompt);
    const pred2 = callOllama("qwen3-tank-v2:0.6b", prompt);
    const pred3 = callOllama("qwen3-tank-v3:0.6b", prompt);

    // Vote
    return mostCommon([pred1, pred2, pred3]);
}
```

## 📈 Monitoring Training

### TensorBoard:

```bash
# During training with unsloth:
pip install tensorboard
tensorboard --logdir ./runs

# Open http://localhost:6006
```

### WandB (Weights & Biases):

```bash
pip install wandb
wandb login

# In training script:
import wandb
wandb.init(project="tank-game-qwen3")
```

## 🎯 Best Practices

1. **Start small**: Train với 50-100 games đầu tiên
2. **Validate early**: Test sau mỗi 50 training examples
3. **Monitor overfitting**: Giữ validation set riêng
4. **Version models**: Track model versions (v1, v2, v3...)
5. **Log everything**: Save training logs, metrics, configs
6. **Backup data**: Training data rất quý, backup thường xuyên

## 📚 Resources

### Documentation:
- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/docs/README.md)
- [Unsloth Documentation](https://github.com/unslothai/unsloth)
- [Qwen3 Model Card](https://huggingface.co/Qwen)

### Tutorials:
- [Fine-tuning LLMs with Unsloth](https://www.youtube.com/watch?v=yGm87f8uScU)
- [Ollama Model Import Guide](https://github.com/ollama/ollama/blob/main/docs/import.md)

### Communities:
- [Ollama Discord](https://discord.gg/ollama)
- [Unsloth GitHub](https://github.com/unslothai/unsloth)

## 🎓 Next Steps

Sau khi train xong model:

1. **Benchmark**: So sánh với tất cả bot khác
2. **Analyze**: Xem model học được gì, sai ở đâu
3. **Iterate**: Collect thêm data từ failure cases
4. **Share**: Publish model lên Hugging Face hoặc Ollama Library

Good luck with your training! 🚀
