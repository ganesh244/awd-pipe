/**
 * Validator for the optional plot-boundary polygon.
 * Mirrors sanitizePlotBoundary() in server.js.
 * Run: npx tsx tests/plotBoundary.test.ts
 */
const MAX_BOUNDARY_POINTS = 500;

const sanitizePlotBoundary = (raw: any): [number, number][] | undefined => {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  if (raw.length > MAX_BOUNDARY_POINTS) return undefined;
  // Number(null), Number('') and Number([]) are all 0, which would silently
  // place a vertex at 0,0 instead of rejecting bad input. Only a real number or
  // a non-empty numeric string counts.
  const num = (v: any): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  };
  const cleaned: [number, number][] = [];
  for (const point of raw) {
    if (!Array.isArray(point) || point.length !== 2) return undefined;
    const lat = num(point[0]);
    const lng = num(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
    cleaned.push([lat, lng]);
  }
  return cleaned;
};

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

// A real Telangana paddy plot — the happy path.
const valid: [number, number][] = [[17.9784, 79.5941], [17.9789, 79.5948], [17.9781, 79.5952]];
check('accepts a valid triangle', sanitizePlotBoundary(valid), valid);
check('accepts a 4-point plot', sanitizePlotBoundary([...valid, [17.9776, 79.5944]]), [...valid, [17.9776, 79.5944]]);

// The field is optional, so absent/empty input must be dropped, not rejected loudly.
check('undefined -> undefined', sanitizePlotBoundary(undefined), undefined);
check('null -> undefined', sanitizePlotBoundary(null), undefined);
check('empty array -> undefined', sanitizePlotBoundary([]), undefined);

// Fewer than 3 points cannot form a polygon.
check('1 point rejected', sanitizePlotBoundary([[17.9, 79.5]]), undefined);
check('2 points rejected', sanitizePlotBoundary([[17.9, 79.5], [17.91, 79.51]]), undefined);

// Malformed shapes that would break the Leaflet renderer.
check('non-array rejected', sanitizePlotBoundary('17.9,79.5'), undefined);
check('point with 3 values rejected', sanitizePlotBoundary([[1, 2, 3], [1, 2], [3, 4]]), undefined);
check('point that is not an array rejected', sanitizePlotBoundary([{ lat: 1, lng: 2 }, [1, 2], [3, 4]]), undefined);
check('NaN rejected', sanitizePlotBoundary([[NaN, 79.5], [17.9, 79.5], [17.8, 79.6]]), undefined);
check('Infinity rejected', sanitizePlotBoundary([[Infinity, 79.5], [17.9, 79.5], [17.8, 79.6]]), undefined);
check('null coordinate rejected', sanitizePlotBoundary([[null, 79.5], [17.9, 79.5], [17.8, 79.6]]), undefined);

// Out-of-range coordinates — a swapped lat/lng is the realistic version of this.
check('latitude > 90 rejected', sanitizePlotBoundary([[91, 79.5], [17.9, 79.5], [17.8, 79.6]]), undefined);
check('latitude < -90 rejected', sanitizePlotBoundary([[-91, 79.5], [17.9, 79.5], [17.8, 79.6]]), undefined);
check('longitude > 180 rejected', sanitizePlotBoundary([[17.9, 181], [17.9, 79.5], [17.8, 79.6]]), undefined);

// Size cap protects the 512MB free tier.
const huge = Array.from({ length: 501 }, (_, i) => [17.9 + i * 1e-5, 79.5 + i * 1e-5]);
check('501 points rejected', sanitizePlotBoundary(huge), undefined);
const atCap = Array.from({ length: 500 }, (_, i) => [17.9 + i * 1e-5, 79.5 + i * 1e-5]);
check('exactly 500 points accepted', sanitizePlotBoundary(atCap)?.length, 500);

// Numeric strings coerce — the form can hand back strings after a round trip.
check('numeric strings coerced', sanitizePlotBoundary([['17.9', '79.5'], [17.91, 79.51], [17.92, 79.52]]),
  [[17.9, 79.5], [17.91, 79.51], [17.92, 79.52]]);
check('non-numeric string rejected', sanitizePlotBoundary([['abc', '79.5'], [17.9, 79.5], [17.8, 79.6]]), undefined);

// 0,0 is in range and must survive, even though it is null island.
check('zero coordinates kept', sanitizePlotBoundary([[0, 0], [0, 0.001], [0.001, 0]]), [[0, 0], [0, 0.001], [0.001, 0]]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
