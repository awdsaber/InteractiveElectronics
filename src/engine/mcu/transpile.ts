// Arduino-C subset -> JavaScript async function body.
//
// Approach: tokenise (comments stripped, strings protected), validate bracket structure and
// statement endings with line numbers, then rewrite token-by-token. We never run regexes over the
// whole source, so text inside string literals is safe.

export class TranspileError extends Error {
  line: number
  constructor(line: number, message: string) {
    super(message)
    this.name = 'TranspileError'
    this.line = line
  }
}

export interface TranspileOptions {
  /** extra class-like types usable in declarations (`Servo` is always known) */
  classTypes?: string[]
  /** library names whose `#include` is silently accepted, with or without `.h` */
  knownLibraries?: string[]
}

export interface TranspileResult {
  /** JS for an async function body; declares `setup` / `loop` (when the sketch defines them) */
  js: string
  warnings: string[]
}

// ───────────────────────── tokenizer ─────────────────────────

type TokType = 'id' | 'num' | 'str' | 'chr' | 'p' | 'pp'
interface Tok {
  t: TokType
  v: string
  line: number
  /** pp tokens: the macro name (#define) or the include target (#include) */
  text?: string
}

const PUNCT3 = ['<<=', '>>=']
const PUNCT2 = ['++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '->', '::']
const PUNCT1 = '{}()[];,.:?+-*/%&|^!~<>='
const NUM_RE = /^(?:0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[uUlLfF]*)/
const ID_RE = /^[A-Za-z_]\w*/

function normalizeNumber(raw: string): string {
  if (/^0[xXbB]/.test(raw)) return raw.replace(/[uUlL]+$/, '')
  const s = raw.replace(/[uUlLfF]+$/, '')
  if (/^0\d+$/.test(s)) return String(parseInt(s, 8)) // C octal
  return s
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  const n = src.length
  let i = 0
  let line = 1
  let lineStart = true
  let inDefine = false
  const push = (t: TokType, v: string, text?: string) => {
    toks.push(text === undefined ? { t, v, line } : { t, v, line, text })
    lineStart = false
  }

  while (i < n) {
    const c = src[i]
    if (c === '\n') {
      if (inDefine) {
        push('pp', '#enddef')
        inDefine = false
      }
      line++
      i++
      lineStart = true
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      i++
      continue
    }
    if (c === '\\' && inDefine && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) {
      i += src[i + 1] === '\n' ? 2 : 3
      line++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      if (close < 0) throw new TranspileError(line, 'unterminated /* comment')
      for (let k = i; k < close; k++) if (src[k] === '\n') line++
      i = close + 2
      continue
    }
    if (c === '#') {
      if (!lineStart) throw new TranspileError(line, "unexpected '#'")
      const rest = src.slice(i)
      const m = /^#[ \t]*([A-Za-z]+)/.exec(rest)
      if (!m) throw new TranspileError(line, "unexpected '#'")
      const directive = m[1]
      i += m[0].length
      if (directive === 'include') {
        const inc = /^[ \t]*[<"]([^>"\n]+)[>"]/.exec(src.slice(i))
        if (!inc) throw new TranspileError(line, 'malformed #include')
        i += inc[0].length
        push('pp', '#include', inc[1].trim())
      } else if (directive === 'define') {
        const d = /^[ \t]+([A-Za-z_]\w*)(\()?/.exec(src.slice(i))
        if (!d) throw new TranspileError(line, 'malformed #define')
        if (d[2]) throw new TranspileError(line, `function-like macro ${d[1]}() is not supported; use a function`)
        i += d[0].length
        push('pp', '#define', d[1])
        inDefine = true
      } else {
        throw new TranspileError(line, `preprocessor directive #${directive} is not supported`)
      }
      continue
    }
    if (c === '"' || c === "'") {
      const start = i
      i++
      while (i < n && src[i] !== c) {
        if (src[i] === '\n') break
        if (src[i] === '\\') i++
        i++
      }
      if (i >= n || src[i] !== c) throw new TranspileError(line, c === '"' ? 'unterminated string' : 'unterminated character literal')
      i++
      push(c === '"' ? 'str' : 'chr', src.slice(start, i))
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = NUM_RE.exec(src.slice(i, i + 64))
      if (!m) throw new TranspileError(line, 'malformed number')
      i += m[0].length
      push('num', normalizeNumber(m[0]))
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = ID_RE.exec(src.slice(i, i + 128)) as RegExpExecArray
      i += m[0].length
      push('id', m[0])
      continue
    }
    const three = src.slice(i, i + 3)
    const two = src.slice(i, i + 2)
    if (PUNCT3.includes(three)) {
      push('p', three)
      i += 3
    } else if (PUNCT2.includes(two)) {
      push('p', two)
      i += 2
    } else if (PUNCT1.includes(c)) {
      push('p', c)
      i++
    } else {
      throw new TranspileError(line, `unexpected character '${c}'`)
    }
  }
  if (inDefine) push('pp', '#enddef')
  return toks
}

// ───────────────────────── structure checks ─────────────────────────

const OPEN = '([{'
const CLOSE: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
const HEADER_KW = new Set(['if', 'for', 'while', 'switch'])

/** match[i] = index of the partner bracket; throws on unbalanced input. */
function matchBrackets(toks: Tok[]): number[] {
  const match: number[] = new Array(toks.length).fill(-1)
  const stack: number[] = []
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i]
    if (tk.t !== 'p') continue
    if (OPEN.includes(tk.v)) {
      stack.push(i)
    } else if (tk.v in CLOSE) {
      const want = CLOSE[tk.v]
      const top = stack[stack.length - 1]
      if (top !== undefined && toks[top].v === want) {
        stack.pop()
        match[i] = top
        match[top] = i
      } else if (stack.some((s) => toks[s].v === want)) {
        // an inner bracket was never closed
        throw new TranspileError(toks[top as number].line, `unclosed '${toks[top as number].v}'`)
      } else {
        throw new TranspileError(tk.line, `unexpected '${tk.v}'`)
      }
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1]
    throw new TranspileError(toks[top].line, `unclosed '${toks[top].v}'`)
  }
  return match
}

const PRIM_TYPES = [
  'int', 'long', 'short', 'unsigned', 'signed', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'void',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'word', 'String',
]
const TYPE_WORDS = new Set(PRIM_TYPES)
const MODIFIERS = new Set(['const', 'static', 'volatile', 'extern', 'inline', 'register'])
const NO_STATEMENT_END = new Set(['else', 'do', 'return', 'case', 'default', 'sizeof', ...PRIM_TYPES, ...MODIFIERS])

/** A statement line that ends in a value and is followed by a line starting a new one, with no ';' between. */
function checkSemicolons(toks: Tok[], match: number[]): void {
  const headerClose = new Set<number>()
  for (let i = 1; i < toks.length; i++) {
    if (toks[i].v === '(' && toks[i].t === 'p' && toks[i - 1].t === 'id' && HEADER_KW.has(toks[i - 1].v)) headerClose.add(match[i])
  }
  const braceIsInit: boolean[] = []
  let depth = 0 // () and [] nesting
  for (let i = 0; i < toks.length - 1; i++) {
    const a = toks[i]
    if (a.t === 'p') {
      if (a.v === '(' || a.v === '[') depth++
      else if (a.v === ')' || a.v === ']') depth--
      else if (a.v === '{') {
        const prev = toks[i - 1]
        const top = braceIsInit[braceIsInit.length - 1] === true
        braceIsInit.push(prev !== undefined && prev.t === 'p' && (prev.v === '=' || (top && (prev.v === ',' || prev.v === '{'))))
      } else if (a.v === '}') braceIsInit.pop()
    }
    const b = toks[i + 1]
    if (a.t === 'pp' || b.t === 'pp' || a.line === b.line) continue
    if (depth !== 0 || braceIsInit[braceIsInit.length - 1] === true) continue
    const aEnds =
      a.t === 'num' ||
      a.t === 'str' ||
      a.t === 'chr' ||
      (a.t === 'id' && !NO_STATEMENT_END.has(a.v)) ||
      (a.t === 'p' && (a.v === ']' || a.v === '++' || a.v === '--' || (a.v === ')' && !headerClose.has(i))))
    const bStarts = b.t === 'id' || b.t === 'num' || b.t === 'str' || b.t === 'chr'
    if (aEnds && bStarts) throw new TranspileError(a.line, "missing ';' at the end of this statement")
  }
}

// ───────────────────────── rewriting ─────────────────────────

const UNSUPPORTED_KW = new Set([
  'struct', 'class', 'enum', 'union', 'typedef', 'template', 'namespace', 'using', 'goto', 'new', 'delete', 'try', 'catch', 'throw', 'this', 'operator', 'virtual', 'friend', 'public', 'private', 'protected',
])
const JS_RESERVED = new Set(['var', 'function', 'in', 'of', 'with', 'yield', 'await', 'async', 'export', 'import', 'typeof', 'instanceof', 'debugger', 'null', 'undefined', 'arguments', 'eval', 'let'])
const KNOWN_INCLUDES = new Set(['Arduino', 'Servo', 'Wire', 'SPI', 'EEPROM', 'math', 'stdlib', 'stdint', 'string', 'stdio'])
/** builtins whose result is an integer, so Serial.print must not add decimals */
const INT_FUNCS = new Set(['map', 'analogRead', 'digitalRead', 'millis', 'micros', 'random', 'sizeof', 'length'])
const TICK = '(++__g.n>__g.limit?await __g.pause():0)'

const jsName = (v: string) => (JS_RESERVED.has(v) ? `${v}_c` : v)

type Kind = 'int' | 'char' | 'float' | 'bool' | 'string' | 'void' | 'class'

function kindOf(words: string[]): Kind {
  const w = new Set(words)
  if (w.has('float') || w.has('double')) return 'float'
  if (w.has('bool') || w.has('boolean')) return 'bool'
  if (w.has('String')) return 'string'
  if (w.has('void')) return 'void'
  if (w.has('char') && !w.has('unsigned') && !w.has('signed')) return 'char'
  return 'int'
}

function castPrefix(words: string[]): string | null {
  const w = new Set(words)
  if (w.has('float') || w.has('double')) return null // JS numbers are already floating point
  if (w.has('bool') || w.has('boolean')) return 'Boolean'
  if (w.has('String')) return 'String'
  if (w.has('char')) return w.has('unsigned') ? '__u8' : '__chr'
  if (w.has('byte') || w.has('uint8_t')) return '__u8'
  if (w.has('uint16_t') || w.has('word')) return '__u16'
  if (w.has('void')) return null
  return '__cast'
}

function sizeOfType(words: string[]): number {
  const w = new Set(words)
  if (w.has('char') || w.has('byte') || w.has('bool') || w.has('boolean') || w.has('uint8_t') || w.has('int8_t')) return 1
  if (w.has('uint64_t') || w.has('int64_t') || words.filter((x) => x === 'long').length >= 2) return 8
  if (w.has('long') || w.has('float') || w.has('double') || w.has('uint32_t') || w.has('int32_t')) return 4
  return 2
}

interface Header {
  kind: 'for' | 'while' | 'other'
  depth: number
  semis: number
  openCond: boolean
}
interface DeclResult {
  index: number
  stmtStart: boolean
  semi: boolean
}

class Transpiler {
  private toks: Tok[]
  private match: number[]
  private out: Tok[] = []
  private hoist: Tok[] = []
  warnings: string[] = []
  private funcs = new Set<string>()
  private floatNames = new Set<string>()
  private intNames = new Set<string>()
  private classTypes: Set<string>
  private knownLibs: Set<string>
  private initBraces = new Set<number>()
  private closers = new Map<number, number>()
  private blockDepth = 0
  private line = 1

  constructor(toks: Tok[], match: number[], opts: TranspileOptions) {
    this.toks = toks
    this.match = match
    this.classTypes = new Set(['Servo', ...(opts.classTypes ?? [])])
    this.knownLibs = new Set([...KNOWN_INCLUDES, ...(opts.knownLibraries ?? []).map((l) => l.replace(/\.h$/, ''))])
  }

  transpile(): string {
    this.scanFunctions()
    this.run(0, this.toks.length, true)
    return `${this.join(this.out)}\n${this.join(this.hoist)}\n`
  }

  // ── helpers ──

  private emit(v: string, t: TokType = 'p'): void {
    this.out.push({ t, v, line: this.line })
  }

  private flushClose(i: number): void {
    const c = this.closers.get(i)
    if (c) {
      for (let k = 0; k < c; k++) this.emit(')')
      this.closers.delete(i)
    }
  }

  private join(toks: Tok[]): string {
    let s = ''
    let prev: Tok | undefined
    for (const tk of toks) {
      if (prev) s += tk.line > prev.line && prev.v !== 'return' ? '\n' : ' '
      s += tk.v
      prev = tk
    }
    return s
  }

  /** index of the first top-level ',' or ';' (or closer / `end`) at or after `from` */
  private exprEnd(from: number, end: number): number {
    const { toks, match } = this
    let k = from
    while (k < end) {
      const tk = toks[k]
      if (tk.t === 'p') {
        if (tk.v === '(' || tk.v === '[' || tk.v === '{') {
          k = match[k] + 1
          continue
        }
        if (tk.v === ',' || tk.v === ';' || tk.v === ')' || tk.v === ']' || tk.v === '}') return k
      }
      k++
    }
    return end
  }

  private splitTop(from: number, to: number): Array<[number, number]> {
    const parts: Array<[number, number]> = []
    if (from >= to) return parts
    let s = from
    let k = from
    while (k < to) {
      const tk = this.toks[k]
      if (tk.t === 'p' && (tk.v === '(' || tk.v === '[' || tk.v === '{')) {
        k = this.match[k] + 1
        continue
      }
      if (tk.t === 'p' && tk.v === ',') {
        parts.push([s, k])
        s = k + 1
      }
      k++
    }
    parts.push([s, to])
    return parts
  }

  /** Pre-pass: names of user functions (and which return floats), so calls can be awaited. */
  private scanFunctions(): void {
    const { toks, match } = this
    let i = 0
    while (i < toks.length) {
      const tk = toks[i]
      if (tk.t === 'p' && tk.v === '{') {
        i = match[i] + 1
        continue
      }
      if (tk.t === 'id' && toks[i + 1]?.v === '(' && i > 0) {
        const prev = toks[i - 1]
        if (prev.t === 'id' && TYPE_WORDS.has(prev.v)) {
          this.funcs.add(tk.v)
          let j = i - 1
          const words: string[] = []
          while (j >= 0 && toks[j].t === 'id' && (TYPE_WORDS.has(toks[j].v) || MODIFIERS.has(toks[j].v))) {
            words.push(toks[j].v)
            j--
          }
          if (kindOf(words) === 'float') this.floatNames.add(tk.v)
          i = match[i + 1] + 1
          continue
        }
      }
      i++
    }
  }

  // ── main rewriting loop over toks[start, end) ──

  private run(start: number, end: number, stmtStart: boolean): void {
    const { toks } = this
    let paren = 0
    let atStart = stmtStart
    const headers: Header[] = []
    let caseColon = false
    let i = start

    while (i < end) {
      this.flushClose(i)
      const tk = toks[i]
      this.line = tk.line
      const wasStart = atStart
      atStart = false

      if (tk.t === 'pp') {
        i = this.preprocessor(i)
        atStart = true
        continue
      }

      if (wasStart) {
        const d = this.tryDecl(i, end)
        if (d) {
          i = d.index
          atStart = d.stmtStart
          const h = headers[headers.length - 1]
          if (d.semi && h && h.kind === 'for' && paren === h.depth) {
            atStart = false // for-init declaration: the next token is the condition
            h.semis++
            this.forCondStart(h, i)
          }
          continue
        }
      }

      if (tk.t === 'num') {
        this.emit(tk.v, 'num')
        i++
        continue
      }
      if (tk.t === 'str' || tk.t === 'chr') {
        this.emit(tk.v, tk.t)
        i++
        continue
      }

      if (tk.t === 'id') {
        const v = tk.v
        if (UNSUPPORTED_KW.has(v)) throw new TranspileError(tk.line, `'${v}' is not supported in this Arduino subset`)
        if (v === 'else' || v === 'do') {
          this.emit(v, 'id')
          atStart = true
          i++
          continue
        }
        if (v === 'case' || v === 'default') {
          caseColon = true
          this.emit(v, 'id')
          i++
          continue
        }
        const prev = toks[i - 1]
        const next = toks[i + 1]
        const isMember = prev !== undefined && prev.t === 'p' && prev.v === '.'
        if (!isMember && v === 'sizeof' && next?.v === '(') {
          i = this.sizeofExpr(i)
          continue
        }
        if (!isMember && v === 'Serial' && next?.v === '.' && (toks[i + 2]?.v === 'print' || toks[i + 2]?.v === 'println') && toks[i + 3]?.v === '(') {
          i = this.serialPrint(i)
          continue
        }
        if (!isMember && next?.v === '(') {
          if (TYPE_WORDS.has(v)) {
            // function-style cast: int(x), float(x), byte(x)
            const p = castPrefix([v])
            if (p) this.emit(p, 'id')
            i++
            continue
          }
          if (this.funcs.has(v) || v === 'delay' || v === 'delayMicroseconds') {
            this.emit('await', 'id')
            this.emit(jsName(v), 'id')
            i++
            continue
          }
        }
        if (isMember && v === 'length' && next?.v === '(' && toks[i + 2]?.v === ')') {
          this.emit('length', 'id')
          i += 3
          continue
        }
        if (wasStart && !isMember && this.intNames.has(v) && !this.floatNames.has(v) && next?.t === 'p' && next.v === '=') {
          const e = this.exprEnd(i + 2, end)
          this.emit(jsName(v), 'id')
          this.emit('=')
          this.emit('__int', 'id')
          this.emit('(')
          this.run(i + 2, e, false)
          this.emit(')')
          i = e
          continue
        }
        this.emit(isMember ? v : jsName(v), 'id')
        i++
        continue
      }

      // punctuation
      switch (tk.v) {
        case '{':
          if (this.initBraces.has(i)) {
            this.emit('[')
          } else {
            this.emit('{')
            this.blockDepth++
            atStart = true
          }
          i++
          continue
        case '}':
          if (this.initBraces.has(i)) {
            this.emit(']')
          } else {
            this.emit('}')
            this.blockDepth--
            atStart = true
          }
          i++
          continue
        case '(': {
          const c = this.tryCast(i)
          if (c !== null) {
            i = c
            continue
          }
          paren++
          const prev = toks[i - 1]
          const kw = prev !== undefined && prev.t === 'id' ? prev.v : ''
          if (kw === 'for') {
            headers.push({ kind: 'for', depth: paren, semis: 0, openCond: false })
            this.emit('(')
            atStart = true
          } else if (kw === 'while') {
            headers.push({ kind: 'while', depth: paren, semis: 0, openCond: false })
            this.emit('(')
            this.emit(TICK)
            this.emit(',')
            this.emit('(')
          } else {
            if (kw === 'if' || kw === 'switch') headers.push({ kind: 'other', depth: paren, semis: 0, openCond: false })
            this.emit('(')
          }
          i++
          continue
        }
        case ')': {
          const h = headers[headers.length - 1]
          const closing = h !== undefined && paren === h.depth
          paren--
          this.emit(')')
          if (h && closing) {
            if (h.kind === 'while') this.emit(')')
            headers.pop()
            atStart = true
          }
          i++
          continue
        }
        case ';': {
          const h = headers[headers.length - 1]
          if (h && h.kind === 'for' && paren === h.depth) {
            h.semis++
            if (h.semis === 2 && h.openCond) this.emit(')')
            this.emit(';')
            if (h.semis === 1) this.forCondStart(h, i + 1)
          } else {
            this.emit(';')
            atStart = paren === 0
          }
          i++
          continue
        }
        case ':':
          this.emit(':')
          if (caseColon && paren === 0) {
            caseColon = false
            atStart = true
          }
          i++
          continue
        case '->':
        case '::':
          throw new TranspileError(tk.line, `'${tk.v}' is not supported in this Arduino subset`)
        default:
          this.emit(tk.v)
          i++
      }
    }
    this.flushClose(end)
  }

  /** After the first ';' of a for header: instrument the loop condition. */
  private forCondStart(h: Header, nextIdx: number): void {
    if (h.semis !== 1) return
    if (this.toks[nextIdx]?.v === ';') {
      this.emit(TICK)
      this.emit(',')
      this.emit('true')
      h.openCond = false
    } else {
      this.emit(TICK)
      this.emit(',')
      this.emit('(')
      h.openCond = true
    }
  }

  // ── pieces ──

  private preprocessor(i: number): number {
    const tk = this.toks[i]
    if (tk.v === '#include') {
      const target = tk.text ?? ''
      const base = target.replace(/\.h$/, '')
      if (!this.knownLibs.has(base)) this.warnings.push(`Line ${tk.line}: unknown library "${target}" - ignored`)
      return i + 1
    }
    if (tk.v === '#define') {
      let e = i + 1
      while (e < this.toks.length && this.toks[e].v !== '#enddef') e++
      this.emit('const', 'id')
      this.emit(tk.text as string, 'id')
      this.emit('=')
      if (e === i + 1) this.emit('1', 'num')
      else this.run(i + 1, e, false)
      this.emit(';')
      return e + 1
    }
    return i + 1 // stray #enddef
  }

  /** `(type)operand` casts. Returns the index after the ')' or null if this is not a cast. */
  private tryCast(i: number): number | null {
    const { toks } = this
    let j = i + 1
    const words: string[] = []
    while (toks[j]?.t === 'id' && (TYPE_WORDS.has(toks[j].v) || toks[j].v === 'const')) {
      if (toks[j].v !== 'const') words.push(toks[j].v)
      j++
    }
    if (!words.length || toks[j]?.v !== ')') return null
    const after = toks[j + 1]
    if (!after) return null
    const startsOperand =
      after.t === 'id' || after.t === 'num' || after.t === 'str' || after.t === 'chr' || (after.t === 'p' && ['(', '-', '+', '!', '~', '++', '--'].includes(after.v))
    if (!startsOperand) return null
    const prefix = castPrefix(words)
    if (prefix) {
      const e = this.operandEnd(j + 1)
      this.emit(prefix, 'id')
      this.emit('(')
      this.closers.set(e, (this.closers.get(e) ?? 0) + 1)
    }
    return j + 1
  }

  private operandEnd(from: number): number {
    const { toks, match } = this
    let k = from
    for (;;) {
      const tk = toks[k]
      if (!tk) return k
      if (tk.t === 'p' && ['-', '+', '!', '~', '++', '--'].includes(tk.v)) {
        k++
        continue
      }
      if (tk.t === 'p' && tk.v === '(') {
        // nested cast?
        let j = k + 1
        let words = 0
        while (toks[j]?.t === 'id' && TYPE_WORDS.has(toks[j].v)) {
          j++
          words++
        }
        if (words && toks[j]?.v === ')') {
          k = j + 1
          continue
        }
      }
      break
    }
    const tk = toks[k]
    if (!tk) return k
    if (tk.t === 'p' && tk.v === '(') k = match[k] + 1
    else k++
    for (;;) {
      const t = toks[k]
      if (!t || t.t !== 'p') break
      if (t.v === '(' || t.v === '[') k = match[k] + 1
      else if (t.v === '.' && toks[k + 1]?.t === 'id') k += 2
      else if (t.v === '++' || t.v === '--') k++
      else break
    }
    return k
  }

  private sizeofExpr(i: number): number {
    const open = i + 1
    const close = this.match[open]
    const inner = this.toks.slice(open + 1, close)
    if (inner.length && inner.every((t) => t.t === 'id' && (TYPE_WORDS.has(t.v) || t.v === 'const'))) {
      this.emit(String(sizeOfType(inner.map((t) => t.v))), 'num')
    } else {
      this.emit('__sizeof', 'id')
      this.emit('(')
      this.run(open + 1, close, false)
      this.emit(')')
    }
    return close + 1
  }

  private isFloatExpr(from: number, to: number): boolean {
    let float = false
    for (let k = from; k < to; k++) {
      const t = this.toks[k]
      const isMember = this.toks[k - 1]?.v === '.'
      if (t.t === 'id') {
        if (isMember) continue
        if (INT_FUNCS.has(t.v)) return false
        if (TYPE_WORDS.has(t.v)) {
          const kind = kindOf([t.v])
          if (kind === 'float') float = true
          else if (kind === 'int' || kind === 'char' || kind === 'bool') return false
        } else if (this.floatNames.has(t.v) || t.v === 'PI') float = true
      } else if (t.t === 'num' && !/^0[xXbB]/.test(t.v) && (t.v.includes('.') || /[eE]/.test(t.v))) {
        float = true
      }
    }
    return float
  }

  private serialPrint(i: number): number {
    const method = this.toks[i + 2].v
    const open = i + 3
    const close = this.match[open]
    this.emit('Serial', 'id')
    this.emit('.')
    this.emit(method, 'id')
    this.emit('(')
    this.splitTop(open + 1, close).forEach(([a, b], n) => {
      if (n) this.emit(',')
      if (n === 0 && a < b && this.isFloatExpr(a, b)) {
        this.emit('__F', 'id')
        this.emit('(')
        this.run(a, b, false)
        this.emit(')')
      } else {
        this.run(a, b, false)
      }
    })
    this.emit(')')
    return close + 1
  }

  // ── declarations ──

  private tryDecl(i: number, end: number): DeclResult | null {
    const { toks, match } = this
    let j = i
    const mods: string[] = []
    while (j < end && toks[j].t === 'id' && MODIFIERS.has(toks[j].v)) {
      mods.push(toks[j].v)
      j++
    }
    const words: string[] = []
    let cls: string | null = null
    if (j < end && toks[j].t === 'id' && this.classTypes.has(toks[j].v)) {
      if (toks[j + 1]?.t !== 'id') return null
      cls = toks[j].v
      j++
    } else {
      while (j < end && toks[j].t === 'id' && TYPE_WORDS.has(toks[j].v)) {
        words.push(toks[j].v)
        j++
      }
      if (!words.length) {
        if (mods.length) throw new TranspileError(toks[i].line, `expected a type after '${mods[mods.length - 1]}'`)
        return null
      }
    }
    let kind: Kind = cls ? 'class' : kindOf(words)
    const t0 = toks[j]
    if (t0 && t0.t === 'p' && t0.v === '*') {
      if (words.includes('char') && !words.includes('unsigned')) {
        kind = 'string' // char* is treated as a string
        j++
      } else {
        throw new TranspileError(t0.line, 'pointers are not supported in this Arduino subset')
      }
    } else if (t0 && t0.t === 'p' && t0.v === '&') {
      throw new TranspileError(t0.line, 'references are not supported in this Arduino subset')
    }
    const nameTok = toks[j]
    if (!nameTok || nameTok.t !== 'id') {
      if (nameTok && nameTok.v === '(' && !cls) return null // e.g. int(x) used as a cast statement
      throw new TranspileError((nameTok ?? toks[j - 1]).line, `expected a name after '${cls ?? words.join(' ')}'`)
    }

    // function definition / prototype
    if (toks[j + 1]?.v === '(' && !cls) {
      if (this.blockDepth > 0) throw new TranspileError(nameTok.line, 'functions cannot be defined inside other functions')
      return this.funcDef(j, kind)
    }

    if (kind === 'void') throw new TranspileError(nameTok.line, 'a variable cannot have type void')
    const isConst = mods.includes('const')
    const isStatic = mods.includes('static') && this.blockDepth > 0
    const savedOut = this.out
    if (isStatic) this.out = this.hoist
    this.line = toks[i].line
    this.emit(isConst ? 'const' : 'let', 'id')
    const fill = kind === 'string' ? '""' : kind === 'bool' ? 'false' : '0'

    let k = j
    let first = true
    for (;;) {
      const nt = toks[k]
      if (!nt || nt.t !== 'id') throw new TranspileError((nt ?? toks[k - 1]).line, 'expected a variable name')
      this.line = nt.line
      if (!first) this.emit(',')
      first = false
      const name = nt.v
      k++
      const dims: Array<[number, number]> = []
      while (toks[k]?.v === '[') {
        dims.push([k + 1, match[k]])
        k = match[k] + 1
      }
      let ctor: [number, number] | null = null
      let init: [number, number] | null = null
      if (toks[k]?.v === '(' && cls) {
        ctor = [k + 1, match[k]]
        k = match[k] + 1
      } else if (toks[k]?.t === 'p' && toks[k].v === '=') {
        const s = k + 1
        const e = this.exprEnd(s, end)
        if (e === s) throw new TranspileError(nt.line, `missing initializer for '${name}'`)
        for (let q = s; q < e; q++) if (toks[q].v === '{' || toks[q].v === '}') this.initBraces.add(q)
        init = [s, e]
        k = e
      }
      this.emit(jsName(name), 'id')
      this.emit('=')
      if (dims.length) {
        if (!init) {
          if (isConst) throw new TranspileError(nt.line, `const '${name}' needs an initializer`)
          this.emit('__arr', 'id')
          this.emit('(')
          this.emit('[')
          dims.forEach((d, n) => {
            if (d[0] === d[1]) throw new TranspileError(nt.line, `array '${name}' needs a size`)
            if (n) this.emit(',')
            this.run(d[0], d[1], false)
          })
          this.emit(']')
          this.emit(',')
          this.emit(fill, 'num')
          this.emit(')')
        } else if (toks[init[0]].v === '{' && dims[0][0] !== dims[0][1]) {
          this.emit('__pad', 'id')
          this.emit('(')
          this.run(init[0], init[1], false)
          this.emit(',')
          this.run(dims[0][0], dims[0][1], false)
          this.emit(',')
          this.emit(fill, 'num')
          this.emit(')')
        } else {
          this.run(init[0], init[1], false)
        }
        if (kind === 'float') this.floatNames.add(name)
      } else if (ctor) {
        this.emit('new', 'id')
        this.emit(cls as string, 'id')
        this.emit('(')
        this.run(ctor[0], ctor[1], false)
        this.emit(')')
      } else if (init) {
        if (kind === 'int') {
          this.emit('__int', 'id')
          this.emit('(')
          this.run(init[0], init[1], false)
          this.emit(')')
        } else {
          this.run(init[0], init[1], false)
        }
      } else {
        if (isConst) throw new TranspileError(nt.line, `const '${name}' needs an initializer`)
        if (kind === 'class') {
          this.emit('new', 'id')
          this.emit(cls as string, 'id')
          this.emit('(')
          this.emit(')')
        } else {
          this.emit(fill, 'num')
        }
      }
      if (!dims.length) {
        if (kind === 'float') this.floatNames.add(name)
        else if (kind === 'int') this.intNames.add(name)
      }
      const sep = toks[k]
      if (sep && sep.t === 'p' && sep.v === ',') {
        k++
        continue
      }
      if (sep && sep.t === 'p' && sep.v === ';') {
        this.emit(';')
        k++
        break
      }
      throw new TranspileError((sep ?? toks[k - 1]).line, `expected ';' after the declaration of '${name}'`)
    }
    this.out = savedOut
    return { index: k, stmtStart: true, semi: true }
  }

  private funcDef(nameIdx: number, retKind: Kind): DeclResult {
    const { toks, match } = this
    const nameTok = toks[nameIdx]
    const open = nameIdx + 1
    const close = match[open]
    const params: string[] = []
    for (const [a, b] of this.splitTop(open + 1, close)) {
      let k = a
      if (b - a === 1 && toks[a].v === 'void') continue
      let sawName: string | null = null
      let kind: Kind = 'int'
      const words: string[] = []
      while (k < b) {
        const t = toks[k]
        if (t.t === 'p' && t.v === '*') {
          if (words.includes('char')) {
            kind = 'string'
            k++
            continue
          }
          throw new TranspileError(t.line, 'pointers are not supported in this Arduino subset')
        }
        if (t.t === 'p' && t.v === '&') throw new TranspileError(t.line, 'reference parameters are not supported in this Arduino subset')
        if (t.t === 'p' && t.v === '=') throw new TranspileError(t.line, 'default argument values are not supported in this Arduino subset')
        if (t.t === 'p' && t.v === '[') {
          k = match[k] + 1
          continue
        }
        if (t.t === 'id') {
          if (MODIFIERS.has(t.v)) {
            k++
            continue
          }
          if (TYPE_WORDS.has(t.v) || (this.classTypes.has(t.v) && k + 1 < b)) {
            words.push(t.v)
            k++
            continue
          }
          sawName = t.v
        }
        k++
      }
      if (kind !== 'string') kind = kindOf(words)
      const pname = sawName ?? `__p${params.length}`
      params.push(jsName(pname))
      if (sawName) {
        if (kind === 'float') this.floatNames.add(sawName)
        else if (kind === 'int') this.intNames.add(sawName)
      }
    }
    if (retKind === 'float') this.floatNames.add(nameTok.v)
    this.funcs.add(nameTok.v)
    const after = toks[close + 1]
    if (after && after.t === 'p' && after.v === '{') {
      this.line = nameTok.line
      this.emit('async', 'id')
      this.emit('function', 'id')
      this.emit(jsName(nameTok.v), 'id')
      this.emit('(')
      params.forEach((p, n) => {
        if (n) this.emit(',')
        this.emit(p, 'id')
      })
      this.emit(')')
      this.emit('{')
      this.blockDepth++
      return { index: close + 2, stmtStart: true, semi: false }
    }
    if (after && after.t === 'p' && after.v === ';') return { index: close + 2, stmtStart: true, semi: false } // prototype
    throw new TranspileError((after ?? toks[close]).line, `expected '{' or ';' after the header of function '${nameTok.v}'`)
  }
}

// ───────────────────────── public API ─────────────────────────

export function transpile(src: string, opts: TranspileOptions = {}): TranspileResult {
  const toks = tokenize(src)
  const match = matchBrackets(toks)
  checkSemicolons(toks, match)
  const tr = new Transpiler(toks, match, opts)
  const js = tr.transpile()
  try {
    // parse only (never called) to catch anything our structural checks missed
    new Function(`return (async () => {\n${js}\n})`)
  } catch (e) {
    throw new TranspileError(1, `this sketch could not be understood (${e instanceof Error ? e.message : String(e)})`)
  }
  return { js, warnings: tr.warnings }
}
