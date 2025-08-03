#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where this script is located
const scriptDir = __dirname;

// Change to the script directory
process.chdir(scriptDir);

console.log('Starting Node server...');

// Check if server.js exists
const serverPath = path.join(scriptDir, 'server.js');
if (!fs.existsSync(serverPath)) {
    console.error('Error: server.js not found in', scriptDir);
    process.exit(1);
}

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: scriptDir
});

server.on('error', (err) => {
    console.error('Error: Failed to start server:', err.message);
    process.exit(1);
});

server.on('exit', (code) => {
    if (code !== 0) {
        console.error(`Server exited with code ${code}`);
        process.exit(code);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    server.kill('SIGTERM');
}); 