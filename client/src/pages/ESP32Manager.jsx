import { useState, useEffect } from 'react';
import { api } from '../shared/api.js';
import AdminLayout from '../shared/ui/AdminLayout.jsx';

export default function ESP32Manager() {
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-100), { timestamp, message, type }]);
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/esp32/status');
      setStatus(response.data);
      addLog(`Status updated: ${response.data.connected ? 'Connected' : 'Disconnected'}`, 'info');
    } catch (error) {
      addLog(`Failed to fetch status: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadFirmware = async () => {
    try {
      setUploading(true);
      addLog('Starting firmware upload...', 'info');
      
      const response = await api.post('/esp32/upload-firmware');
      
      if (response.data.success) {
        addLog('✅ Firmware uploaded successfully!', 'success');
        addLog('ESP32 will restart with new firmware', 'info');
        
        // Refresh status after upload
        setTimeout(() => {
          fetchStatus();
        }, 5000);
      } else {
        addLog(`❌ Upload failed: ${response.data.message}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Upload error: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const restartService = async () => {
    try {
      addLog('Restarting ESP32 service...', 'info');
      
      const response = await api.post('/esp32/restart');
      
      if (response.data.success) {
        addLog('✅ ESP32 service restarted', 'success');
        
        // Refresh status after restart
        setTimeout(() => {
          fetchStatus();
        }, 3000);
      }
    } catch (error) {
      addLog(`❌ Restart failed: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh status every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminLayout title="ESP32 Manager" subtitle="Manage firmware and connection status for ESP32">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Connection & Firmware</h1>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {/* ESP32 Status */}
        <div className="bg-white rounded border border-emerald-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">ESP32 Status</h2>
          
          {status ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-lg font-medium">
                  {status.connected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              
              {status.connected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Port:</span> {status.port}
                  </div>
                  <div>
                    <span className="font-medium">Baud Rate:</span> {status.baudRate}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                Last updated: {new Date(status.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Loading status...</div>
          )}
        </div>

        {/* Firmware Management */}
        <div className="bg-white rounded border border-emerald-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Firmware Management</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
              <h3 className="font-medium text-yellow-800 mb-2">⚠️ Upload New Firmware</h3>
              <p className="text-sm text-yellow-700 mb-3">
                This will disconnect the ESP32, upload new RFID firmware, and restart the service.
                The process takes about 30-60 seconds.
              </p>
              <button
                onClick={uploadFirmware}
                disabled={uploading}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50"
              >
                {uploading ? '📤 Uploading...' : '📤 Upload Firmware'}
              </button>
            </div>
            
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">🔄 Restart Service</h3>
              <p className="text-sm text-blue-700 mb-3">
                Restart the ESP32 connection service without uploading firmware.
                Use this if the connection is stuck or not working properly.
              </p>
              <button
                onClick={restartService}
                className="px-6 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md border border-emerald-300"
              >
                🔄 Restart Service
              </button>
            </div>
          </div>
        </div>

        {/* Current Firmware Info */}
        <div className="bg-white rounded border border-emerald-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Current Firmware</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Version:</span> RFID Scanner v1.0</div>
            <div><span className="font-medium">Features:</span> RC522 RFID, LED feedback, Serial output</div>
            <div><span className="font-medium">Baud Rate:</span> 115200</div>
            <div><span className="font-medium">Protocol:</span> RFID:UID format</div>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-white rounded border border-emerald-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Activity Logs</h2>
          <div className="h-64 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className={`mb-1 ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 
                log.type === 'info' ? 'text-blue-400' : 'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No activity logs yet.</div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded border border-emerald-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Instructions</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">1. Check Status:</span> Ensure ESP32 is connected to COM5
            </div>
            <div>
              <span className="font-medium">2. Upload Firmware:</span> Click "Upload Firmware" to flash new RFID code
            </div>
            <div>
              <span className="font-medium">3. Monitor Logs:</span> Watch backend terminal for detailed upload progress
            </div>
            <div>
              <span className="font-medium">4. Test Scanning:</span> Go to Admin RFID Scanner to test cards
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
