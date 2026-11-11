// The app: Layout wired to the bench store. The 3D canvas loads as its own chunk.
import { Suspense, lazy, useMemo } from 'react'
import { getBench, useStore } from './engine/bench/store'
import { lessons, pinned, tracks } from './lessons'
import { Instruments } from './ui/Instruments'
import { Layout } from './ui/Layout'
import { GuidePanel } from './ui/GuidePanel'
import { PartInspector } from './ui/PartInspector'
import { sfx } from './audio/sound'

const BenchScene = lazy(() => import('./three/BenchScene'))

const summaries = lessons.map(({ id, fig, track, title, subtitle }) => ({ id, fig, track, title, subtitle }))

export default function App() {
  const s = useStore()
  const { lesson, snap, settings } = s
  const failures = useMemo(() => lesson.failures.map((f) => ({ id: f.id, label: f.label })), [lesson])
  const code = s.code[lesson.id] ?? lesson.sketch?.code ?? ''
  const inspected = s.selectedPart ? lesson.board.parts.find((p) => p.id === s.selectedPart) : undefined
  const guideFocus = s.guide && s.guideMode === 'guided' ? (s.guide.step?.focus?.part ?? null) : null

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
      panel={{ placed: snap.placedCount, total: snap.totalParts, status: snap.status, readouts: snap.readouts, onResetPeaks: s.resetPeaks }}
      statusLine={snap.statusLine}
      settings={settings}
      onSetting={s.setSetting}
      code={code}
      onCodeChange={s.setCode}
      onUpload={s.upload}
      serialLines={snap.serial.slice(-12)}
      sketchError={snap.sketchError}
      tweakValues={s.tweaks}
      tweakDefaults={s.tweakDefaults}
      benchControls={{
        sim: { speed: s.speed, rate: snap.rate, capped: snap.capped, onSpeed: s.setSpeed },
        instruments: { open: s.instrumentsOpen, onToggle: s.setInstrumentsOpen },
      }}
      instruments={s.instrumentsOpen ? <Instruments key={lesson.id} lesson={lesson} bench={getBench} /> : null}
      onTweak={s.setTweak}
      onQuizComplete={s.completeQuiz}
      onQuizAnswer={(ok) => sfx(ok ? 'place' : 'pop', ok ? 0.5 : 0.2)}
      toasts={s.toasts}
      onDismissToast={s.dismissToast}
      guide={
        s.guide && lesson.guide ? (
          <GuidePanel
            steps={lesson.guide}
            state={s.guide}
            mode={s.guideMode}
            onMode={s.setGuideMode}
            onBack={s.guideBack}
            onSkip={s.guideSkip}
            onRestart={s.guideRestart}
            onConfirm={s.guideConfirm}
            onShowPart={s.zoomToPart}
          />
        ) : null
      }
      inspector={
        inspected ? (
          <PartInspector
            key={lesson.id}
            lesson={lesson}
            part={inspected}
            snap={snap}
            onClose={() => s.selectPart(null)}
            onZoom={() => s.zoomToPart(inspected.id)}
            onResetView={s.resetView}
          />
        ) : null
      }
    >
      <Suspense fallback={<div className="bench-loading">Setting out the bench…</div>}>
        <BenchScene lesson={lesson} snap={snap} settings={settings} selected={s.selectedPart} guideFocus={guideFocus} onSelect={s.selectPart} view={s.view} tweaks={s.tweaks} />
      </Suspense>
      {s.view.partId && (
        <button type="button" className="pill view-reset" onClick={s.resetView}>
          Reset view
        </button>
      )}
    </Layout>
  )
}
