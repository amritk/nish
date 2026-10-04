declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #0

define internal noundef i64 @mask(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = and i64 %a, %b
  %1 = xor i64 %a, %b
  %2 = or i64 %0, %1
  ret i64 %2
}

define internal noundef i64 @shift(i64 noundef %a, i64 noundef %n) #1 {
entry:
  %0 = and i64 %n, 63
  %1 = shl i64 %a, %0
  %2 = ashr i64 %a, 4
  %3 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %1, i64 %2)
  %4 = extractvalue { i64, i1 } %3, 0
  %5 = extractvalue { i64, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = lshr i64 %a, 1
  %7 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %4, i64 %6)
  %8 = extractvalue { i64, i1 } %7, 0
  %9 = extractvalue { i64, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i64 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %0 = call i64 @mask(i64 255, i64 15)
  %1 = trunc i64 %0 to i32
  %2 = call i64 @shift(i64 1024, i64 3)
  %3 = trunc i64 %2 to i32
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
