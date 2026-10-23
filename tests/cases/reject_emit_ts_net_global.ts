// WP33 R4: every `nish:net` name is also a global builtin, so a socket call
// spelled without the import is refused under --emit-ts as the imported one
// is (NL4011), from the call rather than from an import there is none of.

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  console.log(netAddress(out, "127.0.0.1", 8080));
  return 0;
};
