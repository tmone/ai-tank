@echo off
echo ========================================
echo Testing MCTS Bot vs Original Bot
echo ========================================
echo.

echo Starting server...
start "Server" cmd /c "node Server.js"

timeout /t 2 /nobreak > nul

echo Starting MCTS Bot (Player 1)...
start "MCTS Bot" cmd /c "node Arena/P_AI_MCTS.js"

timeout /t 1 /nobreak > nul

echo Starting Original Bot (Player 2)...
start "Original Bot" cmd /c "node Arena/P2.js"

echo.
echo All processes started!
echo Watch the game windows to see the match.
pause
