/** Exact display/input conversion only; eligibility and scoring remain canonical. */
export function formatUsd(microUsd) {
  const amount = BigInt(microUsd);
  return `${amount / 1_000_000n}.${String(amount % 1_000_000n).padStart(6, "0")}`;
}

export function parseCostCeiling(text) {
  text = text.trim();
  if (text === "") return undefined;
  if (!/^(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(text)) throw new Error("Use USD with up to 6 decimal places, or clear the field.");
  const [whole = "0", fraction = ""] = text.split(".");
  const value = Number(whole || "0") * 1_000_000 + Number(fraction.padEnd(6, "0"));
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error("The cost ceiling must be from USD 0 to USD 1000.");
  return value;
}

export function parseLatencyCeiling(text) {
  text = text.trim();
  if (text === "") return undefined;
  const value = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(value) || value < 0 || value > 600_000) throw new Error("Use whole milliseconds from 0 to 600000, or clear the field.");
  return value;
}
