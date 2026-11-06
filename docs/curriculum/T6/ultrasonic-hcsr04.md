# HC-SR04 Ultrasonic Ranger

*Timing an echo*

> Sound covers a centimetre and back in 58 µs at 20 °C, so the HC-SR04's echo pulse width is the distance, and a 20 °C temperature error costs 3.6 %.

- **Lesson id:** `ultrasonic-hcsr04` · **Track:** T6 Sensors
- **fig:** 35. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `interrupts-timers`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `hcsr04`, `mcu-supply`, `serial-plotter`
- **transient:** false

## Learning goals

1. Describe the time-of-flight sequence: a ≥10 µs trigger, an 8-cycle 40 kHz burst, and an echo pin held HIGH for the round-trip time.
2. Convert echo time to distance with the speed of sound, c ≈ 331.3 + 0.606·T m/s.
3. Use `pulseIn` with a timeout, and know what a missing echo looks like.
4. Filter outliers with a median of several readings, and space pings at least 60 ms apart.
5. Know the limits: about 2–400 cm (vendor claim), a beam about 15° wide, and soft or angled targets.

## Board

Board: `RANGER BENCH`, size 14 × 7, base `mat`. A movable target plate sits on a rail in front of the sensor.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Triggers pings and times echoes. | `pin9`, `pin10` |
| sr04 | `sensor-ultrasonic` (HC-SR04, 45 × 20 mm) | `module` | HC-SR04 | Two 40 kHz transducers (T = transmit, R = receive) and driver/receiver ICs. 5 V, about 15 mA. | `i_sr04`, `echo_src` |
| xtal | (on module) `crystal` (4 MHz) | `tht` | 4 MHZ | Clock for the module's microcontroller (shown in exploded view; varies by clone). | — |
| target | `module` (title "TARGET", 20 × 20 cm plate on a rail) | `offboard` | TARGET | Sets the true distance. Its surface can be hard, soft or angled. | — |
| thermo | `thermistor` (air temperature probe, decorative) | `offboard` | AIR TEMP | Air temperature, which sets the speed of sound (tweak). | — |
| wires | `wire` | `offboard` | — | VCC, TRIG, ECHO, GND. | `w_echo` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `i_sr04` | I | `5v`, `0` | 0.015 A | maxV 5.5 V | HC-SR04 working current (vendor: 15 mA). 5.5 V is a conservative limit; no absolute maximum is published. |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | TRIG output |
| `echo_src` | V | `echo_out`, `0` | 0 / 5 V (set by behavior), rInternal 100 Ω | — | Module's push-pull ECHO output (output resistance approximate) |
| `w_echo` | R | `echo_out`, `d10` | 0.01 Ω | — | ECHO wire |
| `pin10` | PIN | `d10`, `0` | pin 10, vcc 5 | — | ECHO input |

### Behaviors

- **`hcsr04`**. Parameters: `distanceCm` (true, tweak 1–500), `airTempC` 20, `surface` (`hard` | `soft` | `angled`), `noiseCm` 0.3 (1σ, illustrative), `otherSensor` false (crosstalk), `maxCm` 400, `timeoutUs` 38 000 (the echo-HIGH time vendors quote when no echo returns; approximate, varies by clone).
  - **Trigger:** watches pin 9 edges (µs timestamps). A HIGH lasting ≥ 10 µs followed by LOW starts a ping. Pings closer than 20 ms to the previous one are ignored, because the module is still listening.
  - **Echo:** after about 0.5 ms of internal burst and processing delay (approximate), ECHO goes HIGH for t = 2·d / c × 1e6 µs, where c = 331.3 + 0.606·T m/s, plus noise. No echo returns if `distanceCm` < 2 or > maxCm, or if `surface` is soft (85 % of pings lost) or angled (> 70 % lost). Then ECHO stays HIGH for `timeoutUs`. With `otherSensor`, 30 % of pings get a stray early echo at a random time.
  - **`pulseIn`:** exposes `pulseIn(pin, level, timeoutUs)` for pin 10. It returns the HIGH width in µs if the ECHO line actually reaches the pin (`w_echo` present and V(d10) > 3 V while HIGH). If the wait for the edge exceeds `timeoutUs` it returns 0, and it advances virtual time by the time spent waiting. It also sets `echo_src` to 5 V during the HIGH time, sampled at the sim step, for the scope view.
  - **Publishes:** `true_cm`, `echo_us`, `c_mps` and `pings_lost`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Median ranger · **board:** `uno` · **vcc:** 5

| Pin | HC-SR04 pin | PIN element |
|---|---|---|
| 9 | TRIG | `pin9` |
| 10 | ECHO | `pin10` |

```cpp
#define TRIG 9
#define ECHO 10
#define N 5                         // readings per median

float airTempC = 20.0;              // what the code assumes
float readings[N];

float readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);            // >= 10 us trigger pulse
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);   // 30 ms ~ 5 m round trip
  if (us == 0) {
    return -1.0;                    // no echo
  }
  float c = 331.3 + 0.606 * airTempC;              // m/s
  return us * c / 20000.0;          // us * 1e-6 * c * 100 cm/m / 2
}

void sortReadings() {               // insertion sort, N is small
  for (int i = 1; i < N; i++) {
    float key = readings[i];
    int j = i - 1;
    while (j >= 0 && readings[j] > key) {
      readings[j + 1] = readings[j];
      j--;
    }
    readings[j + 1] = key;
  }
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  digitalWrite(TRIG, LOW);
  Serial.begin(115200);
}

void loop() {
  int good = 0;
  for (int i = 0; i < N; i++) {
    readings[i] = readCm();
    if (readings[i] > 0) {
      good++;
    }
    delay(60);                      // let echoes die out between pings
  }
  sortReadings();
  float median = readings[N / 2];
  Serial.print("cm:");
  Serial.print(median);
  Serial.print(",good:");
  Serial.println(good);
}
```

The median of 5 survives up to 2 bad readings (−1 or a stray echo). With `N/2` = 2 it picks the middle of the sorted array. `int` division matters here (SIM NOTE in `arduino-uno`).

## Readouts

| label | source | unit |
|---|---|---|
| TRUE DISTANCE | `{kind:'behavior', key:'true_cm'}` | cm |
| MEASURED | `{kind:'behavior', key:'serial.cm'}` | cm |
| ECHO WIDTH | `{kind:'behavior', key:'echo_us'}` | '' (µs) |
| SPEED OF SOUND | `{kind:'behavior', key:'c_mps'}` | '' (m/s) |
| GOOD PINGS (OF 5) | `{kind:'behavior', key:'serial.good'}` | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Target distance | `behavior:hcsr04` | distanceCm | 1 | 500 | 1 | no | cm |
| Air temperature | `behavior:hcsr04` | airTempC | −10 | 40 | 1 | no | °C |
| Target surface | `behavior:hcsr04` | surface | 0 | 2 | 1 | no | hard/soft/angled |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 5 pings, 60 ms apart, one median per 0.3 s. |
| readout 4 below 3 | Most pings are lost: soft, angled or out-of-range target. |

## Failures

### F1: Cold morning, code still assumes 20 °C
- **Patch:** `{op:'set', elementId:'behavior:hcsr04', key:'airTempC', value:0}`
- **Sim shows:** with the target at 100.0 cm, MEASURED reads about **103.6 cm**.
- **Why:** the real c = 331.3 m/s, but the code uses 343.4 m/s. The echo is 2 × 1.000 / 331.3 = 6037 µs long, and 6037 × 343.4 / 20 000 ≈ 103.6 cm. Measure air temperature (or at least don't hard-code summer) when you need better than about 3 %.

### F2: ECHO wire falls off
- **Patch:** `{op:'remove', elementId:'w_echo'}`
- **Sim shows:** every `pulseIn` waits the full 30 ms and returns 0. `good` = 0 and `cm` = −1. The loop slows to 5 × (30 + 60) ms per reading.
- **Why:** the timeout argument is what keeps the loop alive. Without it, `pulseIn` waits up to **1 second** by default per call. That is a classic "my robot freezes when the sensor is unplugged" bug.

### F3: A second ranger pinging at the same time
- **Patch:** `{op:'set', elementId:'behavior:hcsr04', key:'otherSensor', value:true}`
- **Sim shows:** about 30 % of the single readings come back short and random. The median of 5 still mostly holds, but `good` stays 5, so the bad readings aren't detectable as missing.
- **Why:** both modules hear each other's 40 kHz burst. Fire multiple rangers in sequence (60 ms apart), or point them at angles that don't overlap.

## Meet the board

The HC-SR04 does the hard part itself. You pulse TRIG HIGH for **10 µs**. It sends eight 40 kHz cycles, then holds ECHO HIGH until the echo comes back. Your job is just to measure that pulse.

**Speed of sound:** c ≈ 331.3 + 0.606·T. At 20 °C: 331.3 + 12.1 = **343.4 m/s**. Out and back, 1 cm takes 2 × 0.01 / 343.4 = **58.2 µs**, so distance (cm) ≈ echo µs / 58. A 1166 µs pulse is 1166 / 58.2 ≈ **20.0 cm**.

**Temperature matters:** from 0 °C to 40 °C, c changes from 331 to 356 m/s, about 7.5 %. Assuming 20 °C on a 0 °C day reads 3.6 % long.

**Range and rate:** vendors claim 2–400 cm. The longest round trip, 8 m / 343 m/s ≈ 23 ms, plus ring-down means one ping every **60 ms** (about 16 Hz) is a safe rate.

**Beam:** about 15° wide (vendor). A wall at a steep angle reflects the sound away from the receiver, and soft fabric absorbs it, so both can vanish.

**Electrical:** 5 V at about 15 mA, with a 5 V ECHO output. Fine for an Uno, but **divide ECHO** before it reaches a 3.3 V MCU such as the ESP32-S3.

## For mechanical engineers

> This is an echo sounder on a ship, or a time-of-flight thickness gauge in NDT: send a pulse, time the reflection, multiply by the wave speed, halve it. As in ultrasonic thickness testing, the answer is only as good as your assumed sound velocity, here set by air temperature instead of material. **Where it breaks:** NDT couples the probe to the part with gel and a narrow, focused beam. In open air the beam is wide (about 15°), so the HC-SR04 reports the *nearest* thing in a cone, not the thing straight ahead.

## Pro tips

1. Always pass a timeout to `pulseIn`, sized to your maximum range. 30 ms covers about 5 m. Then treat 0 as "no echo", not "zero distance".
2. Mount the sensor a few centimetres back from any edge of the chassis, and aim it slightly upward on floor robots, or it ranges the floor.
3. Use a median, not a mean. One wild stray echo shifts a mean of 5 by 20 %, while a median ignores it.

## Quiz

1. **ECHO is HIGH for 1166 µs at 20 °C (c = 343.4 m/s). What is the distance?**
   - 10 cm
   - 20 cm
   - 40 cm
   - 58 cm
   - **Answer:** 1. *Why:* d = 1166 × 343.4 / 20 000 ≈ 20.0 cm (or 1166 / 58.2).

2. **The longest range is 4 m. What is the minimum round-trip time you must wait?**
   - 2.3 ms
   - 11.7 ms
   - 23.3 ms
   - 60 ms
   - **Answer:** 2. *Why:* 8 m / 343 m/s = 23.3 ms. Vendors recommend 60 ms between pings to let reverberation die down.

3. **The air is 0 °C but the code assumes 20 °C. A target at exactly 100 cm reads as:**
   - 96.5 cm
   - 100 cm
   - 103.6 cm
   - 107 cm
   - **Answer:** 2. *Why:* reading = 100 × 343.4 / 331.3 ≈ 103.6 cm.

4. **Why might a heavy curtain at 1 m return no reading?**
   - The curtain is too close
   - Soft, porous material absorbs and scatters the ultrasound, so too little echo returns
   - Curtains are transparent to 40 kHz
   - The sensor needs a metal target
   - **Answer:** 1. *Why:* absorption and diffuse scattering leave the echo below the receiver's threshold.

## SIM NOTE

- **`pulseIn`** is a core Arduino function that is not in the §5 list. It needs µs-resolution timing against a behavior-generated pulse, and it must advance virtual time while blocking. This lesson has the behavior provide it, but it belongs in the MCU core (with behaviors able to register pin waveforms).
- TRIG pulse width detection needs µs-timestamped `digitalWrite` events (same as `a4988-stepper`).
- A tweak with an enumerated value (`surface`) works as an integer slider. A dropdown tweak type would read better.
- `float` arrays and `while` with a compound condition (`j >= 0 && readings[j] > key`) must transpile correctly.
