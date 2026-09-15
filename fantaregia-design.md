# Fantaregia — regole di design

Questo file dice **come** si usano i token di `web/src/viste/fantaregia-tokens.css`. I token sono la sorgente dei valori; qui ci sono le decisioni. Va letto insieme al briefing di progetto, di cui è la metà visiva.

Se una regola qui sotto e il codice non vanno d'accordo, ha ragione questo file finché non viene cambiato di proposito.

## Da dove viene questo disegno

L'app è **un portafoglio con una scadenza**. Venticinque posizioni che si rivalutano a ogni giornata caricata, e un appuntamento settimanale in cui bisogna schierare. Non è un tabellone da serata d'asta: quella è una sera su nove mesi.

Da qui tre principi che decidono quasi tutto:

1. **Nessun numero senza la sua variazione.** Un 68 da solo non dice niente a febbraio. Un 68 con +3 e la riga che spiega perché sale, sì.
2. **Silenzio di base.** Le spie si accendono solo quando è successo qualcosa. Se non è cambiato niente, la pagina lo scrive in una riga e tace.
3. **Ogni numero è contestabile.** Sotto ogni punteggio c'è la frase che lo genera. Soglie fisse, nessun modello opaco — lo stesso principio del giudizio delle rose.

## I colori e il loro mestiere

| Famiglia | Token | Mestiere | Non fa mai |
|---|---|---|---|
| Superfici | `--fr-fondo`, `--fr-pan`, `--fr-incasso` | pagina, pannelli, campi rientranti | non porta significato |
| Fili | `--fr-filo`, `--fr-filo-t` | bordi dei blocchi, separatori fra righe | non diventa mai colore d'accento |
| Inchiostri | `--fr-ink`, `--fr-fioco`, `--fr-spento` | testo primario, etichette, note | tre livelli, non di più |
| Scostamento | `--fr-su`, `--fr-giu`, `--fr-fermo` | **solo** se un valore sta sopra o sotto un riferimento | mai stato, marchio, ruolo, decorazione |
| Ruolo | `--fr-ruolo-p/d/c/a` | filo verticale e chip quadrato | mai riempimento, mai testo |
| Difficoltà | `--fr-diff-1…5` | le cinque caselle delle prossime partite | mai altrove |
| Marchio | `--fr-marchio` | identità della squadra di chi guarda | mai un valore, mai uno scostamento |

### La regola che regge tutto

**Verde e rosso dicono lo scostamento da un riferimento.** Il riferimento può essere:

- il valore di prima — è il caso dei delta;
- una soglia dichiarata — appetibilità 75 e 45, fantamedia 7 e 5,5, la mediana di ruolo;
- un valore di mercato — il prezzo atteso in asta, che è poi il Misuratore descritto più sotto.

Sono tutti lo stesso gesto: *quanto sei lontano, e da che parte*. Per questo `appetCol`, `fmCol` e `deltaCol` in `web/src/viste/colori.ts` possono usare verde e rosso senza contraddire niente — e per questo dev'essere sempre possibile dire ad alta voce qual è il riferimento. Se non si riesce, quel colore è sbagliato.

Se serve segnalare qualcosa che non si scosta da niente — una casella da rivedere, un file che manca, una spia neutra — si usa `--fr-fermo`, o la forma: bordo tratteggiato, filo più spesso, un segno diverso. Mai un altro colore.

### Ruoli e difficoltà, due famiglie vicine a verde e rosso

Due famiglie stanno addosso a verde e rosso. Nessuna delle due si è spostata, ma per ragioni diverse — e la seconda ci è arrivata sbagliando prima.

**I colori di ruolo restano quelli del fantacalcio** — P ambra, D verde, C blu, A rosso — anche se `--fr-ruolo-d` sta a 5,5° da `--fr-su` e `--fr-ruolo-a` a 6,3° da `--fr-giu`. Il ruolo è **identità posizionale**, non un valore: vive su un filo da 4px a sinistra della riga e su un chip quadrato di 20px, e non entra mai nello stesso registro di una cifra. Spostarlo avrebbe rotto una convenzione che ogni giocatore ha già in testa dal sito ufficiale, in cambio di un guadagno che non c'è: nessuno legge un filo verticale come «sale».

**Le difficoltà di calendario tengono verde e rosso, ma non i valori dei delta.** Il difetto della scala di partenza era uno solo, e preciso: la casella del calendario morbido era *lo stesso identico hex* di `--fr-su`. Non il fatto di usare le due tonalità.

Perché possono usarle: `fixDiff()` è centrato su 3, cioè sull'avversario medio. Una partita più facile della media è **uno scostamento in positivo da un riferimento dichiarato** — esattamente la regola qui sopra, letta per intero. Quello che cambia è il registro: le caselle sono **velature con l'inchiostro sopra**, chip pieni da 32px, non cifre nude. Un delta è testo colorato; una casella è una superficie. Nessuno dei dieci valori della scala coincide con un valore dei delta, e `web/test/token.test.ts` lo impedisce.

**Una rampa a tinta unica qui non funziona, ed è stato provato.** Il primo tentativo metteva la difficoltà su una scala indaco dove l'intensità era la difficoltà. Sulla carta era più coerente; nell'app era illeggibile: su un chip da 32px con del testo sopra l'intensità non si legge, tanto meno con la trasferta che allora abbassava l'opacità dei chip. **La tonalità legge a colpo d'occhio.**

**La trasferta non usa più l'opacità.** Nell'app originale `.fix.away` era `opacity:.78`, e sbiadiva anche l'inchiostro: 3,3:1 nel tema giorno, 4,4:1 sulla casella neutra nel notte, sotto la soglia di 4,5. Adesso la trasferta è minuscolo e peso più leggero, e il contrasto misurato è quello che si vede. Il test lo scrive come regola: due caselle vicine devono staccarsi di almeno 12° di tonalità, e la meno satura delle cinque deve essere la terza.

**Il verso della numerazione non si tocca.** `--fr-diff-1` è la partita più morbida, `--fr-diff-5` la più dura, perché è il verso di `fixDiff()` e quel numero finisce dritto nel nome della classe. La prima stesura dei token lo aveva al contrario, e l'unico sintomo sarebbe stata una scala ribaltata che nessun test vedeva.

In stampa la tonalità sparisce e il verso lo porta il grigio, dal chiaro allo scuro.

### La regola dei ruoli, applicata alle viste portate

Portando le viste sono venuti fuori diversi punti in cui l'app originale usava i colori di ruolo come testo o come riempimento. Dove il ruolo si capiva già da altro, sono stati tolti:
- le forze di attacco e difesa nel Calendario si distinguono con le etichette «att» e «dif»;
- la colonna P · D · C · A del riepilogo di Rose segue l'ordine dell'intestazione;
- la barra della spesa per reparto in Asta è una barra di avanzamento neutra, quindi colore squadra;
- i contatori per ruolo del tabellone d'Asta e i posti per ruolo nei crediti in sala tornano inchiostro, con fondino e lettera che restano.

Restavano quattro usi in cui il colore di ruolo portava un significato che non è il ruolo, e lì serviva un segno nuovo. Scelti da Francesco il 16/09/2026, sul confronto a schermo nei due temi, con le regole in `componenti.css` sopra quelle di `legacy.css`:

- **la mentalità** era offensiva in rosso attaccante e copertura in blu centrocampista, anche nella barra dell'equilibrio in Asta. Ora è inchiostro con una freccia (`↗ → ↘`), e nella barra è la forma a distinguere: pieno chi spinge, grigio l'equilibrata, tratteggio chi copre. Non è un ruolo, è una direzione — e un difensore offensivo in rosso sembrava un attaccante;
- **il badge del rigorista** era rosso attaccante, ma rigoristi sono anche difensori e centrocampisti. Ora è inchiostro: pieno il primo rigorista, vuoto il secondo. «Una sola fonte» è il tratteggio del bordo e non più `opacity:.62`, che portava il badge sotto il leggibile;
- **la casella della porta inviolata** era verde difensore pur essendo un bonus del portiere. Ora le caselle dei bonus seguono la regola della spia: verde quello che porta punti (gol, assist, porta inviolata, rigori parati), rosso quello che ne toglie (ammonizioni, gol subiti). Sono cadute due incoerenze vicine: gli assist stavano nel colore del marchio, che non è un valore, e la casella a zero era sbiadita con l'opacità — ora è grigio leggibile su fondo incassato;
- **il tetto del giocatore più pericoloso** era rosso, senza un riferimento da cui scostarsi: il tetto è quanto fa in una giornata buona. Ora è inchiostro in grassetto, e le barre accanto sono grigie. Il rosso resta ai malus veri.

## Il colore squadra

Ognuno dei dodici sceglie una tinta e la vede ovunque nella propria copia dell'app.

**Dove arriva:** filo in cima alla testata, gagliardetto accanto al nome, scheda attiva, pulsanti primari, contorno di messa a fuoco, barre di avanzamento neutre (le voci del giudizio), la propria riga nelle rose e nel log d'asta.

**Dove non arriva mai:** delta, indici, colori di ruolo, caselle di difficoltà, spie. Se la tua squadra è verde, il verde continua a voler dire «sopra il riferimento».

**Come si applica:** solo tramite `web/src/viste/colore-squadra.ts`. Non si scrive mai `--fr-marchio` a mano, perché la tinta scelta va corretta fino a `CONTRASTO_MINIMO` (3,6:1 sul fondo del pannello) mantenendo la tonalità. Quattro cose che il modulo fa, e che vanno lasciate fare a lui:

- **Il verso della correzione lo decide il fondo, non il tema dichiarato.** Alla prima apertura su un sistema in tema chiaro `data-tema` non c'è ancora, ma i token sono già quelli del giorno: deducendo il verso dall'attributo si schiariva la tinta sul bianco, e l'ambra predefinita finiva a contrasto 1,23.
- **Si mescola con bianco e nero puri.** Sono gli unici due poli che scalano tutti i canali di pari passo e lasciano la tonalità esatta; mescolando con l'inchiostro dei token, che è appena azzurrato, oliva perdeva 2,6 gradi.
- **L'inchiostro sopra la tinta si sceglie misurando**, fra gli stessi due valori che poi finiscono scritti nel token.
- **Il velo resta trasparente** (`rgba`, 12%). Cotto sul colore del pannello diventerebbe una toppa sbagliata ovunque il velo finisca su un'altra superficie — una casella proposta dal pilota dentro un campo rientrante, per dire.

**Avvisi, non divieti.** Se la tinta è vicina al rosso dei cali, al verde delle salite, o a quella di un altro partecipante, l'app lo dice e propone un'alternativa. La scelta resta dell'utente. Due cose da sapere sugli avvisi:

- **La tonalità di un grigio non vuol dire niente.** Un grigio ha tonalità 0, che è a cinque gradi dal rosso dei cali: senza un controllo sulla saturazione, `#888888` si beccava l'avviso sbagliato e «grafite» veniva accusata di rubare il posto a «cobalto». Due quasi-grigi si confondono fra loro; un quasi-grigio e un colore saturo no.
- **Quello che l'app propone passa dagli stessi controlli di quello che contesta.** Proporre a chi entra una tinta che l'app poi disapprova è il modo più veloce di far perdere credibilità agli avvisi.

**È l'unica preferenza pubblica.** La lega deve sapere che Regia FC è ambra per riconoscerla; non deve sapere che tema usi, quali caselle hai bloccato o quali sono i tuoi obiettivi.

## Tipografia

Due tagli della stessa famiglia: `--fr-font-testo` (Barlow) per il testo, `--fr-font-num` (Barlow Condensed) per **ogni** numero. La condensata fa due lavori: distingue i dati dal testo senza usare colore, e fa stare più cifre in larghezza nelle tabelle dense.

- Cifre tabulari sempre attive (`font-variant-numeric: tabular-nums`), così le colonne non ballano quando un numero cambia.
- La classe `.fr-num` è l'unico modo di scrivere un numero. Mai `font-weight:bold` a mano su una cifra.
- Otto gradini di scala, uno per mestiere. Se serve una misura che non c'è, quasi sempre significa che il gradino giusto esiste già.
- Niente maiuscoletto forzato, niente lettere spaziate: le etichette si distinguono con `--fr-fioco` e `--fr-t-et`.

**Da verificare sul Listone vero:** la condensata a 13–15px su 518 righe. Il ragionamento regge in teoria; la prova è scorrere la lista col pollice e vedere se le cifre si leggono ancora in scansione veloce.

## Densità

- Riga di dati: `--fr-riga-y` in verticale, `--fr-riga-x` in orizzontale. Una riga con filo di ruolo è alta 44px circa: tocca bene col pollice e ne stanno sette in una schermata di telefono.
- Pannelli: `--fr-pad`, distanziati di `--fr-blocco-y`.
- Colonna di lettura: `--fr-lim`, 820px. Oltre, le tabelle diventano illeggibili in larghezza.
- Sotto i 620px: le griglie a tre colonne diventano due, le caselle della formazione due per riga, le colonne secondarie delle tabelle spariscono (`conv`, `prossime 5`) invece di stringersi. Nel Listone le due colonne hanno la classe `col-secondaria`; nella panchina di Formazioni sparisce la squadra di serie A, perché a 390px tagliava il nome del giocatore. Le prove a larghezza telefono si fanno in un iframe da 390px: Chromium headless non impagina sotto i 484px, e ritaglia.

## I componenti ricorrenti

**Filo di ruolo.** Quattro pixel a sinistra di ogni riga di giocatore. È l'unico modo per scorrere 518 righe col pollice sapendo sempre dove sei. **Dove c'è il filo, la lettera del ruolo va senza sfondo** (`.ruolo-lettera`): filo e chip pieno insieme ripetono il ruolo, e un chip verde o rosso finisce nella stessa riga di un delta verde o rosso. Il chip pieno resta per i posti dove il filo non c'è.

**Delta.** Sempre accanto al valore, mai da solo, sempre con il verso. `.fr-delta[data-verso]`, e nelle viste il componente `Delta` di `web/src/viste/segni.tsx`. Tre regole nate dalla prima vista che lo usa (Formazioni):

- **Il verso lo decide una soglia**, non il segno: su un punteggio da 0 a 100 sotto i 3 punti è «fermo». Un punto di differenza è rumore, e una spia si accende solo quando è successo qualcosa.
- **Il confronto deve essere vero.** In Formazioni è la previsione dello stesso giocatore alla giornata prima, e per il punteggio medio quella degli stessi undici. Quando un confronto non c'è (la prima giornata) il delta non si inventa: lascia lo spazio vuoto, così le colonne non ballano.
- **«Fermo» è `--fr-fioco`, non `--fr-fermo`**: il delta è testo, e `--fr-fermo` come testo sta a 2,67:1 sul bianco. Il test dei token lo controlla.

Sulle maglie il delta sta nella riga delle statistiche e non sotto il punteggio: la maglia è una velatura oro, argento o bronzo, e verde e rosso lì sopra non reggono il contrasto.

**Sparkline.** Le ultime cinque giornate dell'indice, senza assi e senza etichette: serve la forma, non i valori. Colore uguale al verso della variazione.

**Misuratore.** Centro = riferimento (il prezzo di adesso), lancetta = valore digitato, zone verde e rossa ai due lati. Si usa per il prezzo in asta; è il modello di riferimento ogni volta che c'è uno scostamento da una soglia, ed è la forma visiva della regola sui colori.

**Spia.** Filo colorato + titolo + riga di dettaglio + azione. Rosso se costa punti, verde se ne porta, neutra altrimenti. Esistono solo quando c'è qualcosa: non si mostra mai una spia spenta.

**Casella di formazione.** Il bordo superiore dice lo stato (alta, neutra, da rivedere), il corpo porta il punteggio e la frase che lo spiega. Tratteggiata e velata di marchio se è una proposta del pilota; bordo scuro pieno se è bloccata.

**Ha preso il posto delle maglie** oro, argento e bronzo (scelta del 16/09/2026). Il grado a medaglia si leggeva a colpo d'occhio, ma il punteggio era bianco su una sfumatura che nel tema giorno stava intorno ai 2:1, e oro e bronzo erano colori decorativi fuori dai token. Gli stati, in quest'ordine:
- **indisponibile:** bordo rosso, perché costa punti;
- **da rivedere:** in panchina c'è chi fa più di quattro punti meglio. Bordo d'inchiostro, cioè una forma e non un colore, e sotto la riga «↑ nome in panchina»;
- **alta:** bordo verde, dai 75 in su, la stessa soglia che colora i punteggi ovunque;
- **neutra:** il filo di sempre.

Il titolare fisso ha il bordo scuro sugli altri tre lati, così lo stato in cima resta. Al passaggio del mouse compare un anello del colore squadra fuori dal bordo, per la stessa ragione. Sul telefono la casella si stringe come faceva la maglia: spariscono frase, «di meglio» e statistiche.

**Titolari fissi e modulo preferito** sono le prime «caselle bloccate». Un titolare fisso ha la casella con il bordo scuro pieno e la parola «fisso» accanto al nome. L'interruttore sta sulla riga di panchina e nella finestra «Chi schierare», ed è una forma, non un colore: acceso è scritto pieno. Le regole che valgono anche per il pilota:
- **Non si scarta niente in silenzio.** Troppi fissi per il reparto: entrano i primi fissati e gli altri sono nominati in una nota. Un fisso indisponibile non si schiera — la regola che non si disattiva — ma la nota lo dice.
- **Un modulo che la rosa non copre non si cambia da solo.** Le caselle scoperte restano vuote e la nota propone il modulo più vicino che i disponibili coprono. Il pulsante lo applica a quella giornata sola, senza toccare la preferenza.
- **Il modulo preferito è il punto di partenza**, non un obbligo. Vale per le giornate mai toccate; cambiare modulo in una giornata non cambia la preferenza.

Tutte e due sono di chi guarda e restano sul dispositivo, una chiave per lega.

**Cassetto.** Scheda giocatore e confronto salgono dal basso con `--fr-r-grande` e un filo di marchio in cima. Non sono pagine: si aprono sopra quello che stavi guardando e lo lasciano dov'era. È fatto solo con il CSS, in `viste/componenti.css` sopra le classi di sempre (`.modal`, `.pcard`), quindi vale per la scheda giocatore e per «Chi schierare» senza toccare i componenti. Si scorre dentro il cassetto, non la pagina sotto (`overscroll-behavior:contain`). Due regole nate dalla prova sul telefono: la scheda ha `min-width:0`, perché un elemento flex non si stringe sotto il suo contenuto; e sotto i 620px le quattro caselle in alto diventano due per riga.

**Colore squadra nella testata e nel registro.** L'intestazione dell'app ha il filo del marchio in cima. Accanto al titolo della lega ci sono il nome della propria squadra e il suo gagliardetto. Nel registro d'asta la propria riga ha il velo e un filo del marchio, come nelle rose. Admin e banditori scelgono dal menu «Il colore di» quale squadra colorare, come il database già permette; chi è in sola lettura colora solo la sua.

## Il pilota automatico

Tre livelli, scelti dall'utente e privati: *guarda e basta*, *propone*, *schiera da solo*. Regole di interfaccia che valgono a tutti e tre:

- Propone sempre **un diff**, mai una formazione nuova da confrontare a mente: chi esce, chi entra, perché, quanto vale.
- Due regole non si disattivano: non schiera mai un indisponibile, non tocca mai una casella bloccata.
- Tiene un diario con l'esito **misurato sui voti veri**, comprese le volte in cui aveva torto. Senza quel registro la soglia si tara a sentimento.

**Il primo pezzo di quel diario esiste già: «Previsione contro realtà»**, in fondo a Formazioni. Per ogni giornata con i voti e una formazione salvata mostra i fantapunti della tua e quelli della formazione che il modello avrebbe consigliato, più la sintesi della stagione. Tre regole valgono per ogni confronto fra previsione e realtà:
- **Il modello si interroga com'era prima della giornata.** Il punteggio di giornata usa forma e titolarità dai voti, e il motore di oggi conosce già quelli della giornata da giudicare: il modello vincerebbe barando. Per ogni giornata si ricostruisce il motore senza i voti da quella in poi (`ingressoFinoA`).
- **Le due formazioni si contano con la stessa regola.** Fantavoti degli undici; chi è senza voto lo sostituisce il primo della panchina dello stesso ruolo che ha preso voto, nell'ordine della panchina, fino a tre cambi. Non sono i fantapunti ufficiali, e la vista lo scrive.
- **I limiti si dichiarano.** Gli indisponibili sono quelli segnati oggi, non quelli di allora.

**Il testa a testa confronta stime, non scelte.** Due rose e una giornata, affiancate, con la formazione che il modello consiglierebbe a ciascuna (scelta (b) del 15/09/2026). Le formazioni vere degli altri restano private: aprirle in lettura cambierebbe il confine più importante del prodotto, e non è stato deciso di farlo.
- In asta resta muto: suggerisce prezzo e scarsità, non offre e non assegna.

## Condiviso e privato

Il confine, che nello schema dati è la divisione fra entità di lega e preferenze d'utente:

- **Di lega:** partecipanti, budget, slot, piano di spesa, assegnazioni, storico, voti di giornata, indisponibili, **calendario di lega e risultati di giornata**, **colore di ciascuna squadra**.
- **Di chi guarda:** squadra scelta come propria, obiettivi e prezzi massimi, formazioni di giornata, caselle bloccate, livello e regole del pilota, tema, modalità asta, accordion aperti.

Il calendario di lega sta fra i dati condivisi per una ragione che non è organizzativa: **è l'unica fonte dei risultati**. L'app non li calcola e non potrebbe — le formazioni degli altri sono private e la conversione fantapunti → gol dipende da regole di lega che non conosce. Da lì vengono classifica e verifica delle previsioni.

Chi ha accesso in sola lettura vede tutto aggiornarsi: i comandi di scrittura spariscono e al loro posto compare un avviso.

## Errori e perdite

Mai perdere una scrittura in silenzio. Se un salvataggio non arriva, al rientro compare in cima a *Lega e dati* un avviso che dice **cosa** risulta indietro e **a che ora** era stato cambiato, con «Applicale ora» e «Lascia com'è». Il ripristino tocca solo impostazioni di lega: le assegnazioni registrate nel frattempo dagli altri non si sovrascrivono mai.

## Stampa

La stampa non usa la pagina a schermo: si genera una vista dedicata e densa. I token di stampa forzano la tavolozza chiara con `!important`, perché le regole del tema notte hanno specificità più alta — e questo vale anche contro gli stili inline che `colore-squadra.ts` scrive sul `:root`, perché una dichiarazione `!important` di foglio batte una dichiarazione inline normale. Altre due trappole già pagate: il selettore che nasconde il resto non deve usare `:not(#id)`, e la vista non va svuotata su `afterprint`.

## Com'è agganciato al codice

I token nuovi sono la sorgente; i nomi vecchi (`--accent`, `--ok`, `--line`, …) sopravvivono come **alias** in `web/src/index.css`, così le 829 righe di `web/src/viste/legacy.css` e le classi Tailwind già scritte continuano a funzionare mentre le viste passano al sistema nuovo una alla volta.

Due corrispondenze che cambiano il comportamento, non solo il valore:

- `--accent` è diventato `--fr-marchio`. L'accento non è più una scelta dell'app: è identità dell'utente, e va corretto a runtime.

  **Dove vive il colore.** Su `squadre.colore`, perché è un dato di lega. Si salva la tinta *scelta*, non quella corretta: la correzione dipende dal tema di chi guarda. Lo cambiano admin e banditori per qualsiasi squadra, e ogni membro — anche in sola lettura — per la squadra che ha scelto come sua. Questo passa da `imposta_colore()`, che legge la squadra scelta di chi chiama senza mostrarla a nessuno. Il marchio di chi guarda è il colore della propria squadra; uscendo dalla lega torna l'ambra predefinita. Accanto a ogni nome nella Panoramica c'è il gagliardetto, perché la lega riconosca le squadre.

  **La tinta attiva si ricorda.** `colore-squadra.ts` tiene la tinta in uso (`usaTinta`, `riapplicaTinta`). A ogni cambio di tema la correzione va rifatta con *quella* tinta: la prima versione riapplicava l'ambra predefinita, e il sistema che passava al chiaro cancellava il colore della squadra.

  **Il tema** («come il sistema», notte, giorno) è una preferenza di chi guarda e resta sul dispositivo, come la modalità asta. L'ordine conta: prima si scrive `data-tema`, poi si riapplica la tinta, perché la correzione legge il fondo del pannello.
- `--warn` è diventato `--fr-fioco`, e le spie che si reggevano sull'ambra adesso si distinguono con la **forma**. Il primo alias puntava a `--fr-fermo`, che come testo sta a 2,67:1 sul bianco: le spie non erano silenziose, erano illeggibili. `web/test/token.test.ts` adesso pretende 4,5:1 per `--warn` nei due temi.

  Gli usi dell'ambra erano di due tipi, e vanno tenuti distinti:
  - **Il gradino di mezzo di una scala** (voto, probabilità, pressione, durezza, titolarità incerta). Il mezzo è neutro per costruzione: grigio leggibile e basta.
  - **Una cosa da fare o da controllare.** Avviso e etichette: bordo tratteggiato, testo pieno. Pallino «manca»: cerchio vuoto. Frasi da controllare, infortunati e diffidati: peso. «C'è di meglio in panchina»: filo pieno in cima alla casella — non tratteggio, che è riservato alle proposte del pilota.

  Tre usi non erano avvisi, e sono tornati al loro mestiere: la stellina degli obiettivi e l'evidenziato della ricerca sono cose tue, quindi colore squadra; «svincolo» è un'etichetta, quindi neutra.

## Cosa non fare

- Aggiungere un colore nuovo. Se serve distinguere qualcosa, prima si prova con forma, posizione o peso.
- Usare verde o rosso quando non sai dire qual è il riferimento.
- Scrivere un numero senza `.fr-num`, o un valore senza il suo delta quando un confronto esiste.
- Mettere un valore letterale (hex, px, font-size) dentro un componente.
- Card arrotondate con ombre per contenere righe di dati: le righe separate da filetti fanno entrare il doppio delle informazioni.
- Animare qualcosa che non sia una risposta diretta a un gesto dell'utente.
