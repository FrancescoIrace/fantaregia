# I tuoi dati vanno qui

Questa cartella è esclusa dal versionamento: quello che ci metti resta sul tuo
computer e non finisce mai su GitHub.

`build.sh dati/` cerca qui dentro quattro file, e per ognuno che manca usa un
valore vuoto — l'app si costruisce lo stesso, con quella funzione spenta.

| File | Lo prepara | Se manca |
|---|---|---|
| `data.json` | `node tools/dati.mjs listone <file>` | l'app parte vuota e importi il listone da *Lega e dati* |
| `cal_bundle.json` | `node tools/dati.mjs calendario <file.csv>` | niente indice calendario né striscia delle prossime partite |
| `hist_bundle.json` | `node tools/dati.mjs statistiche <file.xlsx>` | niente dati della stagione scorsa nella scheda giocatore |
| `rig_bundle.json` | a mano, vedi sotto | niente badge rigoristi |

## rig_bundle.json

Un oggetto `id → [gerarchia, confermato]`, dove `gerarchia` è 1 per il primo
rigorista, 2 per il secondo e così via, e `confermato` è `1` se il dato viene
da più fonti concordi, `0` se da una sola (il badge esce sbiadito).

```json
{ "2194": [1, 1], "5585": [1, 0], "309": [2, 1] }
```

Gli `id` sono quelli del listone. Non c'è un file ufficiale da cui prenderli:
le gerarchie dal dischetto si trovano solo negli articoli di inizio stagione,
e cambiano durante l'anno. Se lo compili, incrocia almeno due fonti e ricontrolla
che ogni nome corrisponda davvero a un giocatore di quella squadra.
