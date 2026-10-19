// WP27 S3.3: a `CPtr | null` parameter of a `declare function` takes the
// literal `null`, the program's own "no buffer", or a pointer narrowed with
// `!== null`. A nullable pointer the program holds came from C, so passing it
// back unnarrowed would hand C a null by a path nobody tested. Refused for a
// local, in parentheses, through a ternary and a `??`, in a constructor
// reached by `new` and in a method;
// `reject_ffi_pointer_nullable_specialised` is the call through a specialised
// function parameter.
declare function realpath(path: string, resolved: CPtr | null): CPtr | null;
declare function free(p: CPtr | null): void;

function local(): void {
  const p = realpath(".", null);
  free(p);
}

function parens(): void {
  const p = realpath(".", null);
  free((p));
}

function ternary(b: boolean): void {
  const p = realpath(".", null);
  free(b ? p : null);
}

function nullish(): void {
  const p = realpath(".", null);
  free(p ?? null);
}

class Owner {
  readonly n: i32;
  constructor() {
    const p = realpath(".", null);
    free(p);
    this.n = 1;
  }
  release(): void {
    const p = realpath(".", null);
    free(p);
  }
}

export function main(): i32 {
  local();
  parens();
  ternary(true);
  nullish();
  const o = new Owner();
  o.release();
  return o.n;
}
