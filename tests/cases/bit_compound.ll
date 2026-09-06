define noundef i32 @test() #0 {
entry:
  %x.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 255, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = and i32 %0, 60
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = or i32 %2, 3
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = xor i32 %4, 5
  store i32 %5, i32* %x.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = shl i32 %6, 2
  store i32 %7, i32* %x.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = ashr i32 %8, 1
  store i32 %9, i32* %x.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = lshr i32 %10, 3
  store i32 %11, i32* %x.addr, align 4
  store i32 2, i32* %n.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = load i32, i32* %n.addr, align 4
  %14 = and i32 %13, 31
  %15 = shl i32 %12, %14
  store i32 %15, i32* %x.addr, align 4
  %16 = load i32, i32* %x.addr, align 4
  ret i32 %16
}

attributes #0 = { nounwind willreturn readnone }
