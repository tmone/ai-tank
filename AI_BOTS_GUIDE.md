# AI Tank Game - AI Bots Guide

Hướng dẫn sử dụng các bot AI để chơi game Tank tự động.

## 📋 Tổng quan

Dự án này cung cấp 3 loại AI bot khác nhau để chơi game Tank:

1. **P_AI_LLM.js** - Bot sử dụng API của Large Language Models (Claude/GPT)
2. **P_AI_MCTS.js** - Bot sử dụng thuật toán Monte Carlo Tree Search
3. **SelfPlayTraining.js** - Hệ thống tự động cho các bot thi đấu với nhau

## 🤖 1. LLM Bot (P_AI_LLM.js)

Bot này sử dụng các mô hình AI tiên tiến như Claude hoặc GPT để phân tích bàn cờ và đưa ra quyết định.

### Ưu điểm:
- Có khả năng "suy nghĩ" chiến lược như con người
- Có thể giải thích lý do đằng sau mỗi nước đi
- Linh hoạt, có thể học từ ngữ cảnh

### Nhược điểm:
- Cần kết nối internet
- Cần API key (có thể tốn phí)
- Chậm hơn các thuật toán truyền thống
- Phụ thuộc vào chất lượng API

### Cách sử dụng:

#### Bước 1: Cấu hình API Key

**Với Claude API:**
```bash
export AI_API_KEY="your-claude-api-key"
export AI_API_TYPE="claude"
```

**Với OpenAI API:**
```bash
export AI_API_KEY="your-openai-api-key"
export AI_API_TYPE="openai"
```

#### Bước 2: Chạy bot

```bash
# Test với server local
node Arena/P_AI_LLM.js

# Hoặc chỉ định host và port
node Arena/P_AI_LLM.js -h 127.0.0.1 -p 3011
```

#### Lấy API Key:

**Claude API:**
1. Truy cập: https://console.anthropic.com/
2. Đăng ký tài khoản
3. Tạo API key trong phần Settings

**OpenAI API:**
1. Truy cập: https://platform.openai.com/
2. Đăng ký tài khoản
3. Tạo API key trong phần API Keys

### Cách hoạt động:

Bot sẽ:
1. Phân tích trạng thái bàn cờ hiện tại
2. Xác định các nước đi hợp lệ
3. Gửi thông tin đến API của Claude/GPT
4. AI phân tích và đưa ra quyết định
5. Bot thực hiện nước đi được đề xuất

## 🎯 2. MCTS Bot (P_AI_MCTS.js)

Bot sử dụng thuật toán Monte Carlo Tree Search - một thuật toán AI mạnh mẽ được sử dụng trong AlphaGo.

### Ưu điểm:
- Không cần API key hay internet
- Rất mạnh trong các game turn-based
- Tự động cân bằng giữa exploration và exploitation
- Có thể chạy offline hoàn toàn

### Nhược điểm:
- Tốn tài nguyên CPU
- Hiệu quả phụ thuộc vào thời gian suy nghĩ

### Cách sử dụng:

```bash
# Chạy bot MCTS
node Arena/P_AI_MCTS.js

# Với custom host/port
node Arena/P_AI_MCTS.js -h 127.0.0.1 -p 3011
```

### Cách hoạt động:

MCTS gồm 4 bước chính:
1. **Selection**: Chọn nhánh đầy hứa hẹn nhất
2. **Expansion**: Mở rộng cây tìm kiếm
3. **Simulation**: Mô phỏng game đến khi kết thúc
4. **Backpropagation**: Cập nhật thông tin về kết quả

Bot sẽ lặp lại quá trình này nhiều lần trong 2.8 giây để tìm nước đi tốt nhất.

## 🔄 3. Self-Play Training System (SelfPlayTraining.js)

Hệ thống tự động cho phép các bot đấu với nhau, thu thập dữ liệu training.

### Tính năng:
- Tự động chạy nhiều trận đấu
- Lưu lại replay của mỗi trận
- Thống kê win rate
- Tạo training dataset

### Cách sử dụng:

```bash
# Chạy 10 trận giữa P1.js và P2.js
node SelfPlayTraining.js --player1 P1.js --player2 P2.js --matches 10

# Test MCTS vs LLM
node SelfPlayTraining.js --player1 P_AI_MCTS.js --player2 P_AI_LLM.js --matches 5

# Với verbose output
node SelfPlayTraining.js --player1 P1.js --player2 P2.js --matches 5 --verbose

# Không lưu replay (nhanh hơn)
node SelfPlayTraining.js --player1 P1.js --player2 P2.js --matches 100 --no-replay
```

### Tham số:
- `--player1 <file>`: Bot người chơi 1
- `--player2 <file>`: Bot người chơi 2
- `--matches <num>`: Số trận đấu
- `--port <num>`: Port của server (mặc định 3011)
- `--verbose`: Hiển thị chi tiết
- `--no-replay`: Không lưu replay

### Output:

Kết quả được lưu trong thư mục `TrainingData/`:
- `summary_*.json`: Thống kê tổng hợp
- `Replays/match_*.txt`: Chi tiết từng trận

## 📊 So sánh các Bot

| Bot | Độ mạnh | Tốc độ | Yêu cầu | Chi phí |
|-----|---------|--------|---------|---------|
| P1.js (Original) | ⭐⭐⭐⭐ | ⚡⚡⚡ | Không | Miễn phí |
| P2.js (Original) | ⭐⭐⭐⭐ | ⚡⚡⚡ | Không | Miễn phí |
| P_AI_MCTS.js | ⭐⭐⭐⭐⭐ | ⚡⚡ | CPU | Miễn phí |
| P_AI_LLM.js | ⭐⭐⭐ | ⚡ | API Key | Có phí |

## 🎮 Ví dụ Thực tế

### Ví dụ 1: Test MCTS bot

```bash
# Terminal 1: Start server
node Server.js

# Terminal 2: Chạy MCTS bot (Player 1)
node Arena/P_AI_MCTS.js

# Terminal 3: Chạy original bot (Player 2)
node Arena/P2.js
```

### Ví dụ 2: Test LLM bot với Claude

```bash
# Set API key
export AI_API_KEY="sk-ant-..."
export AI_API_TYPE="claude"

# Terminal 1: Start server
node Server.js

# Terminal 2: Chạy LLM bot
node Arena/P_AI_LLM.js

# Terminal 3: Chạy MCTS bot
node Arena/P_AI_MCTS.js
```

### Ví dụ 3: Tự động test nhiều trận

```bash
# So sánh MCTS vs Original bot (100 trận)
node SelfPlayTraining.js --player1 P_AI_MCTS.js --player2 P1.js --matches 100

# Kết quả sẽ được lưu trong TrainingData/
```

## 🔧 Tùy chỉnh Bot

### Điều chỉnh MCTS Bot:

Trong file `P_AI_MCTS.js`, bạn có thể thay đổi:

```javascript
var MAX_THINKING_TIME = 2800; // Thời gian suy nghĩ (ms)
var EXPLORATION_CONSTANT = 1.414; // Hệ số exploration (UCB1)
```

### Điều chỉnh LLM Bot:

Trong file `P_AI_LLM.js`, bạn có thể:
- Thay đổi prompt để AI suy nghĩ khác đi
- Thay đổi model (ví dụ từ GPT-4 sang GPT-3.5)
- Thêm context về các trận đã chơi

## 🚀 Ý tưởng Mở rộng

### 1. Neural Network Bot
- Training neural network từ replay data
- Sử dụng TensorFlow.js
- Input: Board state
- Output: Move probabilities

### 2. Hybrid Bot
- Kết hợp MCTS + Neural Network
- Như AlphaGo Zero
- Neural network đánh giá position
- MCTS tìm kiếm nước đi

### 3. Reinforcement Learning
- Sử dụng Q-Learning hoặc PPO
- Tự học từ self-play
- Reward shaping cho chiến lược tốt

### 4. Ensemble Bot
- Kết hợp nhiều bot
- Voting mechanism
- Tận dụng điểm mạnh của từng bot

## 📝 Tips và Tricks

### Để bot LLM chơi tốt hơn:
1. Cung cấp thêm context về các nước đi trước
2. Thêm thông tin về chiến lược thành công
3. Sử dụng few-shot learning với ví dụ

### Để MCTS mạnh hơn:
1. Tăng thời gian suy nghĩ
2. Cải thiện heuristic trong simulation
3. Thêm domain knowledge vào evaluation

### Training hiệu quả:
1. Chạy nhiều trận với seed khác nhau
2. Lưu lại các position thú vị
3. Phân tích các pattern thắng thua

## 🐛 Troubleshooting

### Bot không kết nối được:
- Kiểm tra server đã chạy chưa
- Kiểm tra port đúng chưa
- Kiểm tra firewall

### LLM bot trả về lỗi:
- Kiểm tra API key
- Kiểm tra quota API
- Kiểm tra kết nối internet

### MCTS bot timeout:
- Giảm MAX_THINKING_TIME
- Giảm độ sâu simulation
- Tối ưu code

## 📚 Tài liệu Tham khảo

- [Monte Carlo Tree Search](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)
- [Claude API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [AlphaGo Paper](https://www.nature.com/articles/nature16961)

## 🤝 Đóng góp

Nếu bạn có ý tưởng cải thiện hoặc tìm thấy bug, hãy:
1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Tạo Pull Request

## 📄 License

MIT License - Tự do sử dụng và chỉnh sửa cho mục đích học tập và nghiên cứu.
