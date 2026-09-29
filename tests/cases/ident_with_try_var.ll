define internal noundef i32 @with(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %try.addr = alloca i32, align 4
  %var.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %0 = call i32 @with(i32 1)
  store i32 %0, i32* %try.addr, align 4
  store i32 3, i32* %var.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %1 = load i32, i32* %n.addr, align 4
  %2 = call i32 @with(i32 %1)
  %3 = load i32, i32* %try.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = load i32, i32* %try.addr, align 4
  %6 = add nsw i32 %4, %5
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %var.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = load i32, i32* %var.addr, align 4
  %10 = add nsw i32 %8, %9
  store i32 %10, i32* %n.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  ret i32 %11
}

attributes #0 = { nounwind willreturn readnone }
