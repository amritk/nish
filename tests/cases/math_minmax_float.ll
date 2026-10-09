declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare double @llvm.minnum.f64(double, double) #0
declare double @llvm.maxnum.f64(double, double) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare float @llvm.minnum.f32(float, float) #0
declare float @llvm.maxnum.f32(float, float) #0

define noundef double @minF64(double noundef %a, double noundef %b) #0 {
entry:
  %0 = call double @llvm.minnum.f64(double %a, double %b)
  ret double %0
}

define noundef double @maxF64(double noundef %a, double noundef %b) #0 {
entry:
  %0 = call double @llvm.maxnum.f64(double %a, double %b)
  ret double %0
}

define noundef float @minF32(float noundef %a, float noundef %b) #0 {
entry:
  %0 = call float @llvm.minnum.f32(float %a, float %b)
  ret float %0
}

define noundef float @maxF32(float noundef %a, float noundef %b) #0 {
entry:
  %0 = call float @llvm.maxnum.f32(float %a, float %b)
  ret float %0
}

define internal noundef zeroext i1 @isNan(double noundef %x) #0 {
entry:
  %0 = fcmp une double %x, %x
  ret i1 %0
}

define noundef i32 @test() #1 {
entry:
  %zero.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %nan32.addr = alloca float, align 4
  %ok.addr = alloca i32, align 4
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %zero.addr, align 8
  %1 = load double, double* %zero.addr, align 8
  %2 = fdiv double %0, %1
  store double %2, double* %nan.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %3 = load double, double* %nan.addr, align 8
  %4 = fptrunc double %3 to float
  store float %4, float* %nan32.addr, align 4
  store i32 0, i32* %ok.addr, align 4
  %5 = load double, double* %nan.addr, align 8
  %6 = load double, double* %one.addr, align 8
  %7 = call double @minF64(double %5, double %6)
  %8 = load double, double* %one.addr, align 8
  %9 = fcmp oeq double %7, %8
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i32, i32* %ok.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %ok.addr, align 4
  br label %if.end

if.end:
  %12 = load double, double* %one.addr, align 8
  %13 = load double, double* %nan.addr, align 8
  %14 = call double @minF64(double %12, double %13)
  %15 = load double, double* %one.addr, align 8
  %16 = fcmp oeq double %14, %15
  br i1 %16, label %if.then.1, label %if.end.1

if.then.1:
  %17 = load i32, i32* %ok.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 1)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %ok.addr, align 4
  br label %if.end.1

if.end.1:
  %21 = load double, double* %nan.addr, align 8
  %22 = call double @maxF64(double %21, double 0x4000000000000000)
  %23 = fcmp oeq double %22, 0x4000000000000000
  br i1 %23, label %if.then.2, label %if.end.2

if.then.2:
  %24 = load i32, i32* %ok.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %26, i32* %ok.addr, align 4
  br label %if.end.2

if.end.2:
  %28 = fdiv double 0x4014000000000000, 0x4000000000000000
  %29 = load double, double* %one.addr, align 8
  %30 = fneg double %29
  %31 = call double @minF64(double %28, double %30)
  %32 = load double, double* %one.addr, align 8
  %33 = fneg double %32
  %34 = fcmp oeq double %31, %33
  br i1 %34, label %if.then.3, label %if.end.3

if.then.3:
  %35 = load i32, i32* %ok.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %ok.addr, align 4
  br label %if.end.3

if.end.3:
  %39 = fneg double 0x4008000000000000
  %40 = fneg double 0x401C000000000000
  %41 = call double @maxF64(double %39, double %40)
  %42 = fneg double 0x4008000000000000
  %43 = fcmp oeq double %41, %42
  br i1 %43, label %if.then.4, label %if.end.4

if.then.4:
  %44 = load i32, i32* %ok.addr, align 4
  %45 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 1)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %46, i32* %ok.addr, align 4
  br label %if.end.4

if.end.4:
  %48 = load double, double* %nan.addr, align 8
  %49 = load double, double* %nan.addr, align 8
  %50 = call double @minF64(double %48, double %49)
  %51 = call i1 @isNan(double %50)
  br i1 %51, label %if.then.5, label %if.end.5

if.then.5:
  %52 = load i32, i32* %ok.addr, align 4
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %54, i32* %ok.addr, align 4
  br label %if.end.5

if.end.5:
  %56 = load float, float* %nan32.addr, align 4
  %57 = fdiv float 0x4008000000000000, 0x4000000000000000
  %58 = call float @minF32(float %56, float %57)
  %59 = fdiv float 0x4008000000000000, 0x4000000000000000
  %60 = fcmp oeq float %58, %59
  br i1 %60, label %if.then.6, label %if.end.6

if.then.6:
  %61 = load i32, i32* %ok.addr, align 4
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 1)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %63, i32* %ok.addr, align 4
  br label %if.end.6

if.end.6:
  %65 = fdiv float 0x3FF0000000000000, 0x4010000000000000
  %66 = load float, float* %nan32.addr, align 4
  %67 = call float @maxF32(float %65, float %66)
  %68 = fdiv float 0x3FF0000000000000, 0x4010000000000000
  %69 = fcmp oeq float %67, %68
  br i1 %69, label %if.then.7, label %if.end.7

if.then.7:
  %70 = load i32, i32* %ok.addr, align 4
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %70, i32 1)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %72, i32* %ok.addr, align 4
  br label %if.end.7

if.end.7:
  %74 = call float @minF32(float 0x4008000000000000, float 0x4000000000000000)
  %75 = fcmp oeq float %74, 0x4000000000000000
  br i1 %75, label %if.then.8, label %if.end.8

if.then.8:
  %76 = load i32, i32* %ok.addr, align 4
  %77 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %76, i32 1)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %78, i32* %ok.addr, align 4
  br label %if.end.8

if.end.8:
  %80 = load i32, i32* %ok.addr, align 4
  ret i32 %80

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
