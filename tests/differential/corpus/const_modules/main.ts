import { TOKEN_NUMBER, TOKEN_END, PROMPT, describe } from "./kinds";

export function main(): number {
  for (let t = TOKEN_NUMBER; t <= TOKEN_END; t = t + 1) {
    console.log(`${PROMPT}${t} ${describe(t)}`);
  }
  return TOKEN_END;
}
