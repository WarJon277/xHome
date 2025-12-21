#!/bin/bash

# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 5050 &

# Wait a bit for server to start
sleep 2

# Open browser
if command -v xdg-open > /dev/null; then
    xdg-open http://192.168.0.182:5050/static/index.html
elif command -v open > /dev/null; then
    open http://192.168.0.182:5050/static/index.html
else
    echo "Open http://192.168.0.182:5050/static/index.html in your browser"
fi