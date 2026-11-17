// Texto de un archivo subido. Los reportes HTML del terminal MT5 salen
// en UTF-16 (con BOM); readAsText los leería como UTF-8 y quedarían
// ilegibles. Se mira el BOM y, si no hay, se asume UTF-8.
export function decodeFileBuffer(buffer) {
  const b = new Uint8Array(buffer)
  let enc = 'utf-8'
  if (b[0] === 0xFF && b[1] === 0xFE) enc = 'utf-16le'
  else if (b[0] === 0xFE && b[1] === 0xFF) enc = 'utf-16be'
  return new TextDecoder(enc).decode(b)
}
