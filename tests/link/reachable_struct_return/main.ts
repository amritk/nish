import { lex } from "./lib";

export const main = (): number => {
  const token = lex(7);
  console.log(token.describe());
  return token.kind - 7;
};
