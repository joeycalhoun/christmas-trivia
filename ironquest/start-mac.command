#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing IronQuest (first run only)..."
  npm install
fi
(sleep 4 && open http://localhost:3030) &
npm start
