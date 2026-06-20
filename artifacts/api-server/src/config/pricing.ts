/**
 * SGI — Configurazione prezzi e tetti di utilizzo
 *
 * Due tier a pagamento:
 *   Premium  €9.99  → 600 msg/mese  · Haiku + Sonnet
 *   Pro      €19.99 → 2000 msg/mese · tutti i modelli
 *
 * I limiti sono calcolati automaticamente dal margine target.
 * Aggiusta i valori di base e i limiti si ricalcolano senza toccare altro.
 */

// ─── Prezzi abbonamento ───────────────────────────────────────────────────────
export const PREMIUM_PRICE_CENTS = 999;    // €9.99 / mese
export const PRO_PRICE_CENTS     = 1999;   // €19.99 / mese
export const STRIPE_FEE_RATE     = 0.03;   // 3% Stripe (+ €0.25 fisso, non considerato qui)
export const TARGET_MARGIN_RATE  = 0.40;   // 40% margine minimo target

// ─── Costi modelli (centesimi per 1 000 token, blended input+output) ──────────
export const MODEL_COST_CENTS_PER_1K: Record<string, number> = {
  "claude-haiku-4-5":  0.05,
  "claude-sonnet-4-6": 0.60,
  "claude-opus-4-8":   3.00,
  "gpt-4o-mini":       0.03,
  "gpt-4o":            0.50,
  "o4-mini":           0.15,
};

// ─── Modelli permessi per piano (server-side, non aggirabile) ─────────────────
export const ALLOWED_MODELS: Record<string, string[]> = {
  free:    ["claude-haiku-4-5"],
  premium: ["claude-haiku-4-5", "claude-sonnet-4-6", "gpt-4o-mini"],
  pro:     ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8", "gpt-4o-mini", "gpt-4o", "o4-mini"],
};

// ─── Modello di default per fascia (se l'utente non sceglie) ─────────────────
export const DEFAULT_MODEL: Record<string, string> = {
  free:    "claude-haiku-4-5",
  premium: "claude-haiku-4-5",
  pro:     "claude-haiku-4-5",
};

// ─── Token medi per messaggio (stima conservativa) ───────────────────────────
const AVG_TOKENS_PER_MSG = 2_000;

// ─── Calcolo automatico budget AI per piano ───────────────────────────────────
const netPremium  = PREMIUM_PRICE_CENTS * (1 - STRIPE_FEE_RATE);   // ~969¢
const netPro      = PRO_PRICE_CENTS     * (1 - STRIPE_FEE_RATE);   // ~1939¢
const aiBudgetPremium = netPremium * (1 - TARGET_MARGIN_RATE);      // ~581¢
const aiBudgetPro     = netPro     * (1 - TARGET_MARGIN_RATE);      // ~1163¢

const costPerMsgHaiku = (MODEL_COST_CENTS_PER_1K["claude-haiku-4-5"]! * AVG_TOKENS_PER_MSG) / 1_000;

const calcPremium = Math.floor(aiBudgetPremium / costPerMsgHaiku);
const calcPro     = Math.floor(aiBudgetPro     / costPerMsgHaiku);

// Cap di sicurezza (burst di token imprevedibili)
const CAP_FREE    = 20;
const CAP_PREMIUM = 600;
const CAP_PRO     = 2_000;

// ─── Limiti mensili effettivi per piano ──────────────────────────────────────
export const MONTHLY_LIMITS: Record<string, number> = {
  free:    CAP_FREE,
  premium: Math.min(calcPremium, CAP_PREMIUM),
  pro:     Math.min(calcPro,     CAP_PRO),
};

// ─── Valvola globale di spesa mensile (Fase 5) ───────────────────────────────
export const GLOBAL_MONTHLY_BUDGET_CENTS          = 8_000;  // €80 tetto AI globale (aggiornato per 2 tier)
export const GLOBAL_BUDGET_DEGRADATION_THRESHOLD  = 0.85;

// ─── Log blocchi ─────────────────────────────────────────────────────────────
export const LOG_BLOCKS = true;

// ─── Riepilogo per debug al boot ─────────────────────────────────────────────
export const PRICING_SUMMARY = {
  premiumPriceCents:  PREMIUM_PRICE_CENTS,
  proPriceCents:      PRO_PRICE_CENTS,
  netPremiumCents:    Math.round(netPremium),
  netProCents:        Math.round(netPro),
  aiBudgetPremium:    Math.round(aiBudgetPremium),
  aiBudgetPro:        Math.round(aiBudgetPro),
  limits:             MONTHLY_LIMITS,
};
