// WP15 §8, NL9010: a struct whose declared field order spends bytes on padding
// that a different order would not. Both kinds are here, because a layout is a
// layout — an `interface` is a record laid out by the same rules a `class` is,
// and the rule has to hold for both.
//
// Each is 24 bytes: the `boolean` takes one and seven are then thrown away
// reaching the `f64`, and the trailing `i32` rounds the whole thing back up to
// eight. Widest first each is 16, with no interior gap at all — which is the
// size the message names, beside the order that reaches it.
//
// It is also the only §8 rule computed in pass 1, so this is the smallest case
// that proves a pass-1 warning is reported at all; `diag_order_pass1` is where
// it has to share a file with pass 2.
export class Mixed {
  flag: boolean = false;
  size: f64 = 0;
  count: i32 = 0;
}

export interface Row {
  live: boolean;
  weight: f64;
  index: i32;
}

export const test = (): number => {
  const m = new Mixed();
  m.count = 7;
  const r: Row = { live: true, weight: toF64(3), index: 2 };
  return m.count + r.index + (r.live ? 1 : 0);
};
