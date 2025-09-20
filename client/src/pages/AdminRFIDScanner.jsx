import { useState, useEffect, useRef } from 'react';
import { api } from '../shared/api.js';
import Sidebar from '../shared/Sidebar.jsx';

export default function AdminRFIDScanner() {
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState(null);
  const [reader, setReader] = useState(null);
  const [lastUID, setLastUID] = useState('');
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('Click "Connect ESP32" to start scanning');
  const [logs, setLogs] = useState([]);
  const [rfidInput, setRfidInput] = useState('');
  const [module, setModule] = useState('food');
  const [location, setLocation] = useState('Food Court');
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
            // Filter out ESP32 boot messages
            if (trimmedLine.includes('clk_drv') || 
                trimmedLine.includes('load:') || 
                trimmedLine.includes('entry') ||
                trimmedLine.includes('esp_image') ||
                trimmedLine.includes('boot:') ||
                trimmedLine.includes('ets ') ||
                trimmedLine.includes('rst:') ||
                trimmedLine.includes('configsip') ||
                trimmedLine.includes('mode:DIO')) {
              continue; // Skip boot messages
            }
            
            addLog(`ESP32: ${trimmedLine}`, 'esp32');
            
            if (trimmedLine === 'ESP32_BOOT_OK') {
              setStatus('🔄 ESP32 booted, initializing RFID...');
              addLog('ESP32 boot successful', 'success');
            } else if (trimmedLine === 'RFID_READY') {
              setStatus('🎯 ESP32 Ready - Scan an RFID card');
              addLog('ESP32 RFID reader ready', 'success');
            } else if (trimmedLine === 'RC522_ERROR') {
              setStatus('❌ RC522 RFID module error - check wiring');
              addLog('RC522 module not detected', 'error');
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
    setRfidInput(uid); // Auto-fill the RFID input field
    addLog(`RFID Scanned: ${uid}`, 'rfid');
    setStatus(`🏷️ Scanned: ${uid} - Auto-filled in form`);
    
    // Auto-lookup student
    await lookupStudent(uid);
  };

  const lookupStudent = async (uid = rfidInput) => {
    if (!uid) return;
    
    try {
      setStatus(`🔍 Looking up student for: ${uid}`);
      const response = await api.get(`/rfid/resolve/${uid}`);
      
      if (response.data) {
        const studentData = response.data;
        setStudent(studentData);
        setStatus(`✅ Student Found: ${studentData.name}`);
        addLog(`Student: ${studentData.name} (Roll: ${studentData.rollNo || 'N/A'})`, 'success');
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

  const manualScan = async () => {
    if (!rfidInput) {
      addLog('Please enter an RFID number', 'error');
      return;
    }
    
    try {
      const response = await api.post('/rfid/scan', {
        rfidNumber: rfidInput,
        module: module,
        location: location
      });
      
      if (response.data && response.data.student) {
        const studentData = response.data.student;
        setStudent(studentData);
        setStatus(`✅ Manual scan successful: ${studentData.name}`);
        addLog(`Manual scan: ${studentData.name} - Transaction created`, 'success');
      }
    } catch (error) {
      addLog(`Manual scan failed: ${error.response?.data?.message || error.message}`, 'error');
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin RFID Scanner</h1>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6">
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

        {/* Manual RFID Input */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">RFID Scanning</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFID Number</label>
              <input
                type="text"
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value.toUpperCase())}
                placeholder="Scan card or enter manually"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="food">Food Court</option>
                <option value="library">Library</option>
                <option value="store">Store</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <button
                onClick={() => lookupStudent()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Lookup
              </button>
              <button
                onClick={manualScan}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Scan
              </button>
            </div>
          </div>

          {/* Student Info */}
          {student && (
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Student Found</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {student.name}
                </div>
                <div>
                  <span className="font-medium">Roll No:</span> {student.rollNo || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">RFID:</span> {student.RFIDNumber || student.rfid_uid}
                </div>
                <div>
                  <span className="font-medium">Wallet:</span> ₹{student.walletBalance || 0}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">ESP32 Logs</h2>
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
