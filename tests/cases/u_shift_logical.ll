declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define noundef i32 @shiftU32(i32 noundef %x) #0 {
entry:
  %0 = lshr i32 %x, 1
  %1 = lshr i32 %x, 1
  %2 = add i32 %0, %1
  ret i32 %2
}

define noundef i32 @shiftI32(i32 noundef %x) #1 {
entry:
  %0 = ashr i32 %x, 1
  %1 = lshr i32 %x, 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
