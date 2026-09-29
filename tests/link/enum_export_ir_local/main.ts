import { base } from "./kinds";

enum Kind {
  If = 1,
  While = 2,
  Return = 3,
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

export const main = (): number => {
  const kinds: Kind[] = [Kind.If, Kind.Return, Kind.While];
  console.log(`${heaviest(kinds) + base()}`);
  return kinds[2] === Kind.While ? 0 : 1;
};
