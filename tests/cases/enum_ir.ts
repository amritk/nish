// A numeric `enum` emits nothing: a member is folded to its integer the way a
// module constant is, and the type is `i32` in memory. This program and
// `enum_expanded.ts` differ only in whether the enum is there — the second
// writes the same numbers as `i32` module constants — so their goldens are
// byte-identical files, which is the whole claim of WP23 §3 checked as a diff.
enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

// No initialiser means TypeScript's numbering: the first member is 0 and each
// later one is its predecessor plus one.
enum Level {
  Low,
  Mid,
  High,
}

const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.If:
      return 10;
    case Kind.While:
      return 20;
    default:
      return 30;
  }
};

const scale = (l: Level): i32 => {
  if (l === Level.Low) {
    return 1;
  }
  return l === Level.Mid ? 2 : 4;
};

const heaviest = (kinds: Kind[]): i32 => {
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
  const kinds: Kind[] = [Kind.If, Kind.Return, Kind.While];
  const total = heaviest(kinds) + scale(Level.High) + weight(Kind.If);
  return total;
};
