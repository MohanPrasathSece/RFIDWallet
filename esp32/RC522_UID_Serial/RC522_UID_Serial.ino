#include <SPI.h>
#include <MFRC522.h>

// RC522 wiring for ESP32 (based on your connection diagram)
#define SS_PIN   5   // SDA/SS -> GPIO 5
#define RST_PIN  2   // RST -> GPIO 2

// LED for visual feedback - using GPIO 4 since GPIO 2 is used for RST
#define LED_PIN 4   // External LED or use any free GPIO pin

MFRC522 rfid(SS_PIN, RST_PIN);

void blinkSuccess(uint8_t times = 3, uint16_t onMs = 100, uint16_t offMs = 100) {
  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(LED_PIN, LOW);
    delay(offMs);
  }
}

void setup() {
  // Initialize LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize Serial - MUST match SERIAL_BAUD in server/.env
  Serial.begin(115200);
  while (!Serial) { delay(10); }

  // Initialize SPI and RC522
  SPI.begin();               // ESP32 VSPI defaults: SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();           // Initialize RC522
  
  // Brief startup blink
  blinkSuccess(1, 200, 0);
  delay(50);
  
  Serial.println("RC522 RFID Reader initialized for RFIDWallet Food Court");
}

void loop() {
  // Look for new cards
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(30);
    return;
  }

  // Build UID as uppercase hex without separators (e.g., 04A3BC1D)
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // Print exactly one UID per line for the Node serial bridge
  Serial.println(uid);

  // Blink blue LED 3 times to indicate successful read
  blinkSuccess(3, 100, 100);

  // Halt PICC and stop encryption on PCD to be ready for next card
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Small delay to avoid flooding the same UID repeatedly
  delay(300);
}
