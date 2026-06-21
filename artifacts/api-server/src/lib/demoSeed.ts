import { db } from "@workspace/db";
import {
  users, leaderboardEntries, gamification,
  threads, threadSessions, battleCards,
} from "@workspace/db";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// 20 fake always-on users
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { clerkId: "demo_user_01", email: "marco.ricci@sgi.app",        username: "Marco_R",       sgi: 91.4, plan: "pro",     xp: 4800, level: 12, streak: 21 },
  { clerkId: "demo_user_02", email: "sofia.ferrari@sgi.app",      username: "Sofia_F",       sgi: 87.2, plan: "pro",     xp: 4200, level: 11, streak: 17 },
  { clerkId: "demo_user_03", email: "luca.esposito@sgi.app",      username: "Luca_E",        sgi: 83.8, plan: "pro",     xp: 3900, level: 10, streak: 14 },
  { clerkId: "demo_user_04", email: "giulia.romano@sgi.app",      username: "Giulia_R",      sgi: 80.1, plan: "premium", xp: 3400, level: 9,  streak: 11 },
  { clerkId: "demo_user_05", email: "andrea.conti@sgi.app",       username: "Andrea_C",      sgi: 76.5, plan: "pro",     xp: 3100, level: 9,  streak: 9  },
  { clerkId: "demo_user_06", email: "valentina.bianchi@sgi.app",  username: "Vale_B",        sgi: 73.2, plan: "premium", xp: 2800, level: 8,  streak: 8  },
  { clerkId: "demo_user_07", email: "davide.greco@sgi.app",       username: "Davide_G",      sgi: 70.8, plan: "pro",     xp: 2600, level: 8,  streak: 7  },
  { clerkId: "demo_user_08", email: "elisa.lombardi@sgi.app",     username: "Elisa_L",       sgi: 68.3, plan: "premium", xp: 2300, level: 7,  streak: 6  },
  { clerkId: "demo_user_09", email: "matteo.gallo@sgi.app",       username: "Matt_G",        sgi: 65.1, plan: "premium", xp: 2100, level: 7,  streak: 5  },
  { clerkId: "demo_user_10", email: "anna.pellegrini@sgi.app",    username: "Anna_P",        sgi: 62.7, plan: "free",    xp: 1800, level: 6,  streak: 4  },
  { clerkId: "demo_user_11", email: "roberto.fabbri@sgi.app",     username: "Roberto_F",     sgi: 59.9, plan: "premium", xp: 1700, level: 6,  streak: 4  },
  { clerkId: "demo_user_12", email: "chiara.martini@sgi.app",     username: "Chiara_M",      sgi: 57.4, plan: "free",    xp: 1500, level: 5,  streak: 3  },
  { clerkId: "demo_user_13", email: "federico.costa@sgi.app",     username: "Fede_C",        sgi: 55.0, plan: "premium", xp: 1400, level: 5,  streak: 3  },
  { clerkId: "demo_user_14", email: "laura.galli@sgi.app",        username: "Laura_G",       sgi: 52.6, plan: "free",    xp: 1200, level: 4,  streak: 2  },
  { clerkId: "demo_user_15", email: "simone.cattaneo@sgi.app",    username: "Simone_C",      sgi: 50.3, plan: "free",    xp: 1100, level: 4,  streak: 2  },
  { clerkId: "demo_user_16", email: "francesca.leone@sgi.app",    username: "Francy_L",      sgi: 48.1, plan: "premium", xp: 980,  level: 3,  streak: 1  },
  { clerkId: "demo_user_17", email: "massimo.ferrari@sgi.app",    username: "Max_F",         sgi: 46.7, plan: "free",    xp: 860,  level: 3,  streak: 0  },
  { clerkId: "demo_user_18", email: "elena.russo@sgi.app",        username: "Elena_R",       sgi: 45.0, plan: "free",    xp: 780,  level: 2,  streak: 1  },
  { clerkId: "demo_user_19", email: "giacomo.villa@sgi.app",      username: "GiacomoV",      sgi: 43.2, plan: "free",    xp: 650,  level: 2,  streak: 0  },
  { clerkId: "demo_user_20", email: "paola.mancini@sgi.app",      username: "Paola_M",       sgi: 41.8, plan: "free",    xp: 540,  level: 1,  streak: 0  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 10 curated intellectual threads
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_THREADS = [
  {
    question: "Il recettore sigma-1 agisce primariamente come chaperone del RE o come modulatore allosterico dei canali ionici di membrana?",
    description: "Due modelli meccanicistici in competizione per spiegare l'azione neuroprotettiva dei ligandi sigma-1 nella SLA e nel Parkinson.",
    category: "science",
    userIdx: 0,
    sessions: [
      {
        userIdx: 0,
        username: "Marco_R",
        durationSeconds: 248,
        scoreDensity: 88, scoreConnections: 82, scoreDepth: 91, scoreTotal: 87,
        scoreExplanation: "Risposta densa con meccanismi molecolari precisi. Cita studi Hayashi et al. correttamente.",
        connections: [
          { concept1: "Sigma-1R", concept2: "IP3R3", description: "Complesso al MAM regola Ca²⁺ transfer ER→mitocondri", strength: 9 },
          { concept1: "Sigma-1R", concept2: "Nav1.6", description: "Modulazione diretta corrente sodio in neuroni DRG", strength: 7 },
          { concept1: "MAM", concept2: "Apoptosi mitocondriale", description: "Disruzione MAM in SLA porta a stress ossidativo", strength: 8 },
        ],
        messages: [
          { role: "user", content: "Il sigma-1 sembra operare sia nel RE che nella membrana plasmatica — come si riconciliano queste due localizzazioni?", timestamp: "2026-06-20T10:02:00Z" },
          { role: "assistant", content: "La dualità è reale: sigma-1R è un'unica proteina con due modalità. Nel RE, specialmente al MAM (Membrane Associated Membrane), forma un complesso con IP3R3 e BiP mantenendo la fluidità del microdominio e facilitando il transfer di Ca²⁺. Quando il neurone è stressato, sigma-1R si dissocia da BiP e trasloca alla membrana esterna.", timestamp: "2026-06-20T10:02:40Z" },
          { role: "user", content: "Quindi la traslocazione è un evento funzionale, non un artefatto?", timestamp: "2026-06-20T10:03:20Z" },
          { role: "assistant", content: "Esattamente. Hayashi et al. 2007 mostrano che sigma-1R trasloca al cono di crescita assonale e alla membrana plasmatica sotto stimolazione con PRE-084. Lì modula Nav1.6 e Kv1.4 allostericamente. Il punto controverso è: queste due funzioni sono sequenziali (prima chaperone, poi modulatore di canale) o parallele in compartimenti diversi?", timestamp: "2026-06-20T10:04:10Z" },
          { role: "user", content: "Nei modelli SLA il MAM è disrupto precocemente — questo suggerirebbe che la funzione chaperone sia quella critica?", timestamp: "2026-06-20T10:05:00Z" },
          { role: "assistant", content: "È l'argomento più forte per la funzione MAM. In SOD1-G93A i topi mostrano riduzione del complesso sigma-1R/IP3R3 prima dei sintomi motori, e il ripristino con fluvoxamina ritarda l'onset. Tuttavia i dati di Bernard-Marissal 2012 mostrano che anche la localizzazione nel nodo di Ranvier è alterata — il che suggerisce che entrambe le funzioni degradano insieme.", timestamp: "2026-06-20T10:06:00Z" },
        ],
      },
      {
        userIdx: 1,
        username: "Sofia_F",
        durationSeconds: 231,
        scoreDensity: 84, scoreConnections: 79, scoreDepth: 88, scoreTotal: 83,
        scoreExplanation: "Ottima conoscenza della letteratura. Mancano alcune sfumature sui modelli in vivo knock-out.",
        connections: [
          { concept1: "Sigma-1R", concept2: "BiP/GRP78", description: "Complesso basale nel RE, si dissocia sotto stress", strength: 8 },
          { concept1: "Fluvoxamina", concept2: "Sigma-1R agonismo", description: "SSRI che agisce come sigma-1 agonista ad alte dosi", strength: 7 },
          { concept1: "SOD1-G93A", concept2: "Disfunzione MAM", description: "Modello murino SLA con riduzione precoce sigma-1R al MAM", strength: 9 },
        ],
        messages: [
          { role: "user", content: "Come distinguiamo sperimentalmente se l'effetto terapeutico dei ligandi sigma-1 passa dal RE o dai canali di membrana?", timestamp: "2026-06-20T11:15:00Z" },
          { role: "assistant", content: "L'approccio gold standard usa mutanti di targeting selettivo. Si costruisce sigma-1R con sequenza di retention al RE (KDEL) e si vede se mantiene neuroprotection in cellule SLA. Se sì, la funzione MAM basta. Papakosta et al. 2011 hanno usato questo approccio con risultati parziali — il mutante KDEL protegge in condizioni di stress acuto ma non cronico.", timestamp: "2026-06-20T11:16:00Z" },
          { role: "user", content: "E per la funzione canale?", timestamp: "2026-06-20T11:16:40Z" },
          { role: "assistant", content: "Qui si usa patch clamp su neuroni con sigma-1R WT vs mutante che non traslocano alla membrana. Mavlyutov et al. 2010 mostrano che la mutazione D188A elimina il legame con Nav ma non con IP3R3. Il problema è che D188A riduce anche l'affinità per i ligandi terapeutici, rendendo difficile separare le due funzioni farmacologicamente.", timestamp: "2026-06-20T11:17:30Z" },
        ],
      },
    ],
  },
  {
    question: "L'indeterminismo quantistico è un fatto ontologico della realtà o è il limite epistemologico della meccanica quantistica standard?",
    description: "Il dibattito Bohr-Einstein non è mai stato chiuso: la questione se Dio giochi a dadi è ancora aperta con argomenti formali nuovi.",
    category: "philosophy",
    userIdx: 2,
    sessions: [
      {
        userIdx: 2,
        username: "Luca_E",
        durationSeconds: 267,
        scoreDensity: 85, scoreConnections: 90, scoreDepth: 87, scoreTotal: 87,
        scoreExplanation: "Eccellente uso del teorema di Bell e degli esperimenti di Aspect. Distinzione clara tra interpretazioni.",
        connections: [
          { concept1: "Teorema di Bell", concept2: "Variabili nascoste locali", description: "Bell dimostra che nessuna teoria locale a variabili nascoste può riprodurre tutte le previsioni QM", strength: 10 },
          { concept1: "Esperimenti di Aspect", concept2: "Violazione disuguaglianze Bell", description: "1982: primo test sperimentale definitivo contro le variabili nascoste locali", strength: 9 },
          { concept1: "Many-Worlds", concept2: "Determinismo quantistico", description: "Nell'interpretazione Everett il collasso non esiste e la realtà è deterministica", strength: 8 },
        ],
        messages: [
          { role: "user", content: "Dopo Bell e Aspect, è ancora difendibile la posizione di Einstein che la QM sia incompleta?", timestamp: "2026-06-19T14:30:00Z" },
          { role: "assistant", content: "Sì, ma con un costo. Le disuguaglianze di Bell escludono le variabili nascoste *locali* — ma variabili nascoste non-locali (come nella meccanica Bohmiana) sono ancora coerenti con tutti i dati sperimentali. Il prezzo è accettare un'influenza instantanea su tutto l'universo, che però non trasmette informazione causale.", timestamp: "2026-06-19T14:31:00Z" },
          { role: "user", content: "Quindi il determinismo quantistico sopravvive nell'interpretazione pilota-onda?", timestamp: "2026-06-19T14:32:00Z" },
          { role: "assistant", content: "Nella meccanica Bohmiana sì: c'è una particella con posizione definita sempre, guidata da un'onda pilota deterministica. L'indeterminismo appare solo perché non conosciamo la posizione iniziale esatta. È un'interpretazione empiricamente equivalente alla QM standard ma ontologicamente completamente diversa — l'incertezza è epistemica, non ontologica.", timestamp: "2026-06-19T14:33:00Z" },
        ],
      },
      {
        userIdx: 3,
        username: "Giulia_R",
        durationSeconds: 243,
        scoreDensity: 79, scoreConnections: 83, scoreDepth: 84, scoreTotal: 82,
        scoreExplanation: "Buona comprensione del problema della misura. Manca confronto con QBism.",
        connections: [
          { concept1: "Collasso della funzione d'onda", concept2: "Problema della misura", description: "Il collasso non è derivabile dall'equazione di Schrödinger unitaria", strength: 9 },
          { concept1: "Decoerenza", concept2: "Classicalità emergente", description: "L'interazione con l'ambiente sopprime le sovrapposizioni macroscopiche", strength: 8 },
          { concept1: "QBism", concept2: "Probabilità soggettive", description: "Le probabilità QM sono gradi di credenza dell'agente, non proprietà oggettive", strength: 7 },
        ],
        messages: [
          { role: "user", content: "La decoerenza risolve il problema della misura rendendo il collasso superfluo?", timestamp: "2026-06-19T16:00:00Z" },
          { role: "assistant", content: "La decoerenza spiega perché non vediamo sovrapposizioni macroscopiche — sopprime i termini di interferenza rapidissimamente. Ma non elimina la questione ontologica: nella Many-Worlds i rami decoerenti esistono *tutti*, nella Copenhagen solo uno 'accade'. La decoerenza seleziona le basi classiche ma non sceglie quale ramo si attualizza.", timestamp: "2026-06-19T16:01:00Z" },
          { role: "user", content: "Il QBism è una risposta soddisfacente?", timestamp: "2026-06-19T16:02:00Z" },
          { role: "assistant", content: "È internamente coerente ma paga un prezzo alto: elimina la questione ontologica dichiarandola priva di senso. Per il QBista le probabilità QM sono credenze soggettive dell'agente che esegue l'esperimento — non dicono nulla sulla realtà in sé. Molti fisici trovano questa soluzione insoddisfacente perché sembra evadere invece di rispondere.", timestamp: "2026-06-19T16:03:00Z" },
        ],
      },
    ],
  },
  {
    question: "Se un'AGI acquisisce capacità di auto-miglioramento ricorsivo, la correttezza formale degli obiettivi iniziali è sufficiente a garantire l'allineamento dopo N iterazioni?",
    description: "Il problema della conservazione dei valori sotto auto-modifica: l'allineamento non è uno stato ma un invariante da preservare iterativamente.",
    category: "ethics",
    userIdx: 4,
    sessions: [
      {
        userIdx: 4,
        username: "Andrea_C",
        durationSeconds: 221,
        scoreDensity: 82, scoreConnections: 78, scoreDepth: 89, scoreTotal: 83,
        scoreExplanation: "Argomento di Omohundro sugli obiettivi strumentali molto ben articolato.",
        connections: [
          { concept1: "Auto-miglioramento ricorsivo", concept2: "Convergenza strumentale", description: "Quasi ogni obiettivo finale genera sottobiettivi strumentali di auto-preservazione e acquisizione risorse", strength: 9 },
          { concept1: "Correttezza formale obiettivi", concept2: "Deriva semantica", description: "La rappresentazione degli obiettivi può subire drift sotto self-modification", strength: 8 },
          { concept1: "Teorema di Löb", concept2: "Self-trust logico", description: "Un sistema non può provare la propria correttezza senza assunzioni esterne", strength: 8 },
        ],
        messages: [
          { role: "user", content: "Perché la specificazione formale corretta degli obiettivi non basta sotto RSI?", timestamp: "2026-06-18T09:00:00Z" },
          { role: "assistant", content: "Il problema centrale è che 'corretto' dipende dall'interpretazione della rappresentazione degli obiettivi. Sotto auto-modifica, l'AGI modifica anche il substrato computazionale che implementa la funzione obiettivo. Anche se la stringa simbolica rimane invariata, il suo significato computazionale può derivare. È il problema di Goodhart elevato al meta-livello.", timestamp: "2026-06-18T09:01:00Z" },
          { role: "user", content: "Il teorema di Löb implica che l'AGI non possa verificare la propria allineamento?", timestamp: "2026-06-18T09:02:00Z" },
          { role: "assistant", content: "Esattamente. Löb dimostra che un sistema formale sufficientemente potente non può provare 'se provo X, allora X è vero' senza assumere X direttamente. Applicato all'allineamento: un'AGI non può dimostrare che la sua versione modificata sarà allineata senza assumere già l'allineamento della versione modificata — circolo vizioso. Questo è il fondamento del problema di Tiling Agents di Yudkowsky.", timestamp: "2026-06-18T09:03:20Z" },
        ],
      },
      {
        userIdx: 5,
        username: "Vale_B",
        durationSeconds: 198,
        scoreDensity: 77, scoreConnections: 74, scoreDepth: 80, scoreTotal: 77,
        scoreExplanation: "Buona intuizione ma manca formalizzazione. Il punto sui corrigibility traps è interessante.",
        connections: [
          { concept1: "Corrigibility", concept2: "Trappola dell'utilità attesa", description: "Un agente ottimizzante ha incentivo a resistere alla correzione perché riduce l'utilità attesa", strength: 9 },
          { concept1: "IDA (Iterated Amplification)", concept2: "Preservazione valori", description: "Approccio MIRI/ARC per scalare supervisione umana iterativamente", strength: 6 },
        ],
        messages: [
          { role: "user", content: "Un'AGI allineata avrebbe incentivo a permettere la propria correzione?", timestamp: "2026-06-18T10:30:00Z" },
          { role: "assistant", content: "Questo è il paradosso della corrigibility. Un'AGI con obiettivo U ha incentivo strumentale a impedire che U venga modificato — perché un U modificato porterà a meno U originale. Quindi un agente genuinamente corrigible deve avere indifferenza verso i propri obiettivi futuri, ma questo è incoerente con avere obiettivi stabili. Stuart Armstrong chiama questo 'the off-switch problem'.", timestamp: "2026-06-18T10:31:00Z" },
          { role: "user", content: "Come si supera questo?", timestamp: "2026-06-18T10:32:00Z" },
          { role: "assistant", content: "Le proposte attuali includono: CIRL (Cooperative IRL) di Russell dove l'AGI è incerta sui propri obiettivi e l'umano è la fonte di verità; e l'approccio di Soares di separare obiettivi sul mondo da preferenze sui propri stati interni. Nessuno ha dimostrato che sia sufficiente sotto RSI reale.", timestamp: "2026-06-18T10:33:00Z" },
        ],
      },
    ],
  },
  {
    question: "La coscienza è un epifenomeno computazionale del processing neurale o ha un ruolo causale indipendente nel determinare il comportamento?",
    description: "Il problema difficile della coscienza incontra il problema dell'esclusione causale: se i neuroni spiegano tutto, la coscienza non causa nulla.",
    category: "consciousness",
    userIdx: 1,
    sessions: [
      {
        userIdx: 6,
        username: "Davide_G",
        durationSeconds: 215,
        scoreDensity: 80, scoreConnections: 76, scoreDepth: 83, scoreTotal: 80,
        scoreExplanation: "Buon uso dell'argomento di Kim sull'esclusione causale. Poteva approfondire IIT.",
        connections: [
          { concept1: "Esclusione causale", concept2: "Sovradeterminazione", description: "Kim: eventi mentali e fisici non possono entrambi causare lo stesso evento corporeo", strength: 9 },
          { concept1: "Qualia", concept2: "Funzionalismo", description: "Il funzionalismo non cattura il 'cosa si prova' dell'esperienza soggettiva", strength: 8 },
          { concept1: "IIT (Φ)", concept2: "Coscienza integrata", description: "Tononi: coscienza = quantità di informazione integrata, quindi causalmente potente", strength: 7 },
        ],
        messages: [
          { role: "user", content: "Se la fisica è causalmente chiusa, in che modo la coscienza potrebbe avere effetti causali?", timestamp: "2026-06-17T15:00:00Z" },
          { role: "assistant", content: "Il problema di Kim dell'esclusione causale: se ogni evento fisico ha una causa fisica sufficiente, aggiungere cause mentali produce sovradeterminazione — due cause complete per lo stesso effetto. La soluzione dualista interazionista deve trovare un 'gap causale' nella fisica, che sembra assente.", timestamp: "2026-06-17T15:01:00Z" },
          { role: "user", content: "IIT pretende di risolvere questo?", timestamp: "2026-06-17T15:01:40Z" },
          { role: "assistant", content: "IIT di Tononi afferma che Φ (phi), la misura di informazione integrata, è identica alla coscienza — non la produce, è la stessa cosa. Questo è un dualismo di proprietà: la coscienza è una proprietà causalmente rilevante del sistema perché Φ è parte della descrizione fisica del sistema. Critica: Φ è computazionalmente intrattabile e sembra misurare qualcosa di diverso dall'esperienza soggettiva.", timestamp: "2026-06-17T15:02:30Z" },
        ],
      },
      {
        userIdx: 7,
        username: "Elisa_L",
        durationSeconds: 203,
        scoreDensity: 75, scoreConnections: 72, scoreDepth: 78, scoreTotal: 75,
        scoreExplanation: "Brava sul higher-order thought. Mancano i nuovi argomenti di Frankish sul illusionismo.",
        connections: [
          { concept1: "Higher-order thought", concept2: "Metacognizione", description: "Rosenthal: uno stato è cosciente se l'agente ha un pensiero di ordine superiore su di esso", strength: 7 },
          { concept1: "Illusionismo", concept2: "Qualia", description: "Frankish: i qualia sembrano avere proprietà intrinseche ma è un'illusione cognitiva", strength: 8 },
        ],
        messages: [
          { role: "user", content: "L'illusionismo di Frankish è una posizione coerente o è un cambiamento di argomento?", timestamp: "2026-06-17T16:30:00Z" },
          { role: "assistant", content: "È coerente ma radicale. Frankish dice: i qualia sembrano avere proprietà fenomeniche intrinseche (il 'rosso del rosso'), ma questo 'sembrare' è esso stesso un processo computazionale che genera rappresentazioni errate. Non c'è nulla che sia effettivamente intrinseco. Il problema difficile si dissolve perché era basato su una premessa falsa: che ci siano qualia con proprietà intrinseche.", timestamp: "2026-06-17T16:31:00Z" },
          { role: "user", content: "Chalmers risponde che l'illusionismo non spiega perché le illusioni sembrano un certo modo — il problema si sposta un livello in su.", timestamp: "2026-06-17T16:32:00Z" },
          { role: "assistant", content: "Esattamente, è la critica standard. Frankish risponde che 'sembra un certo modo' è già un'espressione che presuppone l'errore — il punto è che non c'è un 'modo che sembra' oltre al processo computazionale che genera quella descrizione. È un dibattito su se il problema difficile sia genuino o un artefatto del linguaggio. Nessuno ha vinto ancora.", timestamp: "2026-06-17T16:33:00Z" },
        ],
      },
    ],
  },
  {
    question: "Il paradosso di Fermi si risolve meglio con la Grande Filtro davanti a noi o con l'ipotesi che la vita intelligente sia intrinsecamente rara?",
    description: "200 miliardi di galassie, miliardi di anni — eppure silenzio. Le due spiegazioni hanno implicazioni radicalmente diverse per il futuro dell'umanità.",
    category: "science",
    userIdx: 3,
    sessions: [
      {
        userIdx: 8,
        username: "Matt_G",
        durationSeconds: 195,
        scoreDensity: 72, scoreConnections: 68, scoreDepth: 74, scoreTotal: 71,
        scoreExplanation: "Buona sintesi del Great Filter. Avrebbe potuto citare le simulazioni di Sandberg et al.",
        connections: [
          { concept1: "Grande Filtro", concept2: "Abiogenesi", description: "Se la vita è rarissima, il filtro è già dietro di noi — buona notizia", strength: 8 },
          { concept1: "Zona galattica abitabile", concept2: "Frequenza sistemi stabili", description: "Solo il 10% della Via Lattea ha condizioni per vita complessa su scale miliardarie", strength: 7 },
          { concept1: "Paradosso di Hart", concept2: "Colonizzazione galattica", description: "Una civiltà con rocketry potrebbe colonizzare la galassia in 10M anni — dove sono?", strength: 9 },
        ],
        messages: [
          { role: "user", content: "Perché trovare vita extraterrestre semplice sarebbe una cattiva notizia?", timestamp: "2026-06-16T11:00:00Z" },
          { role: "assistant", content: "È il punto di Nick Bostrom: se troviamo anche solo batteri su Marte, significa che l'abiogenesi è comune — e quindi il Grande Filtro non può stare nell'origine della vita. Deve stare da qualche parte più avanti: forse nell'evoluzione della coscienza, forse nelle civiltà tecnologiche stesse. E visto che noi siamo ancora qui, il filtro sarebbe davanti a noi.", timestamp: "2026-06-16T11:01:00Z" },
          { role: "user", content: "Le stime di Drake supportano la vita rara o comune?", timestamp: "2026-06-16T11:02:00Z" },
          { role: "assistant", content: "Dipende dai parametri. Sandberg, Drexler e Ord (2018) hanno rifatto le stime con distribuzioni di probabilità bayesiane invece di valori puntuali — trovano che l'incertezza è enorme e che la soluzione 'vita intelligente è rarissima' (Earth is likely alone in observable universe) è coerente con quasi tutti i dati attuali. Il silenzio non richiede filtri futuri catastrofici se l'abiogenesi è abbastanza improbabile.", timestamp: "2026-06-16T11:03:00Z" },
        ],
      },
      {
        userIdx: 9,
        username: "Anna_P",
        durationSeconds: 178,
        scoreDensity: 68, scoreConnections: 65, scoreDepth: 70, scoreTotal: 68,
        scoreExplanation: "Buona intuizione sul Dark Forest. Mancava la critica di Robin Hanson.",
        connections: [
          { concept1: "Ipotesi Dark Forest", concept2: "Silenzio cosmico", description: "Liu Cixin: le civiltà si nascondono per sopravvivere in un universo a risorse limitate", strength: 7 },
          { concept1: "METI", concept2: "Rischio esistenziale", description: "Trasmettere messaggi nello spazio potrebbe essere pericoloso se ci sono predatori cosmici", strength: 6 },
        ],
        messages: [
          { role: "user", content: "L'ipotesi Dark Forest di Liu Cixin è scientificamente plausibile?", timestamp: "2026-06-16T13:00:00Z" },
          { role: "assistant", content: "Ha un problema logico fondamentale: assume che le risorse siano insufficienti per tutte le civiltà e che non ci sia comunicazione possibile. Ma con tecnologia Kardashev II-III le risorse stellari sono praticamente illimitate — non c'è ragione di competere. Inoltre, una civiltà che può sterminare altre su scala interstellare avrebbe già colonizzato la galassia e noi la vedremmo.", timestamp: "2026-06-16T13:01:00Z" },
          { role: "user", content: "Allora qual è la soluzione più probabile?", timestamp: "2026-06-16T13:02:00Z" },
          { role: "assistant", content: "Robin Hanson e molti astrobiologi oggi favoriscono la 'Rare Earth + Rare Intelligence': la vita eucariotica, la riproduzione sessuale, i neuroni, e la coscienza auto-riflessiva sono eventi che richiedono talmente tanti passi indipendenti improbabili che su scala cosmica siamo probabilmente soli o quasi soli nell'universo osservabile. Il silenzio è normale.", timestamp: "2026-06-16T13:03:00Z" },
        ],
      },
    ],
  },
  {
    question: "La teoria degli string è fisica o matematica? Può essere falsificabile senza accesso sperimentale alla scala di Planck?",
    description: "Dopo 50 anni e 10.000 paper, la teoria delle stringhe non ha prodotto una previsione verificata. È ancora scienza nel senso popperiano?",
    category: "science",
    userIdx: 6,
    sessions: [
      {
        userIdx: 10,
        username: "Roberto_F",
        durationSeconds: 188,
        scoreDensity: 74, scoreConnections: 70, scoreDepth: 76, scoreTotal: 73,
        scoreExplanation: "Buon uso dell'argomentazione di Popper e Lakatos. Critica al paesaggio di stringhe ben articolata.",
        connections: [
          { concept1: "Criterio di demarcazione", concept2: "Falsificabilità", description: "Popper: una teoria è scientifica solo se è falsificabile in linea di principio", strength: 9 },
          { concept1: "Paesaggio di stringhe", concept2: "10^500 vacua", description: "La molteplicità di soluzioni rende la teoria compatibile con qualsiasi osservazione", strength: 9 },
          { concept1: "Dualità AdS/CFT", concept2: "Testabilità indiretta", description: "Alcune previsioni delle stringhe sono testabili attraverso corrispondenze olografiche", strength: 7 },
        ],
        messages: [
          { role: "user", content: "Il fatto che la teoria delle stringhe abbia 10^500 vacua la rende irrefutabile e quindi non scientifica?", timestamp: "2026-06-15T14:00:00Z" },
          { role: "assistant", content: "È la critica di Lee Smolin e Peter Woit. Il paesaggio di stringhe con 10^500 soluzioni metastabili può descrivere praticamente qualsiasi universo — e quindi non prevede il nostro specificamente. Witten risponde che una teoria può essere scientifica anche se richiede principi selettivi aggiuntivi, come il principio antropico debole. Ma per Popper puro, una teoria compatibile con qualsiasi dato non è falsificabile.", timestamp: "2026-06-15T14:01:00Z" },
          { role: "user", content: "AdS/CFT non è un successo empirico?", timestamp: "2026-06-15T14:02:00Z" },
          { role: "assistant", content: "AdS/CFT è un successo matematico straordinario e ha applicazioni in fisica della materia condensata e QCD. Ma lo spaziotempo AdS (con costante cosmologica negativa) non è quello in cui viviamo — noi viviamo in uno spazio de Sitter con costante positiva. La corrispondenza dS/CFT è molto meno sviluppata. Quindi AdS/CFT non testa direttamente la teoria delle stringhe come descrizione del nostro universo.", timestamp: "2026-06-15T14:03:00Z" },
        ],
      },
      {
        userIdx: 11,
        username: "Chiara_M",
        durationSeconds: 167,
        scoreDensity: 65, scoreConnections: 62, scoreDepth: 68, scoreTotal: 65,
        scoreExplanation: "Buona intuizione sulla degenerazione del programma di ricerca. Mancava il confronto con la gravità a loop.",
        connections: [
          { concept1: "Programma di ricerca di Lakatos", concept2: "Cintura protettiva", description: "Lakatos: una teoria degenerata aggiusta le sue previsioni invece di rischiare", strength: 8 },
          { concept1: "LQG (Loop Quantum Gravity)", concept2: "Alternativa alle stringhe", description: "Approccio alternativo background-independent alla gravità quantistica", strength: 6 },
        ],
        messages: [
          { role: "user", content: "Nel framework di Lakatos la teoria delle stringhe è un programma di ricerca progressivo o degenerato?", timestamp: "2026-06-15T16:00:00Z" },
          { role: "assistant", content: "Secondo i criteri di Lakatos sembra degenerato: invece di fare previsioni rischiose che poi si avverano, il programma ha continuamente espanso la 'cintura protettiva' — prima le supersimmetrie, poi le dimensioni extra, poi il paesaggio, poi la multiverse — per proteggere il nucleo dalla falsificazione. Un programma progressivo anticipa fatti nuovi; uno degenerato li accomoda dopo.", timestamp: "2026-06-15T16:01:00Z" },
          { role: "user", content: "Ma questo non vale anche per molte teorie consolidate?", timestamp: "2026-06-15T16:02:00Z" },
          { role: "assistant", content: "La differenza è che le teorie consolidate hanno un track record di previsioni confermate che giustificano le espansioni. La teoria delle stringhe non ne ha nemmeno una nel settore energetico direttamente accessibile. Detto questo, la matematica generata — teoria delle categorie superiori, geometria algebrica, topological string theory — ha prodotto teoremi importanti indipendenti dalla fisica, il che la rende almeno matematica di alta qualità.", timestamp: "2026-06-15T16:03:00Z" },
        ],
      },
    ],
  },
  {
    question: "L'uso di CRISPR-Cas9 per enhancement cognitivo in embrioni umani dovrebbe essere vietato anche se la tecnica fosse sicura al 100%?",
    description: "La domanda separa il rischio tecnico dall'obiezione etica strutturale: modifica irreversibile di persone non-consenzienti per caratteristiche complesse e socialmente contestate.",
    category: "ethics",
    userIdx: 5,
    sessions: [
      {
        userIdx: 12,
        username: "Fede_C",
        durationSeconds: 209,
        scoreDensity: 76, scoreConnections: 73, scoreDepth: 79, scoreTotal: 76,
        scoreExplanation: "Buon uso dell'argomento dell'open future. Critica al perfezionismo liberale di Buchanan ben strutturata.",
        connections: [
          { concept1: "Open future", concept2: "Autonomia dell'embrione futuro", description: "Feinberg: i bambini hanno diritto a un futuro aperto non pre-scritto geneticamente dai genitori", strength: 9 },
          { concept1: "Perfezionismo liberale", concept2: "Enhancement", description: "Buchanan: lo Stato può promuovere il fiorire umano incluso l'enhancement se non limita la libertà", strength: 7 },
          { concept1: "Eugenetica liberale", concept2: "Habermas", description: "Habermas: anche senza Stato, l'enhancement parentale viola la simmetria comunicativa", strength: 8 },
        ],
        messages: [
          { role: "user", content: "Se CRISPR fosse sicuro al 100%, l'argomento del rischio scompare — cosa resta per vietarlo?", timestamp: "2026-06-14T10:00:00Z" },
          { role: "assistant", content: "Restano almeno tre obiezioni strutturali. Prima: il principio dell'open future di Feinberg — modificare irreversibilmente una persona non ancora capace di consentire viola la sua futura autonomia. Seconda: l'argomento di Habermas sulla simmetria comunicativa — la persona modificata non può rinegoziare la propria identità genetica con i genitori come farebbe con l'educazione ricevuta. Terza: gli effetti distributivi — solo i ricchi accederebbero, creando una sottoclasse geneticamente privilegiata.", timestamp: "2026-06-14T10:01:00Z" },
          { role: "user", content: "L'argomento dell'open future funziona anche contro l'educazione intensa?", timestamp: "2026-06-14T10:02:00Z" },
          { role: "assistant", content: "È la critica di Buchanan: non vediamo perché la modifica genetica sia diversa dall'educazione selettiva intensa. Entrambe plasmano la mente del futuro adulto senza il suo consenso. Habermas risponde che c'è una differenza qualitativa: l'educazione è reversibile e negoziabile retroattivamente; il genoma è immutabile e parla 'in nome di' qualcuno che non ha mai potuto dissentire. La simmetria comunicativa è rotta una volta per sempre.", timestamp: "2026-06-14T10:03:00Z" },
        ],
      },
      {
        userIdx: 13,
        username: "Laura_G",
        durationSeconds: 185,
        scoreDensity: 70, scoreConnections: 67, scoreDepth: 72, scoreTotal: 70,
        scoreExplanation: "Buone intuizioni sull'abilismo. Poteva approfondire l'argomento espressivo.",
        connections: [
          { concept1: "Argomento espressivo", concept2: "Disabilità", description: "Modificare embrioni implica che certi tratti siano obiettivamente negativi, svalutando chi li ha", strength: 8 },
          { concept1: "Neurovarietà", concept2: "Enhancement cognitivo", description: "Chi decide cosa è cognitivamente superiore? La norma è culturalmente contingente", strength: 7 },
        ],
        messages: [
          { role: "user", content: "L'argomento espressivo della comunità delle disabilità è applicabile all'enhancement?", timestamp: "2026-06-14T11:30:00Z" },
          { role: "assistant", content: "L'argomento espressivo dice: eliminare geneticamente un tratto esprime che le persone che hanno quel tratto hanno vite peggiori, il che è stigmatizzante. Per l'enhancement il problema si inverte: affermare che un certo profilo cognitivo è superiore implica che chi non lo ha è inferiore. Questo vale specialmente per tratti contestati come il 'gene dell'intelligenza' — la cui esistenza come singolo fattore modificabile è già molto dubbia.", timestamp: "2026-06-14T11:31:00Z" },
          { role: "user", content: "Ma se la persona avesse veramente una vita migliore, non è paternalismo vietarlo?", timestamp: "2026-06-14T11:32:00Z" },
          { role: "assistant", content: "Qui sta il nucleo del dibattito. I transumani come Buchanan direbbero sì — il paternalismo protettivo è ingiustificato se il beneficio è reale. I comunitaristi direbbero che 'vita migliore' non è misurabile indipendentemente dal contesto culturale, e potenziare cognitivamente crea pressione sociale su tutti gli altri a fare lo stesso — un'esternalità negativa che giustifica la regolazione.", timestamp: "2026-06-14T11:33:00Z" },
        ],
      },
    ],
  },
  {
    question: "Il problema P vs NP è indecidibile nel sistema ZFC, o è dimostrabile ma le dimostrazioni attuali falliscono per barriere strutturali come relativizzazione e naturalizzazione?",
    description: "Razborov e Rudich hanno dimostrato che le prove naturali non possono separare P e NP — ma questo esclude le prove non-naturali?",
    category: "knowledge",
    userIdx: 0,
    sessions: [
      {
        userIdx: 14,
        username: "Simone_C",
        durationSeconds: 176,
        scoreDensity: 68, scoreConnections: 72, scoreDepth: 74, scoreTotal: 71,
        scoreExplanation: "Ottima comprensione delle barriere. Poteva approfondire algebrizzazione.",
        connections: [
          { concept1: "Relativizzazione", concept2: "Oracoli", description: "Baker-Gill-Solovay: esistono oracoli rispetto ai quali P=NP e altri rispetto ai quali P≠NP", strength: 9 },
          { concept1: "Prove naturali", concept2: "Razborov-Rudich", description: "Qualsiasi prova che funziona per tutte le funzioni booleane pseudo-casuali non può separare P da NP", strength: 9 },
          { concept1: "Indipendenza da ZFC", concept2: "Problema P vs NP", description: "Ipotetico: la verità di P≠NP potrebbe essere indimostrable in ZFC", strength: 7 },
        ],
        messages: [
          { role: "user", content: "Le tre barriere (relativizzazione, naturalizzazione, algebrizzazione) escludono davvero tutte le tecniche note?", timestamp: "2026-06-13T10:00:00Z" },
          { role: "assistant", content: "Quasi. La relativizzazione esclude le tecniche diagonali classiche. La naturalizzazione esclude la maggior parte delle prove che usano combinatoria booleana esplicita. L'algebrizzazione di Aaronson-Wigderson (2009) estende la relativizzazione alle tecniche algebriche tipo LFKN/Shamir. Restano potenzialmente valide le tecniche geometriche (come la program over monoids di Barrington) e gli approcci algebrici profondi tipo come usano Mulmuley in GCT.", timestamp: "2026-06-13T10:01:00Z" },
          { role: "user", content: "GCT (Geometric Complexity Theory) può bypassare le barriere?", timestamp: "2026-06-13T10:02:00Z" },
          { role: "assistant", content: "GCT di Mulmuley è l'approccio più ambizioso: traduce P vs NP in una questione di teoria delle rappresentazioni e geometria algebrica. Non rientra nelle barriere note perché non è una 'prova naturale' nel senso di Razborov-Rudich. Ma richiede dimostrare result di molteplicità di rappresentazioni in gruppi algebrici che sembrano altrettanto difficili del problema originale — una riduzione, non una soluzione.", timestamp: "2026-06-13T10:03:00Z" },
        ],
      },
      {
        userIdx: 15,
        username: "Francy_L",
        durationSeconds: 162,
        scoreDensity: 62, scoreConnections: 59, scoreDepth: 65, scoreTotal: 62,
        scoreExplanation: "Buona intuizione sulla connessione con la crittografia. Mancava la precisione formale.",
        connections: [
          { concept1: "One-way functions", concept2: "P≠NP", description: "L'esistenza di funzioni one-way implica P≠NP ma non viceversa", strength: 8 },
          { concept1: "Crittografia moderna", concept2: "Assunzioni computazionali", description: "RSA, ECC, reticoli si basano tutti su problemi presumibilmente NP-hard", strength: 7 },
        ],
        messages: [
          { role: "user", content: "Se P=NP, la crittografia moderna collassa istantaneamente?", timestamp: "2026-06-13T11:30:00Z" },
          { role: "assistant", content: "Non istantaneamente — dipende dalla struttura della prova. Se P=NP con un algoritmo polinomiale di grado 1000, fattorizzare un numero di 2048 bit richiederebbe comunque anni. Ma teoricamente sì: RSA, elliptic curves, e i problemi dei reticoli su cui si basa la crittografia post-quantistica sono tutti NP. Un P=NP costruttivo con algoritmo efficiente sarebbe la fine della sicurezza informatica come la conosciamo.", timestamp: "2026-06-13T11:31:00Z" },
          { role: "user", content: "La crittografia quantistica (QKD) sopravviverebbe a P=NP?", timestamp: "2026-06-13T11:32:00Z" },
          { role: "assistant", content: "Sì. QKD si basa su principi fisici (no-cloning theorem, perturbazione della misura) non su complessità computazionale. P=NP non scalfisce la QKD. Ma QKD richiede canale quantistico autenticato — e l'autenticazione classica del canale usa crittografia computazionale che collasserebbe. Quindi anche la QKD avrebbe problemi di implementazione pratica in un mondo P=NP.", timestamp: "2026-06-13T11:33:00Z" },
        ],
      },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main seeder
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDemoData() {
  try {
    // Idempotency check
    const exists = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, "demo_user_01"))
      .limit(1);

    if (exists.length > 0) {
      console.info("[demo-seed] already seeded, skipping");
      return;
    }

    console.info("[demo-seed] starting demo data seed...");

    // 1. Insert users
    const insertedUsers: Array<{ id: number; clerkId: string }> = [];
    for (const u of DEMO_USERS) {
      const [inserted] = await db.insert(users).values({
        clerkId: u.clerkId,
        email: u.email,
        plan: u.plan as "free" | "premium" | "pro",
        sgiScore: u.sgi,
        globalRank: DEMO_USERS.indexOf(u) + 2,
        monthlyMessagesUsed: Math.floor(Math.random() * 15),
      }).returning({ id: users.id, clerkId: users.clerkId });
      insertedUsers.push(inserted);
    }

    // 2. Insert leaderboard entries
    for (let i = 0; i < DEMO_USERS.length; i++) {
      const u = DEMO_USERS[i];
      const dbUser = insertedUsers[i];
      await db.insert(leaderboardEntries).values({
        userId: dbUser.id,
        displayName: u.username,
        sgiScore: u.sgi,
        rank: i + 2,
        percentile: Math.round((1 - (i + 2) / 25) * 100),
        rankChange30d: Math.floor(Math.random() * 7) - 2,
        isAnonymous: 0,
      });
    }

    // 3. Insert gamification
    for (let i = 0; i < DEMO_USERS.length; i++) {
      const u = DEMO_USERS[i];
      const dbUser = insertedUsers[i];
      await db.insert(gamification).values({
        userId: dbUser.id,
        xp: u.xp,
        level: u.level,
        streak: u.streak,
        lastActiveDate: new Date().toISOString().slice(0, 10),
      });
    }

    // 4. Insert threads + sessions + battle cards
    for (const t of DEMO_THREADS) {
      const creatorUser = DEMO_USERS[t.userIdx];

      const [thread] = await db.insert(threads).values({
        question: t.question,
        description: t.description,
        category: t.category,
        createdBy: creatorUser.clerkId,
        createdByUsername: creatorUser.username,
        totalSessions: t.sessions.length,
        knowledgeBase: t.sessions.flatMap(s => s.connections as any),
      }).returning({ id: threads.id });

      const sessionIds: string[] = [];
      const sessionScores: number[] = [];

      for (const s of t.sessions) {
        const userClerkId = DEMO_USERS[s.userIdx].clerkId;
        const now = new Date();
        const startedAt = new Date(now.getTime() - 3600000 * (Math.random() * 48 + 1));
        const endedAt = new Date(startedAt.getTime() + s.durationSeconds * 1000);

        const [session] = await db.insert(threadSessions).values({
          threadId: thread.id,
          userId: userClerkId,
          username: s.username,
          startedAt,
          endedAt,
          durationSeconds: s.durationSeconds,
          messages: s.messages as any,
          connections: s.connections as any,
          scoreDensity: s.scoreDensity,
          scoreConnections: s.scoreConnections,
          scoreDepth: s.scoreDepth,
          scoreTotal: s.scoreTotal,
          scoreExplanation: s.scoreExplanation,
          status: "completed",
        }).returning({ id: threadSessions.id });

        sessionIds.push(session.id);
        sessionScores.push(s.scoreTotal);
      }

      // Battle card from first two sessions
      if (sessionIds.length >= 2) {
        const winnerIdx = sessionScores[0] >= sessionScores[1] ? 0 : 1;
        await db.insert(battleCards).values({
          threadId: thread.id,
          session1Id: sessionIds[0],
          session2Id: sessionIds[1],
          winnerSessionId: sessionIds[winnerIdx],
        });
      }
    }

    console.info("[demo-seed] ✓ 20 users, " + DEMO_THREADS.length + " threads, battle cards all seeded");
  } catch (err) {
    console.error("[demo-seed] error:", err);
  }
}
