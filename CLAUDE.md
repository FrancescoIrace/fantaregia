# Fantaregia — contesto di progetto per Claude Code

Questo file è un briefing per un agente Claude che lavora su questo progetto dentro VS Code (Claude Code). Riassume tutto ciò che è stato deciso e costruito finora nella fase "locale" del progetto, prima di leggere una sola riga di codice. Leggilo per intero prima di proporre modifiche architetturali: molte scelte che sembrano migliorabili a prima vista sono in realtà il risultato di un problema già affrontato (vedi in particolare "Bug già risolti" e "Limiti del modello attuale").

Se questo file vive nella root del repo insieme ai sorgenti veri (`src/part1.html` … `part6.html`, `build.sh`, `tools/*.mjs`, ecc.), leggi quei file prima di scrivere codice: qui sotto trovi la mappa e le regole, non il codice.

## Cos'è Fantaregia

App per gestire l'asta del fantacalcio (Serie A, regole classiche Mantra/base) e poi la stagione: sostituisce fogli Excel e appunti sparsi con un'unica pagina che segue la lega dall'asta fino alla 38ª giornata.

Fino al 2 settembre 2026 il progetto si chiamava "Sala d'Asta Fantacalcio". Il nome è cambiato in **Fantaregia** perché copre due metà (asta + stagione), non solo la serata dell'asta.

**Stato attuale:** un'unica pagina HTML autosufficiente (`Fantaregia.html`), usata in locale, che non chiama la rete tranne per i font e il lettore xlsx via CDN. Esiste anche una versione pubblicata come Claude Artifact (privata, condivisibile via link) che usa la capability di persistenza di quella piattaforma per il salvataggio condiviso — è **quel meccanismo di salvataggio** che il passaggio a una webapp vera deve sostituire con un backend reale.

## Obiettivo di questa fase: la versione online

Il progetto nasce come pagina statica che "ripubblica se stessa" per salvare. Funziona per un'asta di una sera con un solo banditore, ma ha limiti strutturali (vedi sotto) che una webapp vera con backend/DB deve risolvere: più banditori o più letture-scritture concorrenti, salvataggio granulare invece che "intera pagina", niente ricaricamento forzato di tutte le viste a ogni scrittura. L'obiettivo di questa fase è impostare il progetto VS Code (struttura cartelle, stack, eventualmente backend + DB + API) per questa transizione, **preservando intatta tutta la logica di dominio** descritta più sotto (indici, regole di condivisione dei dati, vincoli di licenza). Non è un rewrite da zero dei calcoli: è un cambio della base tecnica sotto un prodotto già definito.

## Architettura e build attuali

- Sorgenti divisi in frammenti: `src/part1.html` … `src/part6.html`.
- `build.sh` li assembla in un unico `Fantaregia.html` finale. **Le modifiche vanno sempre fatte nei frammenti, mai sul file assemblato** — questa regola vale finché la webapp non sostituisce il meccanismo di build; se cambia lo stack, la regola successiva sarà comunque "mai editare l'output generato".
- `tools/dati.mjs` — convertitori listone/calendario/statistiche.
- `tools/taratura-prezzi.cjs` — confronta i prezzi calcolati dal modello con le aste reali di fantacalcio-online.com.
- `tools/studio-forma.cjs` — lo studio (descritto sotto) che ha dimostrato che la "forma" non esiste come segnale utile.
- `testcalib.mjs` — test di regressione che ricontrolla lo scarto prezzo-modello/prezzo-reale a ogni modifica.
- Estensione `.cjs` per gli script di analisi perché `package.json` dichiara `"type": "module"` (altrimenti `require is not defined`).
- Test: suite Playwright headless da rilanciare a ogni modifica (screenshot, scroll orizzontale, import listone/voti, pubblicazione e round-trip dei dati, formazioni, prezzi contro aste reali, titolarità, scarsità, statistiche storiche). `testasta.mjs` è la prova generale: costruisce una lega, fa dodici chiamate vere dall'interfaccia, annulla, ricarica la pagina, verifica che crediti/rose/impostazioni siano ancora lì. `testpdf.mjs` genera il PDF con Playwright e fallisce se supera le tre pagine. **La suite di test non è nel repo pubblico**, per scelta.

## Versione online (branch `online`, cartella `web/`)

La webapp vive in `web/`, accanto all'app a file singolo, che resta intatta: è il riferimento contro cui si misura il port finché la migrazione non è finita. Le regole sui frammenti `src/part*.html` continuano a valere.

- **Stack**: Vite 8 + React 19 + TypeScript 6 + Tailwind 4 + Supabase + React Router, come `l-ultimo-web` ma in TypeScript. TypeScript resta alla 6.0 perché `typescript-eslint` non supporta ancora la 7 (il port in Go). I token grafici sono quelli di `src/part1.html`, copiati in `web/src/index.css` ed esposti come classi Tailwind (`bg-surface`, `text-muted`, …).
- **Motore degli indici** — `web/src/domain/motore.ts`: port 1:1 del motore di `part4.html` (sezioni 2, 4–6f, 13, 18, 20, 21) e dei calcoli di `part5.html` (risultati di lega, infermeria, «Chi schierare»). `creaMotore(ingresso)` prende lo stato nella forma di `S`/`ME` e restituisce funzioni con gli stessi nomi dell'originale. Non legge DOM né variabili globali: la finestra di giornate (gfrom/gspan) e la data di oggi entrano come parametri, e il motore si ricrea a ogni cambio di stato. Le scritture (registraScambio, allineaRose, …) non stanno nel motore: diventano operazioni sul database.
- **Test di equivalenza** — `web/test/equivalenza.test.ts`: assembla i frammenti come `build.sh`, avvia l'app originale in jsdom e confronta **in modo esatto** (non a tolleranza) prezzi, convenienza, titolarità, appetibilità, forze, scarsità, giudizi, previsioni degli scontri, infermeria, formazione automatica e confronto con le rose ufficiali. Usa solo `esempi/` più una lega sintetica generata con seme fisso: può stare nel repo pubblico. Se tocchi una formula il test deve fallire — aggiornalo solo per una modifica voluta e misurata, e portala anche nei frammenti.
- **Database** — `web/supabase/migrations/`: una tabella per entità (leghe, membri, squadre, assegnazioni, log_asta, movimenti, indisponibili, squalifiche_annullate, voti_giornata, dataset, preferenze, inviti). RLS su tutto, anon senza permessi: i dati della lega li leggono solo i suoi membri (vincolo di licenza). Ruoli admin / banditore / lettore. `assegna()` applica le regole di «Assegna» (rosa completa, reparto pieno, tetto) anche con più banditori e dà un errore esplicito se il giocatore è già stato preso; `leghe.versione` permette aggiornamenti ottimistici delle impostazioni. Test su Postgres in memoria (PGlite): `web/test/db/schema.test.ts`.
- **Strato dati** — `web/src/data/componi.ts` ricompone `S`/`ME` dalle righe (nessun calcolo), `web/src/data/lega.ts` carica una lega, ascolta il realtime e chiama le RPC.
- **Comandi** (da `web/`): `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- **Difetto noto ereditato**: `attesoGiocatore` e `pericolosi` leggono `st.pv`, che `statCalc` non produce (le presenze stanno in `pres`), quindi il ramo «voti di quest'anno» non scatta mai e si usa sempre la stagione scorsa. È portato identico per restare 1:1; va corretto nei due posti insieme, se Francesco lo decide.
- **Ancora da fare**: le viste, login e gestione della lega, import dei file dal browser (xlsx), scritture di stagione (movimenti, voti, infermeria) come operazioni sul database, specchio locale con avviso di riconciliazione, riallineamento della suite Playwright privata.

## Repo pubblico su GitHub

Esiste già un repo pubblico impacchettato **senza nessun dato reale** (`git init` e primo commit fatti; il push lo fa Francesco a mano). Contiene: `src/part1..6.html`, `build.sh`, `tools/dati.mjs`, `tools/taratura-prezzi.cjs`, `tools/studio-forma.cjs`, un listone e un calendario **inventati** in `esempi/`, i risultati veri di Serie A 2025/26, due screenshot, un README con la storia del progetto, licenza MIT.

**Non contiene, e non deve mai contenere:** listone vero, voti di giornata, statistiche, rigoristi, calendario ufficiale, e soprattutto il backup dell'asta (`asta_reale.json`, che porta i nomi dei partecipanti alla lega). Il `.gitignore` blocca `dati/*` (tranne `LEGGIMI.md`), gli `.xlsx`, il file `Fantaregia.html` costruito e i backup dell'asta. Quando imposti il progetto VS Code, **replica queste stesse esclusioni nel nuovo `.gitignore`** — è un vincolo di licenza, non una preferenza stilistica (vedi sezione dedicata sotto).

## Le funzionalità (otto sezioni + tabellone fisso)

Tabellone sempre visibile in alto: crediti, tetto d'offerta, slot per reparto, stato del mercato.

1. **Asta live** — ricerca giocatore, assegnazione a squadra/prezzo, blocco offerte oltre tetto o reparti pieni, barra di scostamento dal prezzo consigliato mentre si digita, log con annullamento, badge affare/salasso, sezione apri/chiudi che spiega gli indici.
2. **Listone** — 518 giocatori, filtri ruolo/squadra/fascia prezzo, prezzo atteso, convenienza, appetibilità, fantamedia, prossime partite, obiettivi con prezzo massimo.
3. **Titolari** — chi gioca e chi no per squadra, rigoristi in evidenza, indisponibili.
4. **Rendimento** — presenze, medie, gol, assist dalle giornate caricate.
5. **Giornate** — formazione per ciascuna delle 38 giornate (modulo, undici titolari, panchina ordinata), punteggio per casella con frase esplicativa, confronto ⇄ fra giocatori dello stesso ruolo.
6. **Calendario** — le 20 squadre ordinate per morbidezza calendario su una finestra di giornate scelta dall'utente, separando chi cerca clean sheet da chi cerca bonus.
7. **Rose** — riepilogo asta, classifica giudizi, export Excel, stampa PDF, rose di tutti i partecipanti come accordion richiudibili con barra di ricerca (per giocatore/squadra Serie A/partecipante); stato aperto/chiuso è privato e locale; la ricerca apre da sola le rose con riscontro ed evidenzia le righe; la stampa apre tutto e poi ripristina.
8. **Lega e dati** — partecipanti, budget, slot, piano di spesa per reparto, listone aggiornato, voti di giornata, backup.

**Modalità asta**: interruttore in testata che riordina il menu (asta: Asta live/Listone/Titolari/Rose davanti; stagione: Giornate/Rendimento/Titolari/Listone davanti). Preferenza locale al dispositivo, si autoimposta alla prima apertura guardando se l'asta è finita.

## Dati condivisi vs privati — fondamentale per il redesign multi-utente

Questo è probabilmente il vincolo di prodotto più importante da portare nel nuovo schema dati/DB:

- **Condiviso fra tutti i partecipanti alla lega:** lega, budget, slot, assegnazioni d'asta, storico, voti di giornata, indisponibili.
- **Privato per dispositivo/utente:** la squadra scelta come "propria", gli obiettivi con i prezzi massimi, le formazioni di giornata. Ogni partecipante apre il link e in "Lega e dati" segna quale squadra è la sua.
- **Sola lettura**: chi ha accesso read-only vede tutto aggiornarsi ma non può scrivere (comandi di scrittura nascosti, avviso al loro posto).

In un backend vero questo si traduce naturalmente in: entità "lega" con dati condivisi in un DB centrale, entità "preferenze utente" scoped per account/dispositivo, e un sistema di ruoli (banditore/scrittura vs sola lettura) al posto dell'attuale "chiave di modifica" implicita nella pagina.

## Limiti del modello attuale da superare online (requisiti impliciti per il backend)

Il salvataggio attuale funziona ripubblicando l'intera pagina come nuova versione; tutte le viste aperte si ricaricano su quella. Da qui tre limiti che un backend vero deve risolvere esplicitamente, non solo "aggirare":

1. **Un solo banditore alla volta.** Se due persone registrano un'assegnazione nello stesso istante, la seconda pubblicazione genera un conflitto e quella modifica va persa. → nel nuovo sistema serve scrittura granulare per singola assegnazione con gestione esplicita dei conflitti (idealmente niente "ultimo vince" su un'intera lega).
2. **Ogni salvataggio ricarica la pagina di tutti.** Le modifiche ravvicinate vengono raggruppate ogni ~2 secondi e lo stato locale in corso (giocatore selezionato, prezzo digitato, scheda aperta, ricerca) viene ripreso dopo il reload — ma il reload resta. → un backend con websocket/subscribe su singole entità evita questo del tutto.
3. **Non è un database**, è una pagina che riscrive se stessa. Va bene per un'asta di una sera con un banditore, non per scritture concorrenti da più persone. → è letteralmente la ragione per cui esiste questa fase di migrazione.

**Rete di sicurezza attuale da non perdere nel redesign:** ogni modifica alle impostazioni di lega viene specchiata anche localmente con timestamp; se una pubblicazione non arriva (rete giù, sessione scaduta, conflitto), al rientro compare un avviso che dice cosa risulta indietro e a che ora era stato cambiato, con "Applicale ora" / "Lascia com'è". Il ripristino tocca solo crediti/slot/piano di spesa/nomi squadre: le assegnazioni registrate nel frattempo da altri non vengono mai sovrascritte. Questo comportamento (mai perdere silenziosamente una scrittura, sempre un modo esplicito per riconciliare) è un requisito di prodotto, non un dettaglio implementativo — va riprodotto nel nuovo sistema, probabilmente più facilmente grazie a scritture granulari invece che a "intera pagina".

## Gli indici — la logica di dominio da preservare esattamente

Questi calcoli sono il cuore del prodotto e sono stati tarati con dati reali; **vanno portati 1:1**, non ridisegnati, a meno che Francesco non lo chieda esplicitamente.

- **Prezzo atteso**: trasforma le quotazioni (FVM) in crediti reali di *questa* lega usando budget/squadre/slot/piano di spesa. Ogni giocatore parte da 1 credito, il resto si spartisce in proporzione al surplus sulla quotazione del giocatore "da un credito" (85° percentile della lista), elevato a un esponente che concentra il prezzo sui primi.
- **Taratura su aste vere**: esponente 0,5 per D/C/A, 1,0 per i portieri; piano di spesa mediano 7/19/32/42 (non 8/15/27/50, che sovrastimava l'attacco). Con 10 squadre/500 crediti il modello ricostruisce i prezzi reali entro il 5% (esempi noti: Lautaro 80 vs 84 reale, Malen 83 vs 80, Thuram 71 vs 71, Ramos 70 vs 70, Hojlund 70 vs 70). `testcalib.mjs` controlla questo scarto ad ogni modifica — **non toccare la taratura senza far girare quel test**.
- **Prezzo di adesso**: ad asta cominciata, ricalcolato sui crediti ancora in mano alle squadre non complete e sui giocatori ancora liberi. Il tassello "Mercato" mostra di quanto la lega sta pagando sopra/sotto il listino.
- **Scarsità ("Chi resta, chi cerca")**: per ruolo, titolari liberi vs titolari ancora richiesti dalle squadre (non gli slot totali). Pressione >1 = reparto in rincaro, <0,6 = si può aspettare. Alla chiamata di un giocatore, mostra quanti "simili" restano (stesso ruolo, prezzo atteso entro il 30%, titolarità comparabile).
- **Convenienza**: FVM del giocatore vs FVM atteso per la sua fascia di prezzo *nel suo ruolo* (regressione log-log su tutto il listone). Sopra 1,00 = rende più di quanto costa. Corregge la distorsione del semplice rapporto FVM/quotazione che premia solo i top.
- **Titolarità**: prima dei voti, dedotta dalla quotazione dentro squadra/ruolo (verificata: 17/18 primi rigoristi risultano titolari con questo metodo). Corretta per il 40% dalle presenze 2025/26 (quotazione e presenze correlano solo 0,50). Appena arrivano i voti reali, passa ai fatti: presenza con voto = titolarità piena, spezzone senza voto = un terzo, fiducia piena ai dati dalla 6ª giornata.
- **Indisponibili**: segnati a mano (infortuni/squalifiche) — unico dato che nessun file fornisce. Azzera la titolarità ovunque e toglie il giocatore dalla formazione automatica. È condiviso.
- **Appetibilità (0–100)**: titolarità 40, valore nel ruolo 35, calendario 15, rigori 10. Per i difensori, 8 dei 35 punti del valore passano alla mentalità offensiva (da Mantra) — unico ruolo dove spingere avanti rende più di quanto il listino suggerisca.
- **Calendario**: forza d'attacco/difesa per squadra da quotazioni, corretta coi risultati reali (gol fatti/subiti dai voti caricati, autogol inclusi). Stima con punto fisso attacco×difesa avversaria×fattore campo, peso `n/(n+10)` verso le quotazioni (a 10 giornate contano metà).
- **Perché tutte le giornate pesano uguale (misurato, non assunto)**: su Serie A 2025/26 vera (280 partite, giornate 1-28, incrociate fra openfootball e football-data.co.uk, classifica verificata contro Wikipedia), la forza di una squadra è persistente (correlazione andata↔ritorno 0,58 attacco, 0,55 difesa) ma **la "forma" non esiste come segnale**: autocorrelazione dello scarto dal proprio livello −0,06/−0,09, stabile a lag 2/3/5. Ogni sconto sul passato peggiora la previsione fuori campione in modo monotono (emivita 10: −3,2%, emivita 6: −2,1%, emivita 4: −0,2%, emivita 2: **+7,8%**, cioè peggio di non sapere niente). Lo smorzamento sull'incertezza iniziale invece serve (ottimo k=8–12, usato k=10). **Conclusione da non rifare da capo**: qui non serve un modello di serie temporali, non c'è struttura temporale oltre al livello. Studio in `tools/studio-forma.cjs`, dati in `esempi/serie-a-2025-26-risultati.txt`.
- **Punteggio di giornata**: appetibilità ristretta alla singola partita + forma (fantamedia ultime 3 presenze vs stagionale, solo da quando le presenze sono >3). Segnala in panchina chi supera il titolare di almeno 5 punti.
- **Giudizio delle rose (0–100)**: undici tipo 40 (appetibilità media miglior undici sui moduli ammessi), profondità 15 (i 14 di scorta), prezzi pagati 20 (normalizzati sulla media di lega — senza normalizzare risulterebbe che tutti hanno strapagato, perché gli attesi sono tarati solo sui giocatori che il modello si aspetta vengano comprati), titolari veri 15, rigoristi 5, rischi 5 (concentrazione su un giocatore, dipendenza da un club). Frasi di pro/contro da soglie fisse, **nessun modello linguistico** — ogni riga deve restare verificabile.
- **Riepilogo esportabile**: Excel con foglio Riepilogo e foglio Rose complete (300 righe). I giudizi **non entrano nell'Excel** per scelta (restano nell'app dove si vede da cosa nascono); entrano invece nella stampa PDF, che usa una vista dedicata generata ad hoc (non la pagina a schermo) per stare in 2 fogli A4 invece di 15.
- **Rigoristi**: due fonti incrociate (Sky Sport, FantaMaster) verificate contro il listone — 61 nomi/20 squadre, badge pieno se confermato da entrambe.

## Vincoli di licenza sui dati — critico, da rispettare anche online

Il file dei voti di fantacalcio.it dichiara esplicitamente che **non può essere riprodotto né pubblicato su altri siti internet**, uso personale esclusivo degli iscritti. Questo vale ovunque i dati finiscano: repo pubblico, backend online, database condiviso, log, backup esposti. Nel progettare l'architettura online:

- Nessun dato reale (listone vero, voti, statistiche, calendario ufficiale, backup asta con nomi dei partecipanti) va mai nel repo pubblico o in qualunque storage esposto pubblicamente.
- Se il backend introduce un database condiviso fra utenti della stessa lega, va progettato in modo che resti privato alla lega (autenticazione/autorizzazione), non un dataset pubblicamente accessibile.
- Il README del progetto continua a spiegare che chi lo scarica si procura i listoni per conto proprio.

## Bug già risolti — trappole da non ripetere

- Il salvataggio condiviso (capability di persistenza) non risponde durante il primo giro dello script: le modifiche fatte prima erano perse. Risolto tenendole in sospeso finché non si sa dove salvare, con badge "collegamento…".
- Perdite silenziose in generale → aggiunto specchio locale + avviso di ripristino (vedi sopra).
- La chiamata in corso durante l'asta non sopravviveva al reload dopo un salvataggio → ora giocatore/prezzo/squadra selezionati vengono ripresi.
- Adattamenti mobile persi in una ricostruzione perché applicati al file assemblato invece che ai sorgenti → ora nei sorgenti, con test di regressione sullo scroll orizzontale.
- Collisione `data-slot` fra caselle rosa e formazione → rinominato in `data-lineup`.
- Import CSV che perdeva righe sui ruoli Mantra tipo `E;W` → parser che rispetta le virgolette e riconosce il separatore su tutto il file (non solo la prima riga, che è un titolo).
- "Lautaro Martinez" agganciava il portiere "Martinez Jo." → confronto nomi ora considera le iniziali.
- `_hmed` usato prima della dichiarazione (TDZ) → dichiarazione spostata accanto a `HIST`.
- Collisione classe `.phead` fra intestazione di stampa e scheda giocatore → rinominata `.psthead`.
- Script di analisi con `require is not defined` per via di `"type": "module"` in `package.json` → rinominati `.cjs`.
- Stampa PDF: tavolozza chiara va forzata con `!important` (il tema scuro ha specificità più alta); il selettore che nasconde il resto non deve usare `:not(#id)` (porta con sé specificità da id); la vista di stampa non va svuotata su `afterprint` (arriva a volte prima dell'impaginazione) — si ricostruisce ad ogni stampa e resta nel DOM.

## Come vuole lavorare Francesco (per l'agente)

- Progetto seguito in italiano; usa termini di dominio così come sono (fantamedia, FVM, listone, rigoristi, ecc.), non tradurli.
- Le decisioni sugli indici sono già misurate/tarate con dati reali (vedi sezione indici e studio-forma) — non riproporre versioni "più semplici" senza motivarle contro quei numeri.
- Preferisce regole verificabili a soglie fisse piuttosto che modelli opachi (vedi giudizio delle rose: "nessun modello linguistico, ogni riga verificabile") — mantieni questo principio anche nel redesign.
- Non introdurre dati reali (listone, voti, calendario, backup asta) in nulla che finisca in un repo pubblico o storage esposto.

## Cosa manca in questo documento

Questo briefing descrive **prodotto, regole e algoritmi**, non il codice sorgente attuale (che vive nei frammenti `part1..6.html` del repo, non in questa conversazione). Prima di scrivere codice per la nuova versione, apri e leggi quei file per vedere l'implementazione reale — questo documento ti dice *cosa* deve continuare a essere vero, non *come* è scritto oggi.
