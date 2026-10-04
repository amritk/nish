declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @byThree(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 3
  ret i32 %0
}

define internal noundef i32 @byThirtyTwo(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 0
  ret i32 %0
}

define internal noundef i32 @byThirtyThree(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 1
  ret i32 %0
}

define internal noundef i32 @byMinusOne(i32 noundef %a) #0 {
entry:
  %0 = shl i32 %a, 31
  ret i32 %0
}

define noundef i32 @test() #1 {
entry:
  %0 = call i32 @byThree(i32 1)
  %1 = call i32 @byThirtyTwo(i32 7)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @byThirtyThree(i32 1)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call i32 @byMinusOne(i32 1)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
