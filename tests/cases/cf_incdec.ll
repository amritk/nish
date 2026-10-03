declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

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

define noundef i32 @test() #1 {
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
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %i.addr, align 4
  store i32 %4, i32* %b.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sub nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  store i32 %6, i32* %c.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sub nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  store i32 %9, i32* %d.addr, align 4
  %10 = load i32, i32* %a.addr, align 4
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 1000)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = load i32, i32* %b.addr, align 4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 100)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %16)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %21 = load i32, i32* %c.addr, align 4
  %22 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %21, i32 10)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %23)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %28 = load i32, i32* %d.addr, align 4
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %32 = load i32, i32* %i.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i32 %34

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 2, %ovf.ok.3 ], [ 0, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 0, %ovf.ok.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
