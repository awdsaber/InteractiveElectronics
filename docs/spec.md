# Circuit Atelier — Spec

## 1. Experience
A single-page app with three regions:

- **Sidebar (left).** The syllabus is grouped by track, T0 through T7. Each lesson shows as "Fig. NN", a title and a one-line subtitle, with a ✓ when completed. Progress is kept in localStorage.
- **Bench (centre).** An isometric, hand-inked 3D board for the current lesson on a cutting-mat-coloured base. Callout labels point at parts. The bench action buttons sit in a column at the top-left, and the status panel sits at the top-right.
- **Notes (below the bench).** Three columns:
  - **Meet the board**: markdown explanation plus a "For mechanical engineers" analogy box.
  - **Try it yourself**: an editable Arduino-style sketch with Upload. Lessons without code instead get a "Tweak it" panel of sliders for component values.
  - **Check yourself**: a 3–5 question quiz. Completing the quiz marks the lesson done.

The controls strip under the bench holds:
- **Ink wobble:** a slider from 0 to 1.
- **Palette:** 5 swatches that change the PCB/solder-mask colour.
- **Labels:** on/off.
- **Sound:** a Lo-fi loop toggle and an Effects toggle.

### Bench actions
The order is the normal flow. Each action animates.

| Action | Effect |
|---|---|
| Strip to bare PCB | Removes every part, giving the bare PCB with pads and traces visible. Status: BARE PCB. |
| Pick & place SMD | All `mount:'smd'` parts drop in with a short stagger. |
| Place a part ▸ | A dropdown of the remaining THT/module parts. Placing them one at a time teaches what each does: a toast with the part's `role` text. "Place all" is also available. |
| Solder joints | Every placed THT part gets its solder fillets (small grey cones at the pins). Needs all parts placed; otherwise a toast names what is missing. |
| Plug / unplug USB (or "Connect power") | Toggles power. The circuit is solved and the readouts go live. Status: POWERED. |
| Upload sketch | Transpiles the code box and starts the virtual MCU. Status: RUNNING. Only offered when the lesson has `sketch`. |
| Exploded view | Animates the layers apart vertically: PCB, then SMD, then THT, then modules/off-board parts. Toggle. |
| Break something ▸ | A menu of the lesson's `failures`, plus a "Repair all" item. |

### Status panel
- **PARTS** n/N.
- **STATUS:** one of BARE PCB, ASSEMBLING, READY, POWERED, RUNNING, FAULT.
- The lesson's `readouts`, each formatted with SI prefixes (mA, µA, kΩ…).
- A status sentence below the action buttons, e.g. "POWERED: pin 9 goes HIGH and the motor spins" or "FAULT: LED burnt, 180 mA through a 20 mA part". It comes from the lesson's `statusLines`, or from the failure engine.

### Failures
These are automatic, from ratings:
- **Current above `maxI`, or power above `maxP` for 300 ms of sim time:** the part is marked burnt. It is drawn charred with a puff of smoke, and in the circuit it becomes open (an LED or resistor) or shorted (a transistor in its `shortOnFail` mode).
- **GPIO pin current above its 40 mA absolute maximum** (20 mA recommended, which only raises a warning): the pin is dead.
- **Above `maxV`:** the part fails.

Lesson-defined failures patch the netlist: remove an element, change a value, short two nodes, reverse polarity, or remove a flyback diode.

## 2. Visual identity (original)
- **Theme:** an engineer's notebook. Warm paper background `#f3eee2` with a faint dot grid, ink `#1d1b17`, accent blueprint blue `#2b59c3`, warn `#d9480f`, ok `#2f9e44`.
- **Fonts:** `IBM Plex Mono` for UI chrome and numbers; `Fraunces` for headings (both from Google Fonts).
- **3D:**
  - `MeshToonMaterial` with a 3-step gradient.
  - Black ink outlines through drei `<Outlines>` (thickness about 0.02).
  - An orthographic camera at the isometric angle (35.264°, 45°). Gentle orbit is allowed within limits, and zoom is clamped.
  - **Wobble:** a vertex-shader displacement, noise(position*4 + time*0.5) * wobble * 0.01, so lines boil like hand-drawn animation. At 0 it is completely still.
- **Callout labels:** small white pill tags with an ink border and monospace caps (drei `<Html>`), with a leader line to the part.

## 3. Lesson data model
See `src/engine/types.ts`, the source of truth. Summary:
- A `Lesson` has: `id`, `fig`, `track`, `title`, `subtitle`, `board`, `circuit`, `readouts`, optional `sketch`, optional `tweaks`, `failures`, `statusLines`, `meet` (markdown), `mechanicalAnalogy`, `proTips[]`, `quiz[]`, and optional `behaviors[]`.
- `board.parts[]`: each has a `PartPlacement` with `kind`, a position in board units (1 unit = 10 mm), `mount` (`smd` | `tht` | `module` | `offboard`), an optional `label`, and a `role` (one-line description). A `circuitId` links to netlist elements, so failures render on the right 3D part and LEDs glow based on the simulated current.
- `circuit`: a netlist of `Element`s. Ground is node `'0'`.

## 4. Simulation engine (`src/engine/sim`)
- **Modified nodal analysis (MNA).** Dense matrices are fine (fewer than 60 nodes); solved by Gaussian elimination with partial pivoting.
- **Element types:**
  - `R`, `V` (DC source, optional internal resistance), `I`.
  - `SW` (switch, Ron 0.05 Ω, Roff 1e9 Ω).
  - `D` (Shockley: Is, n, plus series Rs).
  - `LED` (a `D` with colour-specific Is/n, giving Vf≈1.8 V red, 2.0 V yellow, 2.1 V green, 2.9 V blue/white at 20 mA).
  - `ZENER`.
  - `NPN`/`PNP` (simplified Ebers-Moll with β).
  - `NMOS`/`PMOS` (square law with Vth, k).
  - `C`, `L` (backward-Euler companion models).
  - `MOTOR` (R + L + back-EMF ke*ω, with a mechanical state J dω/dt = kt*i - b*ω - load).
  - `PIN` (an MCU GPIO: when OUTPUT it is a voltage source at VCC/0 with Rout 25 Ω; when INPUT it is high-Z (1e9 Ω); PWM is averaged as a duty-cycle voltage).
  - `VCVS` (an ideal op-amp model, clamped to its rails), `PROBE` (0 V source, used as an ammeter).
- **Nonlinear solving:** Newton-Raphson with voltage limiting (pnjlim). Up to 100 iterations, tolerance 1e-6. Gmin 1e-12 on every node. If it fails to converge, use gmin stepping.
- **API:**
  - `solveDC(netlist) → Solution`, with `{nodeV: Record<string,number>, current: Record<elementId,number>, power: Record<elementId,number>}`.
  - `createTransient(netlist, dt)`, giving `{step(): Solution, setPin(id, state), setParam(id, key, value), t}`.
- **Sign convention:** an element's current is positive when it flows from `nodes[0]` to `nodes[1]` through the element. For transistors, report `ib`, `ic` and `ie` in an `extra` map.

## 5. Virtual MCU (`src/engine/mcu`)
- `transpile(src)` turns an Arduino-C subset into JS for an async function body.
  - **Supported:**
    - Typed declarations (`int`, `long`, `unsigned`, `float`, `double`, `bool`, `byte`, `char`, `uint8_t`, `uint16_t`, `int16_t`, `uint32_t`, `const`, `String`), arrays, `#define` constants.
    - Functions, which become `async function`s; every call to a user function is awaited.
    - `for`/`while`/`if`/`switch`.
    - Arduino calls: `pinMode`, `digitalWrite`, `digitalRead`, `analogWrite`, `analogRead`, `delay`, `delayMicroseconds`, `millis`, `micros`, `map`, `constrain`, `random`, `Serial.begin/print/println`, `Servo` (`attach`, `write`), `Wire.begin` (no-op).
    - Library stubs registered by behaviours.
  - **Unsupported syntax** throws a `TranspileError` with the line number. Includes of known libraries are ignored; unknown includes produce a warning.
- `VirtualMcu`:
  - Runs `setup()` and then `loop()` repeatedly against a virtual clock.
  - `delay` yields to the scheduler. The bench runs the sim at 1 ms steps, up to 30 sim-ms per animation frame, and up to 20,000 loop iterations per second.
  - Serial output goes to a ring buffer that the UI shows.

## 6. Tracks (syllabus)

| Track | Name | Lessons |
|---|---|---|
| T0 | Foundations | charge-voltage-current, ohms-law, power-heat, series-parallel, kirchhoff, batteries, multimeter, breadboard |
| T1 | Passives | resistor-codes-divider, capacitor-rc, inductor-rl, rlc-resonance, ac-oscilloscope, transformer |
| T2 | Semiconductors | diode-rectifier, led-resistor (video Fig. 02), zener, transistor-switch (video Fig. 03), mosfet-switch, opamp-basics, regulators-linear-buck |
| T3 | Digital | logic-gates, flipflops-counters, timer-555, adc-dac-pwm |
| T4 | Microcontrollers | arduino-uno (video Fig. 01, the "start here" lesson), esp32-s3 (video Fig. 04), teensy-41, interrupts-timers |
| T5 | Motors & drivers | tb6612fng (video Fig. 05), l298n (video Fig. 06), a4988-stepper (video Fig. 07), pca9685-servo (video Fig. 08), encoders |
| T6 | Sensors | mpu6050-imu (video Fig. 09), ultrasonic-hcsr04, loadcell-hx711, thermistor |
| T7 | Professional | serial-protocols, power-grounding-emc, thermal-design, pcb-design-workflow, soldering-rework, debugging-instruments, pid-motor-control, capstone-balancing-robot |

`fig` numbers are assigned in sidebar order. The sidebar starts with "Start here: Arduino Uno" pinned at the top, then lists T0 onward.
