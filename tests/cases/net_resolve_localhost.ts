// `netResolve`: `localhost` resolves, through the hosts file, to loopback
// addresses only (127.0.0.0/8 mapped, or ::1), each with the port asked for in
// the last two bytes, and family 4 gives an IPv4 one. A numeric host needs no
// lookup and is one address, and an `out` with room for one keeps the first
// and answers 1 however many the resolver had.
import { netResolve } from "nish:net";

const isLoopback = (a: u8[], at: i32): boolean => {
  let mapped = a[at + 10] === 255 && a[at + 11] === 255 && a[at + 12] === 127;
  let v6 = a[at + 15] === 1;
  for (let i = 0; i < 10; i++) {
    if (a[at + i] !== 0) {
      mapped = false;
      v6 = false;
    }
  }
  for (let i = 10; i < 15; i++) {
    if (a[at + i] !== 0) {
      v6 = false;
    }
  }
  return mapped || v6;
};

const portAt = (a: u8[], at: i32): i32 => toI32(a[at + 16]) * 256 + toI32(a[at + 17]);

export const main = (): number => {
  const out: u8[] = new Array<u8>(18 * 8);
  const n = netResolve(out, "localhost", 8080, 0);
  let loopback = n >= 1;
  for (let i = 0; i < n; i++) {
    loopback = loopback && isLoopback(out, i * 18) && portAt(out, i * 18) === 8080;
  }
  console.log(`localhost: ${loopback}`);
  const v4 = netResolve(out, "localhost", 443, 4);
  console.log(`localhost v4: ${v4 >= 1 && out[10] === 255 && out[12] === 127 && portAt(out, 0) === 443}`);
  const one: u8[] = new Array<u8>(18);
  console.log(netResolve(one, "127.0.0.1", 65535, 0));
  console.log(`${one[10]} ${one[11]} ${one[12]} ${one[15]} ${portAt(one, 0)}`);
  console.log(netResolve(one, "localhost", 0, 0));
  return 0;
};
