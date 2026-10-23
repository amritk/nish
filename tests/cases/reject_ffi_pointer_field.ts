// WP27 S2: a `CPtr` in a field would put a foreign address inside a value the
// arena owns and the escape analysis walks. It is not arena memory and must
// never be treated as though it were, so the type cannot be stored in one. A
// class with a `CPtr` field is a handle class since WP40 (§4a), with rules of
// its own (`reject_ffi_handle_*`); an interface has no constructor to own the
// pointer, and keeps this rule.
declare function handle(): CPtr;

interface Session {
  open: CPtr;
}

export const main = (): i32 => 0;
