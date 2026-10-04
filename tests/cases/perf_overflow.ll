declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define noundef i32 @test() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %widened.addr = alloca i64, align 8
  %shifted.addr = alloca i32, align 4
  store i32 3, i32* %a.addr, align 4
  store i32 4, i32* %b.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = load i32, i32* %b.addr, align 4
  %2 = mul nsw i32 %0, %1
  %3 = sext i32 %2 to i64
  store i64 %3, i64* %widened.addr, align 8
  %4 = shl i32 1, 0
  store i32 %4, i32* %shifted.addr, align 4
  %5 = load i64, i64* %widened.addr, align 8
  %6 = trunc i64 %5 to i32
  %7 = load i32, i32* %shifted.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
