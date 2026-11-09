# M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)

The per-lesson task, definition of done and scope-cut rules are the same as in `docs/plans/m2-video-lessons.md`, plus everything learned in M3 (`src/lessons/README.md`, "Authoring pitfalls"):
- Check every curriculum figure against a datasheet, and fix the curriculum when it's wrong.
- The circuit must read clearly at default zoom. Add `facts` to the key parts for the part inspector.
- Use the instrument panel wherever a waveform is the point of the lesson.
- At most 3 screenshots per lesson, because the disk is tight. Run dev servers in the background and give screenshot scripts a hard timeout.
- At most about 3 authors at once while the network is unreliable.

## Engine features available
- **Elements and sources:** LOGIC (gates and Schmitt), REG, FUSE, POT, XFMR and `V.wave`.
- **Timing:** switched PWM, edge substeps, and the trapezoidal integration method.
- **Instruments:** scope and strip chart, the shared `ac-meter`, derived and peak readouts.
- **Behaviors:** a lifecycle with `onPin`, `onStep`, `onSerial`, `read` and I²C `ack`. Existing behaviors: tb6612, l298n, a4988, pca9685, imu-mpu6050, mcu-supply, serial-plotter, square-wave, ws2812, wifi-sim, esp32-boot.
- **MCU:** interrupts, `pulseIn`, Wire/SPI and Uno 16-bit int.
- **UI:** the part inspector.

## Order
1. **T3:** logic-gates, flipflops-counters, timer-555 (`ne555` behavior), adc-dac-pwm.
2. **T4 / T5 / T6 rest:** interrupts-timers, encoders (`quad-encoder`), ultrasonic-hcsr04 (`hcsr04`), loadcell-hx711 (`hx711`), thermistor (`ntc`).
3. **T7:**
   - serial-protocols (logic-analyzer behavior: an event timeline with UART, I²C and SPI decode)
   - power-grounding-emc
   - thermal-design (`thermal-network`)
   - pcb-design-workflow (`pcb-tour`, a guided layer tour)
   - soldering-rework (`solder-joints`)
   - debugging-instruments
   - pid-motor-control (`dyno-load` plus an encoder, closed loop)
4. **Capstone:** capstone-balancing-robot. It reuses `tb6612`, `imu-mpu6050` (via `pitchSource`) and `quad-encoder`, plus a `balance-bot` physics behavior (cart-pendulum).

The capstone and pid-motor-control need the motor-load coupling API (`setMotorLoad` exists) and possibly a dynamic board (the robot tilts). Plan these with the lead before starting.
