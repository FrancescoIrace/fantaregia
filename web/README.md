# Fantaregia · versione online

La webapp che prende il posto della pagina che ripubblica sé stessa: stessi indici, stesso aspetto, ma con un database vero sotto. Più banditori insieme, salvataggio per singola riga, aggiornamenti in tempo reale senza ricaricare la pagina.

L'app a file singolo in `../src` resta dov'è ed è il termine di paragone: il motore degli indici qui dentro è un port 1:1 del suo, e un test lo verifica numero per numero.

## Avvio

```bash
npm install
cp .env.example .env.local     # URL e chiave anon del progetto Supabase
npm run dev
```

## Database

Le migrazioni sono in `supabase/migrations/`. Con un progetto Supabase già creato:

```bash
npx supabase login
npx supabase link --project-ref <ref-del-progetto>
npx supabase db push
```

A ogni nuova migrazione basta rilanciare `npx supabase db push`.

Ogni tabella ha le policy RLS: i dati di una lega li leggono solo i suoi membri. Non è un dettaglio: listoni e voti non sono nostri e alcuni file vietano esplicitamente la ripubblicazione, quindi niente di questo database deve essere leggibile da fuori.

## Messa online (Vercel)

Il progetto sta in `web/`, quindi su Vercel va detto dove guardare:

| Impostazione | Valore |
|---|---|
| Root Directory | `web` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Variabili | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

`vercel.json` contiene la riscrittura che manda ogni indirizzo a `index.html`: senza, aprendo un link diretto a una lega si otterrebbe un 404.

Le due variabili sono le stesse di `.env.local`. La chiave pubblica finisce nel codice che scarica il browser, ed è previsto: a proteggere i dati sono le policy RLS.

Dopo il primo deploy, in Supabase → Authentication → URL Configuration aggiungi il dominio come **Site URL** e fra i **Redirect URLs**, altrimenti la mail di conferma rimanda a localhost.

## Test

```bash
npm test
```

- `test/equivalenza.test.ts`: avvia l'app originale in jsdom e confronta ogni indice con il port in TypeScript, in modo esatto.
- `test/db/schema.test.ts`: applica le migrazioni a un Postgres in memoria (PGlite) e prova permessi, conflitti fra banditori e regole d'asta.
- `test/componi.test.ts`: dalle righe del database allo stato del motore.
- `test/import.test.ts`: una lega esportata come la esporta l'app a file singolo, importata con `importa_lega()` e riletta: il motore deve dare gli stessi numeri prima e dopo.

Nessun test usa dati reali: solo `../esempi/` (giocatori inventati) e leghe sintetiche.

## Com'è fatta

```
src/domain/   il motore degli indici (motore.ts), import di listone e calendario, tipi
src/data/     dal database allo stato del motore, caricamento e realtime, operazioni d'asta
src/lib/      client Supabase
supabase/     configurazione e migrazioni
test/         equivalenza col motore originale, schema, strato dati
```
