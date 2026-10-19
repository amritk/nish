// WP27 S3.2: a `string` copied out of C inside a `using a = arena()` block is
// the block's allocation, so a local declared outside it cannot keep it: the
// block releases the copy when it ends. Refused in a loop and outside one, as
// a call of a function returning a fresh `string` is.
declare function strerror(errnum: i32): string;

function looped(n: i32): string {
  let s = "";
  {
    using a = arena();
    for (let i = 0; i < n; i++) {
      s = strerror(i);
    }
  }
  return s;
}

function direct(): string {
  let s = "";
  {
    using a = arena();
    s = strerror(13);
  }
  return s;
}

export function main(): i32 {
  console.log(looped(4));
  console.log(direct());
  return 0;
}
