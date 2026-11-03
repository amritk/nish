// The ChaCha20 quarter round (RFC 8439 §2.1) on four blocks at once: each
// vector holds one word of four blocks, so `addWrapping`, `xor` and `rotl`
// run the round's eight steps lane by lane, and each rotate is one
// `llvm.fshl` by a constant. Lane 0 is the RFC's §2.1.1 test vector, whose
// answer is ea2a92f4 cb1cf8ce 4581472e 5881c4bb; lane 2 wraps every add.
import { u32x4, addWrapping, xor, rotl, store } from "nish:simd";

export const main = (): number => {
  let a = u32x4(0x11111111, 1, 0xffffffff, 0x61707865);
  let b = u32x4(0x01020304, 2, 0xffffffff, 0x3320646e);
  let c = u32x4(0x9b8d6f43, 3, 0xffffffff, 0x79622d32);
  let d = u32x4(0x01234567, 4, 0xffffffff, 0x6b206574);
  a = addWrapping(a, b);
  d = rotl(xor(d, a), 16);
  c = addWrapping(c, d);
  b = rotl(xor(b, c), 12);
  a = addWrapping(a, b);
  d = rotl(xor(d, a), 8);
  c = addWrapping(c, d);
  b = rotl(xor(b, c), 7);
  const words: u32[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  store(a, words, 0);
  store(b, words, 4);
  store(c, words, 8);
  store(d, words, 12);
  for (let lane = 0; lane < 4 && 12 + lane < words.length; lane++) {
    console.log(`${words[lane]} ${words[4 + lane]} ${words[8 + lane]} ${words[12 + lane]}`);
  }
  return 0;
};
