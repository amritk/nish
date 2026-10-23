// WP40 B1.3 widens B1.2's proof: a later argument that is itself a foreign
// call cannot resize an array (C is lent `buf->data`, never the header), so
// `credited` proves `toU64(buf.length)` and carries no `ffi-length` check.
// `rewound` calls C *and* pops, so it resizes: `uncredited` keeps the check,
// and its run compares 4 against 3 and panics.
declare function pwrite(fd: i32, buf: readonly u8[], n: u64, off: i64): i64;
declare function lseek(fd: i32, off: i64, whence: i32): i64;

function rewound(b: u8[]): i64 {
  const off = lseek(-1, 0, 1);
  b.pop();
  return off;
}

export function credited(): i32 {
  const buf: u8[] = [1, 2, 3, 4];
  return toI32(pwrite(-1, buf, toU64(buf.length), lseek(-1, 0, 1)));
}

export function uncredited(): i32 {
  const buf: u8[] = [1, 2, 3, 4];
  return toI32(pwrite(-1, buf, toU64(buf.length), rewound(buf)));
}
