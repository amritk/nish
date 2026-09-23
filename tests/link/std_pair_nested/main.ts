import { span } from "./lib";

export const main = (): i32 => {
  const s = span(4, 3, "word");
  console.log(`${s.second} ${s.first.first}..${s.first.second}`);
  return 0;
};
