// Account statement en PDF → texto CSV (ver importers/statementPdf.js).
// pdf.js pesa bastante: se carga solo cuando el usuario sube un PDF.
import { extractPdfTokens, statementTokensToCsv } from '@/importers/statementPdf'

export async function readPdfStatement(buffer) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    // ?worker: Vite lo empaqueta como .js (un .mjs suelto puede servirse
    // con un tipo MIME que el navegador no acepta para workers)
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
  ])
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new worker.default()
  return statementTokensToCsv(await extractPdfTokens(pdfjs, buffer))
}
