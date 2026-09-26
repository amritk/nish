const hypot = (a: number, b: number): number => Math.sqrt(a * a + b * b);

const roundHalfUp = (x: number): number => Math.round(x);

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
