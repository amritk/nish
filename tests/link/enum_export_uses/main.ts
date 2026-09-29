// An imported enum is the exporter's enum, used every way a local one is: a
// field type, a parameter and a return type, a local, a `Map` key, a `switch`
// discriminant with member labels, and `===` between two members.
import { Kind, weight } from "./kinds";

class Token {
  kind: Kind;
  text: string;

  constructor(kind: Kind, text: string) {
    this.kind = kind;
    this.text = text;
  }
}

const loopKind = (): Kind => Kind.While;

const name = (k: Kind): string => {
  switch (k) {
    case Kind.If:
      return "if";
    case Kind.While:
      return "while";
    default:
      return "return";
  }
};

export const main = (): number => {
  const tokens: Token[] = [new Token(Kind.If, "if"), new Token(loopKind(), "while"), new Token(Kind.Return, "return")];
  const counts = new Map<Kind, i32>();
  let total = 0;
  for (const t of tokens) {
    const k: Kind = t.kind;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    total = total + weight(k);
    console.log(`${t.text} ${name(k)} ${k === Kind.While ? "loop" : "straight"}`);
  }
  console.log(`${counts.size} kinds, weight ${total}`);
  return counts.get(Kind.Return) ?? 9;
};
