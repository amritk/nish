// WP27 S2: a `CPtr` in a field would put a foreign address inside a value the
// arena owns and the escape analysis walks. It is not arena memory and must
// never be treated as though it were, so the type cannot be stored in one.
declare function handle(): CPtr;

class Session {
  open: CPtr = handle();
}

export const main = (): i32 => 0;
