import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import type { Sketch } from '../engine/types'
import { sketchBaud } from './sketchBaud'

export interface TryItYourselfProps {
  sketch: Pick<Sketch, 'title'>
  code: string
  onCodeChange: (code: string) => void
  /** called with the current code when Upload is pressed */
  onUpload: (code: string) => void
  uploadDisabled?: boolean
  serialLines: string[]
  /** compile/runtime error, e.g. "line 4: 'ledPin' was not declared" */
  error?: string | null
}

export function TryItYourself({ sketch, code, onCodeChange, onUpload, uploadDisabled, serialLines, error }: TryItYourselfProps) {
  return (
    <section className="note" aria-labelledby="try-h">
      <h2 id="try-h" className="note-head">
        <span>B</span> Try it yourself
      </h2>
      <div className="editor-bar">
        <span className="file">{sketch.title.toLowerCase().replace(/\s+/g, '_')}.ino</span>
        <button type="button" className="pill small primary" disabled={uploadDisabled} onClick={() => onUpload(code)}>
          Upload ▸
        </button>
      </div>
      <div className="editor">
        <CodeMirror
          value={code}
          height="240px"
          extensions={[cpp()]}
          theme="light"
          onChange={onCodeChange}
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
          aria-label="Sketch code"
        />
      </div>
      {error && (
        <p className="code-error" role="alert">
          <b>error</b> {error}
        </p>
      )}
      <div className="serial" aria-label="Serial monitor">
        <div className="serial-head">Serial monitor · {sketchBaud(code) ?? 9600} baud</div>
        <pre>{serialLines.length ? serialLines.join('\n') : '— no output yet —'}</pre>
      </div>
    </section>
  )
}
