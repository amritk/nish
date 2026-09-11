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
  %8 = add nsw i32 %6, %7
  ret i32 %8
}

attributes #0 = { nounwind willreturn readnone }
