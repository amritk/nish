// `readonly` is collected from the modifiers of a class field and an interface
// field alike (one `collectField` for both), so the rule holds on an interface
// too — the literal still sets it, and nothing after that may. The message
// drops "outside its constructor", because an interface has no constructor to
// point at.
interface Config {
  readonly name: string;
  size: number;
}

export function main(): number {
  const c: Config = { name: "a", size: 1 };
  c.size = 2;
  c.name = "b";
  return 0;
}
