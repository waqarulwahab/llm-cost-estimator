// Pure, VS Code-free formatting helpers shared by the UI layer and tested directly.
import type { ModelEstimate } from "./estimator";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CAD: "$",
  AUD: "$",
  NZD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  KRW: "₩",
  BRL: "R$",
};

/** Returns the symbol for a currency code, or "" if unknown. */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? "";
}

/**
 * Formats a USD cost for display. Uses more decimal places for small amounts so
 * sub-cent estimates stay meaningful (e.g. $0.000123 instead of $0.00).
 * When the currency has no known symbol, the code is shown as a prefix.
 */
export function formatCost(value: number, currency = "USD"): string {
  const symbol = currencySymbol(currency);
  const prefix = symbol ? symbol : `${currency.toUpperCase()} `;

  let digits: number;
  const abs = Math.abs(value);
  if (abs === 0) {
    digits = 2;
  } else if (abs < 0.01) {
    digits = 6;
  } else if (abs < 1) {
    digits = 4;
  } else {
    digits = 2;
  }

  return `${prefix}${value.toFixed(digits)}`;
}

/** Formats an integer token/char count with thousands separators. */
export function formatTokens(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** Marker appended to a model label when its token count is an approximation. */
export const ESTIMATE_MARKER = "~";

/** Marker shown when a prompt exceeds a model's context window. */
export const OVER_CONTEXT_MARKER = "⚠";

/** Sorts estimates cheapest-first (by total cost). Pure; safe to reuse anywhere. */
export function sortByCost(estimates: ModelEstimate[]): ModelEstimate[] {
  return [...estimates].sort((a, b) => a.totalCost - b.totalCost);
}
