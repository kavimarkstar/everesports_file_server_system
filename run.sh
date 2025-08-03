#!/bin/bash

# Change to the directory where this script is located
cd "$(dirname "$0")"

echo "Starting Node server..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Start the server
node server.js

# Check if the server started successfully
if [ $? -ne 0 ]; then
    echo "Error: Failed to start server"
    exit 1
fi 