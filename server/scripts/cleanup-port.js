#!/usr/bin/env node

// Force cleanup COM port - kills all processes using the port

const { spawn, exec } = require('child_process');
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM5';

console.log('🧹 COM Port Cleanup Tool');
console.log('========================');
console.log(`Target Port: ${SERIAL_PORT}`);
console.log('');

async function killProcessesByPort() {
  console.log(`🔍 Finding processes using ${SERIAL_PORT}...`);
  
  return new Promise((resolve) => {
    // Use handle.exe to find processes using the COM port (if available)
    exec(`handle.exe ${SERIAL_PORT}`, (error, stdout) => {
      if (!error && stdout) {
        console.log('📋 Processes found using the port:');
        console.log(stdout);
        
        // Extract PIDs and kill them
        const lines = stdout.split('\n');
        const pids = [];
        
        lines.forEach(line => {
          const match = line.match(/pid:\s*(\d+)/i);
          if (match) {
            pids.push(match[1]);
          }
        });
        
        if (pids.length > 0) {
          console.log(`🔫 Killing PIDs: ${pids.join(', ')}`);
          pids.forEach(pid => {
            exec(`taskkill /F /PID ${pid}`, () => {});
          });
        }
      }
      resolve();
    });
  });
}

async function killCommonProcesses() {
  console.log('🔫 Killing common processes that might hold COM ports...');
  
  const processesToKill = [
    'python.exe',
    'esptool.exe', 
    'arduino.exe',
    'Code.exe',
    'devenv.exe',
    'putty.exe',
    'teraterm.exe'
  ];
  
  for (const process of processesToKill) {
    await new Promise((resolve) => {
      exec(`taskkill /F /IM ${process}`, (error, stdout) => {
        if (!error) {
          console.log(`✅ Killed ${process}`);
        }
        resolve();
      });
    });
  }
}

async function forceReleasePort() {
  console.log(`🔓 Attempting to force-release ${SERIAL_PORT}...`);
  
  try {
    // Try to use mode command to reset the port
    await new Promise((resolve) => {
      exec(`mode ${SERIAL_PORT} baud=115200 parity=n data=8 stop=1`, (error) => {
        resolve();
      });
    });
    
    console.log('✅ Port reset command sent');
    
  } catch (error) {
    console.log('⚠️  Could not reset port via mode command');
  }
}

async function testPortAccess() {
  console.log(`🧪 Testing ${SERIAL_PORT} access...`);
  
  try {
    const { SerialPort } = require('serialport');
    
    const testPort = new SerialPort({ 
      path: SERIAL_PORT, 
      baudRate: 115200,
      autoOpen: false 
    });
    
    await new Promise((resolve, reject) => {
      testPort.open((err) => {
        if (err) {
          reject(err);
        } else {
          testPort.close(() => {
            resolve();
          });
        }
      });
    });
    
    console.log('✅ Port is now accessible!');
    return true;
    
  } catch (error) {
    console.log(`❌ Port still not accessible: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Kill processes by port (if handle.exe is available)
    await killProcessesByPort();
    
    // Step 2: Kill common processes
    await killCommonProcesses();
    
    // Step 3: Force release port
    await forceReleasePort();
    
    // Step 4: Wait a moment
    console.log('⏳ Waiting for processes to fully terminate...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Test port access
    const isAccessible = await testPortAccess();
    
    if (isAccessible) {
      console.log('');
      console.log('🎉 SUCCESS! Port cleanup completed.');
      console.log('💡 You can now restart your server: npm run start');
    } else {
      console.log('');
      console.log('❌ Port is still not accessible.');
      console.log('💡 Manual steps to try:');
      console.log('   1. Disconnect and reconnect ESP32 USB cable');
      console.log('   2. Restart your computer');
      console.log('   3. Check Device Manager for port conflicts');
      console.log('   4. Try a different USB port');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

main();
