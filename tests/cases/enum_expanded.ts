// `enum_ir.ts` written without its enums: the same numbers as `i32` module
// constants, the same functions, the same names. The two `.ll` goldens are
// byte-identical files; if they ever differ, an enum has started to cost
// something at run time (WP23 §3).
const KIND_IF: i32 = 1;
const KIND_WHILE: i32 = 2;
const KIND_RETURN: i32 = 3;

const LEVEL_LOW: i32 = 0;
const LEVEL_MID: i32 = 1;
const LEVEL_HIGH: i32 = 2;

const weight = (k: i32): i32 => {
  switch (k) {
    case KIND_IF:
      return 10;
    case KIND_WHILE:
      return 20;
    default:
      return 30;
  }
};

const scale = (l: i32): i32 => {
  if (l === LEVEL_LOW) {
    return 1;
  }
  return l === LEVEL_MID ? 2 : 4;
};

const heaviest = (kinds: i32[]): i32 => {
  let best = 0;
  for (const k of kinds) {
    const w = weight(k);
    if (w > best) {
      best = w;
    }
  }
  return best;
};

export const test = (): number => {
  const kinds: i32[] = [KIND_IF, KIND_RETURN, KIND_WHILE];
  const total = heaviest(kinds) + scale(LEVEL_HIGH) + weight(KIND_IF);
  return total;
};
