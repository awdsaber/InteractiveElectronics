// power-meter: input power, output power, loss and efficiency of a converter (a regulator, a
// buck, an amplifier stage), read from the time-averaged solution the readouts see.
//
// params: vin (node at the input), iin (element carrying the input current, usually a PROBE),
//         vout (node at the output), iout (element carrying the output current, usually the load).
// Publishes `pin` = V(vin)·I(iin), `pout` = V(vout)·I(iout) (W), `loss` = pin − pout (W) and
// `eta` = 100·pout/pin (%; 0 while the input power is below 1 µW).
//
// Lesson use: behaviors: [{ id: 'power-meter', instance: 'buck', params: { vin: 'vin', iin: 'P_BK', vout: 'out', iout: 'R_L' } }]
//             readouts:  [{ label: 'BUCK EFF', source: { kind: 'behavior', key: 'buck.eta' }, unit: '%' }]

import type { Behavior, Solution } from '../types'

const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))
const vOf = (s: Solution, n: string) => (n === '0' ? 0 : s.voltageOf ? s.voltageOf(n) : (s.nodeV[n] ?? 0))

/** input power below this reads 0 % efficiency rather than noise / 0 */
const P_FLOOR = 1e-6

export const behavior: Behavior = {
  id: 'power-meter',

  tick(ctx) {
    const s = ctx.solution
    if (!s) return
    const p = ctx.params
    const pin = vOf(s, String(p.vin)) * curOf(s, String(p.iin))
    const pout = vOf(s, String(p.vout)) * curOf(s, String(p.iout))
    ctx.publish('pin', pin)
    ctx.publish('pout', pout)
    ctx.publish('loss', pin - pout)
    ctx.publish('eta', pin > P_FLOOR ? (100 * pout) / pin : 0)
  },
}
