# M3 — Foundations, Passives, Semiconductors (T0–T2)

The per-lesson task, definition of done and scope-cut rules are identical to `docs/plans/m2-video-lessons.md`. In addition:
- **Curriculum accuracy:** the curriculum files contain at least one known datasheet error (L298N "typical" was really the minimum). Check every figure you use against datasheet values, and fix the curriculum file too if it's wrong. Note the fix in `docs/decisions.md`.
- **Pedagogy:** these are first-principles lessons for a mechanical engineer.
  - Tweaks must make the concept *felt*: sliders whose effect is obvious in the readouts and the 3D (LED brightness, a resistor getting hot, a meter needle).
  - The "Break it" failures should be memorable.
- **Lesson shape:** lessons are usually `base: 'breadboard-only'` with a battery pack or bench supply. Use the existing parts (`multimeter`, `battery-aa-pack`, `battery-9v`, `breadboard`, `resistor`, `led`, `potentiometer`, `wire`, `probe`).
- **Instruments:** the scope, chart readouts, enum/momentary tweaks and sim speed (M2.5-X4) land during this milestone. Lessons that need them (ac-oscilloscope, rlc-resonance, capacitor-rc, inductor-rl, transformer, diode-rectifier) go in later batches, after X4 merges.

## Batch 1 (no new engine features)
- T0/charge-voltage-current
- T0/ohms-law
- T0/power-heat
- T0/series-parallel
- T0/kirchhoff

## Batch 2
- T0/batteries
- T0/multimeter
- T0/breadboard
- T1/resistor-codes-divider
- T2/zener

## Batch 3 (after X4 and X6)
- T1/capacitor-rc
- T1/inductor-rl
- T1/rlc-resonance
- T1/ac-oscilloscope
- T1/transformer

## Batch 4
- T2/diode-rectifier
- T2/mosfet-switch
- T2/opamp-basics
- T2/regulators-linear-buck
