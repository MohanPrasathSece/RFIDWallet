// ESP32 Serial Reader Service - Direct USB to Backend Terminal
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

class ESP32SerialService {
  constructor(options = {}) {
    this.portPath = options.portPath || process.env.SERIAL_PORT || 'COM5';
    this.baudRate = options.baudRate || 115200;
    this.serverUrl = options.serverUrl || 'http://localhost:5000';
    this.deviceKey = options.deviceKey || 'dev-local-1';
    this.io = options.io; // Socket.IO instance
    
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.reconnectTimeout = null;
    // Logging controls
    // Levels: 'error' < 'info' < 'debug'
    this.logLevel = (options.logLevel || process.env.ESP32_LOG_LEVEL || 'info').toLowerCase();
    // Map of message -> last timestamp to throttle noisy repeats
    this._lastLogTimes = new Map();
  }

  log(message, type = 'info') {
    // Determine if we should log based on level and throttling
    const typeLevel = (t) => {
      if (t === 'error') return 0;
      if (t === 'data') return 2; // treat raw serial as debug
      return 1; // info/success/rfid -> info
    };
    const currentLevel = (() => {
      if (this.logLevel === 'error') return 0;
      if (this.logLevel === 'debug') return 2;
      return 1; // info
    })();
    if (typeLevel(type) > currentLevel) return;

    // Throttle highly repetitive connection messages
    const throttleMs = 30000; // 30s
    const shouldThrottle =
      /Attempting connection|Attempting to reconnect|Failed to open port|Connection failed|ESP32 disconnected/.test(message);
    const key = shouldThrottle ? `${type}:${message}` : null;
    if (key) {
      const now = Date.now();
      const last = this._lastLogTimes.get(key) || 0;
      if (now - last < throttleMs) return;
      this._lastLogTimes.set(key, now);
    }

    const prefix = '[ESP32]';
    switch (type) {
      case 'success':
        console.log(`\x1b[32m${prefix} ✅ ${message}\x1b[0m`);
        break;
      case 'error':
        console.log(`\x1b[31m${prefix} ❌ ${message}\x1b[0m`);
        break;
      case 'rfid':
        console.log(`\x1b[33m${prefix} 🏷️  ${message}\x1b[0m`);
        break;
      case 'data':
        console.log(`\x1b[36m${prefix} 📡 ${message}\x1b[0m`);
        break;
      default:
        console.log(`\x1b[37m${prefix} ${message}\x1b[0m`);
    }
  }

  async connect() {
    try {
      this.log(`Attempting connection to ESP32 on ${this.portPath} at ${this.baudRate} baud...`);
      
      this.port = new SerialPort({ 
        path: this.portPath, 
        baudRate: this.baudRate,
        autoOpen: false 
      });
      
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      // Setup event handlers
      this.port.on('open', () => {
        this.isConnected = true;
        this.log(`ESP32 connected successfully on ${this.portPath}`, 'success');
        this.log('Serial communication established at 115200 baud', 'success');
        this.log('Ready for RFID scanning at Food Court', 'success');
      });
      
      this.port.on('error', (error) => {
        if (error.message.includes('Access denied') || error.message.includes('Permission denied')) {
          this.log('📤 ESP32 port busy - likely firmware upload or another process', 'info');
          this.log('⏳ Will retry connection automatically...', 'info');
        } else {
          this.log(`Serial error: ${error.message}`, 'error');
        }
        this.handleDisconnection();
      });
      
      this.port.on('close', () => {
        if (this.isConnected) {
          this.log('📤 ESP32 disconnected - likely for firmware upload', 'info');
          this.log('⏳ Will reconnect automatically after upload...', 'info');
        } else {
          this.log('ESP32 disconnected', 'error');
        }
        this.handleDisconnection();
      });
      
      this.parser.on('data', (line) => {
        this.handleSerialData(line.trim());
      });
      
      // Open the port
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) {
            this.log(`Failed to open port: ${err.message}`, 'error');
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
    } catch (error) {
      this.log(`Connection failed: ${error.message}`, 'error');
      this.scheduleReconnect();
    }
  }

  handleSerialData(data) {
    if (!data) return;
    
    // Detect firmware upload process
    if (this.isUploadInProgress(data)) {
      this.handleUploadProgress(data);
      return;
    }
    
    // Filter out boot messages and system info
    if (this.isBootMessage(data)) {
      return; // Skip boot spam
    }
    
    this.log(`Raw: "${data}"`, 'data');
    
    if (data === 'waiting for download') {
      this.log('⚠️  ESP32 stuck in download mode - needs reset', 'error');
      this.log('💡 Try manually pressing the ESP32 reset button', 'info');
      return; // Don't log this as raw data
      
    } else if (data === 'ESP32_BOOT_OK') {
      this.log('✅ ESP32 firmware boot successful', 'success');
      
    } else if (data === 'RFID_INITIALIZING') {
      this.log('🔄 ESP32 initializing RFID module...', 'info');
      
    } else if (data === 'RC522_OK') {
      this.log('✅ RC522 RFID module detected successfully', 'success');
      
    } else if (data === 'RFID_READY') {
      this.log('🎯 ESP32 RFID reader initialized and ready for scanning!', 'success');
      
      // Emit to connected clients
      if (this.io) {
        this.io.emit('esp32:ready', { message: 'ESP32 RFID reader ready' });
      }
      
    } else if (data === 'RC522_ERROR') {
      this.log('❌ RC522 RFID module not detected - check wiring!', 'error');
      
    } else if (data.startsWith('RFID:')) {
      const uid = data.substring(5);
      this.handleRFIDScan(uid);
    } else {
      // Log any other ESP32 messages
      this.log(`ESP32 says: ${data}`);
    }
  }

  isUploadInProgress(data) {
    const uploadIndicators = [
      'Connecting........',
      'Chip is ESP32',
      'Features:',
      'Crystal is',
      'MAC:',
      'Uploading stub...',
      'Running stub...',
      'Stub running...',
      'Changing baud rate',
      'Changed.',
      'Configuring flash size...',
      'Flash will be erased',
      'Compressed',
      'Wrote',
      'Hash of data verified',
      'Leaving...',
      'Hard resetting',
      'esptool.py',
      'Serial port',
      'Detecting chip type',
      'Writing at 0x'
    ];
    
    return uploadIndicators.some(indicator => data.includes(indicator));
  }

  isBootMessage(data) {
    const bootMessages = [
      'clk_drv:',
      'load:0x',
      'entry 0x',
      'esp_image:',
      'boot:',
      'ets ',
      'rst:0x',
      'configsip:',
      'mode:DIO',
      'SPIWP:',
      'invalid segment',
      'OTA app partition',
      'No bootable app',
      'magic byte'
    ];
    
    return bootMessages.some(msg => data.includes(msg));
  }

  handleUploadProgress(data) {
    if (data.includes('Connecting')) {
      this.log('🔄 Connecting to ESP32 for firmware upload...', 'info');
    } else if (data.includes('Chip is ESP32')) {
      this.log('✅ ESP32 chip detected', 'success');
    } else if (data.includes('Uploading stub')) {
      this.log('📤 Uploading bootloader stub...', 'info');
    } else if (data.includes('Running stub')) {
      this.log('🚀 Bootloader stub running', 'success');
    } else if (data.includes('Configuring flash')) {
      this.log('⚙️  Configuring flash memory...', 'info');
    } else if (data.includes('Flash will be erased')) {
      this.log('🗑️  Erasing flash memory...', 'info');
    } else if (data.includes('Writing at 0x')) {
      const match = data.match(/Writing at 0x([0-9a-f]+)/);
      if (match) {
        this.log(`✍️  Writing firmware at 0x${match[1]}...`, 'info');
      }
    } else if (data.includes('Hash of data verified')) {
      this.log('✅ Firmware verification successful', 'success');
    } else if (data.includes('Hard resetting')) {
      this.log('🔄 ESP32 resetting after upload...', 'info');
    } else if (data.includes('Leaving')) {
      this.log('🎉 Firmware upload completed successfully!', 'success');
      this.log('⏳ Waiting for ESP32 to restart...', 'info');
    } else {
      // Log other upload-related messages
      this.log(`[Upload] ${data}`, 'data');
    }
  }

  async handleRFIDScan(uid) {
    this.log(`RFID Scanned: ${uid}`, 'rfid');
    
    try {
      // Post to local server API
      const response = await axios.post(`${this.serverUrl}/api/rfid/esp32-scan`, {
        rfidNumber: uid,
        module: 'food',
        location: 'Food Court'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': this.deviceKey
        },
        timeout: 5000
      });
      
      if (response.status === 201 && response.data.student) {
        const student = response.data.student;
        this.log(`Student found: ${student.name} (${student.rollNo}) - Balance: ₹${student.walletBalance}`, 'success');
        
        // Emit to connected clients
        if (this.io) {
          this.io.emit('esp32:rfid-scan', {
            uid,
            student,
            transaction: response.data
          });
        }
        
      } else {
        this.log(`Unexpected response: ${response.status}`, 'error');
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        this.log(`No student found for RFID: ${uid}`, 'error');
      } else {
        this.log(`API error: ${error.message}`, 'error');
      }
      
      // Still emit the scan event even if student not found
      if (this.io) {
        this.io.emit('esp32:rfid-scan', {
          uid,
          error: error.response?.data?.message || error.message
        });
      }
    }
  }

  handleDisconnection() {
    this.isConnected = false;
    if (this.port && this.port.isOpen) {
      try {
        this.port.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.log('🔄 Attempting to reconnect in 5 seconds...', 'info');
    this.reconnectTimeout = setTimeout(() => {
      this.connect().then(() => {
        this.log('🎉 ESP32 reconnected successfully!', 'success');
      }).catch(() => {
        // Will retry automatically with longer delay
      });
    }, 5000); // Increased delay to 5 seconds
  }

  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.port && this.port.isOpen) {
      try {
        await this.port.close();
        this.log('Disconnected from ESP32');
      } catch (error) {
        this.log(`Disconnect error: ${error.message}`, 'error');
      }
    }
    
    this.isConnected = false;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      port: this.portPath,
      baudRate: this.baudRate
    };
  }
}

module.exports = ESP32SerialService;
