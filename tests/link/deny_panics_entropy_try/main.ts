// examples-strict S7e: `crypto.tryGetRandomValues` is no panic site, so a
// package held to the no-panic default builds a fill through it, where
// `crypto.getRandomValues` is refused (`tests/link/deny_panics_entropy`).
// `strict` keeps the harness from passing `--allow-panics`.
import { nonce } from "./nonce";

export const main = (): i32 => {
  const n = nonce();
  if (!n.ok) {
    console.log(n.error);
    return 1;
  }
  console.log(`filled ${n.value.length}`);
  return 0;
};
