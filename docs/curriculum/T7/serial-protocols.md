# UART, I²C and SPI

*Reading the wire*

> At 9600 baud each byte takes 1.04 ms on the wire. At 400 kHz an I²C bus with 4.7 kΩ pull-ups and 100 pF already misses its 300 ns rise-time limit.

- **Lesson id:** `serial-protocols` · **Track:** T7 Professional
- **fig:** 38. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `mpu6050-imu`, T3 `flipflops-counters` (shift registers)
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `logic-analyzer`, `wire-bus`, `spi-bus`, `hc595`, `imu-mpu6050`, `mcu-supply`
- **transient:** false

## Learning goals

1. Read a UART frame (start bit, 8 data bits LSB first, stop bit) and compute byte time from the baud rate.
2. Read an I²C transaction: START, 7-bit address + R/W, ACK/NACK, register, repeated START, data, STOP.
3. Size I²C pull-ups from the rise-time limit (t_r ≈ 0.8473·R·C) and the 3 mA sink limit.
4. Read an SPI transfer: CS low, SCK, MOSI/MISO, and the four modes (CPOL/CPHA).
5. Use a logic analyzer's protocol decoders to find baud mismatches, NACKs and slow edges.

## Board

Board: `PROTOCOL BENCH`, size 16 × 9, base `mat`. A logic analyzer's grabbers are clipped onto the bus wires.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | UART on D0/D1 (to the USB bridge), I²C on A4/A5, hardware SPI on D11/D13 with latch on D10. | `pin_sda`, `pin_scl`, `pin10`, `pin11`, `pin13`, `pin1` |
| gy521 | `module` (GY-521, see `mpu6050-imu`) | `module` | I²C: MPU-6050 | Address 0x68, WHO_AM_I register 0x75 = 0x68. | `i_mpu`, `r_sda`, `r_scl` |
| u_595 | `ic-dip` (16-pin, 74HC595) | `tht` | SPI: 74HC595 | 8-bit shift register with output latch, driven like an SPI device. | `q0`…`q7` |
| c_595 | `capacitor-ceramic` (100 nF) | `tht` | DECOUPLE | At the 595's VCC pin. | — |
| leds | `led` ×8 (5 mm green) | `tht` | BAR | Show the 595's outputs. | `led0`…`led7` |
| r_leds | `resistor` ×8 (1 kΩ) | `tht` | 1k ×8 | About 3 mA each, so 8 × 3 = 24 mA stays under the 595's 70 mA VCC/GND limit. | `rl0`…`rl7` |
| la | `module` (title "LOGIC ANALYZER", 8-channel USB, 24 MS/s class) | `offboard` | LOGIC ANALYZER | Samples the digital lines and decodes the protocols. | — |
| probes | `probe` ×6 | `offboard` | CH0–CH5 | TX, SDA, SCL, SCK, MOSI, LATCH. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `ldo` | OPAMP | `5v`, `3v3`, `3v3` | vPos 3.3, vNeg 0 | — | GY-521 LDO model |
| `i_mpu` | I | `3v3`, `0` | 0.0039 A | — | |
| `r_sda` | R | `3v3`, `sda` | 4.7 kΩ | — | |
| `r_scl` | R | `3v3`, `scl` | 4.7 kΩ | — | |
| `c_sda` | C | `sda`, `0` | 100 pF | — | Bus capacitance: pins + 20 cm of wire (estimate) |
| `c_scl` | C | `scl`, `0` | 100 pF | — | |
| `pin_sda` | PIN | `sda`, `0` | pin 18, vcc 5 | — | (open-drain, SIM NOTE) |
| `pin_scl` | PIN | `scl`, `0` | pin 19, vcc 5 | — | |
| `pin1` | PIN | `d1`, `0` | pin 1, vcc 5 | — | UART TX (idles HIGH) |
| `pin10` | PIN | `d10`, `0` | pin 10, vcc 5 | — | 595 latch (RCLK) |
| `pin11` | PIN | `d11`, `0` | pin 11, vcc 5 | — | MOSI to SER |
| `pin13` | PIN | `d13`, `0` | pin 13, vcc 5 | — | SCK to SRCLK |
| `i_595` | I | `5v`, `0` | 0.00008 A | maxV 7 V | 74HC595 quiescent current is tiny (µA). 7 V absolute maximum. |
| `q0`…`q7` | SW | `5v`, `qk_i` | set by `hc595` | — | Output high-side, one per bit |
| `rq0`…`rq7` | R | `qk_i`, `qk` | 50 Ω | maxI 0.035 A | Output resistance at 5 V (approximate). 35 mA per-pin absolute max. |
| `rl0`…`rl7` | R | `qk`, `lk` | 1 kΩ | — | |
| `led0`…`led7` | LED | `lk`, `0` | green | maxI 0.02 A | ≈ 2.8 mA each |

(Low-side output transistors are omitted: LOW = switch open, so the LED is off.)

### Behaviors

- **`wire-bus`**. Implements the Arduino `Wire` API: `begin()`, `setClock(hz)`, `beginTransmission(addr)`, `write(b)`, `endTransmission(stop)` (returns 0 = OK, 2 = NACK on address, 3 = NACK on data, 4 = other), `requestFrom(addr, n)`, `available()` and `read()`. Devices register on the bus. Here `imu-mpu6050` provides register-level access at 0x68 with registers 0x75 WHO_AM_I → 0x68, 0x6B PWR_MGMT_1 (sleep bit set at power-up), and 0x3B–0x40 accelerometer data.
  - **Edge check:** each transaction computes the SDA/SCL rise time t_r = 0.8473 × R × C from the *current* values of `r_sda`/`c_sda` (and SCL). If t_r exceeds the mode limit (1000 ns at ≤100 kHz, 300 ns at ≤400 kHz), bits are corrupted with probability rising with t_r / (½ bit time), giving random NACKs or bad data. With a pull-up missing, the bus is stuck low and every call returns 4.
  - Transactions advance virtual time by their real duration (9 clocks per byte plus START/STOP).
- **`spi-bus`**. Implements `SPI.begin()`, `SPI.beginTransaction(SPISettings(hz, order, mode))`, `SPI.transfer(b)` and `SPI.endTransaction()`, with the constants `MSBFIRST`, `LSBFIRST`, `SPI_MODE0`…`SPI_MODE3`. Bytes go to the registered device (`hc595`) with the clock rate and mode.
- **`hc595`**. Shifts in bits MSB-first in SPI mode 0 (the 595 samples on the SRCLK rising edge). On a rising edge of pin 10 (latch) it copies the shift register to `q0…q7.closed`. If the master uses mode 1 or 3, it shifts the sampled bits by one position (a mode mismatch).
- **`logic-analyzer`**. Records every UART byte (from `Serial.print`), I²C transaction and SPI byte, plus digital edges on the probed pins, as timestamped events. It renders them as waveforms with protocol decode rows:
  - **UART:** idle-HIGH, start bit, 8 data bits LSB first, stop bit, at the sketch's baud rate. The analyzer decodes at *its own* configured baud (`laBaud`).
  - **I²C:** SCL/SDA with exponential rise edges using t_r.
  - **SPI:** SCK/MOSI/latch.
  - Publishes `uart_byte_us`, `i2c_tr_ns`, `i2c_nacks`, `spi_last` and `la_decode_errors`. It needs a timeline panel in the UI (SIM NOTE).
- **`imu-mpu6050`**: see `mpu6050-imu`. Here only its register map is used.
- **`mcu-supply`**: see `arduino-uno`.

## Sketch

**Title:** Three buses, one sketch · **board:** `uno` · **vcc:** 5

| Pin | Bus / signal | PIN element |
|---|---|---|
| 1 | UART TX | `pin1` |
| A4 / A5 | I²C SDA / SCL | `pin_sda`, `pin_scl` |
| 11 / 13 | SPI MOSI / SCK | `pin11`, `pin13` |
| 10 | 595 latch | `pin10` |

```cpp
#include <Wire.h>
#include <SPI.h>

#define MPU_ADDR 0x68
#define LATCH 10

// Write one register over I2C. Returns the Wire status (0 = ACK).
int writeReg(int reg, int value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission();
}

// Read n bytes starting at reg into buf. Returns how many arrived.
int readRegs(int reg, int buf[], int n) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {   // repeated START follows
    return 0;
  }
  Wire.requestFrom(MPU_ADDR, n);
  int got = 0;
  while (Wire.available() && got < n) {
    buf[got] = Wire.read();
    got++;
  }
  return got;
}

void show(int bits) {                       // 8 LEDs via the 74HC595
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(LATCH, LOW);
  SPI.transfer(bits);
  digitalWrite(LATCH, HIGH);                // rising edge copies to outputs
  SPI.endTransaction();
}

int buf[2];

void setup() {
  Serial.begin(115200);                     // 8.68 us per bit
  pinMode(LATCH, OUTPUT);
  SPI.begin();
  Wire.begin();
  Wire.setClock(100000);                    // standard mode first

  int who[1];
  readRegs(0x75, who, 1);
  Serial.print("WHO_AM_I=0x");
  Serial.println(who[0], HEX);              // expect 0x68
  Serial.print("wake status ");
  Serial.println(writeReg(0x6B, 0x00));     // clear the sleep bit
}

void loop() {
  if (readRegs(0x3B, buf, 2) == 2) {
    int ax = buf[0] * 256 + buf[1];
    if (ax > 32767) {
      ax = ax - 65536;                      // 16-bit two's complement
    }
    int level = map(constrain(ax, -16384, 16384), -16384, 16384, 0, 8);
    int bits = 0;
    for (int i = 0; i < level; i++) {
      bits = (bits << 1) | 1;               // bar graph: 'level' LEDs lit
    }
    show(bits);
    Serial.print("ax:");
    Serial.println(ax);
  } else {
    Serial.println("I2C read failed");
  }
  delay(100);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| UART BYTE TIME | `{kind:'behavior', key:'uart_byte_us'}` | '' (µs) |
| I²C RISE TIME | `{kind:'behavior', key:'i2c_tr_ns'}` | '' (ns) |
| I²C NACKS | `{kind:'behavior', key:'i2c_nacks'}` | '' |
| SPI LAST BYTE | `{kind:'behavior', key:'spi_last'}` | '' |
| SDA IDLE | `{kind:'voltage', node:'sda'}` | V |
| LED BAR CURRENT | `{kind:'current', elementId:'i_595'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| SDA pull-up | `r_sda` | value | 1000 | 47000 | — | yes | Ω |
| SCL pull-up | `r_scl` | value | 1000 | 47000 | — | yes | Ω |
| Bus capacitance | `c_sda` | value | 2e-11 | 4e-10 | — | yes | F |
| Analyzer baud | `behavior:logic-analyzer` | laBaud | 9600 | 115200 | — | no | baud |

Change `Wire.setClock(100000)` to `400000` in the code and watch the rise-time row turn red with 4.7 kΩ at 100 pF.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: I²C read, then SPI write, then UART print, every 100 ms. Open the analyzer to see all three. |
| readout 2 above 0 | I²C NACKs: check pull-ups, address and rise time. |

## Failures

### F1: Analyzer (or monitor) at the wrong baud
- **Patch:** `{op:'set', elementId:'behavior:logic-analyzer', key:'laBaud', value:9600}`
- **Sim shows:** the UART decode row is full of framing errors and garbage characters, while the LEDs and I²C rows are fine.
- **Why:** UART has no clock line. Both ends must agree on bit time: 8.68 µs at 115 200 versus 104.2 µs at 9600. Garbage text with the right number of characters in bursts is almost always a baud mismatch.

### F2: 47 kΩ pull-ups at 400 kHz
- **Patches:** `{op:'set', elementId:'r_sda', key:'value', value:47000}`, `{op:'set', elementId:'r_scl', key:'value', value:47000}`, plus the learner sets `Wire.setClock(400000)`.
- **Sim shows:** t_r = 0.8473 × 47 kΩ × 100 pF ≈ **4 µs**. The edges never reach HIGH within a 1.25 µs half-period, so NACKs and corrupt bytes follow. At 100 kHz (half-period 5 µs) it is marginal.
- **Why:** pull-ups trade rise time against sink current. Rmax = t_r / (0.8473 × C) = 300 ns / (0.8473 × 100 pF) ≈ **3.5 kΩ** for fast mode, and Rmin = (3.3 − 0.4) V / 3 mA ≈ **970 Ω**. 2.2 kΩ is a safe choice.

### F3: Pull-ups missing
- **Patches:** `{op:'remove', elementId:'r_sda'}`, `{op:'remove', elementId:'r_scl'}`
- **Sim shows:** SDA idles near 0 V. Every `endTransmission` returns 4 and the sketch prints "I2C read failed". The analyzer shows flat-low lines with no START.
- **Why:** devices on an I²C bus only pull low (open-drain). With no pull-up, "HIGH" never happens.

## Meet the board

**UART:** asynchronous, with no clock wire. Each byte is a LOW start bit, 8 data bits LSB first, and a HIGH stop bit, so 10 bit-times per byte. At 115 200 baud that is 8.68 µs per bit and **86.8 µs per byte**. At 9600 baud it is 1.04 ms per byte, or **960 bytes/s**.

**I²C:** two open-drain lines with pull-ups, shared by up to dozens of devices. A transaction is START (SDA falls while SCL is high), the address byte (7 bits + R/W), ACK from the device, data bytes each followed by an ACK, then STOP. Reading WHO_AM_I takes about 4 bytes × 9 clocks = 36 clocks, which is **360 µs** at 100 kHz.

**Rise time sets the speed:** t_r (30 % → 70 %) = 0.8473·R·C. With 4.7 kΩ and 100 pF that is **398 ns**: fine for standard mode (1000 ns limit), too slow for fast mode (300 ns). 2.2 kΩ gives 186 ns.

**SPI:** a push-pull master clock (SCK) and data (MOSI, MISO), with an active-LOW chip select (CS) per device. There is no addressing and no ACK, and it is fast: 1 MHz here. The **mode** sets the clock idle level (CPOL) and the sampling edge (CPHA), and both sides must agree. The 74HC595 is mode 0 with its latch as the "CS".

**When to use which:** UART for point-to-point links and logs, I²C for many slow sensors on two wires, SPI for speed (displays, SD cards, ADCs).

## For mechanical engineers

> UART is two people agreeing to tap Morse at an agreed rate without a metronome: if one speeds up 5 %, by the end of a word the letters are garbled. I²C is a party line on a shared pneumatic header: anyone can vent it to zero (pull low), the pull-up slowly repressurises it, and the bigger the header's volume (capacitance), the slower it recovers. SPI is a dedicated drive shaft with a clutch per machine (chip select): rigid, fast and simple. **Where it breaks:** real "pressure" (voltage) has thresholds, not gauges, so a slow-rising line doesn't read "half" — it reads wrong.

## Pro tips

1. Buy a cheap 8-channel logic analyzer before your next I²C problem. Seeing a NACK, a stretched clock or a 400 ns rise on screen beats an hour of guessing.
2. Check every I²C call's return value. `endTransmission()` returning 2 means "nobody answered at that address", which is the most common bring-up fault (wrong address, AD0, power).
3. Keep I²C on-board, or within about 30 cm. For longer runs, lower the clock, use stronger pull-ups, or switch to a differential bus (RS-485, CAN).

## Quiz

1. **At 9600 baud, 8N1, what is the maximum throughput in bytes per second?**
   - 1200
   - 960
   - 9600
   - 76 800
   - **Answer:** 1. *Why:* each byte takes 10 bits (start, 8 data, stop), and 9600 / 10 = 960 bytes/s.

2. **4.7 kΩ pull-ups and 100 pF of bus capacitance. What is the 30–70 % rise time, and is 400 kHz OK?**
   - 47 ns, OK
   - 186 ns, OK
   - 398 ns, too slow (limit 300 ns)
   - 4 µs, too slow
   - **Answer:** 2. *Why:* 0.8473 × 4700 × 100e-12 ≈ 398 ns, over the 300 ns fast-mode limit.

3. **What is the smallest I²C pull-up to 3.3 V if devices must sink at most 3 mA at VOL = 0.4 V?**
   - 330 Ω
   - 970 Ω
   - 2.2 kΩ
   - 10 kΩ
   - **Answer:** 1. *Why:* Rmin = (3.3 − 0.4) / 0.003 ≈ 967 Ω.

4. **Which SPI line chooses which device is listening?**
   - MOSI
   - MISO
   - SCK
   - CS (chip select), active LOW, one per device
   - **Answer:** 3. *Why:* SPI has no addresses. Each device listens only while its CS line is pulled low.

## SIM NOTE

- **Wire and SPI APIs (required):** the full `Wire` master API and `SPI` (`begin`, `beginTransaction`, `SPISettings`, `transfer`, `endTransaction`), plus `Serial.println(x, HEX)` formatting. These need a bus/device registry so behaviors can implement devices at register level.
- **Logic-analyzer panel (new UI):** a timeline view of behavior-recorded events, with protocol decode rows (UART/I²C/SPI) and analog-looking rise edges computed from R and C. It is not sampled from the 1 ms MNA steps.
- **Array parameters to functions** (`int buf[]`) must work in the transpiler (JS arrays pass by reference, which matches C).
- Open-drain PIN mode (also requested in `pca9685-servo` and `mpu6050-imu`).
- A tweak bound to sketch code (`Wire.setClock`) is not possible. The learner edits the code instead, which is fine.
