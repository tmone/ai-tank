#!/bin/bash

# ==================== QWEN3 FINETUNE PIPELINE =====================
# Complete pipeline for finetuning Qwen3:0.6b model with Ollama
#
# Usage:
#   ./FinetunePipeline.sh --stage <stage> [options]
#
# Stages:
#   collect    - Collect training data from expert bot
#   prepare    - Prepare data for finetuning
#   finetune   - Finetune the model
#   evaluate   - Evaluate finetuned model
#   all        - Run all stages
# ==================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
STAGE="all"
EXPERT_BOT="P_AI_MCTS.js"
OPPONENT_BOT="P2.js"
NUM_MATCHES=100
BASE_MODEL="qwen3:0.6b"
FINETUNED_MODEL="qwen3-tank:0.6b"
TRAINING_DATA_DIR="./TrainingData/LLM_Training"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)
            STAGE="$2"
            shift 2
            ;;
        --expert)
            EXPERT_BOT="$2"
            shift 2
            ;;
        --opponent)
            OPPONENT_BOT="$2"
            shift 2
            ;;
        --matches)
            NUM_MATCHES="$2"
            shift 2
            ;;
        --base-model)
            BASE_MODEL="$2"
            shift 2
            ;;
        --output-model)
            FINETUNED_MODEL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Ollama is installed
check_ollama() {
    log_info "Checking Ollama installation..."
    if ! command -v ollama &> /dev/null; then
        log_error "Ollama is not installed!"
        log_info "Install it from: https://ollama.ai"
        exit 1
    fi
    log_success "Ollama is installed"
}

# Check if base model exists
check_base_model() {
    log_info "Checking if base model exists: $BASE_MODEL"
    if ! ollama list | grep -q "$BASE_MODEL"; then
        log_warning "Base model not found. Pulling..."
        ollama pull "$BASE_MODEL"
    fi
    log_success "Base model ready: $BASE_MODEL"
}

# Stage 1: Collect training data
collect_data() {
    log_info "========== STAGE 1: COLLECTING TRAINING DATA =========="
    log_info "Expert bot: $EXPERT_BOT"
    log_info "Opponent bot: $OPPONENT_BOT"
    log_info "Number of matches: $NUM_MATCHES"

    node DataCollector.js \
        --expert "$EXPERT_BOT" \
        --opponent "$OPPONENT_BOT" \
        --matches "$NUM_MATCHES"

    log_success "Data collection complete!"
}

# Stage 2: Prepare data for finetuning
prepare_data() {
    log_info "========== STAGE 2: PREPARING DATA =========="

    # Find the most recent training data file
    LATEST_DATA=$(ls -t "$TRAINING_DATA_DIR"/training_data_*.jsonl 2>/dev/null | head -1)

    if [ -z "$LATEST_DATA" ]; then
        log_error "No training data found! Run collect stage first."
        exit 1
    fi

    log_info "Using training data: $LATEST_DATA"

    # Count examples
    NUM_EXAMPLES=$(wc -l < "$LATEST_DATA")
    log_info "Total training examples: $NUM_EXAMPLES"

    if [ "$NUM_EXAMPLES" -lt 50 ]; then
        log_warning "Only $NUM_EXAMPLES examples found. Consider collecting more data."
    fi

    # Create Modelfile
    log_info "Creating Modelfile..."

    cat > "$TRAINING_DATA_DIR/Modelfile" << EOF
FROM $BASE_MODEL

# Set the temperature for more deterministic responses during gameplay
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40

# System message
SYSTEM """
You are an expert at playing a strategic tank game. You always choose the best move that:
1. Controls more territory
2. Cuts off opponent's escape routes
3. Avoids corners and dead ends
4. Maximizes future move options

You respond with ONLY the direction: LEFT, RIGHT, UP, or DOWN
"""
EOF

    log_success "Modelfile created at: $TRAINING_DATA_DIR/Modelfile"
    log_success "Data preparation complete!"
}

# Stage 3: Finetune the model
finetune_model() {
    log_info "========== STAGE 3: FINETUNING MODEL =========="

    # Note: Ollama doesn't support direct finetuning yet
    # We'll create a customized model with the system prompt
    # For real finetuning, you'd need to use tools like:
    # - unsloth
    # - axolotl
    # - llama.cpp with LoRA

    log_warning "Ollama doesn't support direct finetuning yet."
    log_info "Creating a customized model with optimized parameters..."

    cd "$TRAINING_DATA_DIR"
    ollama create "$FINETUNED_MODEL" -f Modelfile
    cd - > /dev/null

    log_success "Model created: $FINETUNED_MODEL"
    log_info ""
    log_info "For actual finetuning with your collected data, use:"
    log_info "  1. Export base model: ollama show $BASE_MODEL --modelfile > base_modelfile.txt"
    log_info "  2. Use unsloth or axolotl to finetune with your JSONL data"
    log_info "  3. Convert finetuned model to GGUF format"
    log_info "  4. Import to Ollama: ollama create $FINETUNED_MODEL -f your_modelfile"
    log_info ""
    log_info "See OLLAMA_TRAINING_GUIDE.md for detailed instructions"
}

# Stage 4: Evaluate the model
evaluate_model() {
    log_info "========== STAGE 4: EVALUATING MODEL =========="

    log_info "Testing finetuned model against original bots..."

    # Set the model to use
    export OLLAMA_MODEL="$FINETUNED_MODEL"

    log_info "Running evaluation matches (10 games)..."
    node SelfPlayTraining.js \
        --player1 P_AI_Ollama.js \
        --player2 P2.js \
        --matches 10

    log_success "Evaluation complete!"
    log_info "Check TrainingData/ for results"
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║       QWEN3 TANK GAME FINETUNING PIPELINE             ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    check_ollama
    check_base_model

    case $STAGE in
        collect)
            collect_data
            ;;
        prepare)
            prepare_data
            ;;
        finetune)
            prepare_data
            finetune_model
            ;;
        evaluate)
            evaluate_model
            ;;
        all)
            collect_data
            prepare_data
            finetune_model
            evaluate_model
            ;;
        *)
            log_error "Unknown stage: $STAGE"
            log_info "Valid stages: collect, prepare, finetune, evaluate, all"
            exit 1
            ;;
    esac

    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║                  PIPELINE COMPLETE!                    ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

main
