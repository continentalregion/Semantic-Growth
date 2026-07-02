/**
 * SGI — Configurazione prezzi e tetti di utilizzo
 *
 * Due tier a pagamento:
 *   Premium  €9.99  → 600 msg/mese  · Haiku + Sonnet + GPT-4o Mini
 *   Pro      €19.99 → 2000 msg/mese · tutti i modelli (eccetto o4-mini, rimosso)
 *
 * Il margine minimo garantito è il 40% del ricavo netto per ogni utente
 * pagante, indipendentemente dal modello scelto (cost cap per-utente).
 */

// ─── Prezzi abbonamento ───────────────────────────────────────────────────────
export const PREMIUM_PRICE_CENTS = 999;    // €9.99 / mese
export const PRO_PRICE_CENTS     = 1999;   // €19.99 / mese

// ─── Fee Stripe reale (1.5% + €0.25 fisso per transazione) ───────────────────
// NON usare una % flat: la quota fissa impatta molto sui prezzi bassi.
export const STRIPE_FEE_RATE_PCT   = 0.015;  // 1.5%
export const STRIPE_FEE_FIXED_CENTS = 25;    // €0.25

// ─── Ricavo netto per piano (al netto di Stripe) ─────────────────────────────
// Premium: 999 × (1 - 0.015) - 25 = 984.985 - 25 = 959.985 → ~960¢ = €9.60
// Pro:    1999 × (1 - 0.015) - 25 = 1969.015 - 25 = 1944.015 → ~1944¢ = €19.44
const netPremiumCents = Math.round(PREMIUM_PRICE_CENTS * (1 - STRIPE_FEE_RATE_PCT) - STRIPE_FEE_FIXED_CENTS);
const netProCents     = Math.round(PRO_PRICE_CENTS     * (1 - STRIPE_FEE_RATE_PCT) - STRIPE_FEE_FIXED_CENTS);

// ─── Margine minimo target ────────────────────────────────────────────────────
export const TARGET_MARGIN_RATE = 0.40;   // 40% margine trattenuto

// ─── Budget AI per-utente (60% del netto — model-agnostic) ───────────────────
// budget_AI = netto × (1 - TARGET_MARGIN_RATE) = netto × 0.60
// Premium: 960 × 0.60 = 576¢  → arrotondato 575¢
// Pro:    1944 × 0.60 = 1166¢ → arrotondato 1166¢
export const PREMIUM_AI_BUDGET_CENTS = Math.floor(netPremiumCents * (1 - TARGET_MARGIN_RATE));
export const PRO_AI_BUDGET_CENTS     = Math.floor(netProCents     * (1 - TARGET_MARGIN_RATE));

// ─── Costi modelli (centesimi per 1 000 token, blended input+output) ──────────
export const MODEL_COST_CENTS_PER_1K: Record<string, number> = {
  "claude-haiku-4-5":  0.05,
  "claude-sonnet-4-6": 0.60,
  "claude-opus-4-8":   3.00,
  "gpt-4o-mini":       0.03,
  "gpt-4o":            0.50,
  // o4-mini rimosso: era in ALLOWED_MODELS.pro ma assente dal selettore UI →
  // incoerenza chiusa rimuovendo la voce server-side (Opzione A).
};

// ─── Modelli permessi per piano (server-side, non aggirabile) ─────────────────
export const ALLOWED_MODELS: Record<string, string[]> = {
  free:    ["claude-haiku-4-5"],
  premium: ["claude-haiku-4-5", "claude-sonnet-4-6", "gpt-4o-mini"],
  pro:     ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8", "gpt-4o-mini", "gpt-4o"],
};

// ─── Modello di default per fascia (se l'utente non sceglie) ─────────────────
export const DEFAULT_MODEL: Record<string, string> = {
  free:    "claude-haiku-4-5",
  premium: "claude-haiku-4-5",
  pro:     "claude-haiku-4-5",
};

// ─── Token medi per messaggio (stima conservativa — usata solo per MONTHLY_LIMITS) ──
const AVG_TOKENS_PER_MSG = 2_000;

// ─── Calcolo automatico limiti messaggi per piano (basato su Haiku come proxy) ─
const costPerMsgHaiku = (MODEL_COST_CENTS_PER_1K["claude-haiku-4-5"]! * AVG_TOKENS_PER_MSG) / 1_000;
const aiBudgetPremiumForMsgCap = netPremiumCents * (1 - TARGET_MARGIN_RATE);
const aiBudgetProForMsgCap     = netProCents     * (1 - TARGET_MARGIN_RATE);

const CAP_FREE    = 20;
const CAP_PREMIUM = 600;
const CAP_PRO     = 2_000;

// ─── Limiti mensili effettivi per piano (contatore messaggi — hard stop) ──────
export const MONTHLY_LIMITS: Record<string, number> = {
  free:    CAP_FREE,
  premium: Math.min(Math.floor(aiBudgetPremiumForMsgCap / costPerMsgHaiku), CAP_PREMIUM),
  pro:     Math.min(Math.floor(aiBudgetProForMsgCap     / costPerMsgHaiku), CAP_PRO),
};

// ─── Limiti mensili per-utente numero battaglie (hard stop) ──────────────────
// Distinto dal BATTLE_MONTHLY_BUDGET_CENTS (valvola aggregata di costo €): questo
// è un contatore per singolo utente, unità = 1 battaglia (match), non per-turno.
// Configurabile via env per aggiustamenti rapidi senza redeploy del codice.
export const MONTHLY_BATTLE_LIMITS: Record<string, number> = {
  free:    Number(process.env.BATTLE_LIMIT_FREE    ?? 8),
  premium: Number(process.env.BATTLE_LIMIT_PREMIUM ?? 80),
  pro:     Number(process.env.BATTLE_LIMIT_PRO     ?? 250),
};

// ─── Soglia soft-warning (frazione del limite mensile) ───────────────────────
// A questa frazione del limite (es. free: 6/8) l'API include un flag di warning
// non bloccante nella risposta, PRIMA dell'hard-stop, con framing positivo upgrade.
export const BATTLE_LIMIT_WARNING_RATIO = 0.75;

// ─── Budget mensile chiamate LLM per battle auth-user ────────────────────────
// Copre: generateBattleTheme, generateAiArgument (auto-escalation + ai-join),
// e sparring turns. Separato dal GLOBAL_MONTHLY_BUDGET_CENTS (chat only).
// Formula: ~0.07¢/battle × N_battles. A 1000 battle/mese = €0.70 → margine ampio.
// Alzare proporzionalmente al crescere del traffico battle.
export const BATTLE_MONTHLY_BUDGET_CENTS = 5_000;  // €50/mese

// ─── Valvola globale di spesa mensile cross-tenant (Fase 5 — anti-abuso) ──────
// Questa valvola è un firewall di emergenza, NON il meccanismo principale di
// protezione margine (che è ora il cost cap per-utente, FASE 4).
//
// Valore corrente: €500 (50_000¢) — adeguato fino a ~28 utenti Pro attivi.
// Formula di ricalcolo: N_paid_users × PRO_AI_BUDGET_CENTS × 1.5
//   - 10 utenti Pro: 10 × 1166 × 1.5 = ~€175   → valore attuale copre
//   - 40 utenti Pro: 40 × 1166 × 1.5 = ~€700   → ALZARE oltre ~40 utenti Pro
//   - 200 utenti Pro: 200 × 1166 × 1.5 = ~€3500 → aggiornare di conseguenza
export const GLOBAL_MONTHLY_BUDGET_CENTS         = 50_000;  // €500 — anti-abuso/runaway
export const GLOBAL_BUDGET_DEGRADATION_THRESHOLD = 0.85;

// ─── Sotto-limite Opus per piano Pro (FASE 6 — UX + qualità) ─────────────────
// Complementare al cost cap per-utente: crea una degradazione a tre fasi
// (Opus → Sonnet dopo 150 msg, qualsiasi modello → Haiku dopo cost cap).
// Con il cost cap, un Pro che usa solo Opus può fare ~194 msg prima del cap
// di costo → il limite a 150 scatta prima e fornisce un messaggio più preciso.
export const OPUS_MONTHLY_LIMIT  = 150;
export const OPUS_FALLBACK_MODEL = "claude-sonnet-4-6";

// ─── Modello di fallback per cost cap (FASE 4) ────────────────────────────────
export const COST_CAP_FALLBACK_MODEL = "claude-haiku-4-5";

// ─── Log blocchi ─────────────────────────────────────────────────────────────
export const LOG_BLOCKS = true;

// ─── Riepilogo per debug al boot ─────────────────────────────────────────────
export const PRICING_SUMMARY = {
  premiumPriceCents:       PREMIUM_PRICE_CENTS,
  proPriceCents:           PRO_PRICE_CENTS,
  netPremiumCents,
  netProCents,
  premiumAiBudgetCents:    PREMIUM_AI_BUDGET_CENTS,
  proAiBudgetCents:        PRO_AI_BUDGET_CENTS,
  targetMarginRate:        TARGET_MARGIN_RATE,
  limits:                  MONTHLY_LIMITS,
  globalBudgetCents:       GLOBAL_MONTHLY_BUDGET_CENTS,
};
