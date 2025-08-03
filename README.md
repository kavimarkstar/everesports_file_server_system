# EverEsports Server

Cross-platform startup scripts for the EverEsports server.

## Platform-Specific Startup Scripts

### Windows
Use `run.bat`:
```cmd
run.bat
```
Or double-click the `run.bat` file.

### Linux/Ubuntu
Use `run.sh`:
```bash
./run.sh
```
Or:
```bash
bash run.sh
```

### Universal (All Platforms)
Use `run.js`:
```bash
node run.js
```

## Features

All scripts include:
- ✅ Automatic directory navigation to script location
- ✅ Error handling and validation
- ✅ Platform detection (universal script)
- ✅ Graceful shutdown handling
- ✅ Node.js availability checking (Linux/Ubuntu)

## Requirements

- Node.js installed and available in PATH
- `server.js` file in the same directory as the scripts

## Troubleshooting

1. **"Node.js not found"**: Install Node.js from https://nodejs.org/
2. **"server.js not found"**: Ensure `server.js` is in the same directory as the scripts
3. **Permission denied (Linux/Ubuntu)**: Run `chmod +x run.sh` to make the script executable

## Script Details

- **run.bat**: Windows batch file with error handling
- **run.sh**: Linux/Ubuntu bash script with Node.js validation
- **run.js**: Universal Node.js script that works on all platforms 