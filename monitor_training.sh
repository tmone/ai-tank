#!/bin/bash

# Monitor training progress in real-time

echo "╔════════════════════════════════════════════════════════╗"
echo "║         TRAINING PROGRESS MONITOR                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║         TRAINING PROGRESS MONITOR                      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "📊 Current Status ($(date '+%H:%M:%S')):"
    echo "────────────────────────────────────────────────────────────"

    # Count training data files
    if [ -d "TrainingData/LLM_Training" ]; then
        JSONL_FILES=$(ls TrainingData/LLM_Training/*.jsonl 2>/dev/null | wc -l)
        echo "  Training data files: $JSONL_FILES"

        if [ $JSONL_FILES -gt 0 ]; then
            TOTAL_EXAMPLES=$(cat TrainingData/LLM_Training/*.jsonl 2>/dev/null | wc -l)
            echo "  Total training examples: $TOTAL_EXAMPLES"

            # Show latest file info
            LATEST=$(ls -t TrainingData/LLM_Training/*.jsonl 2>/dev/null | head -1)
            if [ ! -z "$LATEST" ]; then
                LATEST_EXAMPLES=$(wc -l < "$LATEST")
                LATEST_NAME=$(basename "$LATEST")
                echo "  Latest file: $LATEST_NAME ($LATEST_EXAMPLES examples)"
            fi
        fi
    fi

    echo ""

    # Check if any collection process running
    if pgrep -f "DataCollector.js" > /dev/null; then
        echo "  ✅ Data collection RUNNING"
    else
        echo "  ⏸️  Data collection NOT running"
    fi

    if pgrep -f "TrainWithUnsloth" > /dev/null; then
        echo "  ✅ Training RUNNING"
    else
        echo "  ⏸️  Training NOT running"
    fi

    if pgrep -f "EvaluateModel" > /dev/null; then
        echo "  ✅ Evaluation RUNNING"
    else
        echo "  ⏸️  Evaluation NOT running"
    fi

    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo "  Progress Target: 500+ examples for good training"
    if [ ! -z "$TOTAL_EXAMPLES" ]; then
        PROGRESS=$((TOTAL_EXAMPLES * 100 / 500))
        if [ $PROGRESS -gt 100 ]; then PROGRESS=100; fi
        echo "  Progress: $PROGRESS% ($TOTAL_EXAMPLES/500)"

        # Progress bar
        BAR_LENGTH=40
        FILLED=$((BAR_LENGTH * PROGRESS / 100))
        printf "  ["
        printf "%${FILLED}s" | tr ' ' '█'
        printf "%$((BAR_LENGTH - FILLED))s" | tr ' ' '░'
        printf "]\n"
    fi

    echo ""
    echo "  Press Ctrl+C to stop monitoring"
    echo "────────────────────────────────────────────────────────────"

    sleep 5
done
