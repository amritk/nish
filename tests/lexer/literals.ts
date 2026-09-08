// Numeric and string literal shapes, including the ones AmritScript rejects.
const dec = 1234;
const sep = 1_000_000;
const hex = 0xdeadBEEF;
const bin = 0b1010_0101;
const oct = 0o777;
const flt = 3.14;
const dot = .5;
const exp = 1e10;
const negExp = 1.5e-7;
const plusExp = 2E+3;
const big = 10n;
const bigHex = 0xffn;
const s1 = "plain";
const s2 = 'single';
const s3 = "esc \n \t \\ \" \0 \x41 A \u{1F600}";
const s4 = "";
// The scan takes the plain bytes between escapes in whole runs, so the cases
// that matter are the ones where a run is empty: an escape at the very start,
// two escapes with nothing between them, and a literal that is only an escape.
const s5 = "\nfirst";
const s6 = "\x41\x42Cadjacent";
const s7 = "\n";
const s8 = "line \
continuation";
const div = 1 / 2 / 3;
const notRegex = a / b / c;
