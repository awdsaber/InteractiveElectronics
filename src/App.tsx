// Mock-data shell so the UI can be reviewed on its own. Task E replaces this with the store-driven app.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lesson, Track, BenchStatus, Tweak } from './engine/types'
import { setEffectsEnabled, sfx, startLofi, stopLofi, unlockAudio } from './audio/sound'
import { Layout } from './ui/Layout'
import type { SettingChange } from './ui/Controls'
import { siLabel } from './ui/format'
import type { BenchAction, Settings, ToastMessage } from './ui/types'

const tracks: Track[] = [
  { id: 'T0', name: 'Orientation', blurb: 'Tools, units and safety.' },
  { id: 'T1', name: 'Basics', blurb: 'Voltage, current, resistance.' },
  { id: 'T2', name: 'Diodes & LEDs', blurb: 'One-way valves for current.' },
  { id: 'T3', name: 'Transistors', blurb: 'Switches and amplifiers.' },
]

const lessonList = [
  { id: 'ohm', fig: 1, track: 'T1', title: 'Ohm’s law', subtitle: 'Pressure, flow, friction' },
  { id: 'divider', fig: 2, track: 'T1', title: 'Voltage divider', subtitle: 'Two resistors, one tap' },
  { id: 'led', fig: 3, track: 'T2', title: 'LED + resistor', subtitle: 'Why LEDs need a limiter' },
  { id: 'diode', fig: 4, track: 'T2', title: 'Flyback diode', subtitle: 'Catching the inductive kick' },
  { id: 'npn', fig: 5, track: 'T3', title: 'NPN switch', subtitle: 'A 20 mA pin drives a motor' },
] as const satisfies readonly Pick<Lesson, 'id' | 'fig' | 'track' | 'title' | 'subtitle'>[]

const mockLesson: Lesson = {
  id: 'led',
  fig: 3,
  track: 'T2',
  title: 'LED + resistor',
  subtitle: 'Why LEDs need a limiter',
  tagline: 'a 220 Ω resistor turns a 5 V pin into a safe 14 mA',
  board: { name: 'LED-01', size: [8, 6], parts: [] },
  circuit: { elements: [] },
  powerElementId: 'V1',
  readouts: [],
  sketch: {
    title: 'Blink',
    board: 'uno',
    vcc: 5,
    pins: { 13: 'PIN13' },
    code: `const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("on");
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}
`,
  },
  tweaks: [
    { label: 'Series resistor', elementId: 'R1', key: 'value', min: 10, max: 10000, log: true, unit: 'Ω' },
  ],
  failures: [],
  meet: `An **LED** is a diode that glows. Past its forward voltage (about 1.8 V for red) it conducts almost without limit, so the *only* thing setting the current is whatever you put in series.

The resistor does that job: with a 5 V pin, a 1.8 V LED and 220 Ω, Ohm's law gives **I = (5 − 1.8) / 220 ≈ 14.5 mA**, comfortably under the 20 mA rating.

- Long leg is the anode (+)
- The flat edge on the lens marks the cathode (−)`,
  mechanicalAnalogy: `Think of a pressure-relief check valve with almost no resistance once it cracks open. The resistor is the **orifice plate** in the line: it, not the valve, decides the flow rate for a given supply pressure.`,
  proTips: [
    'Size the resistor for the pin, not the LED: stay below 20 mA per GPIO.',
    'Brighter is not 4x current. Perceived brightness is roughly logarithmic.',
  ],
  quiz: [
    {
      q: 'A red LED (Vf ≈ 1.8 V) runs from 5 V through 220 Ω. About how much current flows?',
      options: ['1.8 mA', '14.5 mA', '23 mA', '230 mA'],
      answer: 1,
      why: '(5 − 1.8) V / 220 Ω = 14.5 mA. The resistor drops the 3.2 V the LED does not.',
    },
    {
      q: 'Why does the LED need a series resistor at all?',
      options: [
        'The resistor makes the LED brighter.',
        'Above Vf the LED’s own resistance is tiny, so current would run away.',
        'LEDs only work with AC.',
      ],
      answer: 1,
      why: 'Above its forward voltage the diode curve is very steep: a small voltage change makes a large current change.',
    },
  ],
}

const parts = [
  { id: 'r1', label: 'R1 · 220 Ω resistor' },
  { id: 'd1', label: 'D1 · red LED' },
  { id: 'j1', label: 'J1 · header pins' },
]

let toastId = 1

export default function App() {
  const [active, setActive] = useState('led')
  const [completed, setCompleted] = useState<string[]>(['ohm'])
  const [settings, setSettings] = useState<Settings>({ wobble: 0.35, palette: 'green', labels: true, lofi: false, effects: true })
  const [placed, setPlaced] = useState<string[]>([])
  const [smd, setSmd] = useState(false)
  const [soldered, setSoldered] = useState(false)
  const [powered, setPowered] = useState(false)
  const [running, setRunning] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [code, setCode] = useState(mockLesson.sketch!.code)
  const [serial, setSerial] = useState<string[]>([])
  const [tweaks, setTweaks] = useState<Record<string, number>>({ 'R1.value': 220 })
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToasts((t) => [...t.slice(-2), { id: toastId++, text, tone }])
  }, [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // fake serial output while "running"
  const tick = useRef(0)
  useEffect(() => {
    if (!running) return
    const h = setInterval(() => setSerial((s) => [...s.slice(-6), `on  t=${(++tick.current * 0.5).toFixed(1)}s`]), 1000)
    return () => clearInterval(h)
  }, [running])

  const allPlaced = placed.length === parts.length
  let status: BenchStatus = 'BARE PCB'
  if (running) status = 'RUNNING'
  else if (powered) status = 'POWERED'
  else if (soldered) status = 'READY'
  else if (smd || placed.length) status = 'ASSEMBLING'

  const onAction = (a: BenchAction) => {
    sfx('click')
    if (a === 'strip') {
      setPlaced([]); setSmd(false); setSoldered(false); setPowered(false); setRunning(false); setSerial([])
      toast('Board stripped to bare copper.')
    } else if (a === 'pick-place') {
      setSmd(true); sfx('place'); toast('SMD parts dropped in.')
    } else if (a === 'place-all') {
      setPlaced(parts.map((p) => p.id)); sfx('place'); toast('All through-hole parts placed.', 'ok')
    } else if (a.startsWith('place:')) {
      const id = a.slice(6)
      setPlaced((p) => [...p, id]); sfx('place')
      toast(id === 'r1' ? 'R1 limits the LED current to a safe value.' : 'Placed.')
    } else if (a === 'solder') {
      if (!allPlaced) return toast(`Still to place: ${parts.filter((p) => !placed.includes(p.id)).map((p) => p.label.split(' ')[0]).join(', ')}`, 'warn')
      setSoldered(true); sfx('solder'); toast('Joints soldered.', 'ok')
    } else if (a === 'power') {
      sfx('plug'); setPowered((p) => !p); setRunning(false)
    } else if (a === 'upload') {
      setRunning(true); sfx('success'); toast('Sketch uploaded.', 'ok')
    } else if (a === 'explode') {
      setExploded((e) => !e)
    } else if (a.startsWith('break:')) {
      sfx('pop'); toast('LED burnt: 180 mA through a 20 mA part.', 'warn')
    } else if (a === 'repair') {
      toast('Everything repaired.', 'ok')
    }
  }

  const onSetting = (c: SettingChange) => {
    unlockAudio()
    setSettings((s) => ({ ...s, [c.key]: c.value }))
    if (c.key === 'lofi') (c.value ? startLofi : stopLofi)()
    if (c.key === 'effects') setEffectsEnabled(c.value)
  }

  const ia = powered ? (5 - 1.8) / (tweaks['R1.value'] ?? 220) : 0
  const lesson: Lesson = { ...mockLesson, id: active === 'led' ? 'led' : active }

  return (
    <Layout
      lesson={lesson}
      syllabus={{
        tracks,
        lessons: [...lessonList],
        activeId: active,
        completed,
        pinned: ['ohm'],
        onSelect: (id) => { setActive(id); sfx('click') },
      }}
      actions={{
        status,
        remainingParts: parts.filter((p) => !placed.includes(p.id)),
        allPlaced,
        smdPlaced: smd,
        soldered,
        powered,
        exploded,
        hasSketch: true,
        failures: [
          { id: 'rm-r', label: 'Remove the current-limiting resistor' },
          { id: 'r22', label: 'Swap in a 22 Ω resistor' },
          { id: 'rev', label: 'Reverse the LED' },
        ],
        onAction,
      }}
      panel={{
        placed: placed.length + (smd ? 1 : 0),
        total: parts.length + 1,
        status,
        readouts: [
          { label: 'LED CURRENT', value: siLabel(ia, 'A') },
          { label: 'PIN 13', value: powered ? '5 V' : '0 V' },
          { label: 'R1 POWER', value: siLabel(ia * ia * (tweaks['R1.value'] ?? 220), 'W'), tone: ia > 0.02 ? 'warn' : 'normal' },
        ],
      }}
      statusLine={{
        text: running ? 'RUNNING: pin 13 toggles every 500 ms and the LED blinks' : powered ? 'POWERED: the board has 5 V; upload a sketch to blink the LED' : 'Assemble the board, then plug in USB.',
        tone: 'info',
      }}
      settings={settings}
      onSetting={onSetting}
      code={code}
      onCodeChange={setCode}
      onUpload={() => onAction('upload')}
      serialLines={serial}
      sketchError={null}
      tweakValues={tweaks}
      onTweak={(t: Tweak, v: number) => setTweaks((x) => ({ ...x, [`${t.elementId}.${t.key}`]: v }))}
      onQuizComplete={(score) => {
        setCompleted((c) => (c.includes(active) ? c : [...c, active]))
        sfx('success')
        toast(`Quiz done: ${score} correct.`, 'ok')
      }}
      onQuizAnswer={(ok) => sfx(ok ? 'place' : 'pop')}
      toasts={toasts}
      onDismissToast={dismiss}
    >
      <div className="mock-canvas">
        <svg viewBox="0 0 400 260" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M200 40 330 110 200 180 70 110Z" fill="var(--pcb, #1f7a4d)" fillOpacity=".25" />
            <path d="M70 110v22l130 70 130-70v-22" />
            <path d="M200 180v22" />
          </g>
        </svg>
        <p>3D workbench slot</p>
      </div>
    </Layout>
  )
}
