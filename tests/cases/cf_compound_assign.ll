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
  %9 = sdiv i32 %8, 5
  store i32 %9, i32* %x.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = srem i32 %10, 4
  store i32 %11, i32* %x.addr, align 4
  store i32 2, i32* %y.addr, align 4
  %12 = load i32, i32* %y.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %15, i32* %x.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %15)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %18, i32* %y.addr, align 4
  %20 = load i32, i32* %x.addr, align 4
  %21 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %20, i32 100)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %24 = load i32, i32* %y.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %26

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
