// A diagnostic column counts UTF-16 code units, not the bytes the self-hosted
// compiler stores a file as: `é` is one column and two bytes, `🎉` is two and
// four. Both sit before the caret, so the two counts differ by three here —
// which is the whole reason this case exists, because no other corpus program
// puts a non-ASCII character in front of one (WP19 §A5).
export const main = (): number => {
  const cafe = "café 🎉"; const n: i32 = cafe;
  return n;
};
