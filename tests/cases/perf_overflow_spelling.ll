define noundef i32 @test() #0 {
entry:
  %hexShift.addr = alloca i32, align 4
  %exponent.addr = alloca i32, align 4
  %0 = shl i32 1, 0
  store i32 %0, i32* %hexShift.addr, align 4
  %1 = mul nsw i32 100000, 100000
  store i32 %1, i32* %exponent.addr, align 4
  %2 = load i32, i32* %hexShift.addr, align 4
  %3 = load i32, i32* %exponent.addr, align 4
  %4 = add nsw i32 %2, %3
  ret i32 %4
}

attributes #0 = { nounwind willreturn readnone }
