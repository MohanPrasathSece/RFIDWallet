#!/usr/bin/env node

// Manual ESP32 Reset Script
// Use this if ESP32 is stuck in download mode

const { SerialPort } = require('serialport');

const SERIAL_PORT = process.env.SERIAL_PORT || 'COM5';

console.log('🔄 ESP32 Manual Reset Tool');
console.log('==========================');
console.log(`Target Port: ${SERIAL_PORT}`);
console.log('');

async function resetESP32() {
  try {
    console.log('🔄 Sending reset signal to ESP32...');
    
    const resetPort = new SerialPort({ 
      path: SERIAL_PORT, 
      baudRate: 115200,
      autoOpen: false 
    });
    
    await new Promise((resolve, reject) => {
      resetPort.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('📡 Connected to ESP32');
        
        // ESP32 reset sequence: DTR and RTS control
        resetPort.set({ dtr: false, rts: true }, () => {
          console.log('🔽 Pulling ESP32 into reset...');
          setTimeout(() => {
            resetPort.set({ dtr: true, rts: false }, () => {
              console.log('🔼 Releasing reset...');
              setTimeout(() => {
                resetPort.set({ dtr: false, rts: false }, () => {
                  console.log('✅ Reset sequence completed');
                  resetPort.close(() => {
                    resolve();
                  });
                });
              }, 100);
            });
          }, 100);
        });
      });
    });
    
    console.log('🎉 ESP32 reset successfully!');
    console.log('⏳ ESP32 should boot into normal mode now');
    console.log('💡 Check your server logs for "ESP32_BOOT_OK" message');
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    console.log('');
    console.log('💡 Manual reset options:');
    console.log('   1. Press the physical RESET button on ESP32');
    console.log('   2. Disconnect and reconnect USB cable');
    console.log('   3. Check if another program is using the port');
    process.exit(1);
  }
}

resetESP32();
