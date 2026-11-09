@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare double @llvm.sqrt.f64(double) #1
declare double @llvm.fabs.f64(double) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1
declare i32 @llvm.ctlz.i32(i32, i1) #1

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %two.addr = alloca double, align 8
  %half.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  store double 0x4000000000000000, double* %two.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = load double, double* %two.addr, align 8
  %2 = fdiv double %0, %1
  store double %2, double* %half.addr, align 8
  %3 = load double, double* %zero.addr, align 8
  %4 = call double @nish.sinF64(double %3)
  %5 = call i8* @nish_str_from_f64(double %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load double, double* %half.addr, align 8
  %8 = call double @nish.sinF64(double %7)
  %9 = call i8* @nish_str_from_f64(double %8)
  %10 = call i8* @nish_str_concat(i8* %6, i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %12 = load double, double* %two.addr, align 8
  %13 = fneg double %12
  %14 = call double @nish.sinF64(double %13)
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %11, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load double, double* %one.addr, align 8
  %19 = load double, double* %zero.addr, align 8
  %20 = fdiv double %18, %19
  %21 = call double @nish.sinF64(double %20)
  %22 = call i8* @nish_str_from_f64(double %21)
  %23 = call i8* @nish_str_concat(i8* %17, i8* %22)
  call void @nish_print(i8* %23)
  %24 = load double, double* %zero.addr, align 8
  %25 = call double @nish.cosF64(double %24)
  %26 = call i8* @nish_str_from_f64(double %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load double, double* %half.addr, align 8
  %29 = call double @nish.cosF64(double %28)
  %30 = call i8* @nish_str_from_f64(double %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = call double @nish.cosF64(double 0x4480F0CF064DD592)
  %34 = call i8* @nish_str_from_f64(double %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  call void @nish_print(i8* %35)
  %36 = load double, double* %zero.addr, align 8
  %37 = call double @nish.expF64(double %36)
  %38 = call i8* @nish_str_from_f64(double %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = load double, double* %one.addr, align 8
  %41 = fneg double %40
  %42 = call double @nish.expF64(double %41)
  %43 = call i8* @nish_str_from_f64(double %42)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %46 = call double @nish.expF64(double 0x4086300000000000)
  %47 = call i8* @nish_str_from_f64(double %46)
  %48 = call i8* @nish_str_concat(i8* %45, i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %50 = fneg double 0x4087500000000000
  %51 = call double @nish.expF64(double %50)
  %52 = call i8* @nish_str_from_f64(double %51)
  %53 = call i8* @nish_str_concat(i8* %49, i8* %52)
  call void @nish_print(i8* %53)
  %54 = load double, double* %one.addr, align 8
  %55 = call double @nish.logF64(double %54)
  %56 = call i8* @nish_str_from_f64(double %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = load double, double* %two.addr, align 8
  %59 = call double @nish.logF64(double %58)
  %60 = call i8* @nish_str_from_f64(double %59)
  %61 = call i8* @nish_str_concat(i8* %57, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = load double, double* %zero.addr, align 8
  %64 = call double @nish.logF64(double %63)
  %65 = call i8* @nish_str_from_f64(double %64)
  %66 = call i8* @nish_str_concat(i8* %62, i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %68 = load double, double* %one.addr, align 8
  %69 = fneg double %68
  %70 = call double @nish.logF64(double %69)
  %71 = call i8* @nish_str_from_f64(double %70)
  %72 = call i8* @nish_str_concat(i8* %67, i8* %71)
  call void @nish_print(i8* %72)
  %73 = load double, double* %two.addr, align 8
  %74 = call double @nish.powF64(double %73, double 0x4024000000000000)
  %75 = call i8* @nish_str_from_f64(double %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %77 = load double, double* %two.addr, align 8
  %78 = load double, double* %half.addr, align 8
  %79 = call double @nish.powF64(double %77, double %78)
  %80 = call i8* @nish_str_from_f64(double %79)
  %81 = call i8* @nish_str_concat(i8* %76, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %83 = load double, double* %two.addr, align 8
  %84 = fneg double %83
  %85 = call double @nish.powF64(double %84, double 0x4008000000000000)
  %86 = call i8* @nish_str_from_f64(double %85)
  %87 = call i8* @nish_str_concat(i8* %82, i8* %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %89 = load double, double* %zero.addr, align 8
  %90 = load double, double* %one.addr, align 8
  %91 = fneg double %90
  %92 = call double @nish.powF64(double %89, double %91)
  %93 = call i8* @nish_str_from_f64(double %92)
  %94 = call i8* @nish_str_concat(i8* %88, i8* %93)
  call void @nish_print(i8* %94)
  %95 = load double, double* %two.addr, align 8
  %96 = call double @nish.fmodF64(double 0x401C000000000000, double %95)
  %97 = call i8* @nish_str_from_f64(double %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %99 = fneg double 0x401E000000000000
  %100 = load double, double* %two.addr, align 8
  %101 = call double @nish.fmodF64(double %99, double %100)
  %102 = call i8* @nish_str_from_f64(double %101)
  %103 = call i8* @nish_str_concat(i8* %98, i8* %102)
  %104 = call i8* @nish_str_concat(i8* %103, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %105 = load double, double* %one.addr, align 8
  %106 = load double, double* %zero.addr, align 8
  %107 = call double @nish.fmodF64(double %105, double %106)
  %108 = call i8* @nish_str_from_f64(double %107)
  %109 = call i8* @nish_str_concat(i8* %104, i8* %108)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %111 = call double @nish.fmodF64(double 0x7E37E43C8800759C, double 0x401C000000000000)
  %112 = call i8* @nish_str_from_f64(double %111)
  %113 = call i8* @nish_str_concat(i8* %110, i8* %112)
  call void @nish_print(i8* %113)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
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

define internal noundef i32 @nish.loWord(double noundef %x) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = trunc i64 %0 to i32
  ret i32 %1
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

define internal noundef double @nish.clearLo(double noundef %x) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 -1 to i64
  %2 = sext i32 32 to i64
  %3 = and i64 %2, 63
  %4 = shl i64 %1, %3
  %5 = and i64 %0, %4
  %6 = bitcast i64 %5 to double
  ret double %6
}

define internal noundef i32 @nish.ipio2(i32 noundef %i) #1 {
entry:
  switch i32 %i, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
    i32 3, label %sw.case.3
    i32 4, label %sw.case.4
    i32 5, label %sw.case.5
    i32 6, label %sw.case.6
    i32 7, label %sw.case.7
    i32 8, label %sw.case.8
    i32 9, label %sw.case.9
    i32 10, label %sw.case.10
    i32 11, label %sw.case.11
    i32 12, label %sw.case.12
    i32 13, label %sw.case.13
    i32 14, label %sw.case.14
    i32 15, label %sw.case.15
    i32 16, label %sw.case.16
    i32 17, label %sw.case.17
    i32 18, label %sw.case.18
    i32 19, label %sw.case.19
    i32 20, label %sw.case.20
    i32 21, label %sw.case.21
    i32 22, label %sw.case.22
    i32 23, label %sw.case.23
    i32 24, label %sw.case.24
    i32 25, label %sw.case.25
    i32 26, label %sw.case.26
    i32 27, label %sw.case.27
    i32 28, label %sw.case.28
    i32 29, label %sw.case.29
    i32 30, label %sw.case.30
    i32 31, label %sw.case.31
    i32 32, label %sw.case.32
    i32 33, label %sw.case.33
    i32 34, label %sw.case.34
    i32 35, label %sw.case.35
    i32 36, label %sw.case.36
    i32 37, label %sw.case.37
    i32 38, label %sw.case.38
    i32 39, label %sw.case.39
    i32 40, label %sw.case.40
    i32 41, label %sw.case.41
    i32 42, label %sw.case.42
    i32 43, label %sw.case.43
    i32 44, label %sw.case.44
    i32 45, label %sw.case.45
    i32 46, label %sw.case.46
    i32 47, label %sw.case.47
    i32 48, label %sw.case.48
    i32 49, label %sw.case.49
    i32 50, label %sw.case.50
    i32 51, label %sw.case.51
    i32 52, label %sw.case.52
    i32 53, label %sw.case.53
    i32 54, label %sw.case.54
    i32 55, label %sw.case.55
    i32 56, label %sw.case.56
    i32 57, label %sw.case.57
    i32 58, label %sw.case.58
    i32 59, label %sw.case.59
    i32 60, label %sw.case.60
    i32 61, label %sw.case.61
    i32 62, label %sw.case.62
    i32 63, label %sw.case.63
    i32 64, label %sw.case.64
    i32 65, label %sw.case.65
  ]

sw.case:
  ret i32 10680707

sw.case.1:
  ret i32 7228996

sw.case.2:
  ret i32 1387004

sw.case.3:
  ret i32 2578385

sw.case.4:
  ret i32 16069853

sw.case.5:
  ret i32 12639074

sw.case.6:
  ret i32 9804092

sw.case.7:
  ret i32 4427841

sw.case.8:
  ret i32 16666979

sw.case.9:
  ret i32 11263675

sw.case.10:
  ret i32 12935607

sw.case.11:
  ret i32 2387514

sw.case.12:
  ret i32 4345298

sw.case.13:
  ret i32 14681673

sw.case.14:
  ret i32 3074569

sw.case.15:
  ret i32 13734428

sw.case.16:
  ret i32 16653803

sw.case.17:
  ret i32 1880361

sw.case.18:
  ret i32 10960616

sw.case.19:
  ret i32 8533493

sw.case.20:
  ret i32 3062596

sw.case.21:
  ret i32 8710556

sw.case.22:
  ret i32 7349940

sw.case.23:
  ret i32 6258241

sw.case.24:
  ret i32 3772886

sw.case.25:
  ret i32 3769171

sw.case.26:
  ret i32 3798172

sw.case.27:
  ret i32 8675211

sw.case.28:
  ret i32 12450088

sw.case.29:
  ret i32 3874808

sw.case.30:
  ret i32 9961438

sw.case.31:
  ret i32 366607

sw.case.32:
  ret i32 15675153

sw.case.33:
  ret i32 9132554

sw.case.34:
  ret i32 7151469

sw.case.35:
  ret i32 3571407

sw.case.36:
  ret i32 2607881

sw.case.37:
  ret i32 12013382

sw.case.38:
  ret i32 4155038

sw.case.39:
  ret i32 6285869

sw.case.40:
  ret i32 7677882

sw.case.41:
  ret i32 13102053

sw.case.42:
  ret i32 15825725

sw.case.43:
  ret i32 473591

sw.case.44:
  ret i32 9065106

sw.case.45:
  ret i32 15363067

sw.case.46:
  ret i32 6271263

sw.case.47:
  ret i32 9264392

sw.case.48:
  ret i32 5636912

sw.case.49:
  ret i32 4652155

sw.case.50:
  ret i32 7056368

sw.case.51:
  ret i32 13614112

sw.case.52:
  ret i32 10155062

sw.case.53:
  ret i32 1944035

sw.case.54:
  ret i32 9527646

sw.case.55:
  ret i32 15080200

sw.case.56:
  ret i32 6658437

sw.case.57:
  ret i32 6231200

sw.case.58:
  ret i32 6832269

sw.case.59:
  ret i32 16767104

sw.case.60:
  ret i32 5075751

sw.case.61:
  ret i32 3212806

sw.case.62:
  ret i32 1398474

sw.case.63:
  ret i32 7579849

sw.case.64:
  ret i32 6349435

sw.case.65:
  ret i32 12618859

sw.default:
  ret i32 0
}

define internal noundef i64 @nish.pio2Word(i32 noundef %p) #0 {
entry:
  %j.addr = alloca i32, align 4
  %off.addr = alloca i32, align 4
  %c0.addr = alloca i64, align 8
  %c1.addr = alloca i64, align 8
  %c2.addr = alloca i64, align 8
  %c3.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %low.addr = alloca i64, align 8
  %0 = icmp slt i32 %p, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i64 @nish.pio2Word(i32 1)
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %p)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = sext i32 %3 to i64
  %6 = and i64 %5, 63
  %7 = lshr i64 %1, %6
  ret i64 %7

if.end:
  %8 = sub nsw i32 %p, 1
  %9 = sdiv i32 %8, 24
  store i32 %9, i32* %j.addr, align 4
  %10 = sub nsw i32 %p, 1
  %11 = load i32, i32* %j.addr, align 4
  %12 = mul nsw i32 %11, 24
  %13 = sub nsw i32 %10, %12
  store i32 %13, i32* %off.addr, align 4
  %14 = load i32, i32* %j.addr, align 4
  %15 = call i32 @nish.ipio2(i32 %14)
  %16 = sext i32 %15 to i64
  store i64 %16, i64* %c0.addr, align 8
  %17 = load i32, i32* %j.addr, align 4
  %18 = add nsw i32 %17, 1
  %19 = call i32 @nish.ipio2(i32 %18)
  %20 = sext i32 %19 to i64
  store i64 %20, i64* %c1.addr, align 8
  %21 = load i32, i32* %j.addr, align 4
  %22 = add nsw i32 %21, 2
  %23 = call i32 @nish.ipio2(i32 %22)
  %24 = sext i32 %23 to i64
  store i64 %24, i64* %c2.addr, align 8
  %25 = load i32, i32* %j.addr, align 4
  %26 = add nsw i32 %25, 3
  %27 = call i32 @nish.ipio2(i32 %26)
  %28 = sext i32 %27 to i64
  store i64 %28, i64* %c3.addr, align 8
  %29 = load i64, i64* %c0.addr, align 8
  %30 = sext i32 40 to i64
  %31 = and i64 %30, 63
  %32 = shl i64 %29, %31
  %33 = load i64, i64* %c1.addr, align 8
  %34 = sext i32 16 to i64
  %35 = and i64 %34, 63
  %36 = shl i64 %33, %35
  %37 = or i64 %32, %36
  %38 = load i64, i64* %c2.addr, align 8
  %39 = sext i32 8 to i64
  %40 = and i64 %39, 63
  %41 = lshr i64 %38, %40
  %42 = or i64 %37, %41
  store i64 %42, i64* %top.addr, align 8
  %43 = load i64, i64* %c2.addr, align 8
  %44 = sext i32 255 to i64
  %45 = and i64 %43, %44
  %46 = sext i32 24 to i64
  %47 = and i64 %46, 63
  %48 = shl i64 %45, %47
  %49 = load i64, i64* %c3.addr, align 8
  %50 = or i64 %48, %49
  store i64 %50, i64* %low.addr, align 8
  %51 = load i64, i64* %top.addr, align 8
  %52 = load i32, i32* %off.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = and i64 %53, 63
  %55 = shl i64 %51, %54
  %56 = load i64, i64* %low.addr, align 8
  %57 = load i32, i32* %off.addr, align 4
  %58 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 32, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %61 = sext i32 %59 to i64
  %62 = and i64 %61, 63
  %63 = lshr i64 %56, %62
  %64 = or i64 %55, %63
  ret i64 %64

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.mulHi(i64 noundef %a, i64 noundef %b) #1 {
entry:
  %m32.addr = alloca i64, align 8
  %a0.addr = alloca i64, align 8
  %a1.addr = alloca i64, align 8
  %b0.addr = alloca i64, align 8
  %b1.addr = alloca i64, align 8
  %p00.addr = alloca i64, align 8
  %p01.addr = alloca i64, align 8
  %p10.addr = alloca i64, align 8
  %mid.addr = alloca i64, align 8
  %0 = sext i32 1 to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = sext i32 1 to i64
  %5 = sub i64 %3, %4
  store i64 %5, i64* %m32.addr, align 8
  %6 = load i64, i64* %m32.addr, align 8
  %7 = and i64 %a, %6
  store i64 %7, i64* %a0.addr, align 8
  %8 = sext i32 32 to i64
  %9 = and i64 %8, 63
  %10 = lshr i64 %a, %9
  store i64 %10, i64* %a1.addr, align 8
  %11 = load i64, i64* %m32.addr, align 8
  %12 = and i64 %b, %11
  store i64 %12, i64* %b0.addr, align 8
  %13 = sext i32 32 to i64
  %14 = and i64 %13, 63
  %15 = lshr i64 %b, %14
  store i64 %15, i64* %b1.addr, align 8
  %16 = load i64, i64* %a0.addr, align 8
  %17 = load i64, i64* %b0.addr, align 8
  %18 = mul i64 %16, %17
  store i64 %18, i64* %p00.addr, align 8
  %19 = load i64, i64* %a0.addr, align 8
  %20 = load i64, i64* %b1.addr, align 8
  %21 = mul i64 %19, %20
  store i64 %21, i64* %p01.addr, align 8
  %22 = load i64, i64* %a1.addr, align 8
  %23 = load i64, i64* %b0.addr, align 8
  %24 = mul i64 %22, %23
  store i64 %24, i64* %p10.addr, align 8
  %25 = load i64, i64* %p00.addr, align 8
  %26 = sext i32 32 to i64
  %27 = and i64 %26, 63
  %28 = lshr i64 %25, %27
  %29 = load i64, i64* %p01.addr, align 8
  %30 = load i64, i64* %m32.addr, align 8
  %31 = and i64 %29, %30
  %32 = add i64 %28, %31
  %33 = load i64, i64* %p10.addr, align 8
  %34 = load i64, i64* %m32.addr, align 8
  %35 = and i64 %33, %34
  %36 = add i64 %32, %35
  store i64 %36, i64* %mid.addr, align 8
  %37 = load i64, i64* %a1.addr, align 8
  %38 = load i64, i64* %b1.addr, align 8
  %39 = mul i64 %37, %38
  %40 = load i64, i64* %p01.addr, align 8
  %41 = sext i32 32 to i64
  %42 = and i64 %41, 63
  %43 = lshr i64 %40, %42
  %44 = add i64 %39, %43
  %45 = load i64, i64* %p10.addr, align 8
  %46 = sext i32 32 to i64
  %47 = and i64 %46, 63
  %48 = lshr i64 %45, %47
  %49 = add i64 %44, %48
  %50 = load i64, i64* %mid.addr, align 8
  %51 = sext i32 32 to i64
  %52 = and i64 %51, 63
  %53 = lshr i64 %50, %52
  %54 = add i64 %49, %53
  ret i64 %54
}

define internal noundef i32 @nish.clz64(i64 noundef %v) #1 {
entry:
  %h.addr = alloca i32, align 4
  %0 = sext i32 32 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %v, %1
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %h.addr, align 4
  %4 = load i32, i32* %h.addr, align 4
  %5 = icmp ne i32 %4, 0
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = load i32, i32* %h.addr, align 4
  %7 = call i32 @llvm.ctlz.i32(i32 %6, i1 false)
  br label %cond.end

cond.false:
  %8 = trunc i64 %v to i32
  %9 = call i32 @llvm.ctlz.i32(i32 %8, i1 false)
  %10 = add nsw i32 %9, 32
  br label %cond.end

cond.end:
  %11 = phi i32 [ %7, %cond.true ], [ %10, %cond.false ]
  ret i32 %11
}

define internal noundef double @nish.trigLarge(double noundef %x, i32 noundef %ix, i32 noundef %hx, i32 noundef %mode) #0 {
entry:
  %e.addr = alloca i32, align 4
  %m.addr = alloca i64, align 8
  %p.addr = alloca i32, align 4
  %w0.addr = alloca i64, align 8
  %w1.addr = alloca i64, align 8
  %w2.addr = alloca i64, align 8
  %lo2.addr = alloca i64, align 8
  %hi2.addr = alloca i64, align 8
  %lo1.addr = alloca i64, align 8
  %hi1.addr = alloca i64, align 8
  %p0.addr = alloca i64, align 8
  %p1.addr = alloca i64, align 8
  %c.addr = alloca i64, align 8
  %p2.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %q2.addr = alloca i64, align 8
  %q1.addr = alloca i64, align 8
  %q0.addr = alloca i64, align 8
  %neg.addr = alloca i1, align 1
  %k0.addr = alloca i64, align 8
  %k1.addr = alloca i64, align 8
  %sh.addr = alloca i32, align 4
  %lz.addr = alloca i32, align 4
  %a.addr = alloca double, align 8
  %b.addr = alloca double, align 8
  %p1h.addr = alloca double, align 8
  %p1l.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  %split.addr = alloca double, align 8
  %ac.addr = alloca double, align 8
  %ah.addr = alloca double, align 8
  %al.addr = alloca double, align 8
  %pc.addr = alloca double, align 8
  %ph.addr = alloca double, align 8
  %pl.addr = alloca double, align 8
  %err.addr = alloca double, align 8
  %tail.addr = alloca double, align 8
  %y0.addr = alloca double, align 8
  %y1.addr = alloca double, align 8
  %0 = ashr i32 %ix, 20
  %1 = sub nsw i32 %0, 1023
  store i32 %1, i32* %e.addr, align 4
  %2 = bitcast double %x to i64
  %3 = sext i32 1 to i64
  %4 = sext i32 52 to i64
  %5 = and i64 %4, 63
  %6 = shl i64 %3, %5
  %7 = sext i32 1 to i64
  %8 = sub i64 %6, %7
  %9 = and i64 %2, %8
  %10 = sext i32 1 to i64
  %11 = sext i32 52 to i64
  %12 = and i64 %11, 63
  %13 = shl i64 %10, %12
  %14 = or i64 %9, %13
  store i64 %14, i64* %m.addr, align 8
  %15 = load i32, i32* %e.addr, align 4
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %15, i32 53)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %p.addr, align 4
  %19 = load i32, i32* %p.addr, align 4
  %20 = call i64 @nish.pio2Word(i32 %19)
  store i64 %20, i64* %w0.addr, align 8
  %21 = load i32, i32* %p.addr, align 4
  %22 = add nsw i32 %21, 64
  %23 = call i64 @nish.pio2Word(i32 %22)
  store i64 %23, i64* %w1.addr, align 8
  %24 = load i32, i32* %p.addr, align 4
  %25 = add nsw i32 %24, 128
  %26 = call i64 @nish.pio2Word(i32 %25)
  store i64 %26, i64* %w2.addr, align 8
  %27 = load i64, i64* %m.addr, align 8
  %28 = load i64, i64* %w2.addr, align 8
  %29 = mul i64 %27, %28
  store i64 %29, i64* %lo2.addr, align 8
  %30 = load i64, i64* %m.addr, align 8
  %31 = load i64, i64* %w2.addr, align 8
  %32 = call i64 @nish.mulHi(i64 %30, i64 %31)
  store i64 %32, i64* %hi2.addr, align 8
  %33 = load i64, i64* %m.addr, align 8
  %34 = load i64, i64* %w1.addr, align 8
  %35 = mul i64 %33, %34
  store i64 %35, i64* %lo1.addr, align 8
  %36 = load i64, i64* %m.addr, align 8
  %37 = load i64, i64* %w1.addr, align 8
  %38 = call i64 @nish.mulHi(i64 %36, i64 %37)
  store i64 %38, i64* %hi1.addr, align 8
  %39 = load i64, i64* %lo2.addr, align 8
  store i64 %39, i64* %p0.addr, align 8
  %40 = load i64, i64* %hi2.addr, align 8
  %41 = load i64, i64* %lo1.addr, align 8
  %42 = add i64 %40, %41
  store i64 %42, i64* %p1.addr, align 8
  %43 = load i64, i64* %p1.addr, align 8
  %44 = load i64, i64* %lo1.addr, align 8
  %45 = icmp ult i64 %43, %44
  br i1 %45, label %cond.true, label %cond.false

cond.true:
  %46 = sext i32 1 to i64
  br label %cond.end

cond.false:
  %47 = sext i32 0 to i64
  br label %cond.end

cond.end:
  %48 = phi i64 [ %46, %cond.true ], [ %47, %cond.false ]
  store i64 %48, i64* %c.addr, align 8
  %49 = load i64, i64* %hi1.addr, align 8
  %50 = load i64, i64* %m.addr, align 8
  %51 = load i64, i64* %w0.addr, align 8
  %52 = mul i64 %50, %51
  %53 = add i64 %49, %52
  %54 = load i64, i64* %c.addr, align 8
  %55 = add i64 %53, %54
  store i64 %55, i64* %p2.addr, align 8
  %56 = load i64, i64* %p2.addr, align 8
  %57 = sext i32 62 to i64
  %58 = and i64 %57, 63
  %59 = lshr i64 %56, %58
  %60 = trunc i64 %59 to i32
  store i32 %60, i32* %n.addr, align 4
  %61 = load i64, i64* %p2.addr, align 8
  %62 = sext i32 2 to i64
  %63 = and i64 %62, 63
  %64 = shl i64 %61, %63
  %65 = load i64, i64* %p1.addr, align 8
  %66 = sext i32 62 to i64
  %67 = and i64 %66, 63
  %68 = lshr i64 %65, %67
  %69 = or i64 %64, %68
  store i64 %69, i64* %q2.addr, align 8
  %70 = load i64, i64* %p1.addr, align 8
  %71 = sext i32 2 to i64
  %72 = and i64 %71, 63
  %73 = shl i64 %70, %72
  %74 = load i64, i64* %p0.addr, align 8
  %75 = sext i32 62 to i64
  %76 = and i64 %75, 63
  %77 = lshr i64 %74, %76
  %78 = or i64 %73, %77
  store i64 %78, i64* %q1.addr, align 8
  %79 = load i64, i64* %p0.addr, align 8
  %80 = sext i32 2 to i64
  %81 = and i64 %80, 63
  %82 = shl i64 %79, %81
  store i64 %82, i64* %q0.addr, align 8
  store i1 false, i1* %neg.addr, align 1
  %83 = load i64, i64* %q2.addr, align 8
  %84 = sext i32 63 to i64
  %85 = and i64 %84, 63
  %86 = lshr i64 %83, %85
  %87 = sext i32 0 to i64
  %88 = icmp ne i64 %86, %87
  br i1 %88, label %if.then, label %if.end

if.then:
  %89 = load i32, i32* %n.addr, align 4
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 1)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %91, i32* %n.addr, align 4
  store i1 true, i1* %neg.addr, align 1
  %93 = load i64, i64* %q0.addr, align 8
  %94 = xor i64 %93, -1
  %95 = sext i32 1 to i64
  %96 = add i64 %94, %95
  store i64 %96, i64* %q0.addr, align 8
  %97 = load i64, i64* %q0.addr, align 8
  %98 = sext i32 0 to i64
  %99 = icmp eq i64 %97, %98
  br i1 %99, label %cond.true.1, label %cond.false.1

cond.true.1:
  %100 = sext i32 1 to i64
  br label %cond.end.1

cond.false.1:
  %101 = sext i32 0 to i64
  br label %cond.end.1

cond.end.1:
  %102 = phi i64 [ %100, %cond.true.1 ], [ %101, %cond.false.1 ]
  store i64 %102, i64* %k0.addr, align 8
  %103 = load i64, i64* %q1.addr, align 8
  %104 = xor i64 %103, -1
  %105 = load i64, i64* %k0.addr, align 8
  %106 = add i64 %104, %105
  store i64 %106, i64* %q1.addr, align 8
  %107 = load i64, i64* %k0.addr, align 8
  %108 = sext i32 0 to i64
  %109 = icmp ne i64 %107, %108
  br i1 %109, label %land.rhs, label %land.end

land.rhs:
  %110 = load i64, i64* %q1.addr, align 8
  %111 = sext i32 0 to i64
  %112 = icmp eq i64 %110, %111
  br label %land.end

land.end:
  %113 = phi i1 [ false, %cond.end.1 ], [ %112, %land.rhs ]
  br i1 %113, label %cond.true.2, label %cond.false.2

cond.true.2:
  %114 = sext i32 1 to i64
  br label %cond.end.2

cond.false.2:
  %115 = sext i32 0 to i64
  br label %cond.end.2

cond.end.2:
  %116 = phi i64 [ %114, %cond.true.2 ], [ %115, %cond.false.2 ]
  store i64 %116, i64* %k1.addr, align 8
  %117 = load i64, i64* %q2.addr, align 8
  %118 = xor i64 %117, -1
  %119 = load i64, i64* %k1.addr, align 8
  %120 = add i64 %118, %119
  store i64 %120, i64* %q2.addr, align 8
  br label %if.end

if.end:
  store i32 0, i32* %sh.addr, align 4
  %121 = load i64, i64* %q2.addr, align 8
  %122 = sext i32 0 to i64
  %123 = icmp eq i64 %121, %122
  br i1 %123, label %if.then.1, label %if.end.1

if.then.1:
  %124 = load i64, i64* %q1.addr, align 8
  store i64 %124, i64* %q2.addr, align 8
  %125 = load i64, i64* %q0.addr, align 8
  store i64 %125, i64* %q1.addr, align 8
  %126 = sext i32 0 to i64
  store i64 %126, i64* %q0.addr, align 8
  store i32 64, i32* %sh.addr, align 4
  br label %if.end.1

if.end.1:
  %127 = load i64, i64* %q2.addr, align 8
  %128 = call i32 @nish.clz64(i64 %127)
  store i32 %128, i32* %lz.addr, align 4
  %129 = load i32, i32* %lz.addr, align 4
  %130 = icmp sgt i32 %129, 0
  br i1 %130, label %if.then.2, label %if.end.2

if.then.2:
  %131 = load i64, i64* %q2.addr, align 8
  %132 = load i32, i32* %lz.addr, align 4
  %133 = sext i32 %132 to i64
  %134 = and i64 %133, 63
  %135 = shl i64 %131, %134
  %136 = load i64, i64* %q1.addr, align 8
  %137 = load i32, i32* %lz.addr, align 4
  %138 = sub nsw i32 64, %137
  %139 = sext i32 %138 to i64
  %140 = and i64 %139, 63
  %141 = lshr i64 %136, %140
  %142 = or i64 %135, %141
  store i64 %142, i64* %q2.addr, align 8
  %143 = load i64, i64* %q1.addr, align 8
  %144 = load i32, i32* %lz.addr, align 4
  %145 = sext i32 %144 to i64
  %146 = and i64 %145, 63
  %147 = shl i64 %143, %146
  %148 = load i64, i64* %q0.addr, align 8
  %149 = load i32, i32* %lz.addr, align 4
  %150 = sub nsw i32 64, %149
  %151 = sext i32 %150 to i64
  %152 = and i64 %151, 63
  %153 = lshr i64 %148, %152
  %154 = or i64 %147, %153
  store i64 %154, i64* %q1.addr, align 8
  br label %if.end.2

if.end.2:
  %155 = load i64, i64* %q2.addr, align 8
  %156 = sext i32 11 to i64
  %157 = and i64 %156, 63
  %158 = lshr i64 %155, %157
  %159 = uitofp i64 %158 to double
  %160 = load i32, i32* %sh.addr, align 4
  %161 = sub nsw i32 -53, %160
  %162 = load i32, i32* %lz.addr, align 4
  %163 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %161, i32 %162)
  %164 = extractvalue { i32, i1 } %163, 0
  %165 = extractvalue { i32, i1 } %163, 1
  br i1 %165, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %166 = call double @nish.pow2(i32 %164)
  %167 = fmul double %159, %166
  store double %167, double* %a.addr, align 8
  %168 = load i64, i64* %q2.addr, align 8
  %169 = sext i32 2047 to i64
  %170 = and i64 %168, %169
  %171 = sext i32 53 to i64
  %172 = and i64 %171, 63
  %173 = shl i64 %170, %172
  %174 = load i64, i64* %q1.addr, align 8
  %175 = sext i32 11 to i64
  %176 = and i64 %175, 63
  %177 = lshr i64 %174, %176
  %178 = or i64 %173, %177
  %179 = uitofp i64 %178 to double
  %180 = load i32, i32* %sh.addr, align 4
  %181 = sub nsw i32 -117, %180
  %182 = load i32, i32* %lz.addr, align 4
  %183 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %181, i32 %182)
  %184 = extractvalue { i32, i1 } %183, 0
  %185 = extractvalue { i32, i1 } %183, 1
  br i1 %185, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %186 = call double @nish.pow2(i32 %184)
  %187 = fmul double %179, %186
  store double %187, double* %b.addr, align 8
  store double 0x3FF921FB54442D18, double* %p1h.addr, align 8
  store double 0x3C91A62633145C07, double* %p1l.addr, align 8
  %188 = load double, double* %a.addr, align 8
  %189 = load double, double* %p1h.addr, align 8
  %190 = fmul double %188, %189
  store double %190, double* %t.addr, align 8
  store double 0x41A0000002000000, double* %split.addr, align 8
  %191 = load double, double* %a.addr, align 8
  %192 = load double, double* %split.addr, align 8
  %193 = fmul double %191, %192
  store double %193, double* %ac.addr, align 8
  %194 = load double, double* %ac.addr, align 8
  %195 = load double, double* %ac.addr, align 8
  %196 = load double, double* %a.addr, align 8
  %197 = fsub double %195, %196
  %198 = fsub double %194, %197
  store double %198, double* %ah.addr, align 8
  %199 = load double, double* %a.addr, align 8
  %200 = load double, double* %ah.addr, align 8
  %201 = fsub double %199, %200
  store double %201, double* %al.addr, align 8
  %202 = load double, double* %p1h.addr, align 8
  %203 = load double, double* %split.addr, align 8
  %204 = fmul double %202, %203
  store double %204, double* %pc.addr, align 8
  %205 = load double, double* %pc.addr, align 8
  %206 = load double, double* %pc.addr, align 8
  %207 = load double, double* %p1h.addr, align 8
  %208 = fsub double %206, %207
  %209 = fsub double %205, %208
  store double %209, double* %ph.addr, align 8
  %210 = load double, double* %p1h.addr, align 8
  %211 = load double, double* %ph.addr, align 8
  %212 = fsub double %210, %211
  store double %212, double* %pl.addr, align 8
  %213 = load double, double* %ah.addr, align 8
  %214 = load double, double* %ph.addr, align 8
  %215 = fmul double %213, %214
  %216 = load double, double* %t.addr, align 8
  %217 = fsub double %215, %216
  %218 = load double, double* %ah.addr, align 8
  %219 = load double, double* %pl.addr, align 8
  %220 = fmul double %218, %219
  %221 = fadd double %217, %220
  %222 = load double, double* %al.addr, align 8
  %223 = load double, double* %ph.addr, align 8
  %224 = fmul double %222, %223
  %225 = fadd double %221, %224
  %226 = load double, double* %al.addr, align 8
  %227 = load double, double* %pl.addr, align 8
  %228 = fmul double %226, %227
  %229 = fadd double %225, %228
  store double %229, double* %err.addr, align 8
  %230 = load double, double* %err.addr, align 8
  %231 = load double, double* %a.addr, align 8
  %232 = load double, double* %p1l.addr, align 8
  %233 = fmul double %231, %232
  %234 = load double, double* %b.addr, align 8
  %235 = load double, double* %p1h.addr, align 8
  %236 = fmul double %234, %235
  %237 = fadd double %233, %236
  %238 = fadd double %230, %237
  store double %238, double* %tail.addr, align 8
  %239 = load double, double* %t.addr, align 8
  %240 = load double, double* %tail.addr, align 8
  %241 = fadd double %239, %240
  store double %241, double* %y0.addr, align 8
  %242 = load double, double* %tail.addr, align 8
  %243 = load double, double* %y0.addr, align 8
  %244 = load double, double* %t.addr, align 8
  %245 = fsub double %243, %244
  %246 = fsub double %242, %245
  store double %246, double* %y1.addr, align 8
  %247 = load i1, i1* %neg.addr, align 1
  %248 = icmp slt i32 %hx, 0
  %249 = icmp ne i1 %247, %248
  br i1 %249, label %if.then.3, label %if.end.3

if.then.3:
  %250 = load double, double* %y0.addr, align 8
  %251 = fneg double %250
  store double %251, double* %y0.addr, align 8
  %252 = load double, double* %y1.addr, align 8
  %253 = fneg double %252
  store double %253, double* %y1.addr, align 8
  br label %if.end.3

if.end.3:
  %254 = load double, double* %y0.addr, align 8
  %255 = load double, double* %y1.addr, align 8
  %256 = icmp slt i32 %hx, 0
  br i1 %256, label %cond.true.3, label %cond.false.3

cond.true.3:
  %257 = load i32, i32* %n.addr, align 4
  %258 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %257)
  %259 = extractvalue { i32, i1 } %258, 0
  %260 = extractvalue { i32, i1 } %258, 1
  br i1 %260, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  br label %cond.end.3

cond.false.3:
  %261 = load i32, i32* %n.addr, align 4
  br label %cond.end.3

cond.end.3:
  %262 = phi i32 [ %259, %ovf.ok.4 ], [ %261, %cond.false.3 ]
  %263 = tail call double @nish.trigKernel(double %254, double %255, i32 %262, i32 %mode)
  ret double %263

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %if.then ], [ 1, %if.end.2 ], [ 1, %ovf.ok.2 ], [ 3, %cond.true.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef double @nish.kernelTan(double noundef %x0, double noundef %y0, i1 noundef zeroext %odd) #1 {
entry:
  %x.addr = alloca double, align 8
  %y.addr = alloca double, align 8
  %big.addr = alloca i1, align 1
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %w2.addr = alloca double, align 8
  %w4.addr = alloca double, align 8
  %r0.addr = alloca double, align 8
  %v0.addr = alloca double, align 8
  %s.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %wx.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %res.addr = alloca double, align 8
  %zz.addr = alloca double, align 8
  %vv.addr = alloca double, align 8
  %a.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  store double %x0, double* %x.addr, align 8
  store double %y0, double* %y.addr, align 8
  %0 = load double, double* %x.addr, align 8
  %1 = call double @llvm.fabs.f64(double %0)
  %2 = fcmp oge double %1, 0x3FE5942800000000
  store i1 %2, i1* %big.addr, align 1
  %3 = load i1, i1* %big.addr, align 1
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = fcmp olt double %x0, 0x0000000000000000
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = load double, double* %x.addr, align 8
  %6 = fneg double %5
  store double %6, double* %x.addr, align 8
  %7 = load double, double* %y.addr, align 8
  %8 = fneg double %7
  store double %8, double* %y.addr, align 8
  br label %if.end.1

if.end.1:
  %9 = load double, double* %x.addr, align 8
  %10 = fsub double 0x3FE921FB54442D18, %9
  %11 = load double, double* %y.addr, align 8
  %12 = fsub double 0x3C81A62633145C07, %11
  %13 = fadd double %10, %12
  store double %13, double* %x.addr, align 8
  store double 0x0000000000000000, double* %y.addr, align 8
  br label %if.end

if.end:
  %14 = load double, double* %x.addr, align 8
  %15 = load double, double* %x.addr, align 8
  %16 = fmul double %14, %15
  store double %16, double* %z.addr, align 8
  %17 = load double, double* %z.addr, align 8
  %18 = load double, double* %z.addr, align 8
  %19 = fmul double %17, %18
  store double %19, double* %w.addr, align 8
  %20 = load double, double* %w.addr, align 8
  %21 = load double, double* %w.addr, align 8
  %22 = fmul double %20, %21
  store double %22, double* %w2.addr, align 8
  %23 = load double, double* %w2.addr, align 8
  %24 = load double, double* %w2.addr, align 8
  %25 = fmul double %23, %24
  store double %25, double* %w4.addr, align 8
  %26 = load double, double* %w.addr, align 8
  %27 = fmul double 0x3F9664F48406D637, %26
  %28 = fadd double %27, 0x3FC111111110FE7A
  %29 = load double, double* %w2.addr, align 8
  %30 = load double, double* %w.addr, align 8
  %31 = fmul double 0x3F4344D8F2F26501, %30
  %32 = fadd double %31, 0x3F6D6D22C9560328
  %33 = fmul double %29, %32
  %34 = fadd double %28, %33
  %35 = load double, double* %w4.addr, align 8
  %36 = fneg double 0x3EF375CBDB605373
  %37 = load double, double* %w.addr, align 8
  %38 = fmul double %36, %37
  %39 = fadd double %38, 0x3F147E88A03792A6
  %40 = fmul double %35, %39
  %41 = fadd double %34, %40
  store double %41, double* %r0.addr, align 8
  %42 = load double, double* %z.addr, align 8
  %43 = load double, double* %w.addr, align 8
  %44 = fmul double 0x3F8226E3E96E8493, %43
  %45 = fadd double %44, 0x3FABA1BA1BB341FE
  %46 = load double, double* %w2.addr, align 8
  %47 = load double, double* %w.addr, align 8
  %48 = fmul double 0x3F3026F71A8D1068, %47
  %49 = fadd double %48, 0x3F57DBC8FEE08315
  %50 = fmul double %46, %49
  %51 = fadd double %45, %50
  %52 = load double, double* %w4.addr, align 8
  %53 = load double, double* %w.addr, align 8
  %54 = fmul double 0x3EFB2A7074BF7AD4, %53
  %55 = fadd double %54, 0x3F12B80F32F0A7E9
  %56 = fmul double %52, %55
  %57 = fadd double %51, %56
  %58 = fmul double %42, %57
  store double %58, double* %v0.addr, align 8
  %59 = load double, double* %z.addr, align 8
  %60 = load double, double* %x.addr, align 8
  %61 = fmul double %59, %60
  store double %61, double* %s.addr, align 8
  %62 = load double, double* %y.addr, align 8
  %63 = load double, double* %z.addr, align 8
  %64 = load double, double* %s.addr, align 8
  %65 = load double, double* %r0.addr, align 8
  %66 = load double, double* %v0.addr, align 8
  %67 = fadd double %65, %66
  %68 = fmul double %64, %67
  %69 = load double, double* %y.addr, align 8
  %70 = fadd double %68, %69
  %71 = fmul double %63, %70
  %72 = fadd double %62, %71
  store double %72, double* %r.addr, align 8
  %73 = load double, double* %r.addr, align 8
  %74 = load double, double* %s.addr, align 8
  %75 = fmul double 0x3FD5555555555563, %74
  %76 = fadd double %73, %75
  store double %76, double* %r.addr, align 8
  %77 = load double, double* %x.addr, align 8
  %78 = load double, double* %r.addr, align 8
  %79 = fadd double %77, %78
  store double %79, double* %wx.addr, align 8
  %80 = load i1, i1* %big.addr, align 1
  br i1 %80, label %if.then.2, label %if.end.2

if.then.2:
  br i1 %odd, label %cond.true, label %cond.false

cond.true:
  %81 = fneg double 0x3FF0000000000000
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %82 = phi double [ %81, %cond.true ], [ 0x3FF0000000000000, %cond.false ]
  store double %82, double* %v.addr, align 8
  %83 = load double, double* %v.addr, align 8
  %84 = load double, double* %x.addr, align 8
  %85 = load double, double* %wx.addr, align 8
  %86 = load double, double* %wx.addr, align 8
  %87 = fmul double %85, %86
  %88 = load double, double* %wx.addr, align 8
  %89 = load double, double* %v.addr, align 8
  %90 = fadd double %88, %89
  %91 = fdiv double %87, %90
  %92 = load double, double* %r.addr, align 8
  %93 = fsub double %91, %92
  %94 = fsub double %84, %93
  %95 = fmul double %94, 0x4000000000000000
  %96 = fsub double %83, %95
  store double %96, double* %res.addr, align 8
  %97 = fcmp olt double %x0, 0x0000000000000000
  br i1 %97, label %cond.true.1, label %cond.false.1

cond.true.1:
  %98 = load double, double* %res.addr, align 8
  %99 = fneg double %98
  br label %cond.end.1

cond.false.1:
  %100 = load double, double* %res.addr, align 8
  br label %cond.end.1

cond.end.1:
  %101 = phi double [ %99, %cond.true.1 ], [ %100, %cond.false.1 ]
  ret double %101

if.end.2:
  %102 = xor i1 %odd, true
  br i1 %102, label %if.then.3, label %if.end.3

if.then.3:
  %103 = load double, double* %wx.addr, align 8
  ret double %103

if.end.3:
  %104 = load double, double* %wx.addr, align 8
  %105 = call double @nish.clearLo(double %104)
  store double %105, double* %zz.addr, align 8
  %106 = load double, double* %r.addr, align 8
  %107 = load double, double* %zz.addr, align 8
  %108 = load double, double* %x.addr, align 8
  %109 = fsub double %107, %108
  %110 = fsub double %106, %109
  store double %110, double* %vv.addr, align 8
  %111 = fneg double 0x3FF0000000000000
  %112 = load double, double* %wx.addr, align 8
  %113 = fdiv double %111, %112
  store double %113, double* %a.addr, align 8
  %114 = load double, double* %a.addr, align 8
  %115 = call double @nish.clearLo(double %114)
  store double %115, double* %t.addr, align 8
  %116 = load double, double* %t.addr, align 8
  %117 = load double, double* %a.addr, align 8
  %118 = load double, double* %t.addr, align 8
  %119 = load double, double* %zz.addr, align 8
  %120 = fmul double %118, %119
  %121 = fadd double %120, 0x3FF0000000000000
  %122 = load double, double* %t.addr, align 8
  %123 = load double, double* %vv.addr, align 8
  %124 = fmul double %122, %123
  %125 = fadd double %121, %124
  %126 = fmul double %117, %125
  %127 = fadd double %116, %126
  ret double %127
}

define internal noundef double @nish.kernelSin(double noundef %x, double noundef %y, i1 noundef zeroext %tail) #1 {
entry:
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %0 = fmul double %x, %x
  store double %0, double* %z.addr, align 8
  %1 = load double, double* %z.addr, align 8
  %2 = load double, double* %z.addr, align 8
  %3 = fmul double %1, %2
  store double %3, double* %w.addr, align 8
  %4 = load double, double* %z.addr, align 8
  %5 = load double, double* %z.addr, align 8
  %6 = fmul double %5, 0x3EC71DE357B1FE7D
  %7 = fsub double %6, 0x3F2A01A019C161D5
  %8 = fmul double %4, %7
  %9 = fadd double %8, 0x3F8111111110F8A6
  %10 = load double, double* %z.addr, align 8
  %11 = load double, double* %w.addr, align 8
  %12 = fmul double %10, %11
  %13 = load double, double* %z.addr, align 8
  %14 = fmul double %13, 0x3DE5D93A5ACFD57C
  %15 = fsub double %14, 0x3E5AE5E68A2B9CEB
  %16 = fmul double %12, %15
  %17 = fadd double %9, %16
  store double %17, double* %r.addr, align 8
  %18 = load double, double* %z.addr, align 8
  %19 = fmul double %18, %x
  store double %19, double* %v.addr, align 8
  %20 = xor i1 %tail, true
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load double, double* %v.addr, align 8
  %22 = load double, double* %z.addr, align 8
  %23 = load double, double* %r.addr, align 8
  %24 = fmul double %22, %23
  %25 = fneg double 0x3FC5555555555549
  %26 = fadd double %24, %25
  %27 = fmul double %21, %26
  %28 = fadd double %x, %27
  ret double %28

if.end:
  %29 = load double, double* %z.addr, align 8
  %30 = fmul double %y, 0x3FE0000000000000
  %31 = load double, double* %v.addr, align 8
  %32 = load double, double* %r.addr, align 8
  %33 = fmul double %31, %32
  %34 = fsub double %30, %33
  %35 = fmul double %29, %34
  %36 = fsub double %35, %y
  %37 = load double, double* %v.addr, align 8
  %38 = fneg double 0x3FC5555555555549
  %39 = fmul double %37, %38
  %40 = fsub double %36, %39
  %41 = fsub double %x, %40
  ret double %41
}

define internal noundef double @nish.kernelCos(double noundef %x, double noundef %y) #1 {
entry:
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %hz.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %0 = fmul double %x, %x
  store double %0, double* %z.addr, align 8
  %1 = load double, double* %z.addr, align 8
  %2 = load double, double* %z.addr, align 8
  %3 = fmul double %1, %2
  store double %3, double* %w.addr, align 8
  %4 = load double, double* %z.addr, align 8
  %5 = load double, double* %z.addr, align 8
  %6 = load double, double* %z.addr, align 8
  %7 = fmul double %6, 0x3EFA01A019CB1590
  %8 = fsub double %7, 0x3F56C16C16C15177
  %9 = fmul double %5, %8
  %10 = fadd double %9, 0x3FA555555555554C
  %11 = fmul double %4, %10
  %12 = load double, double* %w.addr, align 8
  %13 = load double, double* %w.addr, align 8
  %14 = fmul double %12, %13
  %15 = load double, double* %z.addr, align 8
  %16 = load double, double* %z.addr, align 8
  %17 = fneg double 0x3DA8FAE9BE8838D4
  %18 = fmul double %16, %17
  %19 = fadd double %18, 0x3E21EE9EBDB4B1C4
  %20 = fmul double %15, %19
  %21 = fsub double %20, 0x3E927E4F809C52AD
  %22 = fmul double %14, %21
  %23 = fadd double %11, %22
  store double %23, double* %r.addr, align 8
  %24 = load double, double* %z.addr, align 8
  %25 = fmul double %24, 0x3FE0000000000000
  store double %25, double* %hz.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %26 = load double, double* %one.addr, align 8
  %27 = load double, double* %hz.addr, align 8
  %28 = fsub double %26, %27
  store double %28, double* %v.addr, align 8
  %29 = load double, double* %v.addr, align 8
  %30 = load double, double* %one.addr, align 8
  %31 = load double, double* %v.addr, align 8
  %32 = fsub double %30, %31
  %33 = load double, double* %hz.addr, align 8
  %34 = fsub double %32, %33
  %35 = load double, double* %z.addr, align 8
  %36 = load double, double* %r.addr, align 8
  %37 = fmul double %35, %36
  %38 = fmul double %x, %y
  %39 = fsub double %37, %38
  %40 = fadd double %34, %39
  %41 = fadd double %29, %40
  ret double %41
}

define internal noundef double @nish.trigKernel(double noundef %y0, double noundef %y1, i32 noundef %n, i32 noundef %mode) #1 {
entry:
  %q.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = and i32 %n, 3
  store i32 %0, i32* %q.addr, align 4
  %1 = icmp eq i32 %mode, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = load i32, i32* %q.addr, align 4
  %3 = and i32 %2, 1
  %4 = icmp ne i32 %3, 0
  %5 = tail call double @nish.kernelTan(double %y0, double %y1, i1 %4)
  ret double %5

if.end:
  %6 = icmp eq i32 %mode, 2
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %q.addr, align 4
  %8 = add nsw i32 %7, 1
  %9 = and i32 %8, 3
  br label %cond.end

cond.false:
  %10 = load i32, i32* %q.addr, align 4
  br label %cond.end

cond.end:
  %11 = phi i32 [ %9, %cond.true ], [ %10, %cond.false ]
  store i32 %11, i32* %k.addr, align 4
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp eq i32 %12, 0
  br i1 %13, label %if.then.1, label %if.end.1

if.then.1:
  %14 = tail call double @nish.kernelSin(double %y0, double %y1, i1 true)
  ret double %14

if.end.1:
  %15 = load i32, i32* %k.addr, align 4
  %16 = icmp eq i32 %15, 1
  br i1 %16, label %if.then.2, label %if.end.2

if.then.2:
  %17 = tail call double @nish.kernelCos(double %y0, double %y1)
  ret double %17

if.end.2:
  %18 = load i32, i32* %k.addr, align 4
  %19 = icmp eq i32 %18, 2
  br i1 %19, label %if.then.3, label %if.end.3

if.then.3:
  %20 = call double @nish.kernelSin(double %y0, double %y1, i1 true)
  %21 = fneg double %20
  ret double %21

if.end.3:
  %22 = call double @nish.kernelCos(double %y0, double %y1)
  %23 = fneg double %22
  ret double %23
}

define internal noundef double @nish.trigReduced(double noundef %x, double noundef %ax, i32 noundef %mode) #0 {
entry:
  %hx.addr = alloca i32, align 4
  %rounded.addr = alloca double, align 8
  %fn.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %y0.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  %y1.addr = alloca double, align 8
  %0 = fcmp olt double %ax, 0x413921FB00000000
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i1 @nish.isNan(double %ax)
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = fcmp ogt double %ax, 0x7FEFFFFFFFFFFFFF
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %if.then ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = fsub double %x, %x
  ret double %5

if.end.1:
  %6 = call i32 @nish.hiWord(double %x)
  store i32 %6, i32* %hx.addr, align 4
  %7 = load i32, i32* %hx.addr, align 4
  %8 = and i32 %7, 2147483647
  %9 = load i32, i32* %hx.addr, align 4
  %10 = tail call double @nish.trigLarge(double %x, i32 %8, i32 %9, i32 %mode)
  ret double %10

if.end:
  %11 = fmul double %x, 0x3FE45F306DC9C883
  %12 = fadd double %11, 0x4338000000000000
  store double %12, double* %rounded.addr, align 8
  %13 = load double, double* %rounded.addr, align 8
  %14 = fsub double %13, 0x4338000000000000
  store double %14, double* %fn.addr, align 8
  %15 = load double, double* %fn.addr, align 8
  %16 = fmul double %15, 0x3FF921FB54400000
  %17 = fsub double %x, %16
  store double %17, double* %r.addr, align 8
  %18 = load double, double* %fn.addr, align 8
  %19 = fmul double %18, 0x3DD0B4611A626331
  store double %19, double* %w.addr, align 8
  %20 = load double, double* %r.addr, align 8
  %21 = load double, double* %w.addr, align 8
  %22 = fsub double %20, %21
  store double %22, double* %y0.addr, align 8
  %23 = load double, double* %y0.addr, align 8
  %24 = call double @llvm.fabs.f64(double %23)
  %25 = fmul double %ax, 0x3F00000000000000
  %26 = fcmp olt double %24, %25
  br i1 %26, label %if.then.2, label %if.end.2

if.then.2:
  %27 = load double, double* %r.addr, align 8
  store double %27, double* %t.addr, align 8
  %28 = load double, double* %fn.addr, align 8
  %29 = fmul double %28, 0x3DD0B4611A600000
  store double %29, double* %w.addr, align 8
  %30 = load double, double* %t.addr, align 8
  %31 = load double, double* %w.addr, align 8
  %32 = fsub double %30, %31
  store double %32, double* %r.addr, align 8
  %33 = load double, double* %fn.addr, align 8
  %34 = fmul double %33, 0x3BA3198A2E037073
  %35 = load double, double* %t.addr, align 8
  %36 = load double, double* %r.addr, align 8
  %37 = fsub double %35, %36
  %38 = load double, double* %w.addr, align 8
  %39 = fsub double %37, %38
  %40 = fsub double %34, %39
  store double %40, double* %w.addr, align 8
  %41 = load double, double* %r.addr, align 8
  %42 = load double, double* %w.addr, align 8
  %43 = fsub double %41, %42
  store double %43, double* %y0.addr, align 8
  %44 = load double, double* %y0.addr, align 8
  %45 = call double @llvm.fabs.f64(double %44)
  %46 = fmul double %ax, 0x3CF0000000000000
  %47 = fcmp olt double %45, %46
  br i1 %47, label %if.then.3, label %if.end.3

if.then.3:
  %48 = load double, double* %r.addr, align 8
  store double %48, double* %t.addr, align 8
  %49 = load double, double* %fn.addr, align 8
  %50 = fmul double %49, 0x3BA3198A2E000000
  store double %50, double* %w.addr, align 8
  %51 = load double, double* %t.addr, align 8
  %52 = load double, double* %w.addr, align 8
  %53 = fsub double %51, %52
  store double %53, double* %r.addr, align 8
  %54 = load double, double* %fn.addr, align 8
  %55 = fmul double %54, 0x397B839A252049C1
  %56 = load double, double* %t.addr, align 8
  %57 = load double, double* %r.addr, align 8
  %58 = fsub double %56, %57
  %59 = load double, double* %w.addr, align 8
  %60 = fsub double %58, %59
  %61 = fsub double %55, %60
  store double %61, double* %w.addr, align 8
  %62 = load double, double* %r.addr, align 8
  %63 = load double, double* %w.addr, align 8
  %64 = fsub double %62, %63
  store double %64, double* %y0.addr, align 8
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  %65 = load double, double* %r.addr, align 8
  %66 = load double, double* %y0.addr, align 8
  %67 = fsub double %65, %66
  %68 = load double, double* %w.addr, align 8
  %69 = fsub double %67, %68
  store double %69, double* %y1.addr, align 8
  %70 = load double, double* %y0.addr, align 8
  %71 = load double, double* %y1.addr, align 8
  %72 = load double, double* %rounded.addr, align 8
  %73 = bitcast double %72 to i64
  %74 = sext i32 3 to i64
  %75 = and i64 %73, %74
  %76 = trunc i64 %75 to i32
  %77 = tail call double @nish.trigKernel(double %70, double %71, i32 %76, i32 %mode)
  ret double %77
}

define internal noundef double @nish.sinF64(double noundef %x) #0 {
entry:
  %ax.addr = alloca double, align 8
  %0 = call double @llvm.fabs.f64(double %x)
  store double %0, double* %ax.addr, align 8
  %1 = load double, double* %ax.addr, align 8
  %2 = fcmp olt double %1, 0x3FE921FC00000000
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load double, double* %ax.addr, align 8
  %4 = fcmp olt double %3, 0x3E50000000000000
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret double %x

if.end.1:
  %5 = tail call double @nish.kernelSin(double %x, double 0x0000000000000000, i1 false)
  ret double %5

if.end:
  %6 = load double, double* %ax.addr, align 8
  %7 = tail call double @nish.trigReduced(double %x, double %6, i32 1)
  ret double %7
}

define internal noundef double @nish.cosF64(double noundef %x) #0 {
entry:
  %ax.addr = alloca double, align 8
  %0 = call double @llvm.fabs.f64(double %x)
  store double %0, double* %ax.addr, align 8
  %1 = load double, double* %ax.addr, align 8
  %2 = fcmp olt double %1, 0x3FE921FC00000000
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load double, double* %ax.addr, align 8
  %4 = fcmp olt double %3, 0x3E40000000000000
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret double 0x3FF0000000000000

if.end.1:
  %5 = tail call double @nish.kernelCos(double %x, double 0x0000000000000000)
  ret double %5

if.end:
  %6 = load double, double* %ax.addr, align 8
  %7 = tail call double @nish.trigReduced(double %x, double %6, i32 2)
  ret double %7
}

define internal noundef double @nish.withHi(double noundef %x, i32 noundef %hi) #0 {
entry:
  %0 = sext i32 %hi to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = bitcast double %x to i64
  %5 = sext i32 1 to i64
  %6 = sext i32 32 to i64
  %7 = and i64 %6, 63
  %8 = shl i64 %5, %7
  %9 = sext i32 1 to i64
  %10 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %8, i64 %9)
  %11 = extractvalue { i64, i1 } %10, 0
  %12 = extractvalue { i64, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = and i64 %4, %11
  %14 = or i64 %3, %13
  %15 = bitcast i64 %14 to double
  ret double %15

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef double @nish.withLo(double noundef %x, i32 noundef %lo) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 -1 to i64
  %2 = sext i32 32 to i64
  %3 = and i64 %2, 63
  %4 = shl i64 %1, %3
  %5 = and i64 %0, %4
  %6 = zext i32 %lo to i64
  %7 = or i64 %5, %6
  %8 = bitcast i64 %7 to double
  ret double %8
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

define internal noundef double @nish.underflow(double noundef %s) #1 {
entry:
  %0 = fmul double %s, 0x01A56E1FC2F8F359
  %1 = fmul double %0, 0x01A56E1FC2F8F359
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

define internal noundef double @nish.logF64(double noundef %x) #0 {
entry:
  %v.addr = alloca double, align 8
  %hx.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %f.addr = alloca double, align 8
  %dk.addr = alloca double, align 8
  %rr.addr = alloca double, align 8
  %s.addr = alloca double, align 8
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %t1.addr = alloca double, align 8
  %t2.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %hfsq.addr = alloca double, align 8
  store double %x, double* %v.addr, align 8
  %0 = load double, double* %v.addr, align 8
  %1 = call i32 @nish.hiWord(double %0)
  store i32 %1, i32* %hx.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %2 = load i32, i32* %hx.addr, align 4
  %3 = icmp slt i32 %2, 1048576
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %hx.addr, align 4
  %5 = and i32 %4, 2147483647
  %6 = load double, double* %v.addr, align 8
  %7 = call i32 @nish.loWord(double %6)
  %8 = or i32 %5, %7
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  %10 = call double @nish.overflow(double 0x3FF0000000000000)
  %11 = fneg double %10
  ret double %11

if.end.1:
  %12 = load i32, i32* %hx.addr, align 4
  %13 = icmp slt i32 %12, 0
  br i1 %13, label %if.then.2, label %if.end.2

if.then.2:
  %14 = load double, double* %v.addr, align 8
  %15 = load double, double* %v.addr, align 8
  %16 = fsub double %14, %15
  %17 = load double, double* %v.addr, align 8
  %18 = load double, double* %v.addr, align 8
  %19 = fsub double %17, %18
  %20 = fdiv double %16, %19
  ret double %20

if.end.2:
  store i32 -54, i32* %k.addr, align 4
  %21 = load double, double* %v.addr, align 8
  %22 = fmul double %21, 0x4350000000000000
  store double %22, double* %v.addr, align 8
  %23 = load double, double* %v.addr, align 8
  %24 = call i32 @nish.hiWord(double %23)
  store i32 %24, i32* %hx.addr, align 4
  br label %if.end

if.end:
  %25 = load i32, i32* %hx.addr, align 4
  %26 = icmp sge i32 %25, 2146435072
  br i1 %26, label %if.then.3, label %if.end.3

if.then.3:
  %27 = load double, double* %v.addr, align 8
  %28 = load double, double* %v.addr, align 8
  %29 = fadd double %27, %28
  ret double %29

if.end.3:
  %30 = load i32, i32* %k.addr, align 4
  %31 = load i32, i32* %hx.addr, align 4
  %32 = ashr i32 %31, 20
  %33 = sub nsw i32 %32, 1023
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %35, i32* %k.addr, align 4
  %37 = load i32, i32* %hx.addr, align 4
  %38 = and i32 %37, 1048575
  store i32 %38, i32* %hx.addr, align 4
  %39 = load i32, i32* %hx.addr, align 4
  %40 = add nsw i32 %39, 614244
  %41 = and i32 %40, 1048576
  store i32 %41, i32* %i.addr, align 4
  %42 = load double, double* %v.addr, align 8
  %43 = load i32, i32* %hx.addr, align 4
  %44 = load i32, i32* %i.addr, align 4
  %45 = xor i32 %44, 1072693248
  %46 = or i32 %43, %45
  %47 = call double @nish.withHi(double %42, i32 %46)
  store double %47, double* %v.addr, align 8
  %48 = load i32, i32* %k.addr, align 4
  %49 = load i32, i32* %i.addr, align 4
  %50 = ashr i32 %49, 20
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %52, i32* %k.addr, align 4
  %54 = load double, double* %v.addr, align 8
  %55 = fsub double %54, 0x3FF0000000000000
  store double %55, double* %f.addr, align 8
  %56 = load i32, i32* %k.addr, align 4
  %57 = sitofp i32 %56 to double
  store double %57, double* %dk.addr, align 8
  %58 = load i32, i32* %hx.addr, align 4
  %59 = add nsw i32 %58, 2
  %60 = and i32 %59, 1048575
  %61 = icmp slt i32 %60, 3
  br i1 %61, label %if.then.4, label %if.end.4

if.then.4:
  %62 = load double, double* %f.addr, align 8
  %63 = fcmp oeq double %62, 0x0000000000000000
  br i1 %63, label %if.then.5, label %if.end.5

if.then.5:
  %64 = load double, double* %dk.addr, align 8
  %65 = fmul double %64, 0x3FE62E42FEE00000
  %66 = load double, double* %dk.addr, align 8
  %67 = fmul double %66, 0x3DEA39EF35793C76
  %68 = fadd double %65, %67
  ret double %68

if.end.5:
  %69 = load double, double* %f.addr, align 8
  %70 = load double, double* %f.addr, align 8
  %71 = fmul double %69, %70
  %72 = load double, double* %f.addr, align 8
  %73 = fneg double 0x3FD5555555555555
  %74 = fmul double %72, %73
  %75 = fadd double %74, 0x3FE0000000000000
  %76 = fmul double %71, %75
  store double %76, double* %rr.addr, align 8
  %77 = load i32, i32* %k.addr, align 4
  %78 = icmp eq i32 %77, 0
  br i1 %78, label %if.then.6, label %if.end.6

if.then.6:
  %79 = load double, double* %f.addr, align 8
  %80 = load double, double* %rr.addr, align 8
  %81 = fsub double %79, %80
  ret double %81

if.end.6:
  %82 = load double, double* %dk.addr, align 8
  %83 = fmul double %82, 0x3FE62E42FEE00000
  %84 = load double, double* %rr.addr, align 8
  %85 = load double, double* %dk.addr, align 8
  %86 = fmul double %85, 0x3DEA39EF35793C76
  %87 = fsub double %84, %86
  %88 = load double, double* %f.addr, align 8
  %89 = fsub double %87, %88
  %90 = fsub double %83, %89
  ret double %90

if.end.4:
  %91 = load double, double* %f.addr, align 8
  %92 = load double, double* %f.addr, align 8
  %93 = fadd double 0x4000000000000000, %92
  %94 = fdiv double %91, %93
  store double %94, double* %s.addr, align 8
  %95 = load double, double* %s.addr, align 8
  %96 = load double, double* %s.addr, align 8
  %97 = fmul double %95, %96
  store double %97, double* %z.addr, align 8
  %98 = load double, double* %z.addr, align 8
  %99 = load double, double* %z.addr, align 8
  %100 = fmul double %98, %99
  store double %100, double* %w.addr, align 8
  %101 = load double, double* %w.addr, align 8
  %102 = load double, double* %w.addr, align 8
  %103 = load double, double* %w.addr, align 8
  %104 = fmul double %103, 0x3FC39A09D078C69F
  %105 = fadd double %104, 0x3FCC71C51D8E78AF
  %106 = fmul double %102, %105
  %107 = fadd double %106, 0x3FD999999997FA04
  %108 = fmul double %101, %107
  store double %108, double* %t1.addr, align 8
  %109 = load double, double* %z.addr, align 8
  %110 = load double, double* %w.addr, align 8
  %111 = load double, double* %w.addr, align 8
  %112 = load double, double* %w.addr, align 8
  %113 = fmul double %112, 0x3FC2F112DF3E5244
  %114 = fadd double %113, 0x3FC7466496CB03DE
  %115 = fmul double %111, %114
  %116 = fadd double %115, 0x3FD2492494229359
  %117 = fmul double %110, %116
  %118 = fadd double %117, 0x3FE5555555555593
  %119 = fmul double %109, %118
  store double %119, double* %t2.addr, align 8
  %120 = load double, double* %t2.addr, align 8
  %121 = load double, double* %t1.addr, align 8
  %122 = fadd double %120, %121
  store double %122, double* %r.addr, align 8
  %123 = load i32, i32* %hx.addr, align 4
  %124 = sub nsw i32 %123, 398458
  %125 = load i32, i32* %hx.addr, align 4
  %126 = sub nsw i32 440401, %125
  %127 = or i32 %124, %126
  %128 = icmp sgt i32 %127, 0
  br i1 %128, label %if.then.7, label %if.end.7

if.then.7:
  %129 = load double, double* %f.addr, align 8
  %130 = load double, double* %f.addr, align 8
  %131 = fmul double %129, %130
  %132 = fmul double %131, 0x3FE0000000000000
  store double %132, double* %hfsq.addr, align 8
  %133 = load i32, i32* %k.addr, align 4
  %134 = icmp eq i32 %133, 0
  br i1 %134, label %if.then.8, label %if.end.8

if.then.8:
  %135 = load double, double* %f.addr, align 8
  %136 = load double, double* %hfsq.addr, align 8
  %137 = load double, double* %s.addr, align 8
  %138 = load double, double* %hfsq.addr, align 8
  %139 = load double, double* %r.addr, align 8
  %140 = fadd double %138, %139
  %141 = fmul double %137, %140
  %142 = fsub double %136, %141
  %143 = fsub double %135, %142
  ret double %143

if.end.8:
  %144 = load double, double* %dk.addr, align 8
  %145 = fmul double %144, 0x3FE62E42FEE00000
  %146 = load double, double* %hfsq.addr, align 8
  %147 = load double, double* %s.addr, align 8
  %148 = load double, double* %hfsq.addr, align 8
  %149 = load double, double* %r.addr, align 8
  %150 = fadd double %148, %149
  %151 = fmul double %147, %150
  %152 = load double, double* %dk.addr, align 8
  %153 = fmul double %152, 0x3DEA39EF35793C76
  %154 = fadd double %151, %153
  %155 = fsub double %146, %154
  %156 = load double, double* %f.addr, align 8
  %157 = fsub double %155, %156
  %158 = fsub double %145, %157
  ret double %158

if.end.7:
  %159 = load i32, i32* %k.addr, align 4
  %160 = icmp eq i32 %159, 0
  br i1 %160, label %if.then.9, label %if.end.9

if.then.9:
  %161 = load double, double* %f.addr, align 8
  %162 = load double, double* %s.addr, align 8
  %163 = load double, double* %f.addr, align 8
  %164 = load double, double* %r.addr, align 8
  %165 = fsub double %163, %164
  %166 = fmul double %162, %165
  %167 = fsub double %161, %166
  ret double %167

if.end.9:
  %168 = load double, double* %dk.addr, align 8
  %169 = fmul double %168, 0x3FE62E42FEE00000
  %170 = load double, double* %s.addr, align 8
  %171 = load double, double* %f.addr, align 8
  %172 = load double, double* %r.addr, align 8
  %173 = fsub double %171, %172
  %174 = fmul double %170, %173
  %175 = load double, double* %dk.addr, align 8
  %176 = fmul double %175, 0x3DEA39EF35793C76
  %177 = fsub double %174, %176
  %178 = load double, double* %f.addr, align 8
  %179 = fsub double %177, %178
  %180 = fsub double %169, %179
  ret double %180

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef double @nish.scaleDown(double noundef %z, i32 noundef %n) #0 {
entry:
  %0 = call double @nish.pow2(i32 -1000)
  %1 = fmul double %z, %0
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1000)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call double @nish.pow2(i32 %3)
  %6 = fmul double %1, %5
  ret double %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef double @nish.powHugeY(i32 noundef %ix, i32 noundef %hy, i32 noundef %iy, double noundef %s) #1 {
entry:
  %0 = icmp sgt i32 %iy, 1139802112
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp sle i32 %ix, 1072693247
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  %2 = icmp slt i32 %hy, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = call double @nish.overflow(double 0x3FF0000000000000)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi double [ %3, %cond.true ], [ 0x0000000000000000, %cond.false ]
  ret double %4

if.end.1:
  %5 = icmp sgt i32 %hy, 0
  br i1 %5, label %cond.true.1, label %cond.false.1

cond.true.1:
  %6 = call double @nish.overflow(double 0x3FF0000000000000)
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %7 = phi double [ %6, %cond.true.1 ], [ 0x0000000000000000, %cond.false.1 ]
  ret double %7

if.end:
  %8 = icmp slt i32 %ix, 1072693247
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = icmp slt i32 %hy, 0
  br i1 %9, label %cond.true.2, label %cond.false.2

cond.true.2:
  %10 = call double @nish.overflow(double %s)
  br label %cond.end.2

cond.false.2:
  %11 = call double @nish.underflow(double %s)
  br label %cond.end.2

cond.end.2:
  %12 = phi double [ %10, %cond.true.2 ], [ %11, %cond.false.2 ]
  ret double %12

if.end.2:
  %13 = icmp sgt i32 %hy, 0
  br i1 %13, label %cond.true.3, label %cond.false.3

cond.true.3:
  %14 = call double @nish.overflow(double %s)
  br label %cond.end.3

cond.false.3:
  %15 = call double @nish.underflow(double %s)
  br label %cond.end.3

cond.end.3:
  %16 = phi double [ %14, %cond.true.3 ], [ %15, %cond.false.3 ]
  ret double %16
}

define internal noundef double @nish.powExp2(double noundef %ph0, double noundef %pl, double noundef %s) #0 {
entry:
  %ph.addr = alloca double, align 8
  %z0.addr = alloca double, align 8
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %ij.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %unit.addr = alloca i32, align 4
  %t.addr = alloca double, align 8
  %t.addr.1 = alloca double, align 8
  %u.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %t1.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %hz.addr = alloca i32, align 4
  store double %ph0, double* %ph.addr, align 8
  %0 = load double, double* %ph.addr, align 8
  %1 = fadd double %pl, %0
  store double %1, double* %z0.addr, align 8
  %2 = load double, double* %z0.addr, align 8
  %3 = call i32 @nish.hiWord(double %2)
  store i32 %3, i32* %j.addr, align 4
  %4 = load double, double* %z0.addr, align 8
  %5 = call i32 @nish.loWord(double %4)
  store i32 %5, i32* %i.addr, align 4
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp sge i32 %6, 1083179008
  br i1 %7, label %if.then, label %if.else

if.then:
  %8 = load i32, i32* %j.addr, align 4
  %9 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %8, i32 1083179008)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  %12 = load i32, i32* %i.addr, align 4
  %13 = or i32 %10, %12
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = fadd double %pl, 0x3C971547652B82FE
  %16 = load double, double* %z0.addr, align 8
  %17 = load double, double* %ph.addr, align 8
  %18 = fsub double %16, %17
  %19 = fcmp ogt double %15, %18
  br label %lor.end

lor.end:
  %20 = phi i1 [ true, %ovf.ok ], [ %19, %lor.rhs ]
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  %21 = tail call double @nish.overflow(double %s)
  ret double %21

if.end.1:
  br label %if.end

if.else:
  %22 = load i32, i32* %j.addr, align 4
  %23 = and i32 %22, 2147483647
  %24 = icmp sge i32 %23, 1083231232
  br i1 %24, label %if.then.2, label %if.end.2

if.then.2:
  %25 = load i32, i32* %j.addr, align 4
  %26 = icmp ne i32 %25, -1064252416
  br i1 %26, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %27 = load i32, i32* %i.addr, align 4
  %28 = icmp ne i32 %27, 0
  br label %lor.end.2

lor.end.2:
  %29 = phi i1 [ true, %if.then.2 ], [ %28, %lor.rhs.2 ]
  br i1 %29, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %30 = load double, double* %z0.addr, align 8
  %31 = load double, double* %ph.addr, align 8
  %32 = fsub double %30, %31
  %33 = fcmp ole double %pl, %32
  br label %lor.end.1

lor.end.1:
  %34 = phi i1 [ true, %lor.end.2 ], [ %33, %lor.rhs.1 ]
  br i1 %34, label %if.then.3, label %if.end.3

if.then.3:
  %35 = tail call double @nish.underflow(double %s)
  ret double %35

if.end.3:
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  %36 = load i32, i32* %j.addr, align 4
  %37 = and i32 %36, 2147483647
  store i32 %37, i32* %ij.addr, align 4
  %38 = load i32, i32* %ij.addr, align 4
  %39 = ashr i32 %38, 20
  %40 = sub nsw i32 %39, 1023
  store i32 %40, i32* %k.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %41 = load i32, i32* %ij.addr, align 4
  %42 = icmp sgt i32 %41, 1071644672
  br i1 %42, label %if.then.4, label %if.end.4

if.then.4:
  store i32 1048576, i32* %unit.addr, align 4
  %43 = load i32, i32* %j.addr, align 4
  %44 = load i32, i32* %unit.addr, align 4
  %45 = load i32, i32* %k.addr, align 4
  %46 = add nsw i32 %45, 1
  %47 = and i32 %46, 31
  %48 = ashr i32 %44, %47
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %50, i32* %n.addr, align 4
  %52 = load i32, i32* %n.addr, align 4
  %53 = and i32 %52, 2147483647
  %54 = ashr i32 %53, 20
  %55 = sub nsw i32 %54, 1023
  store i32 %55, i32* %k.addr, align 4
  %56 = load i32, i32* %n.addr, align 4
  %57 = load i32, i32* %k.addr, align 4
  %58 = and i32 %57, 31
  %59 = ashr i32 1048575, %58
  %60 = xor i32 %59, -1
  %61 = and i32 %56, %60
  %62 = call double @nish.withHi(double 0x0000000000000000, i32 %61)
  store double %62, double* %t.addr, align 8
  %63 = load i32, i32* %n.addr, align 4
  %64 = and i32 %63, 1048575
  %65 = or i32 %64, 1048576
  %66 = load i32, i32* %k.addr, align 4
  %67 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 20, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %70 = and i32 %68, 31
  %71 = ashr i32 %65, %70
  store i32 %71, i32* %n.addr, align 4
  %72 = load i32, i32* %j.addr, align 4
  %73 = icmp slt i32 %72, 0
  br i1 %73, label %if.then.5, label %if.end.5

if.then.5:
  %74 = load i32, i32* %n.addr, align 4
  %75 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %74)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %76, i32* %n.addr, align 4
  br label %if.end.5

if.end.5:
  %78 = load double, double* %ph.addr, align 8
  %79 = load double, double* %t.addr, align 8
  %80 = fsub double %78, %79
  store double %80, double* %ph.addr, align 8
  br label %if.end.4

if.end.4:
  %81 = load double, double* %ph.addr, align 8
  %82 = fadd double %pl, %81
  %83 = call double @nish.withLo(double %82, i32 0)
  store double %83, double* %t.addr.1, align 8
  %84 = load double, double* %t.addr.1, align 8
  %85 = fmul double %84, 0x3FE62E4300000000
  store double %85, double* %u.addr, align 8
  %86 = load double, double* %t.addr.1, align 8
  %87 = load double, double* %ph.addr, align 8
  %88 = fsub double %86, %87
  %89 = fsub double %pl, %88
  %90 = fmul double %89, 0x3FE62E42FEFA39EF
  %91 = load double, double* %t.addr.1, align 8
  %92 = fneg double 0x3E205C610CA86C39
  %93 = fmul double %91, %92
  %94 = fadd double %90, %93
  store double %94, double* %v.addr, align 8
  %95 = load double, double* %u.addr, align 8
  %96 = load double, double* %v.addr, align 8
  %97 = fadd double %95, %96
  store double %97, double* %z.addr, align 8
  %98 = load double, double* %v.addr, align 8
  %99 = load double, double* %z.addr, align 8
  %100 = load double, double* %u.addr, align 8
  %101 = fsub double %99, %100
  %102 = fsub double %98, %101
  store double %102, double* %w.addr, align 8
  %103 = load double, double* %z.addr, align 8
  %104 = load double, double* %z.addr, align 8
  %105 = load double, double* %z.addr, align 8
  %106 = fmul double %104, %105
  %107 = load double, double* %z.addr, align 8
  %108 = load double, double* %z.addr, align 8
  %109 = fmul double %107, %108
  %110 = call double @nish.expPoly(double %109)
  %111 = fmul double %106, %110
  %112 = fsub double %103, %111
  store double %112, double* %t1.addr, align 8
  %113 = load double, double* %z.addr, align 8
  %114 = load double, double* %t1.addr, align 8
  %115 = fmul double %113, %114
  %116 = load double, double* %t1.addr, align 8
  %117 = fsub double %116, 0x4000000000000000
  %118 = fdiv double %115, %117
  %119 = load double, double* %w.addr, align 8
  %120 = load double, double* %z.addr, align 8
  %121 = load double, double* %w.addr, align 8
  %122 = fmul double %120, %121
  %123 = fadd double %119, %122
  %124 = fsub double %118, %123
  store double %124, double* %r.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %125 = load double, double* %one.addr, align 8
  %126 = load double, double* %r.addr, align 8
  %127 = load double, double* %z.addr, align 8
  %128 = fsub double %126, %127
  %129 = fsub double %125, %128
  store double %129, double* %z.addr, align 8
  %130 = load double, double* %z.addr, align 8
  %131 = call i32 @nish.hiWord(double %130)
  %132 = load i32, i32* %n.addr, align 4
  %133 = shl i32 %132, 20
  %134 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %131, i32 %133)
  %135 = extractvalue { i32, i1 } %134, 0
  %136 = extractvalue { i32, i1 } %134, 1
  br i1 %136, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %135, i32* %hz.addr, align 4
  %137 = load i32, i32* %hz.addr, align 4
  %138 = ashr i32 %137, 20
  %139 = icmp sle i32 %138, 0
  br i1 %139, label %if.then.6, label %if.end.6

if.then.6:
  %140 = load double, double* %z.addr, align 8
  %141 = load i32, i32* %n.addr, align 4
  %142 = call double @nish.scaleDown(double %140, i32 %141)
  %143 = fmul double %s, %142
  ret double %143

if.end.6:
  %144 = load double, double* %z.addr, align 8
  %145 = load i32, i32* %hz.addr, align 4
  %146 = call double @nish.withHi(double %144, i32 %145)
  %147 = fmul double %s, %146
  ret double %147

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.then ], [ 0, %if.then.4 ], [ 1, %ovf.ok.1 ], [ 3, %if.then.5 ], [ 0, %if.end.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef double @nish.powF64(double noundef %x, double noundef %y) #0 {
entry:
  %hx.addr = alloca i32, align 4
  %lx.addr = alloca i32, align 4
  %hy.addr = alloca i32, align 4
  %ly.addr = alloca i32, align 4
  %ix.addr = alloca i32, align 4
  %iy.addr = alloca i32, align 4
  %yisint.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %j.addr.1 = alloca i32, align 4
  %odd.addr = alloca i32, align 4
  %ax.addr = alloca double, align 8
  %z.addr = alloca double, align 8
  %s.addr = alloca double, align 8
  %t1.addr = alloca double, align 8
  %t2.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %u.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %n.addr = alloca i32, align 4
  %jx.addr = alloca i32, align 4
  %j.addr.2 = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %bp.addr = alloca double, align 8
  %dph.addr = alloca double, align 8
  %dpl.addr = alloca double, align 8
  %u.addr.1 = alloca double, align 8
  %one.addr = alloca double, align 8
  %v.addr.1 = alloca double, align 8
  %ss.addr = alloca double, align 8
  %sh.addr = alloca double, align 8
  %th.addr = alloca double, align 8
  %tl.addr = alloca double, align 8
  %sl.addr = alloca double, align 8
  %s2.addr = alloca double, align 8
  %l3.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %pu.addr = alloca double, align 8
  %pv.addr = alloca double, align 8
  %ph.addr = alloca double, align 8
  %pl.addr = alloca double, align 8
  %zh.addr = alloca double, align 8
  %zl.addr = alloca double, align 8
  %t.addr.1 = alloca double, align 8
  %y1.addr = alloca double, align 8
  %0 = call i32 @nish.hiWord(double %x)
  store i32 %0, i32* %hx.addr, align 4
  %1 = call i32 @nish.loWord(double %x)
  store i32 %1, i32* %lx.addr, align 4
  %2 = call i32 @nish.hiWord(double %y)
  store i32 %2, i32* %hy.addr, align 4
  %3 = call i32 @nish.loWord(double %y)
  store i32 %3, i32* %ly.addr, align 4
  %4 = load i32, i32* %hx.addr, align 4
  %5 = and i32 %4, 2147483647
  store i32 %5, i32* %ix.addr, align 4
  %6 = load i32, i32* %hy.addr, align 4
  %7 = and i32 %6, 2147483647
  store i32 %7, i32* %iy.addr, align 4
  %8 = load i32, i32* %iy.addr, align 4
  %9 = load i32, i32* %ly.addr, align 4
  %10 = or i32 %8, %9
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  ret double 0x3FF0000000000000

if.end:
  %12 = call i1 @nish.isNan(double %x)
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = call i1 @nish.isNan(double %y)
  br label %lor.end

lor.end:
  %14 = phi i1 [ true, %if.end ], [ %13, %lor.rhs ]
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = fadd double %x, %y
  ret double %15

if.end.1:
  %16 = load i32, i32* %iy.addr, align 4
  %17 = icmp eq i32 %16, 2146435072
  br i1 %17, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %18 = load i32, i32* %ly.addr, align 4
  %19 = icmp eq i32 %18, 0
  br label %land.end.2

land.end.2:
  %20 = phi i1 [ false, %if.end.1 ], [ %19, %land.rhs.2 ]
  br i1 %20, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %21 = load i32, i32* %ix.addr, align 4
  %22 = icmp eq i32 %21, 1072693248
  br label %land.end.1

land.end.1:
  %23 = phi i1 [ false, %land.end.2 ], [ %22, %land.rhs.1 ]
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %lx.addr, align 4
  %25 = icmp eq i32 %24, 0
  br label %land.end

land.end:
  %26 = phi i1 [ false, %land.end.1 ], [ %25, %land.rhs ]
  br i1 %26, label %if.then.2, label %if.end.2

if.then.2:
  %27 = fsub double %y, %y
  ret double %27

if.end.2:
  %28 = load i32, i32* %hx.addr, align 4
  %29 = icmp eq i32 %28, 1072693248
  br i1 %29, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %30 = load i32, i32* %lx.addr, align 4
  %31 = icmp eq i32 %30, 0
  br label %land.end.3

land.end.3:
  %32 = phi i1 [ false, %if.end.2 ], [ %31, %land.rhs.3 ]
  br i1 %32, label %if.then.3, label %if.end.3

if.then.3:
  ret double 0x3FF0000000000000

if.end.3:
  store i32 0, i32* %yisint.addr, align 4
  %33 = load i32, i32* %hx.addr, align 4
  %34 = icmp slt i32 %33, 0
  br i1 %34, label %if.then.4, label %if.end.4

if.then.4:
  %35 = load i32, i32* %iy.addr, align 4
  %36 = icmp sge i32 %35, 1128267776
  br i1 %36, label %if.then.5, label %if.else

if.then.5:
  store i32 2, i32* %yisint.addr, align 4
  br label %if.end.5

if.else:
  %37 = load i32, i32* %iy.addr, align 4
  %38 = icmp sge i32 %37, 1072693248
  br i1 %38, label %if.then.6, label %if.end.6

if.then.6:
  %39 = load i32, i32* %iy.addr, align 4
  %40 = ashr i32 %39, 20
  %41 = sub nsw i32 %40, 1023
  store i32 %41, i32* %k.addr, align 4
  %42 = load i32, i32* %k.addr, align 4
  %43 = icmp sgt i32 %42, 20
  br i1 %43, label %if.then.7, label %if.else.1

if.then.7:
  %44 = load i32, i32* %ly.addr, align 4
  %45 = load i32, i32* %k.addr, align 4
  %46 = sub nsw i32 52, %45
  %47 = and i32 %46, 31
  %48 = lshr i32 %44, %47
  store i32 %48, i32* %j.addr, align 4
  %49 = load i32, i32* %j.addr, align 4
  %50 = load i32, i32* %k.addr, align 4
  %51 = sub nsw i32 52, %50
  %52 = and i32 %51, 31
  %53 = shl i32 %49, %52
  %54 = load i32, i32* %ly.addr, align 4
  %55 = icmp eq i32 %53, %54
  br i1 %55, label %if.then.8, label %if.end.8

if.then.8:
  %56 = load i32, i32* %j.addr, align 4
  %57 = and i32 %56, 1
  %58 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 2, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %59, i32* %yisint.addr, align 4
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.else.1:
  %61 = load i32, i32* %ly.addr, align 4
  %62 = icmp eq i32 %61, 0
  br i1 %62, label %if.then.9, label %if.end.9

if.then.9:
  %63 = load i32, i32* %iy.addr, align 4
  %64 = load i32, i32* %k.addr, align 4
  %65 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 20, i32 %64)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %68 = and i32 %66, 31
  %69 = ashr i32 %63, %68
  store i32 %69, i32* %j.addr.1, align 4
  %70 = load i32, i32* %j.addr.1, align 4
  %71 = load i32, i32* %k.addr, align 4
  %72 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 20, i32 %71)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %75 = and i32 %73, 31
  %76 = shl i32 %70, %75
  %77 = load i32, i32* %iy.addr, align 4
  %78 = icmp eq i32 %76, %77
  br i1 %78, label %if.then.10, label %if.end.10

if.then.10:
  %79 = load i32, i32* %j.addr.1, align 4
  %80 = and i32 %79, 1
  store i32 %80, i32* %odd.addr, align 4
  %81 = load i32, i32* %odd.addr, align 4
  %82 = sub nsw i32 2, %81
  store i32 %82, i32* %yisint.addr, align 4
  br label %if.end.10

if.end.10:
  br label %if.end.9

if.end.9:
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  br label %if.end.4

if.end.4:
  %83 = load i32, i32* %ly.addr, align 4
  %84 = icmp eq i32 %83, 0
  br i1 %84, label %if.then.11, label %if.end.11

if.then.11:
  %85 = load i32, i32* %iy.addr, align 4
  %86 = icmp eq i32 %85, 2146435072
  br i1 %86, label %if.then.12, label %if.end.12

if.then.12:
  %87 = load i32, i32* %ix.addr, align 4
  %88 = icmp sge i32 %87, 1072693248
  br i1 %88, label %if.then.13, label %if.end.13

if.then.13:
  %89 = load i32, i32* %hy.addr, align 4
  %90 = icmp sge i32 %89, 0
  br i1 %90, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %91 = phi double [ %y, %cond.true ], [ 0x0000000000000000, %cond.false ]
  ret double %91

if.end.13:
  %92 = load i32, i32* %hy.addr, align 4
  %93 = icmp slt i32 %92, 0
  br i1 %93, label %cond.true.1, label %cond.false.1

cond.true.1:
  %94 = fneg double %y
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %95 = phi double [ %94, %cond.true.1 ], [ 0x0000000000000000, %cond.false.1 ]
  ret double %95

if.end.12:
  %96 = load i32, i32* %iy.addr, align 4
  %97 = icmp eq i32 %96, 1072693248
  br i1 %97, label %if.then.14, label %if.end.14

if.then.14:
  %98 = load i32, i32* %hy.addr, align 4
  %99 = icmp slt i32 %98, 0
  br i1 %99, label %cond.true.2, label %cond.false.2

cond.true.2:
  %100 = fdiv double 0x3FF0000000000000, %x
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %101 = phi double [ %100, %cond.true.2 ], [ %x, %cond.false.2 ]
  ret double %101

if.end.14:
  %102 = load i32, i32* %hy.addr, align 4
  %103 = icmp eq i32 %102, 1073741824
  br i1 %103, label %if.then.15, label %if.end.15

if.then.15:
  %104 = fmul double %x, %x
  ret double %104

if.end.15:
  %105 = load i32, i32* %hy.addr, align 4
  %106 = icmp eq i32 %105, 1071644672
  br i1 %106, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %107 = load i32, i32* %hx.addr, align 4
  %108 = icmp sge i32 %107, 0
  br label %land.end.4

land.end.4:
  %109 = phi i1 [ false, %if.end.15 ], [ %108, %land.rhs.4 ]
  br i1 %109, label %if.then.16, label %if.end.16

if.then.16:
  %110 = call double @llvm.sqrt.f64(double %x)
  ret double %110

if.end.16:
  br label %if.end.11

if.end.11:
  %111 = call double @llvm.fabs.f64(double %x)
  store double %111, double* %ax.addr, align 8
  %112 = load i32, i32* %lx.addr, align 4
  %113 = icmp eq i32 %112, 0
  br i1 %113, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %114 = load i32, i32* %ix.addr, align 4
  %115 = icmp eq i32 %114, 2146435072
  br i1 %115, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %116 = load i32, i32* %ix.addr, align 4
  %117 = icmp eq i32 %116, 0
  br label %lor.end.2

lor.end.2:
  %118 = phi i1 [ true, %land.rhs.5 ], [ %117, %lor.rhs.2 ]
  br i1 %118, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %119 = load i32, i32* %ix.addr, align 4
  %120 = icmp eq i32 %119, 1072693248
  br label %lor.end.1

lor.end.1:
  %121 = phi i1 [ true, %lor.end.2 ], [ %120, %lor.rhs.1 ]
  br label %land.end.5

land.end.5:
  %122 = phi i1 [ false, %if.end.11 ], [ %121, %lor.end.1 ]
  br i1 %122, label %if.then.17, label %if.end.17

if.then.17:
  %123 = load i32, i32* %hy.addr, align 4
  %124 = icmp slt i32 %123, 0
  br i1 %124, label %cond.true.3, label %cond.false.3

cond.true.3:
  %125 = load double, double* %ax.addr, align 8
  %126 = fdiv double 0x3FF0000000000000, %125
  br label %cond.end.3

cond.false.3:
  %127 = load double, double* %ax.addr, align 8
  br label %cond.end.3

cond.end.3:
  %128 = phi double [ %126, %cond.true.3 ], [ %127, %cond.false.3 ]
  store double %128, double* %z.addr, align 8
  %129 = load i32, i32* %hx.addr, align 4
  %130 = icmp slt i32 %129, 0
  br i1 %130, label %if.then.18, label %if.end.18

if.then.18:
  %131 = load i32, i32* %ix.addr, align 4
  %132 = sub nsw i32 %131, 1072693248
  %133 = load i32, i32* %yisint.addr, align 4
  %134 = or i32 %132, %133
  %135 = icmp eq i32 %134, 0
  br i1 %135, label %if.then.19, label %if.else.2

if.then.19:
  %136 = load double, double* %z.addr, align 8
  %137 = load double, double* %z.addr, align 8
  %138 = fsub double %136, %137
  %139 = load double, double* %z.addr, align 8
  %140 = load double, double* %z.addr, align 8
  %141 = fsub double %139, %140
  %142 = fdiv double %138, %141
  store double %142, double* %z.addr, align 8
  br label %if.end.19

if.else.2:
  %143 = load i32, i32* %yisint.addr, align 4
  %144 = icmp eq i32 %143, 1
  br i1 %144, label %if.then.20, label %if.end.20

if.then.20:
  %145 = load double, double* %z.addr, align 8
  %146 = fneg double %145
  store double %146, double* %z.addr, align 8
  br label %if.end.20

if.end.20:
  br label %if.end.19

if.end.19:
  br label %if.end.18

if.end.18:
  %147 = load double, double* %z.addr, align 8
  ret double %147

if.end.17:
  %148 = load i32, i32* %hx.addr, align 4
  %149 = icmp slt i32 %148, 0
  br i1 %149, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %150 = load i32, i32* %yisint.addr, align 4
  %151 = icmp eq i32 %150, 0
  br label %land.end.6

land.end.6:
  %152 = phi i1 [ false, %if.end.17 ], [ %151, %land.rhs.6 ]
  br i1 %152, label %if.then.21, label %if.end.21

if.then.21:
  %153 = fsub double %x, %x
  %154 = fsub double %x, %x
  %155 = fdiv double %153, %154
  ret double %155

if.end.21:
  %156 = load i32, i32* %hx.addr, align 4
  %157 = icmp slt i32 %156, 0
  br i1 %157, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %158 = load i32, i32* %yisint.addr, align 4
  %159 = icmp eq i32 %158, 1
  br label %land.end.7

land.end.7:
  %160 = phi i1 [ false, %if.end.21 ], [ %159, %land.rhs.7 ]
  br i1 %160, label %cond.true.4, label %cond.false.4

cond.true.4:
  %161 = fneg double 0x3FF0000000000000
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %162 = phi double [ %161, %cond.true.4 ], [ 0x3FF0000000000000, %cond.false.4 ]
  store double %162, double* %s.addr, align 8
  store double 0x0000000000000000, double* %t1.addr, align 8
  store double 0x0000000000000000, double* %t2.addr, align 8
  %163 = load i32, i32* %iy.addr, align 4
  %164 = icmp sgt i32 %163, 1105199104
  br i1 %164, label %if.then.22, label %if.else.3

if.then.22:
  %165 = load i32, i32* %iy.addr, align 4
  %166 = icmp sgt i32 %165, 1139802112
  br i1 %166, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %167 = load i32, i32* %ix.addr, align 4
  %168 = icmp slt i32 %167, 1072693247
  br label %lor.end.4

lor.end.4:
  %169 = phi i1 [ true, %if.then.22 ], [ %168, %lor.rhs.4 ]
  br i1 %169, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %170 = load i32, i32* %ix.addr, align 4
  %171 = icmp sgt i32 %170, 1072693248
  br label %lor.end.3

lor.end.3:
  %172 = phi i1 [ true, %lor.end.4 ], [ %171, %lor.rhs.3 ]
  br i1 %172, label %if.then.23, label %if.end.23

if.then.23:
  %173 = load i32, i32* %ix.addr, align 4
  %174 = load i32, i32* %hy.addr, align 4
  %175 = load i32, i32* %iy.addr, align 4
  %176 = load double, double* %s.addr, align 8
  %177 = tail call double @nish.powHugeY(i32 %173, i32 %174, i32 %175, double %176)
  ret double %177

if.end.23:
  %178 = load double, double* %ax.addr, align 8
  %179 = fsub double %178, 0x3FF0000000000000
  store double %179, double* %t.addr, align 8
  %180 = load double, double* %t.addr, align 8
  %181 = load double, double* %t.addr, align 8
  %182 = fmul double %180, %181
  %183 = load double, double* %t.addr, align 8
  %184 = load double, double* %t.addr, align 8
  %185 = fmul double %184, 0x3FD0000000000000
  %186 = fsub double %185, 0x3FD5555555555555
  %187 = fmul double %183, %186
  %188 = fadd double %187, 0x3FE0000000000000
  %189 = fmul double %182, %188
  store double %189, double* %w.addr, align 8
  %190 = load double, double* %t.addr, align 8
  %191 = fmul double %190, 0x3FF7154760000000
  store double %191, double* %u.addr, align 8
  %192 = load double, double* %t.addr, align 8
  %193 = fmul double %192, 0x3E54AE0BF85DDF44
  %194 = load double, double* %w.addr, align 8
  %195 = fmul double %194, 0x3FF71547652B82FE
  %196 = fsub double %193, %195
  store double %196, double* %v.addr, align 8
  %197 = load double, double* %u.addr, align 8
  %198 = load double, double* %v.addr, align 8
  %199 = fadd double %197, %198
  %200 = call double @nish.withLo(double %199, i32 0)
  store double %200, double* %t1.addr, align 8
  %201 = load double, double* %v.addr, align 8
  %202 = load double, double* %t1.addr, align 8
  %203 = load double, double* %u.addr, align 8
  %204 = fsub double %202, %203
  %205 = fsub double %201, %204
  store double %205, double* %t2.addr, align 8
  br label %if.end.22

if.else.3:
  store i32 0, i32* %n.addr, align 4
  %206 = load i32, i32* %ix.addr, align 4
  store i32 %206, i32* %jx.addr, align 4
  %207 = load i32, i32* %jx.addr, align 4
  %208 = icmp slt i32 %207, 1048576
  br i1 %208, label %if.then.24, label %if.end.24

if.then.24:
  %209 = load double, double* %ax.addr, align 8
  %210 = fmul double %209, 0x4340000000000000
  store double %210, double* %ax.addr, align 8
  store i32 -53, i32* %n.addr, align 4
  %211 = load double, double* %ax.addr, align 8
  %212 = call i32 @nish.hiWord(double %211)
  store i32 %212, i32* %jx.addr, align 4
  br label %if.end.24

if.end.24:
  %213 = load i32, i32* %n.addr, align 4
  %214 = load i32, i32* %jx.addr, align 4
  %215 = ashr i32 %214, 20
  %216 = sub nsw i32 %215, 1023
  %217 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %213, i32 %216)
  %218 = extractvalue { i32, i1 } %217, 0
  %219 = extractvalue { i32, i1 } %217, 1
  br i1 %219, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %218, i32* %n.addr, align 4
  %220 = load i32, i32* %jx.addr, align 4
  %221 = and i32 %220, 1048575
  store i32 %221, i32* %j.addr.2, align 4
  %222 = load i32, i32* %j.addr.2, align 4
  %223 = or i32 %222, 1072693248
  store i32 %223, i32* %jx.addr, align 4
  store i32 0, i32* %k.addr.1, align 4
  %224 = load i32, i32* %j.addr.2, align 4
  %225 = icmp sle i32 %224, 235662
  br i1 %225, label %if.then.25, label %if.else.4

if.then.25:
  store i32 0, i32* %k.addr.1, align 4
  br label %if.end.25

if.else.4:
  %226 = load i32, i32* %j.addr.2, align 4
  %227 = icmp slt i32 %226, 767610
  br i1 %227, label %if.then.26, label %if.else.5

if.then.26:
  store i32 1, i32* %k.addr.1, align 4
  br label %if.end.26

if.else.5:
  %228 = load i32, i32* %n.addr, align 4
  %229 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %228, i32 1)
  %230 = extractvalue { i32, i1 } %229, 0
  %231 = extractvalue { i32, i1 } %229, 1
  br i1 %231, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %230, i32* %n.addr, align 4
  %232 = load i32, i32* %jx.addr, align 4
  %233 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %232, i32 1048576)
  %234 = extractvalue { i32, i1 } %233, 0
  %235 = extractvalue { i32, i1 } %233, 1
  br i1 %235, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %234, i32* %jx.addr, align 4
  br label %if.end.26

if.end.26:
  br label %if.end.25

if.end.25:
  %236 = load double, double* %ax.addr, align 8
  %237 = load i32, i32* %jx.addr, align 4
  %238 = call double @nish.withHi(double %236, i32 %237)
  store double %238, double* %ax.addr, align 8
  %239 = load i32, i32* %k.addr.1, align 4
  %240 = icmp eq i32 %239, 0
  br i1 %240, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %241 = phi double [ 0x3FF0000000000000, %cond.true.5 ], [ 0x3FF8000000000000, %cond.false.5 ]
  store double %241, double* %bp.addr, align 8
  %242 = load i32, i32* %k.addr.1, align 4
  %243 = icmp eq i32 %242, 0
  br i1 %243, label %cond.true.6, label %cond.false.6

cond.true.6:
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %244 = phi double [ 0x0000000000000000, %cond.true.6 ], [ 0x3FE2B80340000000, %cond.false.6 ]
  store double %244, double* %dph.addr, align 8
  %245 = load i32, i32* %k.addr.1, align 4
  %246 = icmp eq i32 %245, 0
  br i1 %246, label %cond.true.7, label %cond.false.7

cond.true.7:
  br label %cond.end.7

cond.false.7:
  br label %cond.end.7

cond.end.7:
  %247 = phi double [ 0x0000000000000000, %cond.true.7 ], [ 0x3E4CFDEB43CFD006, %cond.false.7 ]
  store double %247, double* %dpl.addr, align 8
  %248 = load double, double* %ax.addr, align 8
  %249 = load double, double* %bp.addr, align 8
  %250 = fsub double %248, %249
  store double %250, double* %u.addr.1, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %251 = load double, double* %one.addr, align 8
  %252 = load double, double* %ax.addr, align 8
  %253 = load double, double* %bp.addr, align 8
  %254 = fadd double %252, %253
  %255 = fdiv double %251, %254
  store double %255, double* %v.addr.1, align 8
  %256 = load double, double* %u.addr.1, align 8
  %257 = load double, double* %v.addr.1, align 8
  %258 = fmul double %256, %257
  store double %258, double* %ss.addr, align 8
  %259 = load double, double* %ss.addr, align 8
  %260 = call double @nish.withLo(double %259, i32 0)
  store double %260, double* %sh.addr, align 8
  %261 = load i32, i32* %jx.addr, align 4
  %262 = ashr i32 %261, 1
  %263 = or i32 %262, 536870912
  %264 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %263, i32 524288)
  %265 = extractvalue { i32, i1 } %264, 0
  %266 = extractvalue { i32, i1 } %264, 1
  br i1 %266, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %267 = load i32, i32* %k.addr.1, align 4
  %268 = shl i32 %267, 18
  %269 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %265, i32 %268)
  %270 = extractvalue { i32, i1 } %269, 0
  %271 = extractvalue { i32, i1 } %269, 1
  br i1 %271, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %272 = call double @nish.withHi(double 0x0000000000000000, i32 %270)
  store double %272, double* %th.addr, align 8
  %273 = load double, double* %ax.addr, align 8
  %274 = load double, double* %th.addr, align 8
  %275 = load double, double* %bp.addr, align 8
  %276 = fsub double %274, %275
  %277 = fsub double %273, %276
  store double %277, double* %tl.addr, align 8
  %278 = load double, double* %v.addr.1, align 8
  %279 = load double, double* %u.addr.1, align 8
  %280 = load double, double* %sh.addr, align 8
  %281 = load double, double* %th.addr, align 8
  %282 = fmul double %280, %281
  %283 = fsub double %279, %282
  %284 = load double, double* %sh.addr, align 8
  %285 = load double, double* %tl.addr, align 8
  %286 = fmul double %284, %285
  %287 = fsub double %283, %286
  %288 = fmul double %278, %287
  store double %288, double* %sl.addr, align 8
  %289 = load double, double* %ss.addr, align 8
  %290 = load double, double* %ss.addr, align 8
  %291 = fmul double %289, %290
  store double %291, double* %s2.addr, align 8
  %292 = load double, double* %s2.addr, align 8
  %293 = load double, double* %s2.addr, align 8
  %294 = load double, double* %s2.addr, align 8
  %295 = fmul double %294, 0x3FCA7E284A454EEF
  %296 = fadd double %295, 0x3FCD864A93C9DB65
  %297 = fmul double %293, %296
  %298 = fadd double %297, 0x3FD17460A91D4101
  %299 = fmul double %292, %298
  store double %299, double* %l3.addr, align 8
  %300 = load double, double* %s2.addr, align 8
  %301 = load double, double* %s2.addr, align 8
  %302 = fmul double %300, %301
  %303 = load double, double* %s2.addr, align 8
  %304 = load double, double* %s2.addr, align 8
  %305 = load double, double* %l3.addr, align 8
  %306 = fadd double %305, 0x3FD55555518F264D
  %307 = fmul double %304, %306
  %308 = fadd double %307, 0x3FDB6DB6DB6FABFF
  %309 = fmul double %303, %308
  %310 = fadd double %309, 0x3FE3333333333303
  %311 = fmul double %302, %310
  store double %311, double* %r.addr, align 8
  %312 = load double, double* %r.addr, align 8
  %313 = load double, double* %sl.addr, align 8
  %314 = load double, double* %sh.addr, align 8
  %315 = load double, double* %ss.addr, align 8
  %316 = fadd double %314, %315
  %317 = fmul double %313, %316
  %318 = fadd double %312, %317
  store double %318, double* %r.addr, align 8
  %319 = load double, double* %sh.addr, align 8
  %320 = load double, double* %sh.addr, align 8
  %321 = fmul double %319, %320
  store double %321, double* %s2.addr, align 8
  %322 = load double, double* %s2.addr, align 8
  %323 = fadd double %322, 0x4008000000000000
  %324 = load double, double* %r.addr, align 8
  %325 = fadd double %323, %324
  %326 = call double @nish.withLo(double %325, i32 0)
  store double %326, double* %th.addr, align 8
  %327 = load double, double* %r.addr, align 8
  %328 = load double, double* %th.addr, align 8
  %329 = fsub double %328, 0x4008000000000000
  %330 = load double, double* %s2.addr, align 8
  %331 = fsub double %329, %330
  %332 = fsub double %327, %331
  store double %332, double* %tl.addr, align 8
  %333 = load double, double* %sh.addr, align 8
  %334 = load double, double* %th.addr, align 8
  %335 = fmul double %333, %334
  store double %335, double* %pu.addr, align 8
  %336 = load double, double* %sl.addr, align 8
  %337 = load double, double* %th.addr, align 8
  %338 = fmul double %336, %337
  %339 = load double, double* %tl.addr, align 8
  %340 = load double, double* %ss.addr, align 8
  %341 = fmul double %339, %340
  %342 = fadd double %338, %341
  store double %342, double* %pv.addr, align 8
  %343 = load double, double* %pu.addr, align 8
  %344 = load double, double* %pv.addr, align 8
  %345 = fadd double %343, %344
  %346 = call double @nish.withLo(double %345, i32 0)
  store double %346, double* %ph.addr, align 8
  %347 = load double, double* %pv.addr, align 8
  %348 = load double, double* %ph.addr, align 8
  %349 = load double, double* %pu.addr, align 8
  %350 = fsub double %348, %349
  %351 = fsub double %347, %350
  store double %351, double* %pl.addr, align 8
  %352 = load double, double* %ph.addr, align 8
  %353 = fmul double %352, 0x3FEEC709E0000000
  store double %353, double* %zh.addr, align 8
  %354 = load double, double* %ph.addr, align 8
  %355 = fneg double 0x3E3E2FE0145B01F5
  %356 = fmul double %354, %355
  %357 = load double, double* %pl.addr, align 8
  %358 = fmul double %357, 0x3FEEC709DC3A03FD
  %359 = fadd double %356, %358
  %360 = load double, double* %dpl.addr, align 8
  %361 = fadd double %359, %360
  store double %361, double* %zl.addr, align 8
  %362 = load i32, i32* %n.addr, align 4
  %363 = sitofp i32 %362 to double
  store double %363, double* %t.addr.1, align 8
  %364 = load double, double* %zh.addr, align 8
  %365 = load double, double* %zl.addr, align 8
  %366 = fadd double %364, %365
  %367 = load double, double* %dph.addr, align 8
  %368 = fadd double %366, %367
  %369 = load double, double* %t.addr.1, align 8
  %370 = fadd double %368, %369
  %371 = call double @nish.withLo(double %370, i32 0)
  store double %371, double* %t1.addr, align 8
  %372 = load double, double* %zl.addr, align 8
  %373 = load double, double* %t1.addr, align 8
  %374 = load double, double* %t.addr.1, align 8
  %375 = fsub double %373, %374
  %376 = load double, double* %dph.addr, align 8
  %377 = fsub double %375, %376
  %378 = load double, double* %zh.addr, align 8
  %379 = fsub double %377, %378
  %380 = fsub double %372, %379
  store double %380, double* %t2.addr, align 8
  br label %if.end.22

if.end.22:
  %381 = call double @nish.withLo(double %y, i32 0)
  store double %381, double* %y1.addr, align 8
  %382 = load double, double* %y1.addr, align 8
  %383 = load double, double* %t1.addr, align 8
  %384 = fmul double %382, %383
  %385 = load double, double* %y1.addr, align 8
  %386 = fsub double %y, %385
  %387 = load double, double* %t1.addr, align 8
  %388 = fmul double %386, %387
  %389 = load double, double* %t2.addr, align 8
  %390 = fmul double %y, %389
  %391 = fadd double %388, %390
  %392 = load double, double* %s.addr, align 8
  %393 = tail call double @nish.powExp2(double %384, double %391, double %392)
  ret double %393

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.then.8 ], [ 1, %if.then.9 ], [ 1, %ovf.ok.1 ], [ 0, %if.end.24 ], [ 0, %if.else.5 ], [ 1, %ovf.ok.4 ], [ 0, %cond.end.7 ], [ 0, %ovf.ok.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef double @nish.fmodF64(double noundef %x, double noundef %y) #0 {
entry:
  %ux.addr = alloca i64, align 8
  %uy.addr = alloca i64, align 8
  %ex.addr = alloca i32, align 4
  %ey.addr = alloca i32, align 4
  %sign.addr = alloca i64, align 8
  %mant.addr = alloca i64, align 8
  %implicit.addr = alloca i64, align 8
  %i.addr = alloca i64, align 8
  %i.addr.1 = alloca i64, align 8
  %0 = bitcast double %x to i64
  store i64 %0, i64* %ux.addr, align 8
  %1 = bitcast double %y to i64
  store i64 %1, i64* %uy.addr, align 8
  %2 = load i64, i64* %ux.addr, align 8
  %3 = sext i32 52 to i64
  %4 = and i64 %3, 63
  %5 = lshr i64 %2, %4
  %6 = sext i32 2047 to i64
  %7 = and i64 %5, %6
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %ex.addr, align 4
  %9 = load i64, i64* %uy.addr, align 8
  %10 = sext i32 52 to i64
  %11 = and i64 %10, 63
  %12 = lshr i64 %9, %11
  %13 = sext i32 2047 to i64
  %14 = and i64 %12, %13
  %15 = trunc i64 %14 to i32
  store i32 %15, i32* %ey.addr, align 4
  %16 = load i64, i64* %ux.addr, align 8
  %17 = sext i32 1 to i64
  %18 = sext i32 63 to i64
  %19 = and i64 %18, 63
  %20 = shl i64 %17, %19
  %21 = and i64 %16, %20
  store i64 %21, i64* %sign.addr, align 8
  %22 = load i64, i64* %uy.addr, align 8
  %23 = sext i32 1 to i64
  %24 = and i64 %23, 63
  %25 = shl i64 %22, %24
  %26 = sext i32 0 to i64
  %27 = icmp eq i64 %25, %26
  br i1 %27, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %28 = call i1 @nish.isNan(double %y)
  br label %lor.end.1

lor.end.1:
  %29 = phi i1 [ true, %entry ], [ %28, %lor.rhs.1 ]
  br i1 %29, label %lor.end, label %lor.rhs

lor.rhs:
  %30 = load i32, i32* %ex.addr, align 4
  %31 = icmp eq i32 %30, 2047
  br label %lor.end

lor.end:
  %32 = phi i1 [ true, %lor.end.1 ], [ %31, %lor.rhs ]
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = fmul double %x, %y
  %34 = fmul double %x, %y
  %35 = fdiv double %33, %34
  ret double %35

if.end:
  %36 = load i64, i64* %ux.addr, align 8
  %37 = sext i32 1 to i64
  %38 = and i64 %37, 63
  %39 = shl i64 %36, %38
  %40 = load i64, i64* %uy.addr, align 8
  %41 = sext i32 1 to i64
  %42 = and i64 %41, 63
  %43 = shl i64 %40, %42
  %44 = icmp ule i64 %39, %43
  br i1 %44, label %if.then.1, label %if.end.1

if.then.1:
  %45 = load i64, i64* %ux.addr, align 8
  %46 = sext i32 1 to i64
  %47 = and i64 %46, 63
  %48 = shl i64 %45, %47
  %49 = load i64, i64* %uy.addr, align 8
  %50 = sext i32 1 to i64
  %51 = and i64 %50, 63
  %52 = shl i64 %49, %51
  %53 = icmp eq i64 %48, %52
  br i1 %53, label %cond.true, label %cond.false

cond.true:
  %54 = fmul double 0x0000000000000000, %x
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %55 = phi double [ %54, %cond.true ], [ %x, %cond.false ]
  ret double %55

if.end.1:
  %56 = sext i32 1 to i64
  %57 = sext i32 52 to i64
  %58 = and i64 %57, 63
  %59 = shl i64 %56, %58
  %60 = sext i32 1 to i64
  %61 = sub i64 %59, %60
  store i64 %61, i64* %mant.addr, align 8
  %62 = sext i32 1 to i64
  %63 = sext i32 52 to i64
  %64 = and i64 %63, 63
  %65 = shl i64 %62, %64
  store i64 %65, i64* %implicit.addr, align 8
  %66 = load i32, i32* %ex.addr, align 4
  %67 = icmp eq i32 %66, 0
  br i1 %67, label %if.then.2, label %if.else

if.then.2:
  %68 = load i64, i64* %ux.addr, align 8
  %69 = sext i32 12 to i64
  %70 = and i64 %69, 63
  %71 = shl i64 %68, %70
  store i64 %71, i64* %i.addr, align 8
  br label %while.cond

while.cond:
  %72 = load i64, i64* %i.addr, align 8
  %73 = sext i32 63 to i64
  %74 = and i64 %73, 63
  %75 = lshr i64 %72, %74
  %76 = sext i32 0 to i64
  %77 = icmp eq i64 %75, %76
  br i1 %77, label %while.body, label %while.end

while.body:
  %78 = load i32, i32* %ex.addr, align 4
  %79 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %78, i32 1)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %80, i32* %ex.addr, align 4
  %82 = load i64, i64* %i.addr, align 8
  %83 = sext i32 1 to i64
  %84 = and i64 %83, 63
  %85 = shl i64 %82, %84
  store i64 %85, i64* %i.addr, align 8
  br label %while.cond

while.end:
  %86 = load i64, i64* %ux.addr, align 8
  %87 = load i32, i32* %ex.addr, align 4
  %88 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %91 = sext i32 %89 to i64
  %92 = and i64 %91, 63
  %93 = shl i64 %86, %92
  store i64 %93, i64* %ux.addr, align 8
  br label %if.end.2

if.else:
  %94 = load i64, i64* %ux.addr, align 8
  %95 = load i64, i64* %mant.addr, align 8
  %96 = and i64 %94, %95
  %97 = load i64, i64* %implicit.addr, align 8
  %98 = or i64 %96, %97
  store i64 %98, i64* %ux.addr, align 8
  br label %if.end.2

if.end.2:
  %99 = load i32, i32* %ey.addr, align 4
  %100 = icmp eq i32 %99, 0
  br i1 %100, label %if.then.3, label %if.else.1

if.then.3:
  %101 = load i64, i64* %uy.addr, align 8
  %102 = sext i32 12 to i64
  %103 = and i64 %102, 63
  %104 = shl i64 %101, %103
  store i64 %104, i64* %i.addr.1, align 8
  br label %while.cond.1

while.cond.1:
  %105 = load i64, i64* %i.addr.1, align 8
  %106 = sext i32 63 to i64
  %107 = and i64 %106, 63
  %108 = lshr i64 %105, %107
  %109 = sext i32 0 to i64
  %110 = icmp eq i64 %108, %109
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %ey.addr, align 4
  %112 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %111, i32 1)
  %113 = extractvalue { i32, i1 } %112, 0
  %114 = extractvalue { i32, i1 } %112, 1
  br i1 %114, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %113, i32* %ey.addr, align 4
  %115 = load i64, i64* %i.addr.1, align 8
  %116 = sext i32 1 to i64
  %117 = and i64 %116, 63
  %118 = shl i64 %115, %117
  store i64 %118, i64* %i.addr.1, align 8
  br label %while.cond.1

while.end.1:
  %119 = load i64, i64* %uy.addr, align 8
  %120 = load i32, i32* %ey.addr, align 4
  %121 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %124 = sext i32 %122 to i64
  %125 = and i64 %124, 63
  %126 = shl i64 %119, %125
  store i64 %126, i64* %uy.addr, align 8
  br label %if.end.3

if.else.1:
  %127 = load i64, i64* %uy.addr, align 8
  %128 = load i64, i64* %mant.addr, align 8
  %129 = and i64 %127, %128
  %130 = load i64, i64* %implicit.addr, align 8
  %131 = or i64 %129, %130
  store i64 %131, i64* %uy.addr, align 8
  br label %if.end.3

if.end.3:
  br label %while.cond.2

while.cond.2:
  %132 = load i32, i32* %ex.addr, align 4
  %133 = load i32, i32* %ey.addr, align 4
  %134 = icmp sgt i32 %132, %133
  br i1 %134, label %while.body.2, label %while.end.2

while.body.2:
  %135 = load i64, i64* %ux.addr, align 8
  %136 = load i64, i64* %uy.addr, align 8
  %137 = icmp uge i64 %135, %136
  br i1 %137, label %if.then.4, label %if.end.4

if.then.4:
  %138 = load i64, i64* %ux.addr, align 8
  %139 = load i64, i64* %uy.addr, align 8
  %140 = icmp eq i64 %138, %139
  br i1 %140, label %if.then.5, label %if.end.5

if.then.5:
  %141 = fmul double 0x0000000000000000, %x
  ret double %141

if.end.5:
  %142 = load i64, i64* %ux.addr, align 8
  %143 = load i64, i64* %uy.addr, align 8
  %144 = sub i64 %142, %143
  store i64 %144, i64* %ux.addr, align 8
  br label %if.end.4

if.end.4:
  %145 = load i64, i64* %ux.addr, align 8
  %146 = sext i32 1 to i64
  %147 = and i64 %146, 63
  %148 = shl i64 %145, %147
  store i64 %148, i64* %ux.addr, align 8
  %149 = load i32, i32* %ex.addr, align 4
  %150 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %149, i32 1)
  %151 = extractvalue { i32, i1 } %150, 0
  %152 = extractvalue { i32, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %151, i32* %ex.addr, align 4
  br label %while.cond.2

while.end.2:
  %153 = load i64, i64* %ux.addr, align 8
  %154 = load i64, i64* %uy.addr, align 8
  %155 = icmp uge i64 %153, %154
  br i1 %155, label %if.then.6, label %if.end.6

if.then.6:
  %156 = load i64, i64* %ux.addr, align 8
  %157 = load i64, i64* %uy.addr, align 8
  %158 = icmp eq i64 %156, %157
  br i1 %158, label %if.then.7, label %if.end.7

if.then.7:
  %159 = fmul double 0x0000000000000000, %x
  ret double %159

if.end.7:
  %160 = load i64, i64* %ux.addr, align 8
  %161 = load i64, i64* %uy.addr, align 8
  %162 = sub i64 %160, %161
  store i64 %162, i64* %ux.addr, align 8
  br label %if.end.6

if.end.6:
  br label %while.cond.3

while.cond.3:
  %163 = load i64, i64* %ux.addr, align 8
  %164 = sext i32 52 to i64
  %165 = and i64 %164, 63
  %166 = lshr i64 %163, %165
  %167 = sext i32 0 to i64
  %168 = icmp eq i64 %166, %167
  br i1 %168, label %while.body.3, label %while.end.3

while.body.3:
  %169 = load i64, i64* %ux.addr, align 8
  %170 = sext i32 1 to i64
  %171 = and i64 %170, 63
  %172 = shl i64 %169, %171
  store i64 %172, i64* %ux.addr, align 8
  %173 = load i32, i32* %ex.addr, align 4
  %174 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %173, i32 1)
  %175 = extractvalue { i32, i1 } %174, 0
  %176 = extractvalue { i32, i1 } %174, 1
  br i1 %176, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %175, i32* %ex.addr, align 4
  br label %while.cond.3

while.end.3:
  %177 = load i32, i32* %ex.addr, align 4
  %178 = icmp sgt i32 %177, 0
  br i1 %178, label %if.then.8, label %if.else.2

if.then.8:
  %179 = load i64, i64* %ux.addr, align 8
  %180 = load i64, i64* %implicit.addr, align 8
  %181 = sub i64 %179, %180
  %182 = load i32, i32* %ex.addr, align 4
  %183 = sext i32 %182 to i64
  %184 = sext i32 52 to i64
  %185 = and i64 %184, 63
  %186 = shl i64 %183, %185
  %187 = or i64 %181, %186
  store i64 %187, i64* %ux.addr, align 8
  br label %if.end.8

if.else.2:
  %188 = load i64, i64* %ux.addr, align 8
  %189 = load i32, i32* %ex.addr, align 4
  %190 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 1, i32 %189)
  %191 = extractvalue { i32, i1 } %190, 0
  %192 = extractvalue { i32, i1 } %190, 1
  br i1 %192, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %193 = sext i32 %191 to i64
  %194 = and i64 %193, 63
  %195 = lshr i64 %188, %194
  store i64 %195, i64* %ux.addr, align 8
  br label %if.end.8

if.end.8:
  %196 = load i64, i64* %ux.addr, align 8
  %197 = load i64, i64* %sign.addr, align 8
  %198 = or i64 %196, %197
  %199 = bitcast i64 %198 to double
  ret double %199

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
