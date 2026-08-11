import { PlotUnit } from '../types';

/**
 * Conversion factors to Acres (the canonical display unit).
 *
 * Telangana / AP land measurement context:
 *  - 1 Acre   = 40 Guntas
 *  - 1 Acre   = 100 Cents
 *  - 1 Acre   = 0.404686 Hectares  (i.e. 1 Hectare = 2.47105 Acres)
 */
const TO_ACRES: Record<PlotUnit, number> = {
  Acres: 1,
  Guntas: 1 / 40,      // 40 Guntas = 1 Acre
  Cents: 1 / 100,      // 100 Cents  = 1 Acre
  Hectares: 2.47105,   // 1 Hectare  = 2.47105 Acres
};

/**
 * Converts a plot size value in any supported unit to Acres.
 * Always use this when summing or comparing across registrations.
 */
export function toAcres(value: number, unit: PlotUnit): number {
  return value * (TO_ACRES[unit] ?? 1);
}

/**
 * Formats a plot size with its original unit for display,
 * and optionally appends the converted acres equivalent.
 *
 * e.g.  "20 Guntas (0.50 Ac)"
 */
export function formatPlotSize(
  value: number,
  unit: PlotUnit,
  showAcresConversion = false
): string {
  const base = `${value} ${unit}`;
  if (showAcresConversion && unit !== 'Acres') {
    const converted = toAcres(value, unit);
    return `${base} (≈${converted.toFixed(2)} Ac)`;
  }
  return base;
}
