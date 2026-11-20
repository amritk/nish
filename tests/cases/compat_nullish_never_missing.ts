// WP28 C1, `nullish`: a `??` whose left operand is never `null` or
// `undefined`. Node never runs the default, so the build keeps the left
// operand alone and says so in a performance note (NL9021).
const keep = (k: number): number => k ?? 9;

const name = (s: string): string => s ?? "anonymous";

export const main = (): void => {
  console.log(`${keep(4)} ${keep(0)} ${name("ada")} ${name("")}`);
};
