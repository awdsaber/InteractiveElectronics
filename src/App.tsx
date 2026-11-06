// The app: Layout wired to the bench store. The 3D canvas loads as its own chunk.
import { Suspense, lazy, useMemo } from 'react'
import { useStore } from './engine/bench/store'
import { lessons, pinned, tracks } from './lessons'
import { Layout } from './ui/Layout'
import { sfx } from './audio/sound'

const BenchScene = lazy(() => import('./three/BenchScene'))

const summaries = lessons.map(({ id, fig, track, title, subtitle }) => ({ id, fig, track, title, subtitle }))

export default function App() {
  const s = useStore()
  const { lesson, snap, settings } = s
  const failures = useMemo(() => lesson.failures.map((f) => ({ id: f.id, label: f.label })), [lesson])
  const code = s.code[lesson.id] ?? lesson.sketch?.code ?? ''

  return (
    <Layout
      lesson={lesson}
      syllabus={{
        tracks,
        lessons: summaries,
        activeId: lesson.id,
        completed: s.progress.completed,
        pinned,
        onSelect: (id) => {
          sfx('click')
          s.selectLesson(id)
        },
      }}
      actions={{
        status: snap.status,
        remainingParts: snap.remaining,
        allPlaced: snap.allPlaced,
        smdPlaced: snap.smdPlaced,
        soldered: snap.assembly.soldered || !snap.needsSolder,
        powered: !!snap.assembly.powered[lesson.powerElementId],
        exploded: snap.assembly.exploded,
        hasSketch: !!lesson.sketch,
        powerLabel: lesson.powerLabel,
        extraPower: lesson.extraPower?.map((p) => ({ id: p.elementId, label: p.label, on: !!snap.assembly.powered[p.elementId] })),
        failures,
        onAction: s.act,
        breadboard: lesson.board.base === 'breadboard-only',
      }}
      panel={{ placed: snap.placedCount, total: snap.totalParts, status: snap.status, readouts: snap.readouts }}
      statusLine={snap.statusLine}
      settings={settings}
      onSetting={s.setSetting}
      code={code}
      onCodeChange={s.setCode}
      onUpload={s.upload}
      serialLines={snap.serial.slice(-12)}
      sketchError={snap.sketchError}
      tweakValues={s.tweaks}
      onTweak={s.setTweak}
      onQuizComplete={s.completeQuiz}
      onQuizAnswer={(ok) => sfx(ok ? 'place' : 'pop', ok ? 0.5 : 0.2)}
      toasts={s.toasts}
      onDismissToast={s.dismissToast}
    >
      <Suspense fallback={<div className="bench-loading">Setting out the bench…</div>}>
        <BenchScene lesson={lesson} snap={snap} settings={settings} />
      </Suspense>
    </Layout>
  )
}
