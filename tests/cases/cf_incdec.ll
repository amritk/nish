define internal noundef double @bump(double noundef %v) #0 {
entry:
  %x.addr = alloca double, align 8
  store double %v, double* %x.addr, align 8
  %0 = load double, double* %x.addr, align 8
  %1 = fadd double %0, 0x3FF0000000000000
  store double %1, double* %x.addr, align 8
  %2 = load double, double* %x.addr, align 8
  %3 = fsub double %2, 0x3FF0000000000000
  store double %3, double* %x.addr, align 8
  %4 = load double, double* %x.addr, align 8
  %5 = fadd double %4, 0x3FF0000000000000
  store double %5, double* %x.addr, align 8
  ret double %5
}

define noundef i32 @test() #0 {
entry:
  %i.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  store i32 5, i32* %i.addr, align 4
  %0 = load i32, i32* %i.addr, align 4
  %1 = add nsw i32 %0, 1
  store i32 %1, i32* %i.addr, align 4
  store i32 %0, i32* %a.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  store i32 %3, i32* %b.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = sub nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  store i32 %4, i32* %c.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sub nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  store i32 %7, i32* %d.addr, align 4
  %8 = load i32, i32* %a.addr, align 4
  %9 = mul nsw i32 %8, 1000
  %10 = load i32, i32* %b.addr, align 4
  %11 = mul nsw i32 %10, 100
  %12 = add nsw i32 %9, %11
  %13 = load i32, i32* %c.addr, align 4
  %14 = mul nsw i32 %13, 10
  %15 = add nsw i32 %12, %14
  %16 = load i32, i32* %d.addr, align 4
  %17 = add nsw i32 %15, %16
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %17, %18
  ret i32 %19
}

attributes #0 = { nounwind willreturn readnone }
