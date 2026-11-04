// `nish/crypto/base64url`'s decoder at every edge of its group-of-four loop:
// it reads four characters a step and decodes a short final group of two or
// three after the loop, so each text length 0 to 15 (every length mod 4,
// twice over) is decoded against the encoder, refused with one character
// out of the alphabet at each position — the first, a middle and the last
// character of a full group, and either one of a final group — refused when
// its final character carries a stray low bit, and decoded with its last
// character dropped, which ends the text one character short of the group
// it began. Each decoded array must also be exactly the size its length spells.
import { base64urlDecode, base64urlEncode } from "nish/crypto/base64url";
import { Suite } from "nish/testing";

/** `len` bytes of a fixed pseudo-random stream; `seed` picks the stream. */
const bytesOf = (len: i32, seed: i32): u8[] => {
  const out: u8[] = [];
  let x: u32 = toU32(seed) * 2654435761 + 1;
  for (let i: i32 = 0; i < len; i++) {
    x = x * 1103515245 + 12345;
    out.push(toU8(toI32(x >> 16) & 255));
  }
  return out;
};

/** Whether `a` is exactly the first `n` bytes of `b`. */
const isPrefix = (a: u8[], b: u8[], n: i32): boolean => {
  if (toI32(a.length) !== n) {
    return false;
  }
  for (let i: i32 = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/** `text` with the character at `at` replaced by `c`. */
const withCharAt = (text: string, at: i32, c: string): string =>
  text.substring(0, at) + c + text.substring(at + 1, toI32(text.length));

/** The bytes a text of `n` characters spells, and -1 for a length of 1 mod 4. */
const sizeOf = (n: i32): i32 => {
  const tail: i32 = n & 3;
  if (tail === 1) {
    return -1;
  }
  return (n >> 2) * 3 + (tail === 0 ? 0 : tail - 1);
};

export const main = (): number => {
  const t = new Suite("base64url groups");
  // Characters next to each alphabet range, the two RFC 4648 §4 letters the
  // URL alphabet replaces, padding, a blank, NUL, DEL and a code unit past a byte.
  const outside: string[] = ["@", "[", "`", "{", "/", ":", ",", ".", "^", "+", "=", " ", "\u0000", "\u007f", "é", "Ł"];

  for (let len: i32 = 0; len <= 11; len++) {
    for (let seed: i32 = 0; seed < 8; seed++) {
      const bytes: u8[] = bytesOf(len, seed * 16 + len);
      const text: string = base64urlEncode(bytes);
      const n: i32 = toI32(text.length);
      const name: string = `${len} bytes as ${n} characters (seed ${seed})`;

      const back: u8[] | null = base64urlDecode(text);
      if (back === null) {
        t.fail(`round trip ${name}`, "refused");
      } else if (!isPrefix(back, bytes, len)) {
        t.fail(`round trip ${name}`, "other bytes");
      }

      // Each position, against each outside character.
      for (let at: i32 = 0; at < n; at++) {
        for (const c of outside) {
          if (base64urlDecode(withCharAt(text, at, c)) !== null) {
            t.fail(`refuse ${name}`, `accepted ${toI32(c.charCodeAt(0))} at ${at}`);
          }
        }
      }

      // One character short: a length of 1 mod 4 is refused, and any other
      // decodes to exactly its size or is refused for its stray low bits.
      if (n > 0) {
        const short: string = text.substring(0, n - 1);
        const got: u8[] | null = base64urlDecode(short);
        const want: i32 = sizeOf(n - 1);
        if (want < 0 && got !== null) {
          t.fail(`one short ${name}`, "accepted a length of 1 mod 4");
        }
        if (got !== null && toI32(got.length) !== want) {
          t.fail(`one short ${name}`, `${got.length} bytes, not ${want}`);
        }
        if (got !== null && !isPrefix(got, bytes, want)) {
          t.fail(`one short ${name}`, "other bytes");
        }
      }

      // A stray bit in each of the low bits the final character leaves unused.
      const tail: i32 = n & 3;
      if (tail !== 0) {
        const lastChar: string = text.substring(n - 1, n);
        const spare: i32 = tail === 2 ? 4 : 2;
        const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        const v: i32 = toI32(alphabet.indexOf(lastChar));
        for (let bit: i32 = 0; bit < spare; bit++) {
          const w: i32 = v ^ (1 << bit);
          const odd: string = withCharAt(text, n - 1, alphabet.substring(w, w + 1));
          if (base64urlDecode(odd) !== null) {
            t.fail(`refuse stray bit ${bit} ${name}`, "accepted");
          }
        }
      }
    }
    t.pass(`${len} bytes: round trip, every position refused, one short, stray bits`);
  }

  // Sizes: the decoded array is exactly as long as the length spells.
  const zeros: string = "AAAAAAAAAAAAAAAA";
  for (let n: i32 = 0; n <= 15; n++) {
    const got: u8[] | null = base64urlDecode(zeros.substring(0, n));
    const want: i32 = sizeOf(n);
    const size: i32 = got === null ? -1 : toI32(got.length);
    t.ok(`${n} characters decode to ${want} bytes (-1 is refused)`, size === want);
  }

  return t.done();
};
