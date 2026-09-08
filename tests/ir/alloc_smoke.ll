
; Appended to a --runtime-decls module by tests/run.js.
; Two 12-byte allocations must be 16 bytes apart (12 rounded up to 8-byte units).
define i64 @alloc_smoke() {
entry:
  %p = call i8* @amrit_alloc_struct(i64 12)
  %q = call i8* @amrit_alloc_struct(i64 12)
  %pi = ptrtoint i8* %p to i64
  %qi = ptrtoint i8* %q to i64
  %d = sub i64 %qi, %pi
  ret i64 %d
}
