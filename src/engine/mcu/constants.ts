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

// attachInterrupt modes (AVR values)
export const CHANGE = 1
export const FALLING = 2
export const RISING = 3
export const NOT_AN_INTERRUPT = -1

// analogReference (AVR values)
export const EXTERNAL = 0
export const DEFAULT = 1
export const INTERNAL = 3

// SPI
export const LSBFIRST = 0
export const MSBFIRST = 1
export const SPI_MODE0 = 0
export const SPI_MODE1 = 1
export const SPI_MODE2 = 2
export const SPI_MODE3 = 3

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
  CHANGE,
  FALLING,
  RISING,
  NOT_AN_INTERRUPT,
  EXTERNAL,
  DEFAULT,
  INTERNAL,
  LSBFIRST,
  MSBFIRST,
  SPI_MODE0,
  SPI_MODE1,
  SPI_MODE2,
  SPI_MODE3,
}

/** ESP32-S3 analog pins are GPIO numbers: A0..A9 = GPIO1..10 (ADC1), A10..A19 = GPIO11..20 (ADC2). */
export const ESP32S3_ANALOG: Record<string, number> = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [`A${k}`, k + 1]))

/**
 * Teensy 4.1 extras (PJRC pinout card): A0..A7 = 14..21 as on the Uno, then A8..A13 = 22..27 and
 * A14..A17 = 38..41, plus Teensyduino's CPU clock constants at the default 600 MHz.
 */
export const TEENSY41_GLOBALS: Record<string, number> = {
  A8: 22,
  A9: 23,
  A10: 24,
  A11: 25,
  A12: 26,
  A13: 27,
  A14: 38,
  A15: 39,
  A16: 40,
  A17: 41,
  F_CPU: 600_000_000,
  F_CPU_ACTUAL: 600_000_000,
}

/** Functions and objects the sandbox provides to sketches (used by the transpiler's unknown-name check). */
export const BUILTIN_NAMES: readonly string[] = [
  ...Object.keys(ARDUINO_CONSTANTS),
  'pinMode', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'delay', 'delayMicroseconds', 'millis', 'micros',
  'map', 'constrain', 'random', 'randomSeed', 'abs', 'min', 'max', 'sq', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'asin', 'acos',
  'atan', 'atan2', 'exp', 'log', 'log10', 'floor', 'ceil', 'round', 'radians', 'degrees', 'lowByte', 'highByte', 'bitRead',
  'bit', 'F', 'Serial', 'Wire', 'Servo', 'SPI', 'SPISettings',
  'attachInterrupt', 'detachInterrupt', 'digitalPinToInterrupt', 'interrupts', 'noInterrupts', 'pulseIn', 'pulseInLong',
  'tone', 'noTone', 'bitWrite', 'bitSet', 'bitClear', 'analogReference', 'analogReadResolution',
  'analogWriteResolution', 'analogWriteFrequency',
]

/** Real Arduino functions the simulator does not model (for a friendlier error). */
export const UNSUPPORTED_API: readonly string[] = ['shiftOut', 'shiftIn', 'cli', 'sei', 'analogReadMilliVolts']
