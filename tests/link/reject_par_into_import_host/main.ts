import { parallelMap, parallelMapInto } from "nish/threads";
import { first } from "./helper";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  // `ts[1]` is `d`, so the body reads the array the call writes.
  const ts: i32[][] = [weights, d];
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  // Spacing: the call sits inside the span `first` has in helper.ts.
  parallelMapInto(src, d, (x) => ts[1][x % 4] + first(1));
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  // Spacing: `main` ends after `first`, so `first` is the innermost span.
  return d[0];
};
