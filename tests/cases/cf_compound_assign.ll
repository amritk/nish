declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef double @scale(double noundef %v, double noundef %k) #0 {
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

define noundef i32 @test() #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = add nsw i32 %0, 5
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = sub nsw i32 %2, 3
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %x.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = icmp eq i32 5, 0
  %10 = icmp eq i32 %8, -2147483648
  %11 = icmp eq i32 5, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %9)
  unreachable

div.ok:
  %14 = sdiv i32 %8, 5
  store i32 %14, i32* %x.addr, align 4
  %15 = load i32, i32* %x.addr, align 4
  %16 = icmp eq i32 4, 0
  %17 = icmp eq i32 %15, -2147483648
  %18 = icmp eq i32 4, -1
  %19 = and i1 %17, %18
  %20 = or i1 %16, %19
  br i1 %20, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %16)
  unreachable

div.ok.1:
  %21 = srem i32 %15, 4
  store i32 %21, i32* %x.addr, align 4
  store i32 2, i32* %y.addr, align 4
  %22 = load i32, i32* %y.addr, align 4
  %23 = load i32, i32* %x.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 1)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %25, i32* %x.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %28, i32* %y.addr, align 4
  %30 = load i32, i32* %x.addr, align 4
  %31 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %30, i32 100)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %34 = load i32, i32* %y.addr, align 4
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %36

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %div.ok.1 ], [ 0, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
