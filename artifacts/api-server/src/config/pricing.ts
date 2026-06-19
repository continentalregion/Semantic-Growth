/**
 * SGI — Configurazione prezzi e tetti di utilizzo
 *
 * REGOLA DI FONDO: nessun utente deve generare un costo AI superiore al
 * suo tetto di fascia. Il tetto premium è calcolato automaticamente dal
 * margine target, non scelto arbitrariamente.
 *
 * CALCOLO TETTO PREMIUM
 * ─────────────────────
 * Budget AI per utente premium = prezzo * (1 - fee_stripe) * (1 - margine_target)
 * Limite messaggi = budget_AI / costo_medio_per_messaggio
 *
 * Con i valori attuali:
 *   9.99 * 0.97 * 0.60 = €5.81 di budget AI per utente/mese
 *   costo medio msg su Haiku ≈ €0.002 (2000 token a 0.001€/1K)
 *   → 5.81 / 0.002 ≈ 2905 → capped a MAX_PREMIUM_MESSAGES per sicurezza
 *
 * Aggiusta PREMIUM_PRICE_CENTS, STRIPE_FEE_RATE o TARGET_MARGIN_RATE
 * e i limiti si ricalcolano automaticamente.
 */

// ─── Prezzi abbonamento ───────────────────────────────────────────────────────
export const PREMIUM_PRICE_CENTS = 999;     // €9.99 / mese
export const STRIPE_FEE_RATE     = 0.03;    // 3% Stripe
export const TARGET_MARGIN_RATE  = 0.40;    // 40% margine minimo target

// ─── Costi modelli (centesimi per 1 000 token, blended input+output) ──────────
export const MODEL_COST_CENTS_PER_1K: Record<string, number> = {
  "claude-haiku-4-5":  0.05,   // ~€0.0005/1K  ← modello "economico" di default
  "claude-sonnet-4-6": 0.60,   // ~€0.006/1K
  "claude-opus-4-8":   3.00,   // ~€0.03/1K    ← solo per momenti "wow"
  "gpt-4o-mini":       0.03,   // ~€0.0003/1K
  "gpt-4o":            0.50,   // ~€0.005/1K
  "o4-mini":           0.15,
};

// ─── Token medi per messaggio (stima conservativa) ───────────────────────────
const AVG_TOKENS_PER_MSG = 2_000;

// ─── Calcolo automatico del budget AI per utente premium ─────────────────────
const netRevenueCents   = PREMIUM_PRICE_CENTS * (1 - STRIPE_FEE_RATE);  // 969.03 ¢
const aibudgetCents     = netRevenueCents * (1 - TARGET_MARGIN_RATE);   // 581.42 ¢

// Costo di un messaggio medio sul modello di routing standard (Haiku)
const costPerMsgHaiku   = (MODEL_COST_CENTS_PER_1K["claude-haiku-4-5"]! * AVG_TOKENS_PER_MSG) / 1_000;
const calculatedPremium = Math.floor(aibudgetCents / costPerMsgHaiku);

// Limite massimo assoluto di sicurezza (cap per imprevedibili burst di token)
const MAX_PREMIUM_MESSAGES = 600;
const MAX_FREE_MESSAGES    = 20;

// ─── Limiti mensili per piano ─────────────────────────────────────────────────
export const MONTHLY_LIMITS: Record<string, number> = {
  free:    MAX_FREE_MESSAGES,
  premium: Math.min(calculatedPremium, MAX_PREMIUM_MESSAGES),
};

// ─── Modello di default per fascia ───────────────────────────────────────────
export const DEFAULT_MODEL: Record<string, string> = {
  free:    "claude-haiku-4-5",   // costo prossimo a zero
  premium: "claude-haiku-4-5",   // di default Haiku; Opus solo su scelta esplicita
};

// ─── Valvola globale di spesa mensile (Fase 5) ───────────────────────────────
export const GLOBAL_MONTHLY_BUDGET_CENTS = 5_000;  // €50 di tetto AI globale
export const GLOBAL_BUDGET_DEGRADATION_THRESHOLD = 0.85; // degrada a 85% del budget

// ─── Log blocchi ─────────────────────────────────────────────────────────────
export const LOG_BLOCKS = true;  // logga ogni blocco per analisi pricing

// ─── Riepilogo per debug ──────────────────────────────────────────────────────
export const PRICING_SUMMARY = {
  premiumPriceCents: PREMIUM_PRICE_CENTS,
  netRevenueCents:   Math.round(netRevenueCents),
  aibudgetCents:     Math.round(aibudgetCents),
  costPerMsgHaikuCents: parseFloat(costPerMsgHaiku.toFixed(4)),
  calculatedPremiumLimit: calculatedPremium,
  effectivePremiumLimit: MONTHLY_LIMITS.premium,
  freeLimit: MONTHLY_LIMITS.free,
};
