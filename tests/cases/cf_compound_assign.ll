define noundef double @scale(double noundef %v, double noundef %k) #0 {
entry:
  %r.addr = alloca double, align 8
  store double %v, double* %r.addr, align 8
  %0 = load double, double* %r.addr, align 8
  %1 = fmul double %0, %k
  store double %1, double* %r.addr, align 8
  %2 = load double, double* %r.addr, align 8
  %3 = fadd double %2, %v
  store double %3, double* %r.addr, align 8
  %4 = load double, double* %r.addr, align 8
  %5 = fdiv double %4, %k
  store double %5, double* %r.addr, align 8
  %6 = load double, double* %r.addr, align 8
  ret double %6
}

define noundef i32 @test() #0 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = add i32 %0, 5
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = sub i32 %2, 3
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = mul i32 %4, 4
  store i32 %5, i32* %x.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = sdiv i32 %6, 5
  store i32 %7, i32* %x.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = srem i32 %8, 4
  store i32 %9, i32* %x.addr, align 4
  store i32 2, i32* %y.addr, align 4
  %10 = load i32, i32* %y.addr, align 4
  %11 = load i32, i32* %x.addr, align 4
  %12 = add i32 %11, 1
  store i32 %12, i32* %x.addr, align 4
  %13 = add i32 %10, %12
  store i32 %13, i32* %y.addr, align 4
  %14 = load i32, i32* %x.addr, align 4
  %15 = mul i32 %14, 100
  %16 = load i32, i32* %y.addr, align 4
  %17 = add i32 %15, %16
  ret i32 %17
}

attributes #0 = { nounwind willreturn readnone }
