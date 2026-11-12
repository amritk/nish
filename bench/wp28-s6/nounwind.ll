; S6, what `nounwind` buys outside the unwind tables, in the smallest function
; that shows it: a store into the caller's memory, a call, and a store that
; overwrites the first. While the callee cannot unwind, nobody can see the
; first store and `opt -O2` deletes it. Take `nounwind` off (run.mjs does, on
; a copy) and the caller's landing pad could read `out` after the callee
; throws, so both stores stay. Under landing pads every Nish function that
; calls one that may throw is in the second case.

declare void @callee(i32 noundef) #0

define void @fill(ptr noalias nocapture noundef %out, i32 noundef %x) #0 {
entry:
  store i32 0, ptr %out, align 4
  call void @callee(i32 %x)
  store i32 %x, ptr %out, align 4
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
