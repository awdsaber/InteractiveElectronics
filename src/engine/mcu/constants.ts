// Arduino constants exposed to sketches. Pin numbers follow the Uno: A0..A5 = 14..19.

export const HIGH = 1
export const LOW = 0
export const INPUT = 0
export const OUTPUT = 1
export const INPUT_PULLUP = 2
export const LED_BUILTIN = 13

export const A0 = 14
export const A1 = 15
export const A2 = 16
export const A3 = 17
export const A4 = 18
export const A5 = 19
export const A6 = 20
export const A7 = 21

export const PI = Math.PI
export const HALF_PI = Math.PI / 2
export const TWO_PI = Math.PI * 2
export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

// Serial.print number bases
export const DEC = 10
export const HEX = 16
export const OCT = 8
export const BIN = 2

export const ARDUINO_CONSTANTS: Record<string, number> = {
  HIGH,
  LOW,
  INPUT,
  OUTPUT,
  INPUT_PULLUP,
  LED_BUILTIN,
  A0,
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  PI,
  HALF_PI,
  TWO_PI,
  DEG_TO_RAD,
  RAD_TO_DEG,
  DEC,
  HEX,
  OCT,
  BIN,
}

/** Functions and objects the sandbox provides to sketches (used by the transpiler's unknown-name check). */
export const BUILTIN_NAMES: readonly string[] = [
  ...Object.keys(ARDUINO_CONSTANTS),
  'pinMode', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'delay', 'delayMicroseconds', 'millis', 'micros',
  'map', 'constrain', 'random', 'randomSeed', 'abs', 'min', 'max', 'sq', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'asin', 'acos',
  'atan', 'atan2', 'exp', 'log', 'log10', 'floor', 'ceil', 'round', 'radians', 'degrees', 'lowByte', 'highByte', 'bitRead',
  'bit', 'F', 'Serial', 'Wire', 'Servo',
]

/** Real Arduino functions the simulator does not model (for a friendlier error). */
export const UNSUPPORTED_API: readonly string[] = [
  'tone', 'noTone', 'pulseIn', 'attachInterrupt', 'detachInterrupt', 'digitalPinToInterrupt', 'bitWrite', 'bitSet', 'bitClear',
  'shiftOut', 'shiftIn', 'analogReference', 'analogReadResolution', 'interrupts', 'noInterrupts',
]
