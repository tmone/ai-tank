#!/bin/bash

echo "========================================"
echo "Testing LLM Bot vs MCTS Bot"
echo "========================================"
echo ""

# Check if API key is set
if [ -z "$AI_API_KEY" ]; then
    echo "ERROR: AI_API_KEY is not set!"
    echo "Please set your API key:"
    echo "  export AI_API_KEY='your-api-key'"
    echo "  export AI_API_TYPE='claude' or 'openai'"
    exit 1
fi

echo "Using AI API Type: ${AI_API_TYPE:-claude}"
echo ""

echo "Starting server..."
node Server.js &
SERVER_PID=$!

sleep 2

echo "Starting LLM Bot (Player 1)..."
node Arena/P_AI_LLM.js &
P1_PID=$!

sleep 1

echo "Starting MCTS Bot (Player 2)..."
node Arena/P_AI_MCTS.js &
P2_PID=$!

echo ""
echo "All processes started!"
echo "Press Ctrl+C to stop all processes"
echo ""

# Wait for any process to exit
wait

# Cleanup
kill $SERVER_PID $P1_PID $P2_PID 2>/dev/null
