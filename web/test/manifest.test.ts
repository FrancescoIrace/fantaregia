/* L'app installabile: il manifest, le icone che promette, e i link in
   index.html. Sono file statici che nessun altro test apre, e un'icona
   spostata o rinominata non la nota nessuno finché qualcuno non prova ad
   aggiungere l'app alla schermata home. */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(WEB + 'public/manifest.webmanifest', 'utf8')) as {
  display: string; start_url: string; background_color: string
  icons: { src: string; sizes: string; purpose: string }[]
}
const html = readFileSync(WEB + 'index.html', 'utf8')

/* larghezza e altezza scritte nell'intestazione del PNG */
const misure = (file: string) => {
  const b = readFileSync(file)
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`
}

describe('il manifest', () => {
  it('ogni icona esiste e ha le misure che dichiara', () => {
    for (const i of manifest.icons) {
      const file = WEB + 'public' + i.src
      expect(existsSync(file), i.src).toBe(true)
      expect(misure(file), i.src).toBe(i.sizes)
    }
  })

  it('ci sono le icone normali e le maskable, a 192 e 512', () => {
    // Android ritaglia le maskable a cerchio, goccia o quadrato tondo: senza, rimpicciolisce l'icona dentro un bordo bianco
    for (const purpose of ['any', 'maskable']) {
      expect(manifest.icons.filter(i => i.purpose === purpose).map(i => i.sizes).sort()).toEqual(['192x192', '512x512'])
    }
  })

  it('si apre come app, dalla lista delle leghe', () => {
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
  })

  it('index.html lo collega, e iOS ha la sua icona piena', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"')
    const apple = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html)
    expect(apple).not.toBeNull()
    // iOS riempie di nero la trasparenza: la maskable è piena fino al bordo
    expect(manifest.icons.find(i => i.src === apple![1])?.purpose).toBe('maskable')
  })

  it('nessun service worker, per ora', () => {
    /* Installabile sì, offline no. Una cache metterebbe listone e voti nello
       storage del telefono: non è ripubblicazione, ma è una copia in più di
       dati che il file delle pagelle vuole tenere stretti. Se un giorno si
       aggiunge, questo test va cambiato apposta, non per inerzia. */
    expect(html).not.toMatch(/serviceWorker/)
    expect(existsSync(WEB + 'public/sw.js')).toBe(false)
  })
})
