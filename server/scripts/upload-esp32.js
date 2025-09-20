#!/usr/bin/env node

// ESP32 Firmware Upload Script for RFIDWallet Project
// Automatically stops the serial bridge, uploads firmware, and restarts the bridge

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SERIAL_PORT = process.env.SERIAL_PORT || 'COM5';
const ESP32_SKETCH_PATH = path.resolve(__dirname, '../../esp32/RC522_UID_Serial');
const BOARD_FQBN = 'esp32:esp32:esp32';

console.log('🔧 ESP32 Firmware Upload for RFIDWallet');
console.log('==========================================');
console.log(`Serial Port: ${SERIAL_PORT}`);
console.log(`Sketch Path: ${ESP32_SKETCH_PATH}`);
console.log(`Board FQBN: ${BOARD_FQBN}`);
console.log('');

// Check if Arduino CLI is available
function checkArduinoCLI() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking Arduino CLI availability...');
    exec('arduino-cli version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Arduino CLI not found. Please install it first:');
        console.error('   https://arduino.github.io/arduino-cli/latest/installation/');
        console.error('   Error details:', error.message);
        reject(error);
      } else {
        console.log('✅ Arduino CLI found:', stdout.trim());
        resolve();
      }
    });
  });
}

// Check if ESP32 is connected and available
function checkESP32Available() {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Checking if ESP32 is available on ${SERIAL_PORT}...`);
    
    exec('arduino-cli board list --format json', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to list boards:', error.message);
        reject(error);
        return;
      }
      
      try {
        const boards = JSON.parse(stdout);
        const esp32Board = boards.find(board => 
          board.port && board.port.address === SERIAL_PORT
        );
        
        if (esp32Board) {
          console.log('✅ ESP32 detected on', SERIAL_PORT);
          console.log('   Board info:', {
            protocol: esp32Board.port.protocol,
            protocolLabel: esp32Board.port.protocol_label,
            boardName: esp32Board.matching_boards?.[0]?.name || 'Unknown'
          });
          resolve();
        } else {
          console.error(`❌ ESP32 not found on ${SERIAL_PORT}`);
          console.error('📋 Available ports:');
          
          if (boards.length === 0) {
            console.error('   No boards detected. Please check:');
            console.error('   • ESP32 is connected via USB');
            console.error('   • USB cable supports data transfer');
            console.error('   • ESP32 drivers are installed');
          } else {
            boards.forEach(board => {
              if (board.port) {
                console.error(`   • ${board.port.address} (${board.port.protocol_label})`);
                if (board.matching_boards && board.matching_boards.length > 0) {
                  console.error(`     └─ ${board.matching_boards[0].name}`);
                }
              }
            });
          }
          
          reject(new Error(`ESP32 not available on ${SERIAL_PORT}`));
        }
      } catch (parseError) {
        console.error('❌ Failed to parse board list:', parseError.message);
        reject(parseError);
      }
    });
  });
}

// Stop any running serial bridge process
function stopSerialBridge() {
  return new Promise((resolve) => {
    console.log('🛑 Stopping serial bridge...');
    
    // On Windows, find and kill node processes running serialBridge.js
    if (process.platform === 'win32') {
      exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout) => {
        if (!error && stdout.includes('serialBridge.js')) {
          exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *serialBridge*"', () => {
            console.log('✅ Serial bridge stopped');
            resolve();
          });
        } else {
          console.log('ℹ️  No serial bridge process found');
          resolve();
        }
      });
    } else {
      // Unix-like systems
      exec('pkill -f serialBridge.js', () => {
        console.log('✅ Serial bridge stopped');
        resolve();
      });
    }
    
    // Fallback timeout
    setTimeout(resolve, 2000);
  });
}

// Install ESP32 core if not present
function installESP32Core() {
  return new Promise((resolve, reject) => {
    console.log('📦 Checking ESP32 core installation...');
    
    const installProcess = spawn('arduino-cli', ['core', 'install', 'esp32:esp32'], {
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let output = '';
    installProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    
    installProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });
    
    installProcess.on('close', (code) => {
      if (code === 0 || output.includes('already installed')) {
        console.log('✅ ESP32 core ready');
        resolve();
      } else {
        reject(new Error(`ESP32 core installation failed with code ${code}`));
      }
    });
  });
}

// Compile the sketch
function compileSketch() {
  return new Promise((resolve, reject) => {
    console.log('🔨 Compiling ESP32 sketch...');
    
    const compileProcess = spawn('arduino-cli', [
      'compile',
      '--fqbn', BOARD_FQBN,
      '--verbose',
      ESP32_SKETCH_PATH
    ], {
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    compileProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    compileProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    compileProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Compilation successful');
        resolve();
      } else {
        reject(new Error(`Compilation failed with code ${code}`));
      }
    });
  });
}

// Upload the sketch
function uploadSketch() {
  return new Promise((resolve, reject) => {
    console.log(`📤 Uploading firmware to ESP32 on ${SERIAL_PORT}...`);
    console.log('⏳ This may take 30-60 seconds...');
    
    const startTime = Date.now();
    let uploadOutput = '';
    
    const uploadProcess = spawn('arduino-cli', [
      'upload',
      '-p', SERIAL_PORT,
      '--fqbn', BOARD_FQBN,
      '--verbose',
      ESP32_SKETCH_PATH
    ], {
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    uploadProcess.stdout.on('data', (data) => {
      const text = data.toString();
      uploadOutput += text;
      process.stdout.write(text);
      
      // Show progress indicators
      if (text.includes('Connecting')) {
        console.log('🔗 Connecting to ESP32...');
      } else if (text.includes('Writing')) {
        console.log('✍️  Writing firmware to flash...');
      } else if (text.includes('Reading')) {
        console.log('📖 Verifying upload...');
      }
    });
    
    uploadProcess.stderr.on('data', (data) => {
      const text = data.toString();
      uploadOutput += text;
      
      // Check for common ESP32 connection issues
      if (text.includes('Failed to connect')) {
        console.error('❌ Failed to connect to ESP32. Try:');
        console.error('   • Press and hold BOOT button during upload');
        console.error('   • Check USB cable connection');
        console.error('   • Verify correct COM port');
      } else if (text.includes('Permission denied') || text.includes('Access is denied')) {
        console.error('❌ Port access denied. Please:');
        console.error('   • Close Arduino Serial Monitor');
        console.error('   • Stop any running serial bridge');
        console.error('   • Check if another program is using the port');
      }
      
      process.stderr.write(data);
    });
    
    uploadProcess.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        console.log(`✅ Upload successful in ${duration}s`);
        console.log('🎉 ESP32 firmware updated with RC522 RFID support');
        console.log('💡 ESP32 will restart automatically and begin scanning');
        resolve();
      } else {
        console.error(`❌ Upload failed with exit code ${code} after ${duration}s`);
        
        // Analyze common failure patterns
        if (uploadOutput.includes('Timed out waiting for packet header')) {
          console.error('💡 Troubleshooting: ESP32 not responding');
          console.error('   • Try pressing BOOT button during upload');
          console.error('   • Check if ESP32 is in bootloader mode');
        } else if (uploadOutput.includes('No such file or directory')) {
          console.error('💡 Troubleshooting: Port not found');
          console.error('   • Verify ESP32 is connected');
          console.error('   • Check COM port number in .env file');
        }
        
        reject(new Error(`Upload failed with code ${code}`));
      }
    });
  });
}

// Restart the serial bridge
function restartSerialBridge() {
  return new Promise((resolve) => {
    console.log('🔄 Restarting serial bridge...');
    
    // Wait a moment for the ESP32 to reset
    setTimeout(() => {
      const bridgeProcess = spawn('npm', ['run', 'bridge:serial'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['inherit', 'pipe', 'pipe'],
        detached: true
      });
      
      bridgeProcess.stdout.on('data', (data) => {
        process.stdout.write(`[Bridge] ${data}`);
      });
      
      bridgeProcess.stderr.on('data', (data) => {
        process.stderr.write(`[Bridge] ${data}`);
      });
      
      console.log('✅ Serial bridge restarted');
      console.log('🎉 ESP32 firmware upload complete! RFID scanning should resume automatically.');
      resolve();
    }, 3000);
  });
}

// Main upload sequence
async function main() {
  try {
    console.log('🚀 Starting ESP32 firmware upload process...');
    console.log('');
    
    await checkArduinoCLI();
    await checkESP32Available();
    await stopSerialBridge();
    await installESP32Core();
    await compileSketch();
    await uploadSketch();
    await restartSerialBridge();
    
    console.log('');
    console.log('🎉 ESP32 firmware upload completed successfully!');
    console.log('📡 RFID scanning should resume automatically');
    console.log('💡 Check the Food page - it will auto-select students on scan');
    
  } catch (error) {
    console.log('');
    console.error('❌ ESP32 upload process failed');
    console.error('🔍 Error details:', error.message);
    console.log('');
    
    // Provide specific troubleshooting based on error type
    if (error.message.includes('ESP32 not available')) {
      console.error('🔧 ESP32 Connection Troubleshooting:');
      console.error('   1. Check USB cable connection');
      console.error('   2. Verify ESP32 is powered on');
      console.error('   3. Install ESP32 USB drivers if needed');
      console.error('   4. Try a different USB port');
      console.error('   5. Check Device Manager for COM port');
    } else if (error.message.includes('Arduino CLI not found')) {
      console.error('🔧 Arduino CLI Installation:');
      console.error('   1. Download from: https://arduino.github.io/arduino-cli/latest/installation/');
      console.error('   2. Add to system PATH');
      console.error('   3. Restart terminal/command prompt');
    } else if (error.message.includes('Upload failed')) {
      console.error('🔧 Upload Troubleshooting:');
      console.error('   1. Press and hold BOOT button during upload');
      console.error('   2. Close any Arduino Serial Monitor');
      console.error('   3. Stop the serial bridge completely');
      console.error('   4. Try uploading again');
    }
    
    console.log('');
    console.error('💡 Need help? Check esp32/README.md for detailed troubleshooting');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Upload interrupted by user');
  process.exit(0);
});

main();
