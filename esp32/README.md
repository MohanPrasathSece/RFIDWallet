# ESP32 RFID Firmware for RFIDWallet

This directory contains the ESP32 firmware for the RFIDWallet Food Court RFID scanning system.

## Hardware Setup

### RC522 RFID Module Wiring
Connect the RC522 to your ESP32 as follows (based on your connection diagram):

| RC522 Pin | ESP32 Pin | Description |
|-----------|-----------|-------------|
| VCC       | 3V3       | Power (DO NOT use 5V) |
| RST       | GPIO 2    | Reset |
| GND       | GND       | Ground |
| MISO      | GPIO 19   | Master In Slave Out |
| MOSI      | GPIO 23   | Master Out Slave In |
| SCK       | GPIO 18   | Serial Clock |
| SDA (SS)  | GPIO 5    | Slave Select |

### LED Indicator
- An external LED connected to GPIO 4 will blink 3 times when an RFID tag is successfully read
- Connect LED: GPIO 4 → 220Ω resistor → LED → GND
- If you don't want LED feedback, the code will still work without it

## Software Requirements

### Arduino IDE Setup
1. Install Arduino IDE 2.x
2. Add ESP32 board support:
   - File → Preferences
   - Additional Board Manager URLs: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install
3. Install MFRC522 library:
   - Tools → Manage Libraries → Search "MFRC522" → Install by miguelbalboa

### Arduino CLI Setup (Alternative)
```bash
# Install Arduino CLI
# Download from: https://arduino.github.io/arduino-cli/latest/installation/

# Install ESP32 core
arduino-cli core install esp32:esp32

# Install MFRC522 library
arduino-cli lib install "MFRC522"
```

## Upload Firmware

### Method 1: Automated Upload (Recommended)
From the server directory, run:
```bash
npm run upload:esp32
```

This will:
1. Stop the serial bridge automatically
2. Compile the ESP32 firmware
3. Upload to your ESP32
4. Restart the serial bridge
5. Show full logs throughout the process

### Method 2: Manual Upload
1. Stop the serial bridge: `Ctrl+C` in the bridge terminal
2. Open Arduino IDE
3. File → Open → Select `RC522_UID_Serial.ino`
4. Tools → Board → ESP32 Arduino → ESP32 Dev Module
5. Tools → Port → Select your COM port
6. Click Upload
7. After upload, restart the bridge: `npm run bridge:serial`

## Configuration

### Serial Communication
- Baud Rate: 115200 (must match `SERIAL_BAUD` in server/.env)
- Data Format: One uppercase hex UID per line (e.g., "04A3BC1D")
- Line Ending: LF (\n)

### Pin Configuration
The current pin assignments match your wiring diagram:
```cpp
#define SS_PIN   5   // SDA/SS pin -> GPIO 5
#define RST_PIN  2   // RST pin -> GPIO 2  
#define LED_PIN  4   // LED pin -> GPIO 4 (external LED)
```

If you need to change pins, modify these defines in the sketch.

## Troubleshooting

### No RFID Detection
- Check wiring connections
- Ensure RC522 is powered with 3.3V (not 5V)
- Verify the RC522 module is not faulty
- Check if the RFID tags are compatible (13.56MHz MIFARE)

### Upload Fails
- Ensure no other program is using the COM port
- Try pressing the BOOT button on ESP32 during upload
- Check if the correct board and port are selected
- Verify USB cable supports data transfer (not just power)

### Serial Bridge Not Receiving Data
- Confirm baud rate matches between ESP32 (115200) and server/.env
- Check if the ESP32 is actually running the uploaded sketch
- Verify COM port number in server/.env matches the ESP32 port
- Ensure no Arduino Serial Monitor is open

## Expected Output

When working correctly, the ESP32 will:
1. Print initialization message on startup
2. Print one uppercase hex UID per line when a tag is scanned
3. Blink the LED 3 times for each successful scan
4. Example output:
   ```
   RC522 RFID Reader initialized for RFIDWallet Food Court
   04A3BC1D
   F7E2D8A1
   ```

## Integration with RFIDWallet

The ESP32 firmware integrates with the RFIDWallet system as follows:
1. ESP32 prints UID to serial when tag is scanned
2. Node.js serial bridge reads the UID from COM port
3. Bridge posts UID to `/api/rfid/esp32-scan` with module=food
4. Server creates pending transaction and emits `rfid:pending`
5. Food page auto-selects the student for immediate ordering
