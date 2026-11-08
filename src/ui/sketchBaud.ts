/** The baud rate a sketch passes to Serial.begin (a numeric literal), or null; comments are ignored. */
export function sketchBaud(code: string): number | null {
  const src = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const m = /\bSerial\s*\.\s*begin\s*\(\s*(\d+)\s*[uUlL]*\s*[,)]/.exec(src)
  return m ? Number(m[1]) : null
}
