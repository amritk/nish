declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define noundef double @minF64(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fcmp uno double %a, %b
  br i1 %0, label %min.end, label %min.num

min.num:
  %1 = fcmp olt double %a, %b
  %2 = select i1 %1, double %a, double %b
  %3 = fcmp oeq double %a, %b
  br i1 %3, label %min.same, label %min.end

min.same:
  %4 = bitcast double %a to i64
  %5 = icmp slt i64 %4, 0
  %6 = select i1 %5, double %a, double %b
  br label %min.end

min.end:
  %7 = phi double [ 0x7FF8000000000000, %entry ], [ %2, %min.num ], [ %6, %min.same ]
  ret double %7
}

define noundef double @maxF64(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fcmp uno double %a, %b
  br i1 %0, label %max.end, label %max.num

max.num:
  %1 = fcmp ogt double %a, %b
  %2 = select i1 %1, double %a, double %b
  %3 = fcmp oeq double %a, %b
  br i1 %3, label %max.same, label %max.end

max.same:
  %4 = bitcast double %a to i64
  %5 = icmp slt i64 %4, 0
  %6 = select i1 %5, double %b, double %a
  br label %max.end

max.end:
  %7 = phi double [ 0x7FF8000000000000, %entry ], [ %2, %max.num ], [ %6, %max.same ]
  ret double %7
}

define noundef float @minF32(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fcmp uno float %a, %b
  br i1 %0, label %min.end, label %min.num

min.num:
  %1 = fcmp olt float %a, %b
  %2 = select i1 %1, float %a, float %b
  %3 = fcmp oeq float %a, %b
  br i1 %3, label %min.same, label %min.end

min.same:
  %4 = bitcast float %a to i32
  %5 = icmp slt i32 %4, 0
  %6 = select i1 %5, float %a, float %b
  br label %min.end

min.end:
  %7 = phi float [ 0x7FF8000000000000, %entry ], [ %2, %min.num ], [ %6, %min.same ]
  ret float %7
}

define noundef float @maxF32(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fcmp uno float %a, %b
  br i1 %0, label %max.end, label %max.num

max.num:
  %1 = fcmp ogt float %a, %b
  %2 = select i1 %1, float %a, float %b
  %3 = fcmp oeq float %a, %b
  br i1 %3, label %max.same, label %max.end

max.same:
  %4 = bitcast float %a to i32
  %5 = icmp slt i32 %4, 0
  %6 = select i1 %5, float %b, float %a
  br label %max.end

max.end:
  %7 = phi float [ 0x7FF8000000000000, %entry ], [ %2, %max.num ], [ %6, %max.same ]
  ret float %7
}

define internal noundef zeroext i1 @isNan(double noundef %x) #0 {
entry:
  %0 = fcmp une double %x, %x
  ret i1 %0
}

define internal noundef zeroext i1 @isNan32(float noundef %x) #0 {
entry:
  %0 = fcmp une float %x, %x
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
  %8 = call i1 @isNan(double %7)
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load i32, i32* %ok.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %ok.addr, align 4
  br label %if.end

if.end:
  %11 = load double, double* %one.addr, align 8
  %12 = load double, double* %nan.addr, align 8
  %13 = call double @minF64(double %11, double %12)
  %14 = call i1 @isNan(double %13)
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = load i32, i32* %ok.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %ok.addr, align 4
  br label %if.end.1

if.end.1:
  %19 = load double, double* %nan.addr, align 8
  %20 = call double @maxF64(double %19, double 0x4000000000000000)
  %21 = call i1 @isNan(double %20)
  br i1 %21, label %if.then.2, label %if.end.2

if.then.2:
  %22 = load i32, i32* %ok.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 1)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %24, i32* %ok.addr, align 4
  br label %if.end.2

if.end.2:
  %26 = fdiv double 0x4014000000000000, 0x4000000000000000
  %27 = load double, double* %one.addr, align 8
  %28 = fneg double %27
  %29 = call double @minF64(double %26, double %28)
  %30 = load double, double* %one.addr, align 8
  %31 = fneg double %30
  %32 = fcmp oeq double %29, %31
  br i1 %32, label %if.then.3, label %if.end.3

if.then.3:
  %33 = load i32, i32* %ok.addr, align 4
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 1)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %35, i32* %ok.addr, align 4
  br label %if.end.3

if.end.3:
  %37 = fneg double 0x4008000000000000
  %38 = fneg double 0x401C000000000000
  %39 = call double @maxF64(double %37, double %38)
  %40 = fneg double 0x4008000000000000
  %41 = fcmp oeq double %39, %40
  br i1 %41, label %if.then.4, label %if.end.4

if.then.4:
  %42 = load i32, i32* %ok.addr, align 4
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 1)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %44, i32* %ok.addr, align 4
  br label %if.end.4

if.end.4:
  %46 = load double, double* %nan.addr, align 8
  %47 = load double, double* %nan.addr, align 8
  %48 = call double @minF64(double %46, double %47)
  %49 = call i1 @isNan(double %48)
  br i1 %49, label %if.then.5, label %if.end.5

if.then.5:
  %50 = load i32, i32* %ok.addr, align 4
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 1)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %52, i32* %ok.addr, align 4
  br label %if.end.5

if.end.5:
  %54 = load double, double* %one.addr, align 8
  %55 = load double, double* %zero.addr, align 8
  %56 = load double, double* %zero.addr, align 8
  %57 = fneg double %56
  %58 = call double @minF64(double %55, double %57)
  %59 = fdiv double %54, %58
  %60 = load double, double* %zero.addr, align 8
  %61 = fcmp olt double %59, %60
  br i1 %61, label %if.then.6, label %if.end.6

if.then.6:
  %62 = load i32, i32* %ok.addr, align 4
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 1)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %64, i32* %ok.addr, align 4
  br label %if.end.6

if.end.6:
  %66 = load double, double* %one.addr, align 8
  %67 = load double, double* %zero.addr, align 8
  %68 = fneg double %67
  %69 = load double, double* %zero.addr, align 8
  %70 = call double @maxF64(double %68, double %69)
  %71 = fdiv double %66, %70
  %72 = load double, double* %zero.addr, align 8
  %73 = fcmp ogt double %71, %72
  br i1 %73, label %if.then.7, label %if.end.7

if.then.7:
  %74 = load i32, i32* %ok.addr, align 4
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 1)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %76, i32* %ok.addr, align 4
  br label %if.end.7

if.end.7:
  %78 = load float, float* %nan32.addr, align 4
  %79 = fdiv float 0x4008000000000000, 0x4000000000000000
  %80 = call float @minF32(float %78, float %79)
  %81 = call i1 @isNan32(float %80)
  br i1 %81, label %if.then.8, label %if.end.8

if.then.8:
  %82 = load i32, i32* %ok.addr, align 4
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 1)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %84, i32* %ok.addr, align 4
  br label %if.end.8

if.end.8:
  %86 = fdiv float 0x3FF0000000000000, 0x4010000000000000
  %87 = load float, float* %nan32.addr, align 4
  %88 = call float @maxF32(float %86, float %87)
  %89 = call i1 @isNan32(float %88)
  br i1 %89, label %if.then.9, label %if.end.9

if.then.9:
  %90 = load i32, i32* %ok.addr, align 4
  %91 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %90, i32 1)
  %92 = extractvalue { i32, i1 } %91, 0
  %93 = extractvalue { i32, i1 } %91, 1
  br i1 %93, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i32 %92, i32* %ok.addr, align 4
  br label %if.end.9

if.end.9:
  %94 = call float @minF32(float 0x4008000000000000, float 0x4000000000000000)
  %95 = fcmp oeq float %94, 0x4000000000000000
  br i1 %95, label %if.then.10, label %if.end.10

if.then.10:
  %96 = load i32, i32* %ok.addr, align 4
  %97 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %96, i32 1)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  store i32 %98, i32* %ok.addr, align 4
  br label %if.end.10

if.end.10:
  %100 = load i32, i32* %ok.addr, align 4
  ret i32 %100

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
