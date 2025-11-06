#!/bin/bash

echo "========================================"
echo "Testing MCTS Bot vs Original Bot"
echo "========================================"
echo ""

echo "Starting server..."
node Server.js &
SERVER_PID=$!

sleep 2

echo "Starting MCTS Bot (Player 1)..."
node Arena/P_AI_MCTS.js &
P1_PID=$!

sleep 1

echo "Starting Original Bot (Player 2)..."
node Arena/P2.js &
P2_PID=$!

echo ""
echo "All processes started!"
echo "Press Ctrl+C to stop all processes"
echo ""

# Wait for any process to exit
wait

# Cleanup
kill $SERVER_PID $P1_PID $P2_PID 2>/dev/null
