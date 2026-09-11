#!/usr/bin/env bash
# Assembla i sei frammenti di src/ in un unico file HTML autosufficiente.
#
#   ./build.sh                 → app vuota, il listone lo importi dall'interfaccia
#   ./build.sh dati/           → app con i dati già dentro (vedi dati/LEGGIMI.md)
#
# Il risultato è Fantaregia.html: si apre con un doppio clic, non ha
# bisogno di un server e non chiama la rete se non per i font e per il lettore
# xlsx, che serve solo quando importi un file.
set -euo pipefail
DATI="${1:-}"
OUT="${OUT:-Fantaregia.html}"

python3 - "$DATI" "$OUT" <<'PY'
import json, os, re, sys
dati, out = sys.argv[1], sys.argv[2]

def carica(nome, vuoto):
    if not dati: return vuoto
    p = os.path.join(dati, nome)
    if not os.path.exists(p):
        print(f"  {nome} non c'è: uso il valore vuoto")
        return vuoto
    with open(p) as f: return f.read()

players = carica("data.json", "[]")
cal     = carica("cal_bundle.json", '{"teams":[],"fix":[],"dates":[]}')
rig     = carica("rig_bundle.json", "{}")
hist    = carica("hist_bundle.json", "{}")
meta    = json.dumps({"name": "Nessun listone caricato" if players.strip() in ("[]", "") else "Listone in uso",
                      "when": None, "count": len(json.loads(players))})

src = lambda n: open(os.path.join("src", n)).read()
p4  = src("part4.html")
p4  = p4[len('<script id="fa-app">'):].rstrip()[:-len("</script>")]

blocco_dati = ('<script id="fa-data">window.PLAYERS=' + players +
               ';window.CAL=' + cal + ';window.RIG=' + rig + ';window.HIST=' + hist +
               ';window.SHARED=null;window.LISTMETA=' + meta + ';</script>')

corpo = (src("part1.html") + src("part2.html") + src("part3.html") + "\n" +
         blocco_dati + "\n" + '<script id="fa-app">' + p4 + src("part5.html") + src("part6.html"))

pagina = ('<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n'
          '<meta name="viewport" content="width=device-width,initial-scale=1">\n</head>\n<body>\n'
          + corpo + '\n</body>\n</html>\n')

with open(out, "w") as f: f.write(pagina)
with open(".check.js", "w") as f:
    f.write(re.findall(r'<script id="fa-app">(.*?)</script>', corpo, re.S)[0])
print(f"  {out}: {os.path.getsize(out)//1024} KB, {len(json.loads(players))} giocatori")
PY

node --check .check.js && rm -f .check.js && echo "  sintassi del JavaScript: ok"
