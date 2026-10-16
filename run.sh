#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting End-to-End MCP Agent Pipeline..."

# 1. Create Virtual Environment
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
else
    echo "✅ Virtual environment already exists."
fi

# 2. Activate Virtual Environment
echo "🔄 Activating virtual environment..."
source .venv/bin/activate

# 3. Install Dependencies from requirements.txt
echo "⬇️ Installing dependencies..."
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "❌ requirements.txt not found! Run 'pip freeze > requirements.txt' first."
    exit 1
fi

# 4. Check for OpenAI API Key
if [ ! -f ".env" ] || ! grep -q "OPENAI_API_KEY" ".env"; then
    echo "⚠️ WARNING: .env file missing or OPENAI_API_KEY not found."
    echo "Make sure your .env file contains: OPENAI_API_KEY=\"sk-...\""
    sleep 2
fi

# 5. Generate the Database
echo "📊 Generating telemetry.db dataset with anomalies..."
python src/core/generate_data.py

# 6. Run the Agent
echo "🤖 Booting MCP server and running diagnostics..."
python src/main.py

echo "✅ Pipeline execution finished."
