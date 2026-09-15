import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { riapplicaTinta } from './viste/colore-squadra.ts'
import { applicaTema, temaSalvato } from './viste/tema.ts'
import './index.css'
import './viste/legacy.css'
import './viste/componenti.css'

/* Il marchio non si scrive mai a mano: la tinta va corretta sul fondo del
   tema corrente. Senza questa chiamata l'ambra predefinita su tema chiaro
   sta a 1,9:1 e i pulsanti primari diventano illeggibili. All'avvio è la
   tinta predefinita; dentro una lega Lega.tsx la sostituisce con quella
   della propria squadra. Al cambio di tema si riapplica la tinta ATTIVA:
   riapplicando la predefinita, il sistema che passa al chiaro
   cancellerebbe il colore della squadra.

   Prima il tema salvato, poi la tinta: applicaTema() fa le due cose in
   quest'ordine, così la prima correzione avviene già sul fondo giusto. */
applicaTema(temaSalvato())
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', riapplicaTinta)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
