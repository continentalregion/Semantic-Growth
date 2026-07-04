# Card a 11 metriche — calibrazione (promemoria per la ripresa)

Stato: test di calibrazione eseguito e confermato valido. **Implementazione in produzione rimandata** — questo documento è il promemoria per riprendere il lavoro in una fase successiva.

## 1. Formula di normalizzazione

Ogni dimensione viene normalizzata da scala 0-10 a scala 0-100 (`dimensione/10 × 100`) e l'aggregato usa la **stessa media pesata reale** già usata in produzione da `computeRawScore` (`artifacts/api-server/src/lib/sgiScoring.ts`), applicata per-messaggio e poi mediata sui messaggi del gruppo (early/late):

```
per ogni messaggio:  rawScore = Σ (dimensione/10 × peso) × 100
aggregato gruppo    = media aritmetica dei rawScore dei messaggi nel gruppo
```

Pesi (identici a `computeRawScore`):

| Dimensione | Peso |
|---|---|
| revisionSignal | 20% |
| interdisciplinaryScore | 17% |
| reasoningDepth | 15% |
| semanticVariety | 13% |
| conceptualComplexity | 12% |
| abstractionLevel | 8% |
| informationDensity | 7% |
| lexicalRichness | 3% |
| originality | 3% |
| stability | 1% |
| continuity | 1% |

**Perché questa formula e non una media semplice**: è la stessa già usata per l'EMA globale dell'utente (`computeNewSgiScore`). Usarne una diversa per la card creerebbe due numeri "SGI" incoerenti tra loro. Dà più peso a `revisionSignal` (segnale di crescita reale) e penalizza dimensioni facilmente "gonfiabili" con testo lungo (`lexicalRichness`, `stability`, `continuity`).

## 2. Gap noto: solo 8/11 dimensioni salvate storicamente

La tabella `sgi_snapshots` (`lib/db/src/schema/sgiSnapshots.ts`) salva oggi solo 8 delle 11 dimensioni: mancano le colonne per `abstractionLevel`, `lexicalRichness`, `informationDensity`. Per il test di calibrazione è stato necessario ri-calcolare tutte le 11 dimensioni ri-scorando il contenuto reale dei messaggi (stesso prompt/modello di produzione), non leggendole dallo storico.

Due opzioni discusse, **decisione non ancora presa**:

- **(a) Ri-scoring on-demand dal contenuto reale dei messaggi** al momento della generazione della card. Più preciso (tutte le conversazioni, anche passate, mostrano 11/11), ma più costoso in token/latenza — richiede una chiamata LLM aggiuntiva per messaggio non ancora coperta dalle 3 dimensioni mancanti.
- **(b) Salvare da subito tutte le 11 dimensioni in avanti** (aggiungere le 3 colonne mancanti a `sgi_snapshots`), accettando che le conversazioni pre-esistenti alla modifica mostrino solo 8/11 metriche.

Da decidere in fase di implementazione, in base a costo/latenza accettabile vs. completezza storica.

## 3. Limite statistico su conversazioni brevi

Con conversazioni sotto i ~10 messaggi totali, ogni messaggio pesa il 15-20% del blocco early/late nello split usato per il calcolo del trend: il delta% risulta rumoroso e può apparire più marcato di quanto sia realmente significativo.

**Regola di attivazione proposta**: la card a 11 metriche dovrebbe attivarsi solo dalla seconda finestra di 5 messaggi in avanti (dal messaggio utente #6 in poi), non dalla prima, per evitare la distorsione strutturale di `revisionSignal`/`continuity` che partono da 0 (o valori artificialmente bassi) al primo messaggio di ogni conversazione, dove non esiste ancora contesto precedente da cui rilevare revisione o continuità.

## 4. Risultati del test di calibrazione (riferimento numerico)

Dati reali, 2 conversazioni dell'utente di produzione (`francescoullo1@gmail.com`), nessun dato demo/sintetico, stesso motore di scoring di produzione (`gpt-4o-mini`, stesso prompt, stesso contesto rolling di 4 messaggi).

**Conversazione "Esistenza Del Noumeno Kantiano Incertezza"** (12 messaggi utente, 3 luglio 2026):

| Metrica | Early | Late | Δ |
|---|---|---|---|
| conceptualComplexity | 62.5 | 65.0 | +2.5 |
| semanticVariety | 50.8 | 50.0 | -0.8 |
| interdisciplinaryScore | 35.0 | 40.0 | +5.0 |
| reasoningDepth | 72.5 | 75.0 | +2.5 |
| originality | 55.8 | 59.2 | +3.3 |
| stability | 75.0 | 78.3 | +3.3 |
| continuity | 61.7 | 64.2 | +2.5 |
| abstractionLevel | 60.0 | 60.0 | 0 |
| lexicalRichness | 52.5 | 54.2 | +1.7 |
| informationDensity | 62.7 | 62.5 | -0.2 |
| revisionSignal | 30.0 | 33.3 | +3.3 |

Aggregato: early 50.7 → late 53.0 (+2.3)

**Conversazione "Gamification In Sito Web"** (9 messaggi utente, 21-22 giugno 2026):

| Metrica | Early | Late | Δ |
|---|---|---|---|
| conceptualComplexity | 46.0 | 36.3 | -9.7 |
| semanticVariety | 40.0 | 30.0 | -10.0 |
| interdisciplinaryScore | 26.0 | 11.3 | -14.7 |
| reasoningDepth | 48.0 | 37.5 | -10.5 |
| originality | 40.0 | 28.8 | -11.3 |
| stability | 72.0 | 75.0 | +3.0 |
| continuity | 53.0 | 57.5 | +4.5 |
| abstractionLevel | 38.0 | 28.8 | -9.3 |
| lexicalRichness | 42.0 | 38.8 | -3.3 |
| informationDensity | 49.8 | 48.8 | -1.0 |
| revisionSignal | 10.0 | 25.0 | +15.0 |

Aggregato: early 34.6 → late 29.9 (-4.7) — calo coerente col contenuto: la conversazione parte concettuale ("gamification") e scivola verso dettagli implementativi via via più operativi/tecnici, per cui molte metriche semantiche scendono, mentre `revisionSignal` sale (l'utente affina la richiesta).

**Conclusione del test**: la formula pesata produce numeri sufficientemente distinti tra conversazioni diverse (34.6 vs 50.7) da essere leggibili e non schiacciati al centro — validata come base per l'implementazione futura.

## 5. Da decidere in fase di implementazione

- **Layout della card**: 11 righe raggruppate per categoria (non lista piatta) — raggruppamento esatto da definire (es. riuso delle 4 macro-dimensioni già esistenti in `computeMacroDimensions`: profondità, connettività, precisione, revisione, oppure un raggruppamento nuovo pensato per la leggibilità della card).
- **Regola della CTA di condivisione**: da definire se mostrarla solo in caso di miglioramento aggregato (early→late positivo) o anche con risultati misti/negativi.
- **Gap 8/11 dimensioni**: scegliere tra opzione (a) o (b) del punto 2.
- **Soglia di attivazione**: confermare la regola "dal messaggio #6 in poi" del punto 3 in fase di design finale.

## Riferimenti codice

- `artifacts/api-server/src/lib/sgiScoring.ts` — formula pesi, `computeRawScore`, `computeMacroDimensions`, `normalizeDimensions`
- `lib/db/src/schema/sgiSnapshots.ts` — schema storage (8/11 dimensioni attualmente)
- `lib/db/src/schema/messages.ts`, `lib/db/src/schema/conversations.ts` — schema conversazioni/messaggi
