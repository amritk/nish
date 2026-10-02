// `base64urlEncode` of an array longer than 2^31 - 1 bytes panics (exit 1)
// before it encodes anything. Under `--number-mode f64` `toI32` of that length
// saturates, so the loop used to stop at 2^31 - 1 bytes and answer the text of
// a prefix as if it were the whole. docs/security/crypto-k1.md, finding K1-3.
import { base64urlEncode } from "nish/crypto/base64url";

export const main = (): i32 => {
  const n: number = 2147483648;
  const data: u8[] = new Array<u8>(n);
  console.log("encoding 2^31 bytes");
  const text: string = base64urlEncode(data);
  console.log(`unreachable: ${text.length} characters of a prefix`);
  return 0;
};
