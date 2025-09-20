import { useState, useEffect, useRef } from 'react';
import { api } from '../shared/api.js';
import { useNavigate } from 'react-router-dom';

export default function RFIDScanner() {
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState(null);
  const [reader, setReader] = useState(null);
  const [lastUID, setLastUID] = useState('');
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('Click "Connect ESP32" to start scanning');
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();
  const logRef = useRef(null);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setLogs(prev => [...prev.slice(-50), logEntry]); // Keep last 50 logs
  };

  const connectESP32 = async () => {
    if (!('serial' in navigator)) {
      setStatus('❌ Web Serial API not supported in this browser');
      addLog('Web Serial API not supported. Use Chrome/Edge.', 'error');
      return;
    }

    try {
      addLog('Requesting serial port...', 'info');
      const selectedPort = await navigator.serial.requestPort();
      
      addLog('Opening serial port at 115200 baud...', 'info');
      await selectedPort.open({ baudRate: 115200 });
      
      setPort(selectedPort);
      setIsConnected(true);
      setStatus('✅ ESP32 Connected - Ready for RFID scanning');
      addLog('ESP32 connected successfully!', 'success');
      
      startReading(selectedPort);
    } catch (error) {
      setStatus('❌ Failed to connect to ESP32');
      addLog(`Connection failed: ${error.message}`, 'error');
    }
  };

  const startReading = async (serialPort) => {
    try {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
      const serialReader = textDecoder.readable.getReader();
      setReader(serialReader);

      let buffer = '';
      
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;
        
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            addLog(`ESP32: ${trimmedLine}`, 'esp32');
            
            if (trimmedLine === 'RFID_READY') {
              setStatus('🎯 ESP32 Ready - Scan an RFID card');
              addLog('ESP32 RFID reader initialized', 'success');
            } else if (trimmedLine.startsWith('RFID:')) {
              const uid = trimmedLine.substring(5);
              await handleRFIDScan(uid);
            }
          }
        }
      }
    } catch (error) {
      addLog(`Reading error: ${error.message}`, 'error');
      setStatus('❌ Connection lost');
      setIsConnected(false);
    }
  };

  const handleRFIDScan = async (uid) => {
    setLastUID(uid);
    addLog(`RFID Scanned: ${uid}`, 'rfid');
    setStatus(`🏷️ Scanned: ${uid} - Looking up student...`);
    
    try {
      // Send to server API
      const response = await api.post('/rfid/esp32-scan', {
        rfidNumber: uid,
        module: 'food',
        location: 'Food Court'
      }, {
        headers: {
          'X-Device-Key': 'dev-local-1'
        }
      });
      
      if (response.data && response.data.student) {
        const studentData = response.data.student;
        setStudent(studentData);
        setStatus(`✅ Student Found: ${studentData.name}`);
        addLog(`Student: ${studentData.name} (${studentData.rollNo})`, 'success');
        
        // Auto-redirect to Food page after 2 seconds
        setTimeout(() => {
          navigate('/food');
        }, 2000);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setStatus('❌ Student not found for this RFID');
        addLog(`No student found for UID: ${uid}`, 'error');
      } else {
        setStatus('❌ Server error');
        addLog(`Server error: ${error.message}`, 'error');
      }
      setStudent(null);
    }
  };

  const disconnect = async () => {
    try {
      if (reader) {
        await reader.cancel();
        setReader(null);
      }
      if (port) {
        await port.close();
        setPort(null);
      }
      setIsConnected(false);
      setStatus('Disconnected');
      addLog('ESP32 disconnected', 'info');
    } catch (error) {
      addLog(`Disconnect error: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    // Auto-scroll logs
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">ESP32 RFID Scanner</h1>
          
          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-lg">{status}</span>
            </div>
            
            {!isConnected ? (
              <button
                onClick={connectESP32}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Connect ESP32
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Last Scanned */}
          {lastUID && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Last Scanned RFID</h3>
              <div className="font-mono text-lg text-blue-600">{lastUID}</div>
              {student && (
                <div className="mt-2 text-sm text-blue-700">
                  <div>Student: {student.name}</div>
                  <div>Roll No: {student.rollNo}</div>
                  <div>Wallet Balance: ₹{student.walletBalance}</div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Instructions</h3>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. Upload the ESP32 firmware using PlatformIO or Arduino IDE</li>
              <li>2. Connect ESP32 to USB (COM5)</li>
              <li>3. Click "Connect ESP32" and select the serial port</li>
              <li>4. Scan RFID cards - students will be auto-selected on Food page</li>
            </ol>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Serial Logs</h2>
          <div 
            ref={logRef}
            className="h-64 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded font-mono text-sm"
          >
            {logs.map((log, index) => (
              <div key={index} className={`mb-1 ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 
                log.type === 'rfid' ? 'text-yellow-400' :
                log.type === 'esp32' ? 'text-blue-400' : 'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet. Connect ESP32 to see activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
