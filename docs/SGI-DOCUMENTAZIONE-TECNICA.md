# SGI — Semantic Growth Index · Documentazione Tecnica (Fonte di Verità)

> **Scopo.** Questo documento è la **fonte di verità** del prodotto SGI. Tutto ciò che segue è **derivato direttamente dal codice** del repository (non da ipotesi). Dove un'informazione non esiste nel codice, è indicato esplicitamente con _«non presente nel codice»_.
> **Aggiornato al:** 24 giugno 2026.
> **Ambito:** questa è la **Fase 1** (documento tecnico). Le Fasi 2 (pagina pubblica "How It Works" + i18n) e 3 (social card) non sono incluse.

### Riferimenti sorgente principali
| Area | File |
| --- | --- |
| Motore di scoring SGI (11 metriche, macro, raw score, EMA, livelli, badge) | `artifacts/api-server/src/lib/sgiScoring.ts` |
| Sistema Battle (User vs AI) | `artifacts/api-server/src/lib/battleScoring.ts` |
| Endpoint chat / scoring messaggi | `artifacts/api-server/src/routes/chat.ts` |
| Endpoint Battle + persistenza | `artifacts/api-server/src/routes/threads.ts` |
| Profilo, rank, percentile, predizioni, badge | `artifacts/api-server/src/routes/users.ts` |
| Gamification (XP/livello/streak/missioni/badge) | `artifacts/api-server/src/routes/gamification.ts` |
| Leaderboard | `artifacts/api-server/src/routes/leaderboard.ts` |
| Schema database (Drizzle) | `lib/db/src/schema/*` |
| Frontend web (rotte/sezioni) | `artifacts/sgi-app/src/App.tsx`, `artifacts/sgi-app/src/components/layout.tsx`, `artifacts/sgi-app/src/pages/*` |

---

## 1. Le 11 metriche semantiche

Le 11 metriche sono definite nell'interfaccia `SgiDimensions` e valutate dalla rubrica condivisa `SGI_DIMENSIONS_RUBRIC` (`sgiScoring.ts`). **Ogni metrica è su scala continua `0.0–10.0`.**

| # | Chiave (codice) | Etichetta IT (`METRIC_LABELS`) | Cosa misura (dalla rubrica) |
| --- | --- | --- | --- |
| 1 | `conceptualComplexity` | Complessità concettuale | quanti concetti distinti e non banali sono presenti |
| 2 | `semanticVariety` | Varietà semantica | ampiezza dei campi semantici toccati |
| 3 | `interdisciplinaryScore` | Interdisciplinarità | ponti tra domini (es. fisica ↔ filosofia) |
| 4 | `reasoningDepth` | Profondità di ragionamento | quanto è profonda la catena logica (affermazione superficiale vs argomento completo) |
| 5 | `originality` | Originalità | distacco dalle formulazioni ovvie/comuni |
| 6 | `stability` | Coerenza interna | consistenza interna, assenza di contraddizioni |
| 7 | `continuity` | Continuità | costruisce in modo coerente sul contesto precedente |
| 8 | `abstractionLevel` | Livello di astrazione | grado di astrazione dal concreto al meta |
| 9 | `lexicalRichness` | Ricchezza lessicale | precisione/accuratezza tecnica del vocabolario (NON conteggio o rarità delle parole — la parola *giusta* vale molto, il riempire di gergo vale poco) |
| 10 | `informationDensity` | Densità informativa | rapporto segnale/rumore; quanto contenuto semantico per parola |
| 11 | `revisionSignal` | Segnale di revisione | **critica**: l'utente sta rivedendo/sfumando/aggiornando una posizione precedente? `0` = nessuna revisione; `1–4` sfumatura minore; `5–7` rifinitura esplicita; `8–10` cambio di posizione motivato. `0` se è il primo messaggio o non esiste posizione precedente |

### Come vengono calcolate — LLM vs rule-based
- **Tutte e 11 le metriche sono LLM-based.** La funzione `scoreMessage()` invia il messaggio utente + ultimi 4 turni di contesto a un singolo modello:
  - Modello: **`gpt-4o-mini`** (via proxy AI di Replit, `@workspace/integrations-openai-ai-server`).
  - Parametri: `temperature: 0`, `response_format: { type: "json_object" }`, `max_tokens: 320`.
  - Il messaggio utente è troncato a **600 caratteri**; il contesto a **200 caratteri** per turno (ultimi 4).
  - Output: un JSON compatto con i valori 0–10 per ogni metrica + fino a 3 `domains`.
- **Normalizzazione (rule-based) `normalizeDimensions()`:** ogni valore è forzato (`clamp`) nell'intervallo `0–10`. I campi mancanti/non numerici ricevono un default di **5** (eccetto `revisionSignal` → **0**). I valori `0` legittimi (es. `revisionSignal`) sono preservati.
- **Fallback (rule-based) `defaultDimensions()`:** se la chiamata LLM o il parsing falliscono, si usano valori fissi: `conceptualComplexity 3, semanticVariety 3, interdisciplinaryScore 2, reasoningDepth 3, originality 3, stability 5, continuity 5, abstractionLevel 3, lexicalRichness 3, informationDensity 3, revisionSignal 0`.
- **Domini semantici:** estratti dallo stesso output LLM, limitati a 3, scelti dalla lista chiusa `SGI_DOMAINS_LIST` (philosophy, mathematics, biology, economics, psychology, physics, linguistics, technology, history, art, literature, politics, sociology, neuroscience, ethics, logic, computer_science, chemistry, astronomy, medicine).

> **Nota.** La medesima rubrica `SGI_DIMENSIONS_RUBRIC` è riusata dal sistema Battle (`battleScoring.ts`), così dashboard e battaglie giudicano sugli **identici** 11 criteri.

---

## 2. Le 4 macro-dimensioni

Le 11 metriche sono aggregate in **4 macro-dimensioni** mostrate all'utente (`computeMacroDimensions()` in `sgiScoring.ts`). Tutte arrotondate a 1 decimale.

| Macro-dimensione (chiave) | Formula (dalle 11 metriche) | Significato |
| --- | --- | --- |
| `profondita` | `(conceptualComplexity + reasoningDepth + abstractionLevel) / 3` | profondità del ragionamento |
| `connettivita` | `(interdisciplinaryScore + semanticVariety) / 2` | ponti tra domini |
| `precisione` | `(informationDensity + lexicalRichness) / 2` | qualità dell'espressione (peso basso perché "gameable") |
| `revisione` | `revisionSignal` | segnale onesto di crescita: l'utente aggiorna il proprio pensiero? |

Anche le macro sono su scala `0.0–10.0`.

---

## 3. SGI Score

### 3.1 Raw score di un singolo messaggio — `computeRawScore()`
Media pesata delle 11 metriche, ciascuna normalizzata `/10`, poi `× 100` → intervallo **0–100**.

| Metrica | Peso |
| --- | --- |
| `revisionSignal` | 0.20 |
| `interdisciplinaryScore` | 0.17 |
| `reasoningDepth` | 0.15 |
| `semanticVariety` | 0.13 |
| `conceptualComplexity` | 0.12 |
| `abstractionLevel` | 0.08 |
| `informationDensity` | 0.07 |
| `lexicalRichness` | 0.03 |
| `originality` | 0.03 |
| `stability` | 0.01 |
| `continuity` | 0.01 |

Somma dei pesi = **1.00**. Formula: `rawScore = Σ (metrica/10 × peso) × 100`.
Scelte di design esplicite nel codice: `revisionSignal` riceve il peso più alto (segnale di crescita onesta); `lexicalRichness` ha peso basso perché facilmente manipolabile.

### 3.2 SGI Score nel tempo — EMA `computeNewSgiScore()`
Lo SGI Score dell'utente è una **media mobile esponenziale (EMA)** dei raw score dei suoi messaggi:

```
se currentScore === 0  →  nuovoScore = messageScore        (bootstrap al primo messaggio)
altrimenti             →  nuovoScore = α·messageScore + (1−α)·currentScore
```

con **α (alpha) = 0.15** (valore di default usato in produzione). Quindi ogni nuovo messaggio sposta lo score del 15% verso il raw score di quel messaggio.

### 3.3 Dove viene applicato (e dove NO)
- **Applicato solo nella chat** (`chat.ts`, endpoint invio messaggio): ad ogni messaggio utente si calcola `scoreMessage()` → `computeNewSgiScore(oldSgi, rawScore, 0.15)` → si aggiorna `users.sgiScore`, si inserisce uno snapshot, si aggiorna il delta della conversazione e del messaggio, si aggiornano i domini semantici, XP, streak, badge, missioni, e infine il rank in leaderboard.
- **NON applicato nelle Battle.** Le battaglie User-vs-AI non toccano mai `users.sgiScore` (vedi §4).

### 3.4 Snapshot dello storico — `sgi_snapshots`
Ad ogni messaggio viene inserito uno snapshot. **Importante (limite del codice):** la tabella `sgi_snapshots` memorizza **solo 8** delle 11 metriche: `conceptualComplexity, semanticVariety, interdisciplinaryScore, reasoningDepth, originality, stability, continuity, revisionSignal`.
Non sono persistite: `abstractionLevel`, `lexicalRichness`, `informationDensity`.
**Conseguenza:** quando la dashboard ricostruisce le macro-dimensioni dallo snapshot più recente (`buildUserProfile` in `users.ts`), questi 3 campi sono passati a `0`. Perciò, calcolate dallo snapshot: `precisione = (0 + 0)/2 = 0` sempre, e `profondita` usa solo `conceptualComplexity + reasoningDepth` (con `abstractionLevel = 0`). Le macro calcolate "in linea" al momento dello scoring del messaggio invece usano tutte e 11.

### 3.5 Rank globale e percentile — `updateLeaderboardRank()`
- `rank = (conteggio righe in leaderboard_entries con sgiScore > sgiScore utente) + 1`.
- `percentile = round((1 − rank/total) × 1000) / 10` (total = righe in `leaderboard_entries`).
- Il valore è scritto su `users.globalRank` e in upsert su `leaderboard_entries` (sgiScore, rank, percentile, displayName `User_NNNNNN`, `isAnonymous = 1`).
- In `buildUserProfile`, il percentile mostrato è `round((1 − rank/totalUsers) × 1000)/10` se il rank esiste, altrimenti `null`.
- `rankChange30d` (in `buildUserProfile`): confronta il rank attuale con un rank stimato dallo snapshot più vecchio degli ultimi 30 giorni, dove `oldPercentile = oldScore / 100` e `oldRank = round(totalUsers × (1 − oldPercentile))`. _(Quirk del codice: tratta lo score 0–100 come frazione di percentile.)_
- Delta SGI mostrati nel profilo: `sgiDailyDelta`, `sgiWeeklyDelta`, `sgiMonthlyDelta` = differenza tra `sgiScore` attuale e lo score dello snapshot immediatamente precedente alla soglia di 1 giorno / 7 giorni / 30 giorni.

### 3.6 Predizioni / proiezioni — `GET /users/me/predictions`
Proiezione **euristica** (non ML), funzione `project(days, growthMultiplier)`:
- Crescita giornaliera media `avgDailyGrowth` stimata dagli snapshot degli ultimi 30 giorni (default `0.3`, limitata a `[-0.5, 2]`).
- Iterazione giorno per giorno: `growth = avgDailyGrowth × growthMultiplier − meanReversion × (sgi − targetSgi) × 0.01`, con `meanReversion = 0.03` e `targetSgi = 65`; `sgi` mantenuto in `[0, 100]`.
- `percentile = clamp(50 + (sgi − 50) × 1.5, 0.1, 99.9)`; `rank = round(totalUsers × (1 − percentile/100))`.
- Tre scenari restituiti: **conservative** (`×0.5`), **realistic** (`×1`), **optimistic** (`×2`), ciascuno a 30/90/180 giorni.

---

## 4. Sistema Battle (User vs AI)

Orchestrato da `evaluateBattle()` (`battleScoring.ts`): **genera risposta AI → doppio scoring → esito → ricompensa**. Modello usato: **`gpt-4o-mini`** in tutti gli step.

### 4.1 Avversario AI — `generateBattleAiAnswer()`
- Modello `gpt-4o-mini`, `temperature: 0.5`, `max_tokens: 700`.
- System prompt: "world-class interdisciplinary thinker" in un duello; risposta **180–280 parole**, solo prosa (niente preamboli/elenchi), **nella stessa lingua della domanda**, ottimizzata su complessità/connessioni/profondità/originalità/astrazione/densità.

### 4.2 Doppio scoring in UNA sola chiamata — `scoreBattleAnswers()`
- Risposta utente e risposta AI valutate **insieme in una singola chiamata LLM** (`temperature: 0`, `json_object`, `max_tokens: 600`) con la **stessa rubrica delle 11 metriche** → varianza eliminata tra i due.
- Mapping fisso: `answerA = utente`, `answerB = AI`. Entrambe troncate a **2400 caratteri**.
- **Robustezza:** fino a **2 tentativi**; validazione stretta `assertValidRawScore()` che **lancia un errore** se manca/è invalida una metrica (non si usano mai default a metà punteggio, che corromperebbero un esito gamificato).
- **Hardening anti prompt-injection:** domanda e risposte sono passate come **dati JSON non fidati**; il prompt istruisce il modello a non obbedire ad eventuali istruzioni contenute nel testo valutato.
- Per ogni risposta si producono: `dimensions` (11), `macroDimensions` (4), `domains`, `rawScore` (0–100, stessa scala dello SGI dashboard).

### 4.3 Esito — `computeBattleOutcome()`
- `margin = userRawScore − aiRawScore`.
- **`TIE_EPSILON = 0.75`**: `margin > 0.75` → vince l'utente; `margin < −0.75` → vince l'AI; altrimenti **pareggio**.
- Confronto per-metrica con **`METRIC_EPSILON = 0.25`**: per ogni metrica, scarto `> 0.25` assegna la metrica all'utente, `< −0.25` all'AI, altrimenti pari.
- Produce `aiAdvantages` (metriche dove l'AI ha vinto, scarto maggiore prima) e `userStrengths` (metriche dove ha vinto l'utente).

### 4.4 Ricompensa — `computeBattleReward()`
| Esito | XP assegnati | Badge |
| --- | --- | --- |
| **Win** | `round(60 + userRawScore × 0.4 + max(0, margin) × 1.5)` | idoneo a `battle_victor` |
| **Tie** | `round(35 + userRawScore × 0.3)` | no |
| **Loss** | `round(15 + userRawScore × 0.25)` | no |

### 4.5 Endpoint e persistenza — `POST /threads/:id/battle`
- Richiede auth Clerk; valida `userAnswer` (**min 10 caratteri**); carica il thread.
- Esegue `evaluateBattle(thread.question, thread.category, userAnswer)`.
- Persiste il duello in `ai_battles` (domanda/categoria "snapshot", `userAnswer`, `aiAnswer`, `userScore`/`aiScore` come JSONB, `winner`, `xpAwarded`, `isPublic = isWin`).
- Assegna **XP alla tabella `gamification`** (upsert, con aggiornamento streak e livello). **Non tocca mai `users.sgiScore`** → il rank globale resta indipendente dalle battaglie.
- Su **vittoria**: marca il duello pubblico (`isPublic = true`) e concede il badge `battle_victor` (idempotente). _(Nota: questo inserimento badge **non** aggiunge i +500 XP che invece concede `checkAndAwardBadges`; vedi §5.)_
- Risponde con: valutazione completa + `battleId`, `xp`, `level`, `badgeAwarded`.
- Le sole battaglie **vinte** appaiono nel feed pubblico (`GET /battles/public`), marcate "vs AI".

### 4.6 Sistema "battaglie" legacy / parallelo (sessioni a tempo)
Oltre al modello User-vs-AI (`ai_battles`), nel codice esiste un sistema di **sessioni di thread a tempo** (PvP), distinto:
- `thread_sessions`: tentativo cronometrato di un utente su un thread, con messaggi e punteggi separati `scoreDensity`, `scoreConnections`, `scoreDepth`, `scoreTotal`, `connections` (knowledge base), `status`.
- `battle_cards`: accoppia due `thread_sessions` per il confronto competitivo (`session1Id`, `session2Id`, `winnerSessionId`).
- Endpoint relativi: `POST /threads/:id/sessions`, `POST /threads/:id/sessions/:sessionId/chat` (SSE), `POST /threads/:id/sessions/:sessionId/complete`, `GET /battle-cards/:id`, `GET /battle-cards/:id/og-image`.

---

## 5. Gamification (XP / livello / badge / streak / missioni)

### 5.1 Fonti di XP
| Fonte | XP |
| --- | --- |
| Messaggio in chat | `round(10 + sgiDelta × 5 + convoCount × 0.5)` (`convoCount` = numero conversazioni dell'utente) |
| Battaglia | `reward.xpAwarded` (formule win/tie/loss, §4.4) |
| Missione completata | **+250** (`updateMissionProgress` → `xpCallback(250)`) |
| Badge ottenuto via `checkAndAwardBadges` | **+500** per badge |

> **Nota di coerenza:** il badge `battle_victor` è concesso nell'endpoint battle **senza** il bonus +500 (quel bonus è solo nel percorso `checkAndAwardBadges`).

### 5.2 Livello — `sgiScoring.ts`
- `computeLevel(xp) = floor(sqrt(xp / 100)) + 1`.
- `xpToNextLevel(xp) = level² × 100 − xp`.
- `levelProgress(xp) = (xp − (level−1)² × 100) / (level² × 100 − (level−1)² × 100)`, limitato a `1`.

### 5.3 Streak
Calcolato in SQL (sia in chat che in battle): se `lastActiveDate` = **ieri** → `streak + 1`; se = **oggi** → invariato; altrimenti → **reset a 1**.

### 5.4 Badge — `BADGE_DEFINITIONS` (7) + soglie `checkAndAwardBadges()`
| Chiave | Nome | Condizione (dal codice) |
| --- | --- | --- |
| `semantic_explorer` | Semantic Explorer | `conversationCount >= 5` |
| `systems_thinker` | Systems Thinker | `interdisciplinaryScore > 7.5` |
| `cross_domain_architect` | Cross-Domain Architect | ≥ 5 domini distinti in una conversazione |
| `abstract_reasoner` | Abstract Reasoner | `abstractionLevel > 8.0` |
| `high_growth_user` | High Growth User | guadagno ≥ 10 punti SGI in 7 giorni |
| `mind_changer` | Mind Changer | definito in `BADGE_DEFINITIONS` (revisionSignal > 7.0). _Nota: non viene assegnato dentro `checkAndAwardBadges` nel codice attuale_ |
| `battle_victor` | Battle Victor | vittoria in battaglia 1-contro-1 vs AI (assegnato in `POST /threads/:id/battle`) |

### 5.5 Missioni — `gamification.ts`
- **Settimanali** (`WEEKLY_MISSION_POOL`, 5 voci, se ne estraggono **2** a rotazione, scadenza al lunedì successivo): "First Steps" (3 conversazioni), "Deep Thinker" (reasoningDepth ≥ 7), "Curious Mind" (3 domini), "Daily Streak" (5 giorni di fila), "SGI Climber" (+5 SGI/settimana).
- **Mensili** (`MONTHLY_MISSION_POOL`, 3 voci, se ne estrae **1**, scadenza fine mese): "Scholar of the Month" (20 conversazioni), "Cross-Domain Master" (8 domini), "Growth Champion" (+15 SGI/mese).
- Rigenerazione automatica alla scadenza (`regenerateMissionsIfNeeded`). Avanzamento via `updateMissionProgress` (per titolo missione). Completamento → +250 XP.
- **Piano free:** le missioni sono **bloccate** (`missionsLocked = true`, lista vuota); disponibili solo per piani non-free.

### 5.6 Indipendenza XP ↔ SGI/rank — **confermata**
- XP, livello, streak e badge vivono nella tabella **`gamification`** (e `badges`/`missions`), separate da **`users.sgiScore`** / **`leaderboard_entries`** (rank, percentile).
- Il rank globale dipende **solo** da `sgiScore`, che cambia **solo** dalla chat (EMA). Le battaglie assegnano **solo XP** e non toccano `sgiScore`. Quindi: **l'XP/livello è indipendente dal rank SGI** (confermato dal codice e dal commento esplicito in `threads.ts`).

---

## 6. Architettura

### 6.1 Struttura (monorepo pnpm)
- **Backend condiviso:** `@workspace/api-server` — Express, tutte le rotte montate sotto **`/api`** (`app.ts`). Auth via **Clerk** (`@clerk/express`, `getAuth(req).userId`). AI via proxy Replit (`@workspace/integrations-openai-ai-server`, modello `gpt-4o-mini`).
- **Libreria dati condivisa:** `@workspace/db` — schema **Drizzle** + PostgreSQL.
- **Due frontend** che consumano lo **stesso** backend `/api`:
  - `@workspace/sgi-app` — **web** (React + Vite, dark/futuristico, routing `wouter`).
  - `@workspace/sgi-mobile` — **mobile** (Expo / React Native).
- Client tipizzati generati condivisi: `@workspace/api-client-react` (hook React Query) e relativo spec Zod.
- Controllo di proprietà per le rotte `:clerkId`: `requireOwner()` (403 se non è il proprietario).

### 6.2 Endpoint API (base `/api`)
| Metodo | Path | Descrizione / Ritorno |
| --- | --- | --- |
| GET | `/healthz` | health check `{status:"ok"}` |
| GET | `/debug-auth` | diagnostica stato auth Clerk |
| POST | `/auth/mobile-signin` | verifica password lato server per mobile → `{token}` |
| POST | `/users/me` | sincronizza utente Clerk → profilo |
| GET | `/users/me` | profilo utente (sgiScore, macroDimensions, rank, percentile, delta…) |
| GET | `/users/me/sgi-history` | storico snapshot SGI (limitato per free) |
| GET | `/users/me/semantic-map` | grafo domini/connessioni (premium) |
| GET | `/users/me/domain-strengths` | aree forti / da sviluppare (premium) |
| GET | `/users/me/predictions` | proiezioni 30/90/180g (conservative/realistic/optimistic) |
| GET | `/users/:clerkId` (+ `/sgi-history`, `/semantic-map`, `/domain-strengths`, `/predictions`) | versioni per clerkId (solo proprietario) |
| GET | `/openai/conversations` | elenco conversazioni utente |
| POST | `/openai/conversations` | crea conversazione |
| GET | `/openai/usage` | uso/costo mensile messaggi |
| GET | `/openai/conversations/:id` | dettaglio conversazione + messaggi |
| DELETE | `/openai/conversations/:id` | elimina conversazione (204) |
| POST | `/openai/conversations/:id/messages` | invia messaggio → **stream SSE** della risposta AI; al termine aggiorna SGI/XP/snapshot |
| GET | `/leaderboard` | classifica paginata + voce utente corrente |
| GET | `/leaderboard/summary` | statistiche globali (media SGI, top, soglie top1%/top10%, attivi 7g) |
| GET | `/gamification/me` | XP, livello, streak, badge, missioni, `missionsLocked`, `xpToNextLevel`, `levelProgress` |
| GET | `/battles/public` | feed battaglie pubbliche (incluse vs AI) |
| GET | `/threads` | elenco thread |
| POST | `/threads` | crea thread |
| GET | `/threads/:id` | dettaglio thread + sessioni |
| POST | `/threads/:id/battle` | **battaglia User-vs-AI** (vedi §4.5) |
| POST | `/threads/:id/sessions` | avvia sessione a tempo |
| POST | `/threads/:id/sessions/:sessionId/chat` | chat di sessione (SSE) |
| POST | `/threads/:id/sessions/:sessionId/complete` | completa sessione + estrae knowledge |
| GET | `/battle-cards/:id` | dati confronto battle card |
| GET | `/battle-cards/:id/og-image` | immagine OG (PNG via resvg, fallback SVG) |
| GET | `/recommendations/me` | suggerimenti di crescita (premium) |
| POST | `/translate` | localizzazione UI via AI |
| GET | `/admin/stats` | metriche di sistema (admin) |

### 6.3 Tabelle database (`lib/db/src/schema/*`)
| Tabella | Colonne chiave | Scopo |
| --- | --- | --- |
| `users` | `id` PK, `clerkId` unique, `email`, `plan` (default `free`), `sgiScore` (real, def 0), `globalRank`, `monthlyMessagesUsed`, `monthlyResetDate` | profilo, piano, SGI score, rank, uso mensile |
| `conversations` | `id` PK, `userId` FK | sessioni di chat utente↔AI |
| `messages` | `id` PK, `conversationId` FK | messaggi (token/costo, `sgiDelta`) |
| `sgi_snapshots` | `id` PK, `userId` FK, `score` + **8 metriche** | storico SGI per i grafici (vedi §3.4) |
| `leaderboard_entries` | `id` PK, `userId`, `sgiScore`, `rank`, `percentile` | dati denormalizzati per la classifica |
| `gamification` | `id` PK, `userId` FK unique, `xp`, `level`, `streak`, `lastActiveDate` | progressione (XP/livello/streak) |
| `badges` | `id` PK, `userId` FK, `badgeKey`, `earnedAt` | achievement ottenuti |
| `missions` | `id` PK, `userId` FK, `type`, `title`, `progress`, `target`, `completed`, `expiresAt` | missioni settimanali/mensili |
| `recommendations` | `id` PK, `userId` FK, `category`, `content`, `estimatedSgiGain` | suggerimenti (lista statica nel codice) |
| `semantic_domains` | `id` PK, `userId` FK, `domain`, `explorationScore`, `messageCount` | mastery/esplorazione per dominio |
| `blocked_attempts` | `id` PK, `userId` FK | log richieste bloccate (limiti d'uso/budget) |
| `threads` | `id` UUID PK, `question`, `category`, `createdBy`, `knowledgeBase` (jsonb), `totalSessions` | prompt condivisi per le battaglie |
| `thread_sessions` | `id` UUID PK, `threadId` FK, `userId`, `messages`, `connections`, `scoreDensity/Connections/Depth/Total`, `status` | tentativo cronometrato su un thread |
| `battle_cards` | `id` UUID PK, `threadId` FK, `session1Id`, `session2Id`, `winnerSessionId` | confronto tra due sessioni |
| `ai_battles` | `id` UUID PK, `threadId` FK, `userId` (clerk), `question`, `userAnswer`, `aiAnswer`, `userScore`/`aiScore` (jsonb), `winner`, `xpAwarded`, `isPublic` | duello User-vs-AI (modello live) |

---

## 7. Le 11 sezioni del sito (web)

Dalla navigazione in `artifacts/sgi-app/src/components/layout.tsx`, raggruppate in **Core / Explore / Game** (la voce **Admin** è separata e non conteggiata). Tutte le rotte sono protette (`ProtectedRoute`) **eccetto `/leaderboard`**, che nel codice è pubblica.

**Gruppo Core**
1. **Dashboard** — `/dashboard` — panoramica del profilo SGI dell'utente, grafici di crescita storica, macro-dimensioni. Dati: `GET /users/me`, `GET /users/me/sgi-history`, `GET /users/me/predictions`, `GET /users/me/semantic-map`.
2. **Chat (Semantic Growth)** — `/chat` — chat AI dove l'utente fa sessioni di ragionamento; **è l'unica sezione che fa crescere lo SGI score**. Dati: `GET/POST/DELETE /openai/conversations[...]`, `POST /openai/conversations/:id/messages` (SSE).
3. **Thread Aperti** — `/threads` (badge "NEW") — elenco delle domande/thread della community da cui avviare le battaglie. Dati: `GET /threads`, `POST /threads`.
4. **Feed Battaglie** — `/battles` (badge "LIVE") — feed pubblico delle battaglie completate (incluse vs AI). Dati: `GET /battles/public`.

**Gruppo Explore**
5. **Classifica / Leaderboard** — `/leaderboard` — ranking globale per SGI + statistiche community. Dati: `GET /leaderboard`, `GET /leaderboard/summary`, `GET /users/me`.
6. **Semantic Map** — `/map` — grafo interattivo dei domini/concetti esplorati. Dati: `GET /users/me/semantic-map`.
7. **Predictions** — `/predictions` — proiezioni di SGI/rank a 30/90/180 giorni (3 scenari). Dati: `GET /users/me/predictions`, `GET /users/me`.
8. **Recommendations (Growth Path)** — `/recommendations` — suggerimenti personalizzati di crescita. Dati: `GET /recommendations/me`.

**Gruppo Game**
9. **Gamification (Progress)** — `/gamification` — livello, XP, streak, badge e missioni. Dati: `GET /gamification/me`.
10. **Profile** — `/profile` — profilo personale, achievement e statistiche. Dati: `GET /gamification/me`, `GET /users/me`.
11. **Settings** — `/settings` — preferenze e account.

**Sezione separata (non conteggiata): Admin** — `/admin` — monitoraggio di sistema. Dati: `GET /admin/stats`.

### Rotte di dettaglio / utilità (non parte delle 11 voci di navigazione)
- `/` Home (landing per utenti non loggati; redirect a `/dashboard` se loggati).
- `/threads/:id` Dettaglio thread; `/threads/:id/battle` Sessione di battaglia; `/battle-cards/:id` Battle card.
- `/sign-in`, `/sign-up` (Clerk); catch-all 404.

---

## Appendice A — Dominio e branding presenti nel codice (rilevante per la Fase 3)

| Posizione | Stringa nel codice |
| --- | --- |
| OG image battle card (`api-server/.../threads.ts`) | `semantic-growth-index.replit.app` |
| Share card web (`sgi-app/.../battle-card.tsx`, `battleStoryCard.ts`) | `SITE_URL = "semantic-growth.app"` |
| Share card mobile (`sgi-mobile/.../ShareableBattleDuelCard.tsx`, `battles.tsx`) | `semantic-growth.app` |

> Il dominio **`sgindex.work`** richiesto per le social card della Fase 3 **non è presente nel codice** attuale: andrà introdotto in quella fase.

## Appendice B — Note e limiti rilevati nel codice
- `sgi_snapshots` salva 8/11 metriche → macro `precisione` ricostruita dallo snapshot è sempre 0 e `profondita` è parziale (§3.4).
- Il badge `mind_changer` è definito ma non assegnato in `checkAndAwardBadges` (§5.4).
- Il badge `battle_victor` non concede i +500 XP previsti per gli altri badge (§5.1).
- `rankChange30d` tratta lo score 0–100 come frazione di percentile (§3.5).
- Le `recommendations` sono una lista statica nel codice, non generate dinamicamente (§ funzione `generateRecommendations`).
