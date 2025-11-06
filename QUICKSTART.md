# 🚀 Quick Start - AI Tank Bots

## 5 phút để bắt đầu!

### Bước 1: Kiểm tra môi trường

```bash
# Kiểm tra Node.js đã cài chưa
node --version  # Cần >= v12.0.0
```

### Bước 2: Test MCTS Bot (Không cần API)

```bash
# Mở 3 terminal

# Terminal 1: Chạy server
node Server.js

# Terminal 2: Chạy MCTS bot
node Arena/P_AI_MCTS.js

# Terminal 3: Chạy bot đối thủ
node Arena/P1.js
```

Xem console để theo dõi bot suy nghĩ và chơi!

### Bước 3: Test LLM Bot (Nếu có API key)

```bash
# Setup API key (chọn 1 trong 2)

# Option 1: Claude API
export AI_API_KEY="sk-ant-api03-..."
export AI_API_TYPE="claude"

# Option 2: OpenAI API
export AI_API_KEY="sk-..."
export AI_API_TYPE="openai"

# Chạy 3 terminal như trên, nhưng thay:
node Arena/P_AI_LLM.js  # Terminal 2
```

### Bước 4: Tự động test nhiều trận

```bash
# Test 10 trận: MCTS vs Original
node SelfPlayTraining.js --player1 P_AI_MCTS.js --player2 P1.js --matches 10

# Xem kết quả trong thư mục TrainingData/
```

## 🎯 Bước tiếp theo

1. Đọc `README_AI_BOTS.md` để hiểu chi tiết
2. Đọc `AI_BOTS_GUIDE.md` để tùy chỉnh bot
3. Thử nghiệm và improve bot của bạn!

## 🆘 Gặp vấn đề?

**Bot không connect:**
```bash
# Kiểm tra server chạy chưa
ps aux | grep Server.js

# Kill tất cả process cũ
killall node
```

**API lỗi:**
```bash
# Kiểm tra API key
echo $AI_API_KEY

# Test API bằng curl (Claude)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $AI_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

## 📚 File quan trọng

- `README_AI_BOTS.md` - README chính (ĐỌC ĐI!)
- `AI_BOTS_GUIDE.md` - Hướng dẫn chi tiết
- `Arena/P_AI_MCTS.js` - MCTS bot
- `Arena/P_AI_LLM.js` - LLM bot
- `SelfPlayTraining.js` - Training system

Enjoy! 🎮
