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

  // Initialize Serial for USB communication
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  
  Serial.println("ESP32_BOOT_OK");
  Serial.println("RFID_INITIALIZING");

  // Initialize SPI and RC522
  SPI.begin();               // ESP32 VSPI defaults: SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();           // Initialize RC522
  
  // Test RC522 communication
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("RC522_ERROR");
    while(1) {
      blinkSuccess(10, 50, 50); // Fast blink for error
      delay(1000);
    }
  } else {
    Serial.println("RC522_OK");
    Serial.println("RFID_READY");
  }
  
  // Brief startup blink
  blinkSuccess(2, 200, 200);
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

  // Send UID in a format the website can easily parse
  Serial.print("RFID:");
  Serial.println(uid);

  // Blink LED 3 times to indicate successful read
  blinkSuccess(3, 100, 100);

  // Halt PICC and stop encryption on PCD to be ready for next card
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Small delay to avoid flooding the same UID repeatedly
  delay(500);
}
