target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define noundef double @grow(double noundef %x) #0 {
entry:
  %0 = tail call double @nish.expF64(double %x)
  ret double %0
}

define internal noundef i32 @nish.hiWord(double noundef %x) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = ashr i64 %0, %2
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef double @nish.pow2(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1023)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = sext i32 %1 to i64
  %4 = sext i32 52 to i64
  %5 = and i64 %4, 63
  %6 = shl i64 %3, %5
  %7 = bitcast i64 %6 to double
  ret double %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #1 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef double @nish.expPoly(double noundef %t) #1 {
entry:
  %0 = fmul double %t, 0x3E66376972BEA4D0
  %1 = fsub double %0, 0x3EBBBD41C5D26BF1
  %2 = fmul double %t, %1
  %3 = fadd double %2, 0x3F11566AAF25DE2C
  %4 = fmul double %t, %3
  %5 = fsub double %4, 0x3F66C16C16BEBD93
  %6 = fmul double %t, %5
  %7 = fadd double %6, 0x3FC555555555553E
  ret double %7
}

define internal noundef double @nish.overflow(double noundef %s) #1 {
entry:
  %0 = fmul double %s, 0x7E37E43C8800759C
  %1 = fmul double %0, 0x7E37E43C8800759C
  ret double %1
}

define internal noundef double @nish.expF64(double noundef %x) #0 {
entry:
  %hxs.addr = alloca i32, align 4
  %negative.addr = alloca i1, align 1
  %hx.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %hi.addr = alloca double, align 8
  %lo.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %half.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  %t.addr.1 = alloca double, align 8
  %c.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %y.addr = alloca double, align 8
  %0 = call i32 @nish.hiWord(double %x)
  store i32 %0, i32* %hxs.addr, align 4
  %1 = load i32, i32* %hxs.addr, align 4
  %2 = icmp slt i32 %1, 0
  store i1 %2, i1* %negative.addr, align 1
  %3 = load i32, i32* %hxs.addr, align 4
  %4 = and i32 %3, 2147483647
  store i32 %4, i32* %hx.addr, align 4
  %5 = load i32, i32* %hx.addr, align 4
  %6 = icmp sge i32 %5, 1082535490
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = load i32, i32* %hx.addr, align 4
  %8 = icmp sge i32 %7, 2146435072
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = call i1 @nish.isNan(double %x)
  br i1 %9, label %if.then.2, label %if.end.2

if.then.2:
  %10 = fadd double %x, %x
  ret double %10

if.end.2:
  %11 = load i1, i1* %negative.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %12 = phi double [ 0x0000000000000000, %cond.true ], [ %x, %cond.false ]
  ret double %12

if.end.1:
  %13 = fcmp ogt double %x, 0x40862E42FEFA39EF
  br i1 %13, label %if.then.3, label %if.end.3

if.then.3:
  %14 = tail call double @nish.overflow(double 0x3FF0000000000000)
  ret double %14

if.end.3:
  %15 = fneg double 0x40874910D52D3051
  %16 = fcmp olt double %x, %15
  br i1 %16, label %if.then.4, label %if.end.4

if.then.4:
  ret double 0x0000000000000000

if.end.4:
  br label %if.end

if.end:
  store i32 0, i32* %k.addr, align 4
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  store double %x, double* %r.addr, align 8
  %17 = load i32, i32* %hx.addr, align 4
  %18 = icmp sgt i32 %17, 1071001154
  br i1 %18, label %if.then.5, label %if.else

if.then.5:
  %19 = load i32, i32* %hx.addr, align 4
  %20 = icmp slt i32 %19, 1072734898
  br i1 %20, label %if.then.6, label %if.else.1

if.then.6:
  %21 = load i1, i1* %negative.addr, align 1
  br i1 %21, label %cond.true.1, label %cond.false.1

cond.true.1:
  %22 = fadd double %x, 0x3FE62E42FEE00000
  br label %cond.end.1

cond.false.1:
  %23 = fsub double %x, 0x3FE62E42FEE00000
  br label %cond.end.1

cond.end.1:
  %24 = phi double [ %22, %cond.true.1 ], [ %23, %cond.false.1 ]
  store double %24, double* %hi.addr, align 8
  %25 = load i1, i1* %negative.addr, align 1
  br i1 %25, label %cond.true.2, label %cond.false.2

cond.true.2:
  %26 = fneg double 0x3DEA39EF35793C76
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %27 = phi double [ %26, %cond.true.2 ], [ 0x3DEA39EF35793C76, %cond.false.2 ]
  store double %27, double* %lo.addr, align 8
  %28 = load i1, i1* %negative.addr, align 1
  br i1 %28, label %cond.true.3, label %cond.false.3

cond.true.3:
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %29 = phi i32 [ -1, %cond.true.3 ], [ 1, %cond.false.3 ]
  store i32 %29, i32* %k.addr, align 4
  br label %if.end.6

if.else.1:
  %30 = load i1, i1* %negative.addr, align 1
  br i1 %30, label %cond.true.4, label %cond.false.4

cond.true.4:
  %31 = fneg double 0x3FE0000000000000
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %32 = phi double [ %31, %cond.true.4 ], [ 0x3FE0000000000000, %cond.false.4 ]
  store double %32, double* %half.addr, align 8
  %33 = fmul double %x, 0x3FF71547652B82FE
  %34 = load double, double* %half.addr, align 8
  %35 = fadd double %33, %34
  %36 = call i32 @llvm.fptosi.sat.i32.f64(double %35)
  store i32 %36, i32* %k.addr, align 4
  %37 = load i32, i32* %k.addr, align 4
  %38 = sitofp i32 %37 to double
  store double %38, double* %t.addr, align 8
  %39 = load double, double* %t.addr, align 8
  %40 = fmul double %39, 0x3FE62E42FEE00000
  %41 = fsub double %x, %40
  store double %41, double* %hi.addr, align 8
  %42 = load double, double* %t.addr, align 8
  %43 = fmul double %42, 0x3DEA39EF35793C76
  store double %43, double* %lo.addr, align 8
  br label %if.end.6

if.end.6:
  %44 = load double, double* %hi.addr, align 8
  %45 = load double, double* %lo.addr, align 8
  %46 = fsub double %44, %45
  store double %46, double* %r.addr, align 8
  br label %if.end.5

if.else:
  %47 = load i32, i32* %hx.addr, align 4
  %48 = icmp slt i32 %47, 1043333120
  br i1 %48, label %if.then.7, label %if.end.7

if.then.7:
  %49 = fadd double %x, 0x3FF0000000000000
  ret double %49

if.end.7:
  br label %if.end.5

if.end.5:
  %50 = load double, double* %r.addr, align 8
  %51 = load double, double* %r.addr, align 8
  %52 = fmul double %50, %51
  store double %52, double* %t.addr.1, align 8
  %53 = load double, double* %r.addr, align 8
  %54 = load double, double* %t.addr.1, align 8
  %55 = load double, double* %t.addr.1, align 8
  %56 = call double @nish.expPoly(double %55)
  %57 = fmul double %54, %56
  %58 = fsub double %53, %57
  store double %58, double* %c.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %59 = load i32, i32* %k.addr, align 4
  %60 = icmp eq i32 %59, 0
  br i1 %60, label %if.then.8, label %if.end.8

if.then.8:
  %61 = load double, double* %one.addr, align 8
  %62 = load double, double* %r.addr, align 8
  %63 = load double, double* %c.addr, align 8
  %64 = fmul double %62, %63
  %65 = load double, double* %c.addr, align 8
  %66 = fsub double %65, 0x4000000000000000
  %67 = fdiv double %64, %66
  %68 = load double, double* %r.addr, align 8
  %69 = fsub double %67, %68
  %70 = fsub double %61, %69
  ret double %70

if.end.8:
  %71 = load double, double* %one.addr, align 8
  %72 = load double, double* %lo.addr, align 8
  %73 = load double, double* %r.addr, align 8
  %74 = load double, double* %c.addr, align 8
  %75 = fmul double %73, %74
  %76 = load double, double* %c.addr, align 8
  %77 = fsub double 0x4000000000000000, %76
  %78 = fdiv double %75, %77
  %79 = fsub double %72, %78
  %80 = load double, double* %hi.addr, align 8
  %81 = fsub double %79, %80
  %82 = fsub double %71, %81
  store double %82, double* %y.addr, align 8
  %83 = load i32, i32* %k.addr, align 4
  %84 = icmp sge i32 %83, -1021
  br i1 %84, label %if.then.9, label %if.end.9

if.then.9:
  %85 = load i32, i32* %k.addr, align 4
  %86 = icmp eq i32 %85, 1024
  br i1 %86, label %if.then.10, label %if.end.10

if.then.10:
  %87 = load double, double* %y.addr, align 8
  %88 = fmul double %87, 0x4000000000000000
  %89 = fmul double %88, 0x7FE0000000000000
  ret double %89

if.end.10:
  %90 = load double, double* %y.addr, align 8
  %91 = load i32, i32* %k.addr, align 4
  %92 = call double @nish.pow2(i32 %91)
  %93 = fmul double %90, %92
  ret double %93

if.end.9:
  %94 = load double, double* %y.addr, align 8
  %95 = load i32, i32* %k.addr, align 4
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %95, i32 1000)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok

ovf.ok:
  %99 = call double @nish.pow2(i32 %97)
  %100 = fmul double %94, %99
  %101 = fmul double %100, 0x0170000000000000
  ret double %101

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
