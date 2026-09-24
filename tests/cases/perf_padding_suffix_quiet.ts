// WP15 §8, the false-positive guard for NL9010's `implements` rule (#108). The
// padding in `Entry` is all inside the prefix — seven bytes between `live` and
// `weight`, which `Header` puts there — and the fields `Entry` adds are already
// widest first, so no order the author is free to write is any smaller and the
// rule says nothing. `Header` alone is as small as its two fields allow.
export interface Header {
  live: boolean;
  weight: f64;
}

export class Entry implements Header {
  live: boolean = false;
  weight: f64 = 0;
  size: f64 = 0;
  count: i32 = 0;
  flag: boolean = false;
}

export const test = (): number => {
  const e = new Entry();
  e.count = 5;
  const h: Header = e;
  return e.count + (h.live ? 1 : 0) + (e.flag ? 1 : 0);
};
