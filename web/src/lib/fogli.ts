/* Lettura di xlsx e csv nel browser. SheetJS viene dalla sua distribuzione
   ufficiale (cdn.sheetjs.com, 0.20.x): la versione su npm è ferma alla
   0.18.5, che ha vulnerabilità note sui file costruiti ad arte. Si carica
   solo quando serve, così non pesa sul resto dell'app. */
import { parseCSV } from '../domain/importa.ts'

export interface Cartella {
  fogli: string[]
  righe: (foglio: string, grezze?: boolean) => unknown[][]
}

export async function apriCartella(file: File): Promise<Cartella> {
  const X = await import('xlsx')
  const wb = X.read(await file.arrayBuffer(), { type: 'array' })
  return {
    fogli: wb.SheetNames,
    righe: (foglio, grezze = true) => X.utils.sheet_to_json<unknown[]>(wb.Sheets[foglio], { header: 1, raw: grezze }),
  }
}

/** scrive un xlsx con un foglio per tabella e lo fa scaricare */
export async function scaricaCartella(fogli: { nome: string; righe: (string | number)[][] }[], nomeFile: string) {
  const X = await import('xlsx')
  const wb = X.utils.book_new()
  for (const f of fogli) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(f.righe), f.nome)
  const dati = X.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([dati], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = nomeFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

const eCsv = (f: File) => /\.(csv|txt)$/i.test(f.name)

/** le righe di un file tabellare: csv così com'è, xlsx dal foglio «Tutti» o dal primo */
export async function righeDaFile(file: File, grezze = true): Promise<unknown[][]> {
  if (eCsv(file)) return parseCSV(await file.text())
  const c = await apriCartella(file)
  return c.righe(c.fogli.includes('Tutti') ? 'Tutti' : c.fogli[0], grezze)
}
