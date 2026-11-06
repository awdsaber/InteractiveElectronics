// Part registry: every PartKind → a framed component taking
// { part: PartPlacement; state: PartRenderState }.

import { BREADBOARD, Breadboard, LoadCell, Module, Oled, Ultrasonic, WifiModule } from './boards'
import { BarrelJack, HeaderFemale, HeaderMale, MicroUsb, ScrewTerminal, UsbB, UsbC } from './connectors'
import { Button, Buzzer, Potentiometer, SwitchSlide } from './controls'
import { definePart } from './frame'
import { chipSize, electroSize } from './footprints'
import { LogicIcLabel, Multimeter, Probe, Testpoint, Wire } from './misc'
import { DcMotor, GearMotorWheel, Servo, Stepper } from './motion'
import {
  CapacitorSmd,
  Ceramic,
  Crystal,
  Diode,
  Electrolytic,
  Fuse,
  Inductor,
  Resistor,
  ResistorSmd,
  Thermistor,
  Zener,
} from './passives'
import { AaPack, Battery9v, Lipo, Transformer } from './power'
import { Dip, Heatsink, LedSmd, Led, Mosfet, Regulator, SmdIc, To92 } from './semis'
import { num, str, type PartRegistry } from './types'

export const partRegistry: PartRegistry = {
  resistor: definePart(Resistor, { height: 0.3 }),
  'resistor-smd': definePart(ResistorSmd, { height: (p) => chipSize(p)[2] }),
  'capacitor-ceramic': definePart(Ceramic, { height: 0.68 }),
  'capacitor-smd': definePart(CapacitorSmd, { height: (p) => chipSize(p)[2] }),
  'capacitor-electrolytic': definePart(Electrolytic, { height: (p) => electroSize(p).h + 0.03 }),
  inductor: definePart(Inductor, { height: (p) => (str(p, 'style', 'drum') === 'toroid' ? 1.4 : 0.75) }),
  diode: definePart(Diode, { height: 0.29 }),
  zener: definePart(Zener, { height: 0.2 }),
  thermistor: definePart(Thermistor, { height: 0.78 }),
  fuse: definePart(Fuse, { height: 0.68 }),
  crystal: definePart(Crystal, { height: 0.38 }),
  led: definePart(Led, { height: 0.9 }),
  'led-smd': definePart(LedSmd, { height: (p) => chipSize(p)[2] }),
  'transistor-to92': definePart(To92, { height: 0.77 }),
  'mosfet-to220': definePart(Mosfet, { height: 1.9 }),
  'regulator-to220': definePart(Regulator, { height: 1.9 }),
  heatsink: definePart(Heatsink, { height: 2.0 }),
  'ic-dip': definePart(Dip, { height: 0.38 }),
  'ic-smd': definePart(SmdIc, { height: 0.12 }),
  'logic-ic-label': definePart(LogicIcLabel, { height: 0.01 }),
  testpoint: definePart(Testpoint, { height: 0.27 }),
  'header-male': definePart(HeaderMale, { height: (p) => 0.25 + num(p, 'pinLength', 0.6) }),
  'header-female': definePart(HeaderFemale, { height: (p) => num(p, 'height', 0.85) }),
  'usb-b': definePart(UsbB, { height: 1.1 }),
  'usb-c': definePart(UsbC, { height: 0.33 }),
  'micro-usb': definePart(MicroUsb, { height: 0.26 }),
  'barrel-jack': definePart(BarrelJack, { height: 1.1 }),
  'screw-terminal': definePart(ScrewTerminal, { height: 1.03 }),
  button: definePart(Button, { height: 0.51 }),
  'switch-slide': definePart(SwitchSlide, { height: 0.72 }),
  potentiometer: definePart(Potentiometer, { height: 1.23 }),
  buzzer: definePart(Buzzer, { height: 0.95 }),
  transformer: definePart(Transformer, { height: 2.75 }),
  'battery-aa-pack': definePart(AaPack, { height: 1.57 }),
  'battery-9v': definePart(Battery9v, { height: 1.75 }),
  'battery-lipo': definePart(Lipo, { height: 0.6 }),
  'dc-motor': definePart(DcMotor, { height: 1.51 }),
  'gear-motor-wheel': definePart(GearMotorWheel, { height: 6.6 }),
  servo: definePart(Servo, { height: 2.75 }),
  'stepper-nema17': definePart(Stepper, { height: 6.2 }),
  breadboard: definePart(Breadboard, { height: BREADBOARD.h }),
  module: definePart(Module, { height: (p) => (str(p, 'variant', '') === 'uno' ? 1.3 : 0.6) }),
  'wifi-module': definePart(WifiModule, { height: 0.34 }),
  oled: definePart(Oled, { height: 0.5 }),
  'sensor-ultrasonic': definePart(Ultrasonic, { height: 2.3 }),
  'load-cell': definePart(LoadCell, { height: 1.9 }),
  wire: definePart(Wire, { height: 0.3 }),
  probe: definePart(Probe, { height: 2.2 }),
  multimeter: definePart(Multimeter, { height: 1.6 }),
}

export { ALL_PART_KINDS } from './kinds'
export { footprint, toBoard, type Footprint, type Pad } from './footprints'
export { BREADBOARD, breadboardHole } from './boards'
export {
  BENCH_Y,
  DEFAULT_PART_STATE,
  PCB_THICKNESS,
  PITCH,
  partPosition,
  type PartComponent,
  type PartProps,
  type PartRegistry,
  type PartRenderState,
} from './types'
