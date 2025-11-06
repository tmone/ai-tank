#!/usr/bin/env python3
"""
QWEN3 TANK GAME FINETUNING WITH UNSLOTH

This script finetunes Qwen3 model for playing the tank game using Unsloth library.

Usage:
    python TrainWithUnsloth.py --data <training_data.jsonl> --output <output_dir>

Requirements:
    - Python 3.10+
    - CUDA GPU (or use Google Colab)
    - Install: pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
"""

import argparse
import json
import os
from pathlib import Path
from typing import List, Dict

# Check if running in Colab
try:
    import google.colab
    IN_COLAB = True
except:
    IN_COLAB = False

def parse_args():
    parser = argparse.ArgumentParser(description='Finetune Qwen3 for tank game')
    parser.add_argument('--data', type=str, required=True,
                        help='Path to training data (JSONL file)')
    parser.add_argument('--base-model', type=str, default='unsloth/Qwen2.5-0.5B-Instruct',
                        help='Base model to finetune')
    parser.add_argument('--output', type=str, default='qwen3-tank-finetuned',
                        help='Output directory')
    parser.add_argument('--epochs', type=int, default=3,
                        help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=2,
                        help='Training batch size')
    parser.add_argument('--lr', type=float, default=2e-4,
                        help='Learning rate')
    parser.add_argument('--max-seq-length', type=int, default=2048,
                        help='Maximum sequence length')
    parser.add_argument('--lora-r', type=int, default=16,
                        help='LoRA rank')
    parser.add_argument('--lora-alpha', type=int, default=16,
                        help='LoRA alpha')
    parser.add_argument('--export-gguf', action='store_true',
                        help='Export to GGUF format for Ollama')
    parser.add_argument('--export-merged', action='store_true',
                        help='Export merged model (full model, not LoRA)')
    return parser.parse_args()

def load_training_data(file_path: str) -> List[Dict]:
    """Load training data from JSONL file"""
    data = []
    with open(file_path, 'r') as f:
        for line in f:
            try:
                item = json.loads(line.strip())
                data.append(item)
            except json.JSONDecodeError:
                continue
    return data

def prepare_dataset(data: List[Dict], tokenizer):
    """Prepare dataset for training"""
    from datasets import Dataset

    # Convert to Hugging Face dataset format
    formatted_data = []
    for item in data:
        messages = item.get('messages', [])
        if len(messages) >= 2:
            formatted_data.append({
                'messages': messages
            })

    dataset = Dataset.from_list(formatted_data)
    return dataset

def main():
    args = parse_args()

    print("=" * 60)
    print("QWEN3 TANK GAME FINETUNING")
    print("=" * 60)
    print(f"Base model: {args.base_model}")
    print(f"Training data: {args.data}")
    print(f"Output directory: {args.output}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch_size}")
    print(f"Learning rate: {args.lr}")
    print("=" * 60)
    print()

    # Install dependencies if needed
    print("Checking dependencies...")
    try:
        from unsloth import FastLanguageModel
        from unsloth import is_bfloat16_supported
    except ImportError:
        print("Installing unsloth...")
        import subprocess
        subprocess.check_call([
            'pip', 'install',
            'unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git'
        ])
        from unsloth import FastLanguageModel
        from unsloth import is_bfloat16_supported

    try:
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except ImportError:
        print("Installing training dependencies...")
        import subprocess
        subprocess.check_call(['pip', 'install', '--no-deps', 'xformers', 'trl', 'peft', 'accelerate', 'bitsandbytes'])
        from trl import SFTTrainer
        from transformers import TrainingArguments

    # Load training data
    print("\nLoading training data...")
    training_data = load_training_data(args.data)
    print(f"Loaded {len(training_data)} training examples")

    if len(training_data) < 10:
        print("WARNING: Very few training examples. Consider collecting more data.")

    # Load base model
    print(f"\nLoading base model: {args.base_model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,  # Auto-detect
        load_in_4bit=True,  # Use 4-bit quantization to save memory
    )

    # Add LoRA adapters
    print("\nAdding LoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=args.lora_alpha,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )

    # Prepare dataset
    print("\nPreparing dataset...")
    dataset = prepare_dataset(training_data, tokenizer)

    # Split into train/validation (90/10)
    split_dataset = dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split_dataset['train']
    eval_dataset = split_dataset['test']

    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(eval_dataset)}")

    # Setup trainer
    print("\nSetting up trainer...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dataset_text_field="messages",
        max_seq_length=args.max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir=args.output,
            evaluation_strategy="steps",
            eval_steps=50,
            save_strategy="steps",
            save_steps=100,
            save_total_limit=3,
            load_best_model_at_end=True,
        ),
    )

    # Show model info
    gpu_stats = torch.cuda.get_device_properties(0)
    start_gpu_memory = round(torch.cuda.max_memory_reserved() / 1024 / 1024 / 1024, 3)
    max_memory = round(gpu_stats.total_memory / 1024 / 1024 / 1024, 3)
    print(f"\nGPU: {gpu_stats.name}")
    print(f"GPU memory: {start_gpu_memory} GB / {max_memory} GB")
    print()

    # Train!
    print("=" * 60)
    print("STARTING TRAINING")
    print("=" * 60)
    print()

    import torch
    trainer_stats = trainer.train()

    print()
    print("=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print()

    # Show stats
    used_memory = round(torch.cuda.max_memory_reserved() / 1024 / 1024 / 1024, 3)
    used_memory_for_lora = round(used_memory - start_gpu_memory, 3)
    used_percentage = round(used_memory / max_memory * 100, 3)
    lora_percentage = round(used_memory_for_lora / max_memory * 100, 3)

    print(f"Peak memory: {used_memory} GB ({used_percentage}%)")
    print(f"Memory for LoRA: {used_memory_for_lora} GB ({lora_percentage}%)")
    print()

    # Save model
    print("Saving model...")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"Model saved to: {args.output}")

    # Export options
    if args.export_merged:
        print("\nExporting merged model...")
        model.save_pretrained_merged(
            f"{args.output}_merged",
            tokenizer,
            save_method="merged_16bit"
        )
        print(f"Merged model saved to: {args.output}_merged")

    if args.export_gguf:
        print("\nExporting to GGUF format...")
        model.save_pretrained_gguf(
            f"{args.output}_gguf",
            tokenizer,
            quantization_method="q4_k_m"  # Good balance of size/quality
        )
        print(f"GGUF model saved to: {args.output}_gguf")
        print()
        print("To use with Ollama:")
        print(f"  1. Create Modelfile:")
        print(f"       FROM ./{args.output}_gguf/model.gguf")
        print(f"  2. Import to Ollama:")
        print(f"       ollama create qwen3-tank:0.6b -f Modelfile")

    print()
    print("=" * 60)
    print("ALL DONE! 🎉")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Test the model:")
    print(f"       export OLLAMA_MODEL=qwen3-tank:0.6b")
    print(f"       node Arena/P_AI_Ollama.js")
    print("  2. Evaluate performance:")
    print(f"       node SelfPlayTraining.js --player1 P_AI_Ollama.js --player2 P2.js --matches 10")
    print()

if __name__ == '__main__':
    main()
