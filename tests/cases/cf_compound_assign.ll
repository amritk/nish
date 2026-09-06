declare void @sts_panic_div(i1 noundef zeroext) #1

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
  %7 = icmp eq i32 5, 0
  %8 = icmp eq i32 %6, -2147483648
  %9 = icmp eq i32 5, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %7)
  unreachable

div.ok:
  %12 = sdiv i32 %6, 5
  store i32 %12, i32* %x.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = icmp eq i32 4, 0
  %15 = icmp eq i32 %13, -2147483648
  %16 = icmp eq i32 4, -1
  %17 = and i1 %15, %16
  %18 = or i1 %14, %17
  br i1 %18, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %14)
  unreachable

div.ok.1:
  %19 = srem i32 %13, 4
  store i32 %19, i32* %x.addr, align 4
  store i32 2, i32* %y.addr, align 4
  %20 = load i32, i32* %y.addr, align 4
  %21 = load i32, i32* %x.addr, align 4
  %22 = add i32 %21, 1
  store i32 %22, i32* %x.addr, align 4
  %23 = add i32 %20, %22
  store i32 %23, i32* %y.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = mul i32 %24, 100
  %26 = load i32, i32* %y.addr, align 4
  %27 = add i32 %25, %26
  ret i32 %27
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind noreturn cold }
