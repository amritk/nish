define noundef i32 @test() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %wide.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %fits.addr = alloca i32, align 4
  %shifted.addr = alloca i32, align 4
  store i32 70000, i32* %a.addr, align 4
  store i32 40000, i32* %b.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = load i32, i32* %b.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = mul nsw i64 %1, %3
  store i64 %4, i64* %wide.addr, align 8
  store i32 3, i32* %n.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = mul nsw i32 %5, 2
  store i32 %6, i32* %n.addr, align 4
  %7 = add nsw i32 2147483646, 1
  store i32 %7, i32* %fits.addr, align 4
  %8 = shl i32 1, 31
  store i32 %8, i32* %shifted.addr, align 4
  %9 = load i64, i64* %wide.addr, align 8
  %10 = sdiv i64 %9, 100000000
  %11 = trunc i64 %10 to i32
  %12 = load i32, i32* %n.addr, align 4
  %13 = add nsw i32 %11, %12
  %14 = load i32, i32* %fits.addr, align 4
  %15 = sub nsw i32 %14, 2147483646
  %16 = add nsw i32 %13, %15
  %17 = load i32, i32* %shifted.addr, align 4
  %18 = load i32, i32* %shifted.addr, align 4
  %19 = sub nsw i32 %17, %18
  %20 = add nsw i32 %16, %19
  ret i32 %20
}

attributes #0 = { nounwind willreturn readnone }
