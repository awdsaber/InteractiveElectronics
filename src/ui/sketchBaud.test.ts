import { describe, expect, it } from 'vitest'
import { sketchBaud } from './sketchBaud'

describe('sketchBaud', () => {
  it('reads the baud from Serial.begin, ignoring comments', () => {
    expect(sketchBaud('void setup() { Serial.begin(115200); }')).toBe(115200)
    expect(sketchBaud('// Serial.begin(300);\nvoid setup(){ Serial.begin( 9600 ); }')).toBe(9600)
    expect(sketchBaud('/* Serial.begin(300); */ void setup(){ Serial.begin(57600UL); }')).toBe(57600)
  })
  it('is null without a literal Serial.begin', () => {
    expect(sketchBaud('void setup() { }')).toBeNull()
    expect(sketchBaud('void setup() { Serial.begin(BAUD); }')).toBeNull()
  })
})
