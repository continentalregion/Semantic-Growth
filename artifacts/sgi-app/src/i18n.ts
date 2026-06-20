import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// ─── Italian (source of truth) ────────────────────────────────────────────────
const IT = {
  nav: {
    core: "Core", explore: "Esplora", game: "Gioco",
    dashboard: "Dashboard", chat: "Chat Semantica", rank: "Rank Globale",
    map: "Mappa Semantica", predictions: "Predizioni",
    growthPath: "Percorso di Crescita", progress: "Progressi",
    profile: "Profilo", settings: "Impostazioni", disconnect: "Disconnetti",
    premiumPlan: "Piano Premium",
    premiumDesc: "Chat illimitata · Analytics avanzata · Predizioni",
    upgrade: "Upgrade ✦",
  },
  home: {
    signIn: "Accedi", initConnection: "Inizia",
    live: "Telemetria cognitiva live online",
    headline: "Traccia l'evoluzione della tua mente.",
    sub: "Il Semantic Growth Index (SGI) è una piattaforma per tracciare l'evoluzione del tuo linguaggio, dell'esplorazione semantica e delle traiettorie cognitive osservabili nelle conversazioni.",
    beginTracking: "Inizia il Tracciamento", accessDashboard: "Accedi alla Dashboard",
    telemetryTitle: "Telemetria di Precisione",
    telemetryDesc: "Mappatura in tempo reale della tua complessità concettuale, varietà semantica e connessioni interdisciplinari.",
    mapsTitle: "Mappe Semantiche",
    mapsDesc: "Visualizza il tuo grafo della conoscenza. Guarda i nodi di comprensione connettersi mentre esplori nuovi domini.",
    rankTitle: "Percentile Globale",
    rankDesc: "Classifica anonima rispetto a migliaia di altri utenti. Misura la tua traiettoria di crescita.",
  },
  dashboard: {
    title: "Telemetria Hub", subtitle: "Tracciamento della crescita cognitiva in tempo reale",
    systemNominal: "SISTEMA NOMINALE", currentSgi: "SGI Attuale",
    globalRank: "Rank Globale", of: "di", tracked: "tracciati",
    weeklyGrowth: "Crescita Settimanale", monthlyGrowth: "Crescita Mensile",
    sgiPoints7: "punti SGI (7 giorni)", sgiPoints30: "punti SGI (30 giorni)",
    growing: "In crescita", needsAttention: "Richiede attenzione",
    topGlobally: "Top {{val}}% globale",
    trajectory: "Traiettoria SGI (30 Giorni)",
    dataPoints: "{{n}} punti · Partito da {{start}}",
    noHistory: "Nessuna cronologia — inizia una conversazione per cominciare",
    chatMore: "Chatta di più per popolare il grafico della traiettoria",
    thisWeek: "questa settimana",
    places30d: "{{dir}} {{n}} posizioni (30d)", start: "Inizio",
  },
  chat: {
    newExploration: "Nuova Esplorazione",
    usageCounter: "{{used}}/{{limit}} msg questo mese",
    fewLeft: "Solo {{n}} messaggi rimasti", limitReached: "Limite raggiunto",
    upgradePro: "Passa a Pro per 2.000 msg/mese e Opus",
    upgradeProBtn: "Upgrade a Pro — €19.99",
    upgradePremiumBtn: "Upgrade a Premium — €9.99",
    placeholder: "Inizia l'esplorazione. La profondità della tua indagine forma la tua traiettoria semantica.",
    sgiUpdate: "aggiornamento SGI",
    modelLockedToast: "{{model}} richiede il piano {{plan}}. Vai su Impostazioni.",
    failedCreate: "Impossibile creare la conversazione",
    failedDelete: "Impossibile eliminare la conversazione",
  },
  leaderboard: {
    title: "Il tuo Rank",
    subtitle: "La tua posizione nell'ecosistema semantico globale — solo tu puoi vedere questo dato.",
    position: "Posizione", notRanked: "non ancora classificato",
    surpassed: "Hai superato il {{pct}}% degli utenti tracciati",
    top1: "Top 1%", top10: "Top 10%", top25: "Top 25%", top50: "Top 50%",
    growing: "In crescita", yourSgi: "Il tuo SGI", sgiDesc: "indice di crescita semantica",
    communityAvg: "Media community", aboveAvg: "+{{n}} sopra la media",
    belowAvg: "{{n}} sotto la media", totalTracked: "Utenti tracciati",
    inNetwork: "nella rete SGI", peakSgi: "Picco assoluto", peakDesc: "SGI più alto registrato",
    thresholds: "Soglie di eccellenza", reached: "✓ raggiunto",
    lacking: "SGI {{threshold}}+ (ti mancano {{gap}})",
    privacyTitle: "Classifica privata",
    privacyDesc: "La classifica completa non è pubblica. Ogni utente vede solo la propria posizione. Il tuo rank è calcolato in forma anonima rispetto alla community senza esporre i dati degli altri.",
    noRankYet: "Il tuo rank apparirà dopo le prime conversazioni. Inizia a esplorare per essere classificato.",
  },
  settings: {
    title: "Impostazioni", subtitle: "Configurazione account e gestione abbonamento",
    account: "Account", email: "Email", currentPlan: "Piano attuale",
    planDesc: "Il tuo tier di abbonamento", memberSince: "Membro dal",
    sgiScore: "SGI Score", sgiScoreDesc: "Indice di crescita semantica",
    upgrade: "Upgrade", currentPlanBtn: "Piano attuale", activateBtn: "Attiva {{name}}",
    proActive: "Pro Attivo",
    proActiveDesc: "Hai accesso completo a tutti i modelli AI, 2.000 messaggi al mese, predizioni avanzate e analisi personalizzata.",
    premiumActive: "Premium Attivo",
    premiumActiveDesc: "Hai 600 messaggi al mese con accesso a Haiku e Sonnet. Passa a Pro per Opus, GPT-4o e 2.000 messaggi.",
    privacy: "Privacy", publicRank: "Classifica pubblica",
    publicRankDesc: "Il tuo nome è anonimizzato sulla leaderboard",
    anonymous: "Anonimo",
    privacyNotice: "SGI traccia i pattern semantici e linguistici delle tue conversazioni. Nessun contenuto personalmente identificabile viene conservato. Il testo viene processato esclusivamente per generare il tuo indice di crescita.",
    modalTitle: "Attiva {{name}}",
    modalDesc: "Il pagamento è in sviluppo. I piani saranno disponibili appena il checkout Stripe sarà attivo.",
    perMonth: "al mese",
    stripeNotice: "L'integrazione Stripe è in fase di sviluppo. Sarai notificato non appena il checkout sarà disponibile.",
    closeBtn: "Chiudi", notifyToast: "Ti notificheremo quando il pagamento sarà disponibile!",
    planFeatures: {
      premium: [
        "600 messaggi al mese", "Claude Haiku + Sonnet",
        "Predizioni di crescita (30/90/180 giorni)", "Mappa domini semantici avanzata",
        "Storico SGI 90 giorni", "Report mensile dettagliato",
      ],
      pro: [
        "2.000 messaggi al mese", "Tutti i modelli: Haiku, Sonnet, Opus, GPT-4o",
        "Accesso prioritario all'AI", "Predizioni avanzate illimitate",
        "Storico SGI completo", "Export dati e analisi personalizzata",
      ],
    },
    planBadge: "Più potente",
  },
  gamification: {
    title: "Progressi", subtitle: "Badge, missioni, XP e streak",
    level: "Livello", totalXp: "XP Totale", badges: "Badge", rankDelta: "Rank Δ 30d",
    semanticLevel: "Livello Semantico", xpToward: "XP verso Livello {{n}}",
    xpToNext: "{{n}} XP al prossimo livello", weeklyMissions: "Missioni Settimanali",
    noMissions: "Nessuna missione attiva questa settimana.",
    streak: "Streak", days: "giorni", last21: "Ultimi 21 giorni",
    badgesSection: "Badge", earned: "guadagnato", locked: "bloccato",
  },
  profile: {
    title: "Profilo di Crescita", subtitle: "Milestone, streak e progressi missioni",
    semanticLevel: "Livello Semantico", dayStreak: "giorni streak",
    lastActive: "Ultimo accesso: {{date}}", noActivity: "Nessuna attività ancora",
    sgiScore: "SGI Score", globalRank: "Rank Globale", percentile: "Percentile",
    topPct: "Top {{n}}%", badgesEarned: "Badge Guadagnati",
    earnedBadges: "Badge Guadagnati",
    noBadges: "Nessun badge ancora. Continua ad esplorare per sbloccare le milestone.",
    activeMissions: "Missioni Attive",
    noMissions: "Nessuna missione attiva. Rimani attivo per ricevere nuove missioni.",
    expires: "Scade: {{date}}", xpToLevel: "{{n}} XP per il Livello {{next}}",
  },
  predictions: {
    lockedTitle: "Simulazione Predittiva",
    lockedDesc: "Proietta la tua traiettoria SGI fino a 180 giorni con scenari conservativo, realistico e ottimistico. Disponibile nel piano Premium.",
    upgradePremium: "Upgrade a Premium",
    unlockDesc: "Sblocca predizioni, mappe avanzate e scoring prioritario",
    title: "Simulazione di Crescita",
    subtitle: "Traiettoria SGI proiettata basata sui tuoi pattern di engagement",
    conservative: "Conservativo", realistic: "Realistico", optimistic: "Ottimistico",
    conservativeDesc: "50% del tasso di crescita attuale mantenuto",
    realisticDesc: "Traiettoria attuale mantenuta",
    optimisticDesc: "2× tasso di crescita attuale",
    trajectoryChart: "Proiezione della Traiettoria",
    disclaimer: "Le proiezioni si basano sullo smoothing esponenziale della tua attività recente. Un engagement costante accelera la crescita.",
  },
  recommendations: {
    title: "Percorso di Crescita",
    subtitle: "Vettori di esplorazione personalizzati basati sul tuo profilo semantico",
    premiumFeature: "Funzione Premium",
    premiumDesc: "Growth Path ti offre raccomandazioni personalizzate generate dall'AI che puntano alle tue dimensioni semantiche più deboli. Upgrade a Premium per sbloccare la tua roadmap di crescita completa.",
    upgradePremium: "Upgrade a Premium",
    noRecs: "Inizia conversazioni per generare raccomandazioni di crescita personalizzate.",
    sgiEst: "SGI stim.",
    categories: {
      reasoning: "Ragionamento", interdisciplinary: "Interdisciplinare",
      abstraction: "Astrazione", domain: "Dominio", conceptual: "Concettuale",
    },
  },
  map: {
    title: "Mappa Semantica", subtitle: "Esplorazione interdisciplinare e forze dei domini",
    premiumFeature: "Funzione Premium",
    premiumDesc: "La Mappa Semantica interattiva mostra la tua rete di domini completa, connessioni cross-disciplina e profondità di esplorazione. Upgrade a Premium per sbloccare.",
    upgradePremium: "Upgrade a Premium",
    noMap: "Inizia conversazioni per costruire la tua mappa di domini semantici.",
    domainNetwork: "Rete dei Domini",
    domainNetworkDesc: "Dimensione nodo = score esplorazione · Spessore arco = forza cross-domain",
    radarTitle: "Radar Competenze per Dominio", radarDesc: "Score 0–10 per dominio",
    domainBreakdown: "Dettaglio Domini", msgs: "msg",
  },
  common: {
    free: "Free", premium: "Premium", pro: "Pro", sgi: "SGI", loading: "Caricamento...",
  },
};

// ─── English (pre-cached) ─────────────────────────────────────────────────────
const EN = {
  nav: {
    core: "Core", explore: "Explore", game: "Game",
    dashboard: "Dashboard", chat: "Semantic Chat", rank: "Global Rank",
    map: "Semantic Map", predictions: "Predictions", growthPath: "Growth Path",
    progress: "Progress", profile: "Profile", settings: "Settings",
    disconnect: "Sign Out", premiumPlan: "Premium Plan",
    premiumDesc: "Unlimited chat · Advanced analytics · Predictions",
    upgrade: "Upgrade ✦",
  },
  home: {
    signIn: "Sign In", initConnection: "Initialize Connection",
    live: "Live cognitive telemetry online",
    headline: "Track the evolution of your mind.",
    sub: "The Semantic Growth Index (SGI) is a platform for tracking the evolution of your language, semantic exploration, and observable cognitive trajectories in conversation.",
    beginTracking: "Begin Tracking", accessDashboard: "Access Dashboard",
    telemetryTitle: "Precision Telemetry",
    telemetryDesc: "Real-time mapping of your conceptual complexity, semantic variety, and interdisciplinary connections.",
    mapsTitle: "Semantic Maps",
    mapsDesc: "Visualize your knowledge graph. Watch the nodes of understanding connect as you explore new domains.",
    rankTitle: "Global Percentile",
    rankDesc: "Anonymous ranking against thousands of other users. Measure your growth trajectory against the curve.",
  },
  dashboard: {
    title: "Telemetry Hub", subtitle: "Real-time cognitive growth tracking",
    systemNominal: "SYSTEM NOMINAL", currentSgi: "Current SGI Score",
    globalRank: "Global Rank", of: "of", tracked: "tracked",
    weeklyGrowth: "Weekly Growth", monthlyGrowth: "Monthly Growth",
    sgiPoints7: "SGI points (7 days)", sgiPoints30: "SGI points (30 days)",
    growing: "Growing", needsAttention: "Needs attention",
    topGlobally: "Top {{val}}% globally",
    trajectory: "SGI Trajectory (30 Days)",
    dataPoints: "{{n}} data points · Started at {{start}}",
    noHistory: "No history yet — start a conversation to begin tracking",
    chatMore: "Chat more to populate your trajectory chart",
    thisWeek: "this week", places30d: "{{dir}} {{n}} places (30d)", start: "Start",
  },
  chat: {
    newExploration: "New Exploration",
    usageCounter: "{{used}}/{{limit}} msg this month",
    fewLeft: "Only {{n}} messages left", limitReached: "Limit reached",
    upgradePro: "Upgrade to Pro for 2,000 msg/month and Opus",
    upgradeProBtn: "Upgrade to Pro — €19.99",
    upgradePremiumBtn: "Upgrade to Premium — €9.99",
    placeholder: "Begin the exploration. The depth of your inquiry shapes your semantic trajectory.",
    sgiUpdate: "SGI update",
    modelLockedToast: "{{model}} requires the {{plan}} plan. Go to Settings.",
    failedCreate: "Failed to create conversation",
    failedDelete: "Failed to delete conversation",
  },
  leaderboard: {
    title: "Your Rank",
    subtitle: "Your position in the global semantic ecosystem — only you can see this.",
    position: "Position", notRanked: "not yet ranked",
    surpassed: "You've surpassed {{pct}}% of tracked users",
    top1: "Top 1%", top10: "Top 10%", top25: "Top 25%", top50: "Top 50%",
    growing: "Growing", yourSgi: "Your SGI", sgiDesc: "semantic growth index",
    communityAvg: "Community Avg", aboveAvg: "+{{n}} above average",
    belowAvg: "{{n}} below average", totalTracked: "Tracked Users",
    inNetwork: "in the SGI network", peakSgi: "All-Time Peak",
    peakDesc: "highest SGI recorded", thresholds: "Excellence Thresholds",
    reached: "✓ reached", lacking: "SGI {{threshold}}+ ({{gap}} to go)",
    privacyTitle: "Private Leaderboard",
    privacyDesc: "The full leaderboard is not public. Each user only sees their own position. Your rank is calculated anonymously relative to the community without exposing others' data.",
    noRankYet: "Your rank will appear after your first conversations. Start exploring to be ranked.",
  },
  settings: {
    title: "Settings", subtitle: "Account configuration and subscription management",
    account: "Account", email: "Email", currentPlan: "Current Plan",
    planDesc: "Your subscription tier", memberSince: "Member Since",
    sgiScore: "SGI Score", sgiScoreDesc: "Semantic growth index",
    upgrade: "Upgrade", currentPlanBtn: "Current Plan", activateBtn: "Activate {{name}}",
    proActive: "Pro Active",
    proActiveDesc: "You have full access to all AI models, 2,000 messages/month, advanced predictions and custom analytics.",
    premiumActive: "Premium Active",
    premiumActiveDesc: "You have 600 messages/month with access to Haiku and Sonnet. Upgrade to Pro for Opus, GPT-4o, and 2,000 messages.",
    privacy: "Privacy", publicRank: "Public Ranking",
    publicRankDesc: "Your name is anonymized on the leaderboard",
    anonymous: "Anonymous",
    privacyNotice: "SGI tracks the semantic and linguistic patterns of your conversations. No personally identifiable content is stored. Text is processed exclusively to generate your growth index.",
    modalTitle: "Activate {{name}}",
    modalDesc: "Payment is under development. Plans will be available once Stripe checkout is active.",
    perMonth: "per month",
    stripeNotice: "Stripe integration is in development. You will be notified as soon as checkout is available.",
    closeBtn: "Close", notifyToast: "We'll notify you when payment is available!",
    planFeatures: {
      premium: [
        "600 messages per month", "Claude Haiku + Sonnet",
        "Growth predictions (30/90/180 days)", "Advanced semantic domain map",
        "90-day SGI history", "Detailed monthly report",
      ],
      pro: [
        "2,000 messages per month", "All models: Haiku, Sonnet, Opus, GPT-4o",
        "Priority AI access", "Unlimited advanced predictions",
        "Full SGI history", "Data export and custom analytics",
      ],
    },
    planBadge: "Most Powerful",
  },
  gamification: {
    title: "Progress", subtitle: "Badges, missions, XP and streak",
    level: "Level", totalXp: "Total XP", badges: "Badges", rankDelta: "Rank Δ 30d",
    semanticLevel: "Semantic Level", xpToward: "XP toward Level {{n}}",
    xpToNext: "{{n}} XP to next level", weeklyMissions: "Weekly Missions",
    noMissions: "No active missions this week.",
    streak: "Streak", days: "days", last21: "Last 21 days",
    badgesSection: "Badges", earned: "earned", locked: "locked",
  },
  profile: {
    title: "Growth Profile", subtitle: "Milestones, streaks, and mission progress",
    semanticLevel: "Semantic Level", dayStreak: "day streak",
    lastActive: "Last active: {{date}}", noActivity: "No activity yet",
    sgiScore: "SGI Score", globalRank: "Global Rank", percentile: "Percentile",
    topPct: "Top {{n}}%", badgesEarned: "Badges Earned",
    earnedBadges: "Earned Badges",
    noBadges: "No badges earned yet. Keep exploring to unlock milestones.",
    activeMissions: "Active Missions",
    noMissions: "No active missions. Stay engaged to receive new missions.",
    expires: "Expires: {{date}}", xpToLevel: "{{n}} XP to Level {{next}}",
  },
  predictions: {
    lockedTitle: "Predictive Simulation",
    lockedDesc: "Project your semantic growth trajectory up to 180 days with conservative, realistic, and optimistic scenarios. Available on the Premium plan.",
    upgradePremium: "Upgrade to Premium",
    unlockDesc: "Unlock predictions, advanced maps, and priority scoring",
    title: "Growth Simulation",
    subtitle: "Projected SGI trajectory based on your current engagement patterns",
    conservative: "Conservative", realistic: "Realistic", optimistic: "Optimistic",
    conservativeDesc: "50% of current growth rate maintained",
    realisticDesc: "Current trajectory maintained", optimisticDesc: "2× current growth rate",
    trajectoryChart: "Trajectory Projection",
    disclaimer: "Projections are based on exponential smoothing of your recent activity. Consistent engagement accelerates growth.",
  },
  recommendations: {
    title: "Growth Path",
    subtitle: "Personalized exploration vectors based on your semantic profile",
    premiumFeature: "Premium Feature",
    premiumDesc: "Growth Path gives you AI-generated, personalized recommendations targeting your weakest semantic dimensions. Upgrade to Premium to unlock your full growth roadmap.",
    upgradePremium: "Upgrade to Premium",
    noRecs: "Start conversations to generate personalized growth recommendations.",
    sgiEst: "SGI est.",
    categories: {
      reasoning: "Reasoning", interdisciplinary: "Interdisciplinary",
      abstraction: "Abstraction", domain: "Domain", conceptual: "Conceptual",
    },
  },
  map: {
    title: "Semantic Map", subtitle: "Interdisciplinary exploration and domain strengths",
    premiumFeature: "Premium Feature",
    premiumDesc: "The interactive Semantic Map shows your full domain network, cross-discipline connections, and exploration depth. Upgrade to Premium to unlock.",
    upgradePremium: "Upgrade to Premium",
    noMap: "Start conversations to build your semantic domain map.",
    domainNetwork: "Domain Network",
    domainNetworkDesc: "Node size = exploration score · Edge thickness = cross-domain strength",
    radarTitle: "Domain Expertise Radar", radarDesc: "Score 0–10 per domain",
    domainBreakdown: "Domain Breakdown", msgs: "msgs",
  },
  common: {
    free: "Free", premium: "Premium", pro: "Pro", sgi: "SGI", loading: "Loading...",
  },
};

// ─── Spanish (pre-cached) ─────────────────────────────────────────────────────
const ES = {
  nav: {
    core: "Core", explore: "Explorar", game: "Juego",
    dashboard: "Panel", chat: "Chat Semántico", rank: "Ranking Global",
    map: "Mapa Semántico", predictions: "Predicciones",
    growthPath: "Ruta de Crecimiento", progress: "Progreso",
    profile: "Perfil", settings: "Ajustes", disconnect: "Salir",
    premiumPlan: "Plan Premium",
    premiumDesc: "Chat ilimitado · Analíticas avanzadas · Predicciones",
    upgrade: "Mejorar ✦",
  },
  home: {
    signIn: "Iniciar sesión", initConnection: "Iniciar Conexión",
    live: "Telemetría cognitiva en vivo",
    headline: "Rastrea la evolución de tu mente.",
    sub: "El Semantic Growth Index (SGI) es una plataforma para rastrear la evolución de tu lenguaje, exploración semántica y trayectorias cognitivas observables en la conversación.",
    beginTracking: "Comenzar Seguimiento", accessDashboard: "Acceder al Panel",
    telemetryTitle: "Telemetría de Precisión",
    telemetryDesc: "Mapeo en tiempo real de tu complejidad conceptual, variedad semántica y conexiones interdisciplinarias.",
    mapsTitle: "Mapas Semánticos",
    mapsDesc: "Visualiza tu grafo del conocimiento. Observa cómo los nodos de comprensión se conectan al explorar nuevos dominios.",
    rankTitle: "Percentil Global",
    rankDesc: "Clasificación anónima frente a miles de usuarios. Mide tu trayectoria de crecimiento.",
  },
  dashboard: {
    title: "Centro de Telemetría", subtitle: "Seguimiento en tiempo real del crecimiento cognitivo",
    systemNominal: "SISTEMA NOMINAL", currentSgi: "SGI Actual",
    globalRank: "Ranking Global", of: "de", tracked: "rastreados",
    weeklyGrowth: "Crecimiento Semanal", monthlyGrowth: "Crecimiento Mensual",
    sgiPoints7: "puntos SGI (7 días)", sgiPoints30: "puntos SGI (30 días)",
    growing: "Creciendo", needsAttention: "Requiere atención",
    topGlobally: "Top {{val}}% global", trajectory: "Trayectoria SGI (30 Días)",
    dataPoints: "{{n}} puntos · Comenzó en {{start}}",
    noHistory: "Sin historial — inicia una conversación para comenzar",
    chatMore: "Chatea más para poblar tu gráfico de trayectoria",
    thisWeek: "esta semana", places30d: "{{dir}} {{n}} posiciones (30d)", start: "Inicio",
  },
  chat: {
    newExploration: "Nueva Exploración",
    usageCounter: "{{used}}/{{limit}} msg este mes",
    fewLeft: "Solo {{n}} mensajes restantes", limitReached: "Límite alcanzado",
    upgradePro: "Cambia a Pro por 2.000 msg/mes y Opus",
    upgradeProBtn: "Mejorar a Pro — €19.99",
    upgradePremiumBtn: "Mejorar a Premium — €9.99",
    placeholder: "Inicia la exploración. La profundidad de tu indagación forma tu trayectoria semántica.",
    sgiUpdate: "actualización SGI",
    modelLockedToast: "{{model}} requiere el plan {{plan}}. Ve a Ajustes.",
    failedCreate: "No se pudo crear la conversación",
    failedDelete: "No se pudo eliminar la conversación",
  },
  leaderboard: {
    title: "Tu Ranking",
    subtitle: "Tu posición en el ecosistema semántico global — solo tú puedes ver esto.",
    position: "Posición", notRanked: "aún no clasificado",
    surpassed: "Has superado al {{pct}}% de los usuarios rastreados",
    top1: "Top 1%", top10: "Top 10%", top25: "Top 25%", top50: "Top 50%",
    growing: "Creciendo", yourSgi: "Tu SGI", sgiDesc: "índice de crecimiento semántico",
    communityAvg: "Media comunidad", aboveAvg: "+{{n}} sobre la media",
    belowAvg: "{{n}} bajo la media", totalTracked: "Usuarios rastreados",
    inNetwork: "en la red SGI", peakSgi: "Pico absoluto",
    peakDesc: "SGI más alto registrado", thresholds: "Umbrales de excelencia",
    reached: "✓ alcanzado", lacking: "SGI {{threshold}}+ (faltan {{gap}})",
    privacyTitle: "Clasificación privada",
    privacyDesc: "La clasificación completa no es pública. Cada usuario solo ve su propia posición. Tu ranking se calcula de forma anónima respecto a la comunidad sin exponer los datos de otros.",
    noRankYet: "Tu ranking aparecerá tras las primeras conversaciones. Empieza a explorar para ser clasificado.",
  },
  settings: {
    title: "Ajustes", subtitle: "Configuración de cuenta y gestión de suscripción",
    account: "Cuenta", email: "Correo electrónico", currentPlan: "Plan actual",
    planDesc: "Tu nivel de suscripción", memberSince: "Miembro desde",
    sgiScore: "Puntuación SGI", sgiScoreDesc: "Índice de crecimiento semántico",
    upgrade: "Mejorar", currentPlanBtn: "Plan actual", activateBtn: "Activar {{name}}",
    proActive: "Pro Activo",
    proActiveDesc: "Tienes acceso completo a todos los modelos AI, 2.000 mensajes/mes, predicciones avanzadas y analítica personalizada.",
    premiumActive: "Premium Activo",
    premiumActiveDesc: "Tienes 600 mensajes/mes con acceso a Haiku y Sonnet. Cambia a Pro para Opus, GPT-4o y 2.000 mensajes.",
    privacy: "Privacidad", publicRank: "Clasificación pública",
    publicRankDesc: "Tu nombre es anonimizado en la clasificación",
    anonymous: "Anónimo",
    privacyNotice: "SGI rastrea los patrones semánticos y lingüísticos de tus conversaciones. No se almacena ningún contenido identificable personalmente. El texto se procesa exclusivamente para generar tu índice de crecimiento.",
    modalTitle: "Activar {{name}}",
    modalDesc: "El pago está en desarrollo. Los planes estarán disponibles cuando el checkout de Stripe esté activo.",
    perMonth: "al mes",
    stripeNotice: "La integración con Stripe está en desarrollo. Se te notificará en cuanto el checkout esté disponible.",
    closeBtn: "Cerrar", notifyToast: "¡Te notificaremos cuando el pago esté disponible!",
    planFeatures: {
      premium: [
        "600 mensajes al mes", "Claude Haiku + Sonnet",
        "Predicciones de crecimiento (30/90/180 días)", "Mapa avanzado de dominios semánticos",
        "Historial SGI 90 días", "Informe mensual detallado",
      ],
      pro: [
        "2.000 mensajes al mes", "Todos los modelos: Haiku, Sonnet, Opus, GPT-4o",
        "Acceso prioritario a la AI", "Predicciones avanzadas ilimitadas",
        "Historial SGI completo", "Exportación de datos y analítica personalizada",
      ],
    },
    planBadge: "Más potente",
  },
  gamification: {
    title: "Progreso", subtitle: "Insignias, misiones, XP y racha",
    level: "Nivel", totalXp: "XP Total", badges: "Insignias", rankDelta: "Rank Δ 30d",
    semanticLevel: "Nivel Semántico", xpToward: "XP hacia Nivel {{n}}",
    xpToNext: "{{n}} XP para el próximo nivel", weeklyMissions: "Misiones Semanales",
    noMissions: "Sin misiones activas esta semana.",
    streak: "Racha", days: "días", last21: "Últimos 21 días",
    badgesSection: "Insignias", earned: "obtenida", locked: "bloqueada",
  },
  profile: {
    title: "Perfil de Crecimiento", subtitle: "Hitos, rachas y progreso de misiones",
    semanticLevel: "Nivel Semántico", dayStreak: "días de racha",
    lastActive: "Último acceso: {{date}}", noActivity: "Sin actividad aún",
    sgiScore: "Puntuación SGI", globalRank: "Ranking Global", percentile: "Percentil",
    topPct: "Top {{n}}%", badgesEarned: "Insignias obtenidas",
    earnedBadges: "Insignias obtenidas",
    noBadges: "Sin insignias aún. Sigue explorando para desbloquear hitos.",
    activeMissions: "Misiones Activas",
    noMissions: "Sin misiones activas. Mantente activo para recibir nuevas misiones.",
    expires: "Expira: {{date}}", xpToLevel: "{{n}} XP para Nivel {{next}}",
  },
  predictions: {
    lockedTitle: "Simulación Predictiva",
    lockedDesc: "Proyecta tu trayectoria SGI hasta 180 días con escenarios conservador, realista y optimista. Disponible en el plan Premium.",
    upgradePremium: "Mejorar a Premium",
    unlockDesc: "Desbloquea predicciones, mapas avanzados y puntuación prioritaria",
    title: "Simulación de Crecimiento",
    subtitle: "Trayectoria SGI proyectada según tus patrones de engagement actuales",
    conservative: "Conservador", realistic: "Realista", optimistic: "Optimista",
    conservativeDesc: "50% de la tasa de crecimiento actual mantenida",
    realisticDesc: "Trayectoria actual mantenida", optimisticDesc: "2× tasa de crecimiento actual",
    trajectoryChart: "Proyección de Trayectoria",
    disclaimer: "Las proyecciones se basan en el suavizado exponencial de tu actividad reciente. Un engagement constante acelera el crecimiento.",
  },
  recommendations: {
    title: "Ruta de Crecimiento",
    subtitle: "Vectores de exploración personalizados basados en tu perfil semántico",
    premiumFeature: "Función Premium",
    premiumDesc: "Growth Path te ofrece recomendaciones personalizadas generadas por AI dirigidas a tus dimensiones semánticas más débiles. Mejora a Premium para desbloquear tu hoja de ruta de crecimiento completa.",
    upgradePremium: "Mejorar a Premium",
    noRecs: "Inicia conversaciones para generar recomendaciones de crecimiento personalizadas.",
    sgiEst: "SGI est.",
    categories: {
      reasoning: "Razonamiento", interdisciplinary: "Interdisciplinar",
      abstraction: "Abstracción", domain: "Dominio", conceptual: "Conceptual",
    },
  },
  map: {
    title: "Mapa Semántico", subtitle: "Exploración interdisciplinar y fortalezas de dominios",
    premiumFeature: "Función Premium",
    premiumDesc: "El Mapa Semántico interactivo muestra tu red de dominios completa, conexiones entre disciplinas y profundidad de exploración. Mejora a Premium para desbloquearlo.",
    upgradePremium: "Mejorar a Premium",
    noMap: "Inicia conversaciones para construir tu mapa de dominios semánticos.",
    domainNetwork: "Red de Dominios",
    domainNetworkDesc: "Tamaño nodo = puntuación de exploración · Grosor arco = fuerza cross-domain",
    radarTitle: "Radar de Competencias por Dominio", radarDesc: "Puntuación 0–10 por dominio",
    domainBreakdown: "Desglose de Dominios", msgs: "msgs",
  },
  common: {
    free: "Gratuito", premium: "Premium", pro: "Pro", sgi: "SGI", loading: "Cargando...",
  },
};

// ─── Cache helpers ─────────────────────────────────────────────────────────────
const CACHE_PREFIX = "sgi-lang-cache-v1-";
const LOADED_LANGS = new Set<string>(["it", "en", "es"]);

function saveToCache(lang: string, data: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(data));
  } catch {}
}

function loadFromCache(lang: string): unknown | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLangCache(lang: string) {
  localStorage.removeItem(CACHE_PREFIX + lang);
}

// ─── Auto-translate via API ────────────────────────────────────────────────────
export async function loadLanguage(langCode: string): Promise<"ok" | "cached" | "error"> {
  const code = langCode.toLowerCase().trim();
  if (LOADED_LANGS.has(code)) return "ok";

  const cached = loadFromCache(code);
  if (cached) {
    i18n.addResourceBundle(code, "translation", cached, true, true);
    await i18n.changeLanguage(code);
    LOADED_LANGS.add(code);
    return "cached";
  }

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: code, translations: IT }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { translations } = await res.json() as { translations: unknown };
    saveToCache(code, translations);
    i18n.addResourceBundle(code, "translation", translations, true, true);
    await i18n.changeLanguage(code);
    LOADED_LANGS.add(code);
    return "ok";
  } catch {
    return "error";
  }
}

// ─── i18next init ─────────────────────────────────────────────────────────────
const savedLang = localStorage.getItem("sgi-lang") ?? "it";

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: IT },
    en: { translation: EN },
    es: { translation: ES },
  },
  lng: savedLang,
  fallbackLng: "it",
  interpolation: { escapeValue: false },
});

// Load saved non-standard language after init
if (!["it", "en", "es"].includes(savedLang)) {
  loadLanguage(savedLang);
}

export default i18n;
