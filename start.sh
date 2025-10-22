#!/bin/bash

# Check for tmux
if ! command -v tmux &> /dev/null; then
  echo "tmux is not installed. Please install tmux first."
  exit 1
fi

# Check for nvm
if [ -z "$NVM_DIR" ]; then
  export NVM_DIR="$HOME/.nvm"
fi
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found. Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
else
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  echo "nvm is already installed."
fi

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "npm not found. Installing latest Node.js LTS via nvm..."
  nvm install --lts
else
  echo "npm is already installed."
fi

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
  echo "pnpm not found. Installing pnpm..."
  npm install -g pnpm
else
  echo "pnpm is already installed."
fi

# Check for bun
if ! command -v bun &> /dev/null; then
  echo "bun not found. Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
else
  echo "bun is already installed."
fi

# Convert .env.example to .env if needed
if [ -f "$HOME/Trendpup/scraper/.env.example" ] && [ ! -f "$HOME/Trendpup/scraper/.env" ]; then
  mv "$HOME/Trendpup/scraper/.env.example" "$HOME/Trendpup/scraper/.env"
  echo "Moved scraper .env.example to .env"
fi
if [ -f "$HOME/Trendpup/eliza/trendpup/.env.example" ] && [ ! -f "$HOME/Trendpup/eliza/trendpup/.env" ]; then
  mv "$HOME/Trendpup/eliza/trendpup/.env.example" "$HOME/Trendpup/eliza/trendpup/.env"
  echo "Moved eliza/trendpup .env.example to .env"
fi

# Start frontend session
if ! tmux has-session -t frontend 2>/dev/null; then
  tmux new-session -d -s frontend "cd $HOME/Trendpup/frontend && pnpm install && pnpm build && pnpm start"
  echo "Started tmux session: frontend"
else
  echo "tmux session 'frontend' already exists."
fi

# Start scraper session
if ! tmux has-session -t scraper 2>/dev/null; then
  tmux new-session -d -s scraper "cd $HOME/Trendpup/scraper && pnpm install && pnpm exec playwright install && pnpm exec playwright install-deps && pnpm build && pnpm start"
  echo "Started tmux session: scraper"
else
  echo "tmux session 'scraper' already exists."
fi

# Start agent session
if ! tmux has-session -t agent 2>/dev/null; then
  tmux new-session -d -s agent "cd $HOME/Trendpup/eliza/trendpup && bun run dev"
  echo "Started tmux session: agent"
else
  echo "tmux session 'agent' already exists."
fi

# List sessions
sleep 1
tmux ls
