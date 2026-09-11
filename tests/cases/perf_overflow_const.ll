define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i32, align 4
  %product.addr = alloca i32, align 4
  %nested.addr = alloca i32, align 4
  %0 = add nsw i32 2147483647, 1
  store i32 %0, i32* %big.addr, align 4
  %1 = mul nsw i32 100000, 100000
  store i32 %1, i32* %product.addr, align 4
  %2 = mul nsw i32 100000, 100000
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %nested.addr, align 4
  %4 = load i32, i32* %big.addr, align 4
  %5 = load i32, i32* %product.addr, align 4
  %6 = add nsw i32 %4, %5
  %7 = load i32, i32* %nested.addr, align 4
  %8 = add nsw i32 %6, %7
  ret i32 %8
}

attributes #0 = { nounwind willreturn readnone }
