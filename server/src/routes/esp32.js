const router = require('express').Router();
const ESP32Uploader = require('../services/esp32Uploader');
const { auth, requireRoles } = require('../middleware/auth');

// Upload firmware to ESP32
router.post('/upload-firmware', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const esp32Service = req.app.get('esp32Service'); // Get ESP32 service from app
    
    const uploader = new ESP32Uploader({
      portPath: process.env.SERIAL_PORT || 'COM5',
      esp32Service: esp32Service
    });
    
    // Start upload process
    await uploader.uploadFirmware();
    
    res.json({
      success: true,
      message: 'ESP32 firmware uploaded successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ESP32-Upload] Upload failed:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get ESP32 status
router.get('/status', async (req, res) => {
  try {
    const esp32Service = req.app.get('esp32Service');
    
    if (!esp32Service) {
      return res.json({
        connected: false,
        message: 'ESP32 service not initialized'
      });
    }
    
    const status = esp32Service.getStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Restart ESP32 service
router.post('/restart', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const esp32Service = req.app.get('esp32Service');
    
    if (esp32Service) {
      await esp32Service.disconnect();
      setTimeout(() => {
        esp32Service.connect();
      }, 2000);
    }
    
    res.json({
      success: true,
      message: 'ESP32 service restarted',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
