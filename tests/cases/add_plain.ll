declare extern_weak void @nish_panic_overflow(i32 noundef)
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32)

define internal i32 @add(i32 %a, i32 %b) {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}
