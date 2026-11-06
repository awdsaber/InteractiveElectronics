// A 40-part bench used by ?gallery&lesson to measure draw calls on a
// realistic lesson: Uno-style board + half breadboard + 38 small parts.

import type { PartPlacement } from '../engine/types'
import { breadboardHole } from './parts/boards'
import { BENCH_Y } from './parts/types'

const BB: [number, number] = [3.5, 0]

function onBB(col: number, row: string, dx = 0): [number, number, number] {
  const [x, y, z] = breadboardHole(col, row)
  return [BB[0] + x + dx, BENCH_Y + y, BB[1] + z]
}

export function lessonParts(): PartPlacement[] {
  const parts: PartPlacement[] = [
    { id: 'U1', kind: 'module', pos: [-6.5, 0], mount: 'offboard', role: '', params: { variant: 'uno' }, label: 'UNO' },
    { id: 'BB1', kind: 'breadboard', pos: BB, mount: 'offboard', role: '' },
  ]
  const leds = ['red', 'yellow', 'green', 'blue', 'white', 'red', 'green', 'yellow']
  for (let i = 0; i < 10; i++) {
    const [x, y, z] = onBB(3 + i * 2.5, 'b', 0.508)
    parts.push({ id: `R${i + 1}`, kind: 'resistor', pos: [x - 0.508, y, z + 0.508], rot: 90, mount: 'tht', role: '', params: { ohms: [220, 330, 1000, 4700, 10000][i % 5] } })
  }
  leds.forEach((c, i) => {
    const [x, y, z] = onBB(3 + i * 3, 'h', 0.127)
    parts.push({ id: `D${i + 1}`, kind: 'led', pos: [x, y, z], mount: 'tht', role: '', params: { color: c } })
  })
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = onBB(5 + i * 6, 'e', 0)
    parts.push({ id: `SW${i + 1}`, kind: 'button', pos: [x, y, z + 0.38], mount: 'tht', role: '' })
  }
  parts.push(
    { id: 'C1', kind: 'capacitor-ceramic', pos: onBB(27, 'c'), mount: 'tht', role: '' },
    { id: 'C2', kind: 'capacitor-ceramic', pos: onBB(29, 'c'), mount: 'tht', role: '' },
    { id: 'C3', kind: 'capacitor-electrolytic', pos: onBB(26, 'i'), mount: 'tht', role: '' },
    { id: 'RV1', kind: 'potentiometer', pos: onBB(28, 'g'), mount: 'tht', role: '' },
    { id: 'U2', kind: 'ic-dip', pos: onBB(15, 'e', 0.381), mount: 'tht', role: '', params: { pins: 8 } },
    { id: 'Q1', kind: 'transistor-to92', pos: onBB(21, 'g'), mount: 'tht', role: '' },
  )
  const colors = ['red', 'black', 'yellow', 'green', 'blue', 'orange', 'white', 'red', 'black', 'yellow']
  colors.forEach((c, i) => {
    const a = onBB(2 + i * 2.8, '+t')
    const b = onBB(2 + i * 2.8, 'a')
    const far = i < 5
    const pts = far
      ? [[-4.6, 0.3, -2.6 + i * 0.25], [a[0], a[1], a[2]]]
      : [[a[0] - 0.25, a[1], a[2]], [b[0], b[1], b[2]]]
    parts.push({ id: `W${i + 1}`, kind: 'wire', pos: [0, 0, 0], mount: 'offboard', role: '', params: { points: pts, color: c } })
  })
  return parts
}
