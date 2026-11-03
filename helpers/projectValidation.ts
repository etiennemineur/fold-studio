/** Small strict JSON validators. No coercion, defaults, unknown keys or recursive schema. */
export type Check = (value: unknown, path: string) => void;
export function fail(path: string): never { throw new Error(`Invalid project field: ${path}`); }
export const num = (min: number, max: number, integer = false): Check => (v,p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(p);
};
export const str = (max: number, min = 0): Check => (v,p) => { if (typeof v !== 'string' || v.length < min || v.length > max) fail(p); };
export const choice = (...values: unknown[]): Check => (v,p) => { if (!values.includes(v)) fail(p); };
export const bool: Check = (v,p) => { if (typeof v !== 'boolean') fail(p); };
export const optional = (check: Check): Check => (v,p) => { if (v !== undefined) check(v,p); };
export const nullable = (check: Check): Check => (v,p) => { if (v !== null) check(v,p); };
export const array = (check: Check, max: number, min = 0): Check => (v,p) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail(p);
  v.forEach((x,i) => check(x,`${p}[${i}]`));
};
export const object = (shape: Record<string, Check>): Check => (v,p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p);
  const data = v as Record<string, unknown>;
  for (const key of Object.keys(data)) if (!Object.hasOwn(shape,key)) fail(`${p}.${key}`);
  for (const [key,check] of Object.entries(shape)) check(data[key],`${p}.${key}`);
};
export const record = (check: Check, max: number): Check => (v,p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length > max) fail(p);
  for (const [key,value] of Object.entries(v)) {
    if (key.length > 200 || ['__proto__','constructor','prototype'].includes(key)) fail(p);
    check(value,`${p}.${key}`);
  }
};
