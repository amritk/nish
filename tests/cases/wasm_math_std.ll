@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare double @llvm.sqrt.f64(double) #1
declare double @llvm.fabs.f64(double) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
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

define internal noundef double @nish.exp2Bits(i64 noundef %biased) #1 {
entry:
  %0 = sext i32 52 to i64
  %1 = and i64 %0, 63
  %2 = shl i64 %biased, %1
  %3 = bitcast i64 %2 to double
  ret double %3
}

define internal noundef double @nish.pow2(i32 noundef %n) #1 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 1023 to i64
  %2 = add nsw i64 %0, %1
  %3 = tail call double @nish.exp2Bits(i64 %2)
  ret double %3
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

define internal noundef i64 @nish.pio2Word(i32 noundef %p) #2 {
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
  %2 = sext i32 1 to i64
  %3 = sext i32 %p to i64
  %4 = sub nsw i64 %2, %3
  %5 = and i64 %4, 63
  %6 = lshr i64 %1, %5
  ret i64 %6

if.end:
  %7 = sub nsw i32 %p, 1
  %8 = sdiv i32 %7, 24
  store i32 %8, i32* %j.addr, align 4
  %9 = sub nsw i32 %p, 1
  %10 = load i32, i32* %j.addr, align 4
  %11 = mul nsw i32 %10, 24
  %12 = sub nsw i32 %9, %11
  store i32 %12, i32* %off.addr, align 4
  %13 = load i32, i32* %j.addr, align 4
  %14 = call i32 @nish.ipio2(i32 %13)
  %15 = sext i32 %14 to i64
  store i64 %15, i64* %c0.addr, align 8
  %16 = load i32, i32* %j.addr, align 4
  %17 = add nsw i32 %16, 1
  %18 = call i32 @nish.ipio2(i32 %17)
  %19 = sext i32 %18 to i64
  store i64 %19, i64* %c1.addr, align 8
  %20 = load i32, i32* %j.addr, align 4
  %21 = add nsw i32 %20, 2
  %22 = call i32 @nish.ipio2(i32 %21)
  %23 = sext i32 %22 to i64
  store i64 %23, i64* %c2.addr, align 8
  %24 = load i32, i32* %j.addr, align 4
  %25 = add nsw i32 %24, 3
  %26 = call i32 @nish.ipio2(i32 %25)
  %27 = sext i32 %26 to i64
  store i64 %27, i64* %c3.addr, align 8
  %28 = load i64, i64* %c0.addr, align 8
  %29 = sext i32 40 to i64
  %30 = and i64 %29, 63
  %31 = shl i64 %28, %30
  %32 = load i64, i64* %c1.addr, align 8
  %33 = sext i32 16 to i64
  %34 = and i64 %33, 63
  %35 = shl i64 %32, %34
  %36 = or i64 %31, %35
  %37 = load i64, i64* %c2.addr, align 8
  %38 = sext i32 8 to i64
  %39 = and i64 %38, 63
  %40 = lshr i64 %37, %39
  %41 = or i64 %36, %40
  store i64 %41, i64* %top.addr, align 8
  %42 = load i64, i64* %c2.addr, align 8
  %43 = sext i32 255 to i64
  %44 = and i64 %42, %43
  %45 = sext i32 24 to i64
  %46 = and i64 %45, 63
  %47 = shl i64 %44, %46
  %48 = load i64, i64* %c3.addr, align 8
  %49 = or i64 %47, %48
  store i64 %49, i64* %low.addr, align 8
  %50 = load i64, i64* %top.addr, align 8
  %51 = load i32, i32* %off.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = and i64 %52, 63
  %54 = shl i64 %50, %53
  %55 = load i64, i64* %low.addr, align 8
  %56 = load i32, i32* %off.addr, align 4
  %57 = sext i32 %56 to i64
  %58 = and i64 %57, 63
  %59 = shl i64 %55, %58
  %60 = sext i32 32 to i64
  %61 = and i64 %60, 63
  %62 = lshr i64 %59, %61
  %63 = or i64 %54, %62
  ret i64 %63
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
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %h.addr, align 4
  %7 = call i32 @llvm.ctlz.i32(i32 %6, i1 false)
  ret i32 %7

if.end:
  %8 = trunc i64 %v to i32
  %9 = call i32 @llvm.ctlz.i32(i32 %8, i1 false)
  %10 = add nsw i32 %9, 32
  ret i32 %10
}

define internal noundef double @nish.trigLarge(double noundef %x, i32 noundef %ix, i32 noundef %hx, i32 noundef %mode) #2 {
entry:
  %m.addr = alloca i64, align 8
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
  %q2.addr = alloca i64, align 8
  %q1.addr = alloca i64, align 8
  %q0.addr = alloca i64, align 8
  %neg.addr = alloca i1, align 1
  %n0.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
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
  %quadrant.addr = alloca i32, align 4
  %0 = bitcast double %x to i64
  %1 = sext i32 1 to i64
  %2 = sext i32 52 to i64
  %3 = and i64 %2, 63
  %4 = shl i64 %1, %3
  %5 = sext i32 1 to i64
  %6 = sub i64 %4, %5
  %7 = and i64 %0, %6
  %8 = sext i32 1 to i64
  %9 = sext i32 52 to i64
  %10 = and i64 %9, 63
  %11 = shl i64 %8, %10
  %12 = or i64 %7, %11
  store i64 %12, i64* %m.addr, align 8
  %13 = ashr i32 %ix, 20
  %14 = sub nsw i32 %13, 1076
  %15 = call i64 @nish.pio2Word(i32 %14)
  store i64 %15, i64* %w0.addr, align 8
  %16 = ashr i32 %ix, 20
  %17 = sub nsw i32 %16, 1012
  %18 = call i64 @nish.pio2Word(i32 %17)
  store i64 %18, i64* %w1.addr, align 8
  %19 = ashr i32 %ix, 20
  %20 = sub nsw i32 %19, 948
  %21 = call i64 @nish.pio2Word(i32 %20)
  store i64 %21, i64* %w2.addr, align 8
  %22 = load i64, i64* %m.addr, align 8
  %23 = load i64, i64* %w2.addr, align 8
  %24 = mul i64 %22, %23
  store i64 %24, i64* %lo2.addr, align 8
  %25 = load i64, i64* %m.addr, align 8
  %26 = load i64, i64* %w2.addr, align 8
  %27 = call i64 @nish.mulHi(i64 %25, i64 %26)
  store i64 %27, i64* %hi2.addr, align 8
  %28 = load i64, i64* %m.addr, align 8
  %29 = load i64, i64* %w1.addr, align 8
  %30 = mul i64 %28, %29
  store i64 %30, i64* %lo1.addr, align 8
  %31 = load i64, i64* %m.addr, align 8
  %32 = load i64, i64* %w1.addr, align 8
  %33 = call i64 @nish.mulHi(i64 %31, i64 %32)
  store i64 %33, i64* %hi1.addr, align 8
  %34 = load i64, i64* %lo2.addr, align 8
  store i64 %34, i64* %p0.addr, align 8
  %35 = load i64, i64* %hi2.addr, align 8
  %36 = load i64, i64* %lo1.addr, align 8
  %37 = add i64 %35, %36
  store i64 %37, i64* %p1.addr, align 8
  %38 = load i64, i64* %p1.addr, align 8
  %39 = load i64, i64* %lo1.addr, align 8
  %40 = icmp ult i64 %38, %39
  br i1 %40, label %cond.true, label %cond.false

cond.true:
  %41 = sext i32 1 to i64
  br label %cond.end

cond.false:
  %42 = sext i32 0 to i64
  br label %cond.end

cond.end:
  %43 = phi i64 [ %41, %cond.true ], [ %42, %cond.false ]
  store i64 %43, i64* %c.addr, align 8
  %44 = load i64, i64* %hi1.addr, align 8
  %45 = load i64, i64* %m.addr, align 8
  %46 = load i64, i64* %w0.addr, align 8
  %47 = mul i64 %45, %46
  %48 = add i64 %44, %47
  %49 = load i64, i64* %c.addr, align 8
  %50 = add i64 %48, %49
  store i64 %50, i64* %p2.addr, align 8
  %51 = load i64, i64* %p2.addr, align 8
  %52 = sext i32 2 to i64
  %53 = and i64 %52, 63
  %54 = shl i64 %51, %53
  %55 = load i64, i64* %p1.addr, align 8
  %56 = sext i32 62 to i64
  %57 = and i64 %56, 63
  %58 = lshr i64 %55, %57
  %59 = or i64 %54, %58
  store i64 %59, i64* %q2.addr, align 8
  %60 = load i64, i64* %p1.addr, align 8
  %61 = sext i32 2 to i64
  %62 = and i64 %61, 63
  %63 = shl i64 %60, %62
  %64 = load i64, i64* %p0.addr, align 8
  %65 = sext i32 62 to i64
  %66 = and i64 %65, 63
  %67 = lshr i64 %64, %66
  %68 = or i64 %63, %67
  store i64 %68, i64* %q1.addr, align 8
  %69 = load i64, i64* %p0.addr, align 8
  %70 = sext i32 2 to i64
  %71 = and i64 %70, 63
  %72 = shl i64 %69, %71
  store i64 %72, i64* %q0.addr, align 8
  %73 = load i64, i64* %q2.addr, align 8
  %74 = sext i32 63 to i64
  %75 = and i64 %74, 63
  %76 = lshr i64 %73, %75
  %77 = sext i32 0 to i64
  %78 = icmp ne i64 %76, %77
  store i1 %78, i1* %neg.addr, align 1
  %79 = load i64, i64* %p2.addr, align 8
  %80 = sext i32 62 to i64
  %81 = and i64 %80, 63
  %82 = lshr i64 %79, %81
  %83 = trunc i64 %82 to i32
  %84 = and i32 %83, 3
  store i32 %84, i32* %n0.addr, align 4
  %85 = load i1, i1* %neg.addr, align 1
  br i1 %85, label %cond.true.1, label %cond.false.1

cond.true.1:
  %86 = load i32, i32* %n0.addr, align 4
  %87 = add nsw i32 %86, 1
  br label %cond.end.1

cond.false.1:
  %88 = load i32, i32* %n0.addr, align 4
  br label %cond.end.1

cond.end.1:
  %89 = phi i32 [ %87, %cond.true.1 ], [ %88, %cond.false.1 ]
  store i32 %89, i32* %n.addr, align 4
  %90 = load i1, i1* %neg.addr, align 1
  br i1 %90, label %if.then, label %if.end

if.then:
  %91 = load i64, i64* %q0.addr, align 8
  %92 = xor i64 %91, -1
  %93 = sext i32 1 to i64
  %94 = add i64 %92, %93
  store i64 %94, i64* %q0.addr, align 8
  %95 = load i64, i64* %q0.addr, align 8
  %96 = sext i32 0 to i64
  %97 = icmp eq i64 %95, %96
  br i1 %97, label %cond.true.2, label %cond.false.2

cond.true.2:
  %98 = sext i32 1 to i64
  br label %cond.end.2

cond.false.2:
  %99 = sext i32 0 to i64
  br label %cond.end.2

cond.end.2:
  %100 = phi i64 [ %98, %cond.true.2 ], [ %99, %cond.false.2 ]
  store i64 %100, i64* %k0.addr, align 8
  %101 = load i64, i64* %q1.addr, align 8
  %102 = xor i64 %101, -1
  %103 = load i64, i64* %k0.addr, align 8
  %104 = add i64 %102, %103
  store i64 %104, i64* %q1.addr, align 8
  %105 = load i64, i64* %k0.addr, align 8
  %106 = sext i32 0 to i64
  %107 = icmp ne i64 %105, %106
  br i1 %107, label %land.rhs, label %land.end

land.rhs:
  %108 = load i64, i64* %q1.addr, align 8
  %109 = sext i32 0 to i64
  %110 = icmp eq i64 %108, %109
  br label %land.end

land.end:
  %111 = phi i1 [ false, %cond.end.2 ], [ %110, %land.rhs ]
  br i1 %111, label %cond.true.3, label %cond.false.3

cond.true.3:
  %112 = sext i32 1 to i64
  br label %cond.end.3

cond.false.3:
  %113 = sext i32 0 to i64
  br label %cond.end.3

cond.end.3:
  %114 = phi i64 [ %112, %cond.true.3 ], [ %113, %cond.false.3 ]
  store i64 %114, i64* %k1.addr, align 8
  %115 = load i64, i64* %q2.addr, align 8
  %116 = xor i64 %115, -1
  %117 = load i64, i64* %k1.addr, align 8
  %118 = add i64 %116, %117
  store i64 %118, i64* %q2.addr, align 8
  br label %if.end

if.end:
  store i32 0, i32* %sh.addr, align 4
  %119 = load i64, i64* %q2.addr, align 8
  %120 = sext i32 0 to i64
  %121 = icmp eq i64 %119, %120
  br i1 %121, label %if.then.1, label %if.end.1

if.then.1:
  %122 = load i64, i64* %q1.addr, align 8
  store i64 %122, i64* %q2.addr, align 8
  %123 = load i64, i64* %q0.addr, align 8
  store i64 %123, i64* %q1.addr, align 8
  %124 = sext i32 0 to i64
  store i64 %124, i64* %q0.addr, align 8
  store i32 64, i32* %sh.addr, align 4
  br label %if.end.1

if.end.1:
  %125 = load i64, i64* %q2.addr, align 8
  %126 = call i32 @nish.clz64(i64 %125)
  store i32 %126, i32* %lz.addr, align 4
  %127 = load i32, i32* %lz.addr, align 4
  %128 = icmp sgt i32 %127, 0
  br i1 %128, label %if.then.2, label %if.end.2

if.then.2:
  %129 = load i64, i64* %q2.addr, align 8
  %130 = load i32, i32* %lz.addr, align 4
  %131 = sext i32 %130 to i64
  %132 = and i64 %131, 63
  %133 = shl i64 %129, %132
  %134 = load i64, i64* %q1.addr, align 8
  %135 = load i32, i32* %lz.addr, align 4
  %136 = sub nsw i32 64, %135
  %137 = sext i32 %136 to i64
  %138 = and i64 %137, 63
  %139 = lshr i64 %134, %138
  %140 = or i64 %133, %139
  store i64 %140, i64* %q2.addr, align 8
  %141 = load i64, i64* %q1.addr, align 8
  %142 = load i32, i32* %lz.addr, align 4
  %143 = sext i32 %142 to i64
  %144 = and i64 %143, 63
  %145 = shl i64 %141, %144
  %146 = load i64, i64* %q0.addr, align 8
  %147 = load i32, i32* %lz.addr, align 4
  %148 = sub nsw i32 64, %147
  %149 = sext i32 %148 to i64
  %150 = and i64 %149, 63
  %151 = lshr i64 %146, %150
  %152 = or i64 %145, %151
  store i64 %152, i64* %q1.addr, align 8
  br label %if.end.2

if.end.2:
  %153 = load i64, i64* %q2.addr, align 8
  %154 = sext i32 11 to i64
  %155 = and i64 %154, 63
  %156 = lshr i64 %153, %155
  %157 = uitofp i64 %156 to double
  %158 = sext i32 970 to i64
  %159 = load i32, i32* %sh.addr, align 4
  %160 = sext i32 %159 to i64
  %161 = sub nsw i64 %158, %160
  %162 = load i32, i32* %lz.addr, align 4
  %163 = sext i32 %162 to i64
  %164 = sub nsw i64 %161, %163
  %165 = call double @nish.exp2Bits(i64 %164)
  %166 = fmul double %157, %165
  store double %166, double* %a.addr, align 8
  %167 = load i64, i64* %q2.addr, align 8
  %168 = sext i32 2047 to i64
  %169 = and i64 %167, %168
  %170 = sext i32 53 to i64
  %171 = and i64 %170, 63
  %172 = shl i64 %169, %171
  %173 = load i64, i64* %q1.addr, align 8
  %174 = sext i32 11 to i64
  %175 = and i64 %174, 63
  %176 = lshr i64 %173, %175
  %177 = or i64 %172, %176
  %178 = uitofp i64 %177 to double
  %179 = sext i32 906 to i64
  %180 = load i32, i32* %sh.addr, align 4
  %181 = sext i32 %180 to i64
  %182 = sub nsw i64 %179, %181
  %183 = load i32, i32* %lz.addr, align 4
  %184 = sext i32 %183 to i64
  %185 = sub nsw i64 %182, %184
  %186 = call double @nish.exp2Bits(i64 %185)
  %187 = fmul double %178, %186
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
  %254 = load i1, i1* %neg.addr, align 1
  br i1 %254, label %cond.true.4, label %cond.false.4

cond.true.4:
  %255 = load i32, i32* %n0.addr, align 4
  %256 = sub nsw i32 3, %255
  br label %cond.end.4

cond.false.4:
  %257 = load i32, i32* %n0.addr, align 4
  %258 = sub nsw i32 4, %257
  br label %cond.end.4

cond.end.4:
  %259 = phi i32 [ %256, %cond.true.4 ], [ %258, %cond.false.4 ]
  store i32 %259, i32* %quadrant.addr, align 4
  %260 = load double, double* %y0.addr, align 8
  %261 = load double, double* %y1.addr, align 8
  %262 = icmp slt i32 %hx, 0
  br i1 %262, label %cond.true.5, label %cond.false.5

cond.true.5:
  %263 = load i32, i32* %quadrant.addr, align 4
  br label %cond.end.5

cond.false.5:
  %264 = load i32, i32* %n.addr, align 4
  br label %cond.end.5

cond.end.5:
  %265 = phi i32 [ %263, %cond.true.5 ], [ %264, %cond.false.5 ]
  %266 = tail call double @nish.trigKernel(double %260, double %261, i32 %265, i32 %mode)
  ret double %266
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

define internal noundef double @nish.trigReduced(double noundef %x, double noundef %ax, i32 noundef %mode) #2 {
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

define internal noundef double @nish.sinF64(double noundef %x) #2 {
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

define internal noundef double @nish.cosF64(double noundef %x) #2 {
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

define internal noundef double @nish.withHi(double noundef %x, i32 noundef %hi) #1 {
entry:
  %0 = sext i32 %hi to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = call i32 @nish.loWord(double %x)
  %5 = zext i32 %4 to i64
  %6 = or i64 %3, %5
  %7 = bitcast i64 %6 to double
  ret double %7
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

define internal noundef double @nish.expF64(double noundef %x) #1 {
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
  %96 = sext i32 %95 to i64
  %97 = sext i32 2023 to i64
  %98 = add nsw i64 %96, %97
  %99 = call double @nish.exp2Bits(i64 %98)
  %100 = fmul double %94, %99
  %101 = fmul double %100, 0x0170000000000000
  ret double %101
}

define internal noundef double @nish.logF64(double noundef %x) #1 {
entry:
  %v.addr = alloca double, align 8
  %hx.addr = alloca i32, align 4
  %scaled.addr = alloca i1, align 1
  %field.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
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
  store i1 false, i1* %scaled.addr, align 1
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
  store i1 true, i1* %scaled.addr, align 1
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
  %30 = load i32, i32* %hx.addr, align 4
  %31 = lshr i32 %30, 20
  store i32 %31, i32* %field.addr, align 4
  %32 = load i32, i32* %hx.addr, align 4
  %33 = and i32 %32, 1048575
  store i32 %33, i32* %hx.addr, align 4
  %34 = load i32, i32* %hx.addr, align 4
  %35 = add nsw i32 %34, 614244
  %36 = and i32 %35, 1048576
  store i32 %36, i32* %i.addr, align 4
  %37 = load double, double* %v.addr, align 8
  %38 = load i32, i32* %hx.addr, align 4
  %39 = load i32, i32* %i.addr, align 4
  %40 = xor i32 %39, 1072693248
  %41 = or i32 %38, %40
  %42 = call double @nish.withHi(double %37, i32 %41)
  store double %42, double* %v.addr, align 8
  %43 = load i32, i32* %field.addr, align 4
  %44 = load i32, i32* %i.addr, align 4
  %45 = ashr i32 %44, 20
  %46 = add nsw i32 %43, %45
  store i32 %46, i32* %e.addr, align 4
  %47 = load i1, i1* %scaled.addr, align 1
  br i1 %47, label %cond.true, label %cond.false

cond.true:
  %48 = load i32, i32* %e.addr, align 4
  %49 = sub nsw i32 %48, 1077
  br label %cond.end

cond.false:
  %50 = load i32, i32* %e.addr, align 4
  %51 = sub nsw i32 %50, 1023
  br label %cond.end

cond.end:
  %52 = phi i32 [ %49, %cond.true ], [ %51, %cond.false ]
  store i32 %52, i32* %k.addr, align 4
  %53 = load double, double* %v.addr, align 8
  %54 = fsub double %53, 0x3FF0000000000000
  store double %54, double* %f.addr, align 8
  %55 = load i32, i32* %k.addr, align 4
  %56 = sitofp i32 %55 to double
  store double %56, double* %dk.addr, align 8
  %57 = load i32, i32* %hx.addr, align 4
  %58 = add nsw i32 %57, 2
  %59 = and i32 %58, 1048575
  %60 = icmp slt i32 %59, 3
  br i1 %60, label %if.then.4, label %if.end.4

if.then.4:
  %61 = load double, double* %f.addr, align 8
  %62 = fcmp oeq double %61, 0x0000000000000000
  br i1 %62, label %if.then.5, label %if.end.5

if.then.5:
  %63 = load double, double* %dk.addr, align 8
  %64 = fmul double %63, 0x3FE62E42FEE00000
  %65 = load double, double* %dk.addr, align 8
  %66 = fmul double %65, 0x3DEA39EF35793C76
  %67 = fadd double %64, %66
  ret double %67

if.end.5:
  %68 = load double, double* %f.addr, align 8
  %69 = load double, double* %f.addr, align 8
  %70 = fmul double %68, %69
  %71 = load double, double* %f.addr, align 8
  %72 = fneg double 0x3FD5555555555555
  %73 = fmul double %71, %72
  %74 = fadd double %73, 0x3FE0000000000000
  %75 = fmul double %70, %74
  store double %75, double* %rr.addr, align 8
  %76 = load i32, i32* %k.addr, align 4
  %77 = icmp eq i32 %76, 0
  br i1 %77, label %if.then.6, label %if.end.6

if.then.6:
  %78 = load double, double* %f.addr, align 8
  %79 = load double, double* %rr.addr, align 8
  %80 = fsub double %78, %79
  ret double %80

if.end.6:
  %81 = load double, double* %dk.addr, align 8
  %82 = fmul double %81, 0x3FE62E42FEE00000
  %83 = load double, double* %rr.addr, align 8
  %84 = load double, double* %dk.addr, align 8
  %85 = fmul double %84, 0x3DEA39EF35793C76
  %86 = fsub double %83, %85
  %87 = load double, double* %f.addr, align 8
  %88 = fsub double %86, %87
  %89 = fsub double %82, %88
  ret double %89

if.end.4:
  %90 = load double, double* %f.addr, align 8
  %91 = load double, double* %f.addr, align 8
  %92 = fadd double 0x4000000000000000, %91
  %93 = fdiv double %90, %92
  store double %93, double* %s.addr, align 8
  %94 = load double, double* %s.addr, align 8
  %95 = load double, double* %s.addr, align 8
  %96 = fmul double %94, %95
  store double %96, double* %z.addr, align 8
  %97 = load double, double* %z.addr, align 8
  %98 = load double, double* %z.addr, align 8
  %99 = fmul double %97, %98
  store double %99, double* %w.addr, align 8
  %100 = load double, double* %w.addr, align 8
  %101 = load double, double* %w.addr, align 8
  %102 = load double, double* %w.addr, align 8
  %103 = fmul double %102, 0x3FC39A09D078C69F
  %104 = fadd double %103, 0x3FCC71C51D8E78AF
  %105 = fmul double %101, %104
  %106 = fadd double %105, 0x3FD999999997FA04
  %107 = fmul double %100, %106
  store double %107, double* %t1.addr, align 8
  %108 = load double, double* %z.addr, align 8
  %109 = load double, double* %w.addr, align 8
  %110 = load double, double* %w.addr, align 8
  %111 = load double, double* %w.addr, align 8
  %112 = fmul double %111, 0x3FC2F112DF3E5244
  %113 = fadd double %112, 0x3FC7466496CB03DE
  %114 = fmul double %110, %113
  %115 = fadd double %114, 0x3FD2492494229359
  %116 = fmul double %109, %115
  %117 = fadd double %116, 0x3FE5555555555593
  %118 = fmul double %108, %117
  store double %118, double* %t2.addr, align 8
  %119 = load double, double* %t2.addr, align 8
  %120 = load double, double* %t1.addr, align 8
  %121 = fadd double %119, %120
  store double %121, double* %r.addr, align 8
  %122 = load i32, i32* %hx.addr, align 4
  %123 = sub nsw i32 %122, 398458
  %124 = load i32, i32* %hx.addr, align 4
  %125 = sub nsw i32 440401, %124
  %126 = or i32 %123, %125
  %127 = icmp sgt i32 %126, 0
  br i1 %127, label %if.then.7, label %if.end.7

if.then.7:
  %128 = load double, double* %f.addr, align 8
  %129 = load double, double* %f.addr, align 8
  %130 = fmul double %128, %129
  %131 = fmul double %130, 0x3FE0000000000000
  store double %131, double* %hfsq.addr, align 8
  %132 = load i32, i32* %k.addr, align 4
  %133 = icmp eq i32 %132, 0
  br i1 %133, label %if.then.8, label %if.end.8

if.then.8:
  %134 = load double, double* %f.addr, align 8
  %135 = load double, double* %hfsq.addr, align 8
  %136 = load double, double* %s.addr, align 8
  %137 = load double, double* %hfsq.addr, align 8
  %138 = load double, double* %r.addr, align 8
  %139 = fadd double %137, %138
  %140 = fmul double %136, %139
  %141 = fsub double %135, %140
  %142 = fsub double %134, %141
  ret double %142

if.end.8:
  %143 = load double, double* %dk.addr, align 8
  %144 = fmul double %143, 0x3FE62E42FEE00000
  %145 = load double, double* %hfsq.addr, align 8
  %146 = load double, double* %s.addr, align 8
  %147 = load double, double* %hfsq.addr, align 8
  %148 = load double, double* %r.addr, align 8
  %149 = fadd double %147, %148
  %150 = fmul double %146, %149
  %151 = load double, double* %dk.addr, align 8
  %152 = fmul double %151, 0x3DEA39EF35793C76
  %153 = fadd double %150, %152
  %154 = fsub double %145, %153
  %155 = load double, double* %f.addr, align 8
  %156 = fsub double %154, %155
  %157 = fsub double %144, %156
  ret double %157

if.end.7:
  %158 = load i32, i32* %k.addr, align 4
  %159 = icmp eq i32 %158, 0
  br i1 %159, label %if.then.9, label %if.end.9

if.then.9:
  %160 = load double, double* %f.addr, align 8
  %161 = load double, double* %s.addr, align 8
  %162 = load double, double* %f.addr, align 8
  %163 = load double, double* %r.addr, align 8
  %164 = fsub double %162, %163
  %165 = fmul double %161, %164
  %166 = fsub double %160, %165
  ret double %166

if.end.9:
  %167 = load double, double* %dk.addr, align 8
  %168 = fmul double %167, 0x3FE62E42FEE00000
  %169 = load double, double* %s.addr, align 8
  %170 = load double, double* %f.addr, align 8
  %171 = load double, double* %r.addr, align 8
  %172 = fsub double %170, %171
  %173 = fmul double %169, %172
  %174 = load double, double* %dk.addr, align 8
  %175 = fmul double %174, 0x3DEA39EF35793C76
  %176 = fsub double %173, %175
  %177 = load double, double* %f.addr, align 8
  %178 = fsub double %176, %177
  %179 = fsub double %168, %178
  ret double %179
}

define internal noundef double @nish.scaleDown(double noundef %z, i32 noundef %n) #1 {
entry:
  %0 = call double @nish.pow2(i32 -1000)
  %1 = fmul double %z, %0
  %2 = sext i32 %n to i64
  %3 = sext i32 2023 to i64
  %4 = add nsw i64 %2, %3
  %5 = call double @nish.exp2Bits(i64 %4)
  %6 = fmul double %1, %5
  ret double %6
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

define internal noundef double @nish.powExp2(double noundef %ph0, double noundef %pl, double noundef %s) #1 {
entry:
  %ph.addr = alloca double, align 8
  %z0.addr = alloca double, align 8
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %ij.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %zh.addr = alloca double, align 8
  %t.addr = alloca double, align 8
  %u.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %t1.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %hi.addr = alloca i32, align 4
  %ze.addr = alloca i64, align 8
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
  %7 = and i32 %6, 2147483647
  store i32 %7, i32* %ij.addr, align 4
  %8 = load i32, i32* %j.addr, align 4
  %9 = icmp sgt i32 %8, 1083179008
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = tail call double @nish.overflow(double %s)
  ret double %10

if.end:
  %11 = load i32, i32* %j.addr, align 4
  %12 = icmp eq i32 %11, 1083179008
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
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
  %20 = phi i1 [ true, %land.rhs ], [ %19, %lor.rhs ]
  br label %land.end

land.end:
  %21 = phi i1 [ false, %if.end ], [ %20, %lor.end ]
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = tail call double @nish.overflow(double %s)
  ret double %22

if.end.1:
  %23 = load i32, i32* %ij.addr, align 4
  %24 = icmp sgt i32 %23, 1083231232
  br i1 %24, label %if.then.2, label %if.end.2

if.then.2:
  %25 = tail call double @nish.underflow(double %s)
  ret double %25

if.end.2:
  %26 = load i32, i32* %j.addr, align 4
  %27 = icmp eq i32 %26, -1064252416
  br i1 %27, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %28 = load i32, i32* %i.addr, align 4
  %29 = icmp ne i32 %28, 0
  br i1 %29, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %30 = load double, double* %z0.addr, align 8
  %31 = load double, double* %ph.addr, align 8
  %32 = fsub double %30, %31
  %33 = fcmp ole double %pl, %32
  br label %lor.end.1

lor.end.1:
  %34 = phi i1 [ true, %land.rhs.1 ], [ %33, %lor.rhs.1 ]
  br label %land.end.1

land.end.1:
  %35 = phi i1 [ false, %if.end.2 ], [ %34, %lor.end.1 ]
  br i1 %35, label %if.then.3, label %if.end.3

if.then.3:
  %36 = tail call double @nish.underflow(double %s)
  ret double %36

if.end.3:
  store i32 0, i32* %n.addr, align 4
  %37 = load i32, i32* %ij.addr, align 4
  %38 = icmp sgt i32 %37, 1071644672
  br i1 %38, label %if.then.4, label %if.end.4

if.then.4:
  %39 = load double, double* %z0.addr, align 8
  %40 = call double @nish.withLo(double %39, i32 0)
  store double %40, double* %zh.addr, align 8
  %41 = load i32, i32* %j.addr, align 4
  %42 = icmp slt i32 %41, 0
  br i1 %42, label %cond.true, label %cond.false

cond.true:
  %43 = load double, double* %zh.addr, align 8
  %44 = fsub double %43, 0x3FE0000000000000
  br label %cond.end

cond.false:
  %45 = load double, double* %zh.addr, align 8
  %46 = fadd double %45, 0x3FE0000000000000
  br label %cond.end

cond.end:
  %47 = phi double [ %44, %cond.true ], [ %46, %cond.false ]
  %48 = call i32 @llvm.fptosi.sat.i32.f64(double %47)
  store i32 %48, i32* %n.addr, align 4
  %49 = load double, double* %ph.addr, align 8
  %50 = load i32, i32* %n.addr, align 4
  %51 = sitofp i32 %50 to double
  %52 = fsub double %49, %51
  store double %52, double* %ph.addr, align 8
  br label %if.end.4

if.end.4:
  %53 = load double, double* %ph.addr, align 8
  %54 = fadd double %pl, %53
  %55 = call double @nish.withLo(double %54, i32 0)
  store double %55, double* %t.addr, align 8
  %56 = load double, double* %t.addr, align 8
  %57 = fmul double %56, 0x3FE62E4300000000
  store double %57, double* %u.addr, align 8
  %58 = load double, double* %t.addr, align 8
  %59 = load double, double* %ph.addr, align 8
  %60 = fsub double %58, %59
  %61 = fsub double %pl, %60
  %62 = fmul double %61, 0x3FE62E42FEFA39EF
  %63 = load double, double* %t.addr, align 8
  %64 = fneg double 0x3E205C610CA86C39
  %65 = fmul double %63, %64
  %66 = fadd double %62, %65
  store double %66, double* %v.addr, align 8
  %67 = load double, double* %u.addr, align 8
  %68 = load double, double* %v.addr, align 8
  %69 = fadd double %67, %68
  store double %69, double* %z.addr, align 8
  %70 = load double, double* %v.addr, align 8
  %71 = load double, double* %z.addr, align 8
  %72 = load double, double* %u.addr, align 8
  %73 = fsub double %71, %72
  %74 = fsub double %70, %73
  store double %74, double* %w.addr, align 8
  %75 = load double, double* %z.addr, align 8
  %76 = load double, double* %z.addr, align 8
  %77 = load double, double* %z.addr, align 8
  %78 = fmul double %76, %77
  %79 = load double, double* %z.addr, align 8
  %80 = load double, double* %z.addr, align 8
  %81 = fmul double %79, %80
  %82 = call double @nish.expPoly(double %81)
  %83 = fmul double %78, %82
  %84 = fsub double %75, %83
  store double %84, double* %t1.addr, align 8
  %85 = load double, double* %z.addr, align 8
  %86 = load double, double* %t1.addr, align 8
  %87 = fmul double %85, %86
  %88 = load double, double* %t1.addr, align 8
  %89 = fsub double %88, 0x4000000000000000
  %90 = fdiv double %87, %89
  %91 = load double, double* %w.addr, align 8
  %92 = load double, double* %z.addr, align 8
  %93 = load double, double* %w.addr, align 8
  %94 = fmul double %92, %93
  %95 = fadd double %91, %94
  %96 = fsub double %90, %95
  store double %96, double* %r.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %97 = load double, double* %one.addr, align 8
  %98 = load double, double* %r.addr, align 8
  %99 = load double, double* %z.addr, align 8
  %100 = fsub double %98, %99
  %101 = fsub double %97, %100
  store double %101, double* %z.addr, align 8
  %102 = load double, double* %z.addr, align 8
  %103 = call i32 @nish.hiWord(double %102)
  store i32 %103, i32* %hi.addr, align 4
  %104 = load i32, i32* %hi.addr, align 4
  %105 = ashr i32 %104, 20
  %106 = sext i32 %105 to i64
  %107 = load i32, i32* %n.addr, align 4
  %108 = sext i32 %107 to i64
  %109 = add nsw i64 %106, %108
  store i64 %109, i64* %ze.addr, align 8
  %110 = load i64, i64* %ze.addr, align 8
  %111 = sext i32 0 to i64
  %112 = icmp sle i64 %110, %111
  br i1 %112, label %if.then.5, label %if.end.5

if.then.5:
  %113 = load double, double* %z.addr, align 8
  %114 = load i32, i32* %n.addr, align 4
  %115 = call double @nish.scaleDown(double %113, i32 %114)
  %116 = fmul double %s, %115
  ret double %116

if.end.5:
  %117 = load i32, i32* %hi.addr, align 4
  %118 = and i32 %117, 1048575
  %119 = sext i32 %118 to i64
  %120 = load i64, i64* %ze.addr, align 8
  %121 = sext i32 20 to i64
  %122 = and i64 %121, 63
  %123 = shl i64 %120, %122
  %124 = or i64 %119, %123
  %125 = sext i32 32 to i64
  %126 = and i64 %125, 63
  %127 = shl i64 %124, %126
  %128 = load double, double* %z.addr, align 8
  %129 = call i32 @nish.loWord(double %128)
  %130 = zext i32 %129 to i64
  %131 = or i64 %127, %130
  %132 = bitcast i64 %131 to double
  %133 = fmul double %s, %132
  ret double %133
}

define internal noundef double @nish.powF64(double noundef %x, double noundef %y) #1 {
entry:
  %hx.addr = alloca i32, align 4
  %lx.addr = alloca i32, align 4
  %hy.addr = alloca i32, align 4
  %ly.addr = alloca i32, align 4
  %ix.addr = alloca i32, align 4
  %iy.addr = alloca i32, align 4
  %yisint.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
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
  %subnormal.addr = alloca i1, align 1
  %hix.addr = alloca i32, align 4
  %j.addr.2 = alloca i32, align 4
  %big.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %dn.addr = alloca double, align 8
  %bp.addr = alloca double, align 8
  %dph.addr = alloca double, align 8
  %dpl.addr = alloca double, align 8
  %u.addr.1 = alloca double, align 8
  %one.addr = alloca double, align 8
  %v.addr.1 = alloca double, align 8
  %ss.addr = alloca double, align 8
  %sh.addr = alloca double, align 8
  %half.addr = alloca i32, align 4
  %thn.addr = alloca double, align 8
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
  %40 = lshr i32 %39, 20
  store i32 %40, i32* %e.addr, align 4
  %41 = load i32, i32* %e.addr, align 4
  %42 = icmp sgt i32 %41, 1043
  br i1 %42, label %if.then.7, label %if.else.1

if.then.7:
  %43 = load i32, i32* %ly.addr, align 4
  %44 = load i32, i32* %e.addr, align 4
  %45 = sub nsw i32 1075, %44
  %46 = and i32 %45, 31
  %47 = lshr i32 %43, %46
  store i32 %47, i32* %j.addr, align 4
  %48 = load i32, i32* %j.addr, align 4
  %49 = load i32, i32* %e.addr, align 4
  %50 = sub nsw i32 1075, %49
  %51 = and i32 %50, 31
  %52 = shl i32 %48, %51
  %53 = load i32, i32* %ly.addr, align 4
  %54 = icmp eq i32 %52, %53
  br i1 %54, label %if.then.8, label %if.end.8

if.then.8:
  %55 = load i32, i32* %j.addr, align 4
  %56 = and i32 %55, 1
  %57 = sub nsw i32 2, %56
  store i32 %57, i32* %yisint.addr, align 4
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.else.1:
  %58 = load i32, i32* %ly.addr, align 4
  %59 = icmp eq i32 %58, 0
  br i1 %59, label %if.then.9, label %if.end.9

if.then.9:
  %60 = load i32, i32* %iy.addr, align 4
  %61 = load i32, i32* %e.addr, align 4
  %62 = sub nsw i32 1043, %61
  %63 = and i32 %62, 31
  %64 = ashr i32 %60, %63
  store i32 %64, i32* %j.addr.1, align 4
  %65 = load i32, i32* %j.addr.1, align 4
  %66 = load i32, i32* %e.addr, align 4
  %67 = sub nsw i32 1043, %66
  %68 = and i32 %67, 31
  %69 = shl i32 %65, %68
  %70 = load i32, i32* %iy.addr, align 4
  %71 = icmp eq i32 %69, %70
  br i1 %71, label %if.then.10, label %if.end.10

if.then.10:
  %72 = load i32, i32* %j.addr.1, align 4
  %73 = and i32 %72, 1
  store i32 %73, i32* %odd.addr, align 4
  %74 = load i32, i32* %odd.addr, align 4
  %75 = sub nsw i32 2, %74
  store i32 %75, i32* %yisint.addr, align 4
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
  %76 = load i32, i32* %ly.addr, align 4
  %77 = icmp eq i32 %76, 0
  br i1 %77, label %if.then.11, label %if.end.11

if.then.11:
  %78 = load i32, i32* %iy.addr, align 4
  %79 = icmp eq i32 %78, 2146435072
  br i1 %79, label %if.then.12, label %if.end.12

if.then.12:
  %80 = load i32, i32* %ix.addr, align 4
  %81 = icmp sge i32 %80, 1072693248
  br i1 %81, label %if.then.13, label %if.end.13

if.then.13:
  %82 = load i32, i32* %hy.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %84 = phi double [ %y, %cond.true ], [ 0x0000000000000000, %cond.false ]
  ret double %84

if.end.13:
  %85 = load i32, i32* %hy.addr, align 4
  %86 = icmp slt i32 %85, 0
  br i1 %86, label %cond.true.1, label %cond.false.1

cond.true.1:
  %87 = fneg double %y
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %88 = phi double [ %87, %cond.true.1 ], [ 0x0000000000000000, %cond.false.1 ]
  ret double %88

if.end.12:
  %89 = load i32, i32* %iy.addr, align 4
  %90 = icmp eq i32 %89, 1072693248
  br i1 %90, label %if.then.14, label %if.end.14

if.then.14:
  %91 = load i32, i32* %hy.addr, align 4
  %92 = icmp slt i32 %91, 0
  br i1 %92, label %cond.true.2, label %cond.false.2

cond.true.2:
  %93 = fdiv double 0x3FF0000000000000, %x
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %94 = phi double [ %93, %cond.true.2 ], [ %x, %cond.false.2 ]
  ret double %94

if.end.14:
  %95 = load i32, i32* %hy.addr, align 4
  %96 = icmp eq i32 %95, 1073741824
  br i1 %96, label %if.then.15, label %if.end.15

if.then.15:
  %97 = fmul double %x, %x
  ret double %97

if.end.15:
  %98 = load i32, i32* %hy.addr, align 4
  %99 = icmp eq i32 %98, 1071644672
  br i1 %99, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %100 = load i32, i32* %hx.addr, align 4
  %101 = icmp sge i32 %100, 0
  br label %land.end.4

land.end.4:
  %102 = phi i1 [ false, %if.end.15 ], [ %101, %land.rhs.4 ]
  br i1 %102, label %if.then.16, label %if.end.16

if.then.16:
  %103 = call double @llvm.sqrt.f64(double %x)
  ret double %103

if.end.16:
  br label %if.end.11

if.end.11:
  %104 = call double @llvm.fabs.f64(double %x)
  store double %104, double* %ax.addr, align 8
  %105 = load i32, i32* %lx.addr, align 4
  %106 = icmp eq i32 %105, 0
  br i1 %106, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %107 = load i32, i32* %ix.addr, align 4
  %108 = icmp eq i32 %107, 2146435072
  br i1 %108, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %109 = load i32, i32* %ix.addr, align 4
  %110 = icmp eq i32 %109, 0
  br label %lor.end.2

lor.end.2:
  %111 = phi i1 [ true, %land.rhs.5 ], [ %110, %lor.rhs.2 ]
  br i1 %111, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %112 = load i32, i32* %ix.addr, align 4
  %113 = icmp eq i32 %112, 1072693248
  br label %lor.end.1

lor.end.1:
  %114 = phi i1 [ true, %lor.end.2 ], [ %113, %lor.rhs.1 ]
  br label %land.end.5

land.end.5:
  %115 = phi i1 [ false, %if.end.11 ], [ %114, %lor.end.1 ]
  br i1 %115, label %if.then.17, label %if.end.17

if.then.17:
  %116 = load i32, i32* %hy.addr, align 4
  %117 = icmp slt i32 %116, 0
  br i1 %117, label %cond.true.3, label %cond.false.3

cond.true.3:
  %118 = load double, double* %ax.addr, align 8
  %119 = fdiv double 0x3FF0000000000000, %118
  br label %cond.end.3

cond.false.3:
  %120 = load double, double* %ax.addr, align 8
  br label %cond.end.3

cond.end.3:
  %121 = phi double [ %119, %cond.true.3 ], [ %120, %cond.false.3 ]
  store double %121, double* %z.addr, align 8
  %122 = load i32, i32* %hx.addr, align 4
  %123 = icmp slt i32 %122, 0
  br i1 %123, label %if.then.18, label %if.end.18

if.then.18:
  %124 = load i32, i32* %ix.addr, align 4
  %125 = sub nsw i32 %124, 1072693248
  %126 = load i32, i32* %yisint.addr, align 4
  %127 = or i32 %125, %126
  %128 = icmp eq i32 %127, 0
  br i1 %128, label %if.then.19, label %if.else.2

if.then.19:
  %129 = load double, double* %z.addr, align 8
  %130 = load double, double* %z.addr, align 8
  %131 = fsub double %129, %130
  %132 = load double, double* %z.addr, align 8
  %133 = load double, double* %z.addr, align 8
  %134 = fsub double %132, %133
  %135 = fdiv double %131, %134
  store double %135, double* %z.addr, align 8
  br label %if.end.19

if.else.2:
  %136 = load i32, i32* %yisint.addr, align 4
  %137 = icmp eq i32 %136, 1
  br i1 %137, label %if.then.20, label %if.end.20

if.then.20:
  %138 = load double, double* %z.addr, align 8
  %139 = fneg double %138
  store double %139, double* %z.addr, align 8
  br label %if.end.20

if.end.20:
  br label %if.end.19

if.end.19:
  br label %if.end.18

if.end.18:
  %140 = load double, double* %z.addr, align 8
  ret double %140

if.end.17:
  %141 = load i32, i32* %hx.addr, align 4
  %142 = icmp slt i32 %141, 0
  br i1 %142, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %143 = load i32, i32* %yisint.addr, align 4
  %144 = icmp eq i32 %143, 0
  br label %land.end.6

land.end.6:
  %145 = phi i1 [ false, %if.end.17 ], [ %144, %land.rhs.6 ]
  br i1 %145, label %if.then.21, label %if.end.21

if.then.21:
  %146 = fsub double %x, %x
  %147 = fsub double %x, %x
  %148 = fdiv double %146, %147
  ret double %148

if.end.21:
  %149 = load i32, i32* %hx.addr, align 4
  %150 = icmp slt i32 %149, 0
  br i1 %150, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %151 = load i32, i32* %yisint.addr, align 4
  %152 = icmp eq i32 %151, 1
  br label %land.end.7

land.end.7:
  %153 = phi i1 [ false, %if.end.21 ], [ %152, %land.rhs.7 ]
  br i1 %153, label %cond.true.4, label %cond.false.4

cond.true.4:
  %154 = fneg double 0x3FF0000000000000
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %155 = phi double [ %154, %cond.true.4 ], [ 0x3FF0000000000000, %cond.false.4 ]
  store double %155, double* %s.addr, align 8
  store double 0x0000000000000000, double* %t1.addr, align 8
  store double 0x0000000000000000, double* %t2.addr, align 8
  %156 = load i32, i32* %iy.addr, align 4
  %157 = icmp sgt i32 %156, 1105199104
  br i1 %157, label %if.then.22, label %if.else.3

if.then.22:
  %158 = load i32, i32* %iy.addr, align 4
  %159 = icmp sgt i32 %158, 1139802112
  br i1 %159, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %160 = load i32, i32* %ix.addr, align 4
  %161 = icmp slt i32 %160, 1072693247
  br label %lor.end.4

lor.end.4:
  %162 = phi i1 [ true, %if.then.22 ], [ %161, %lor.rhs.4 ]
  br i1 %162, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %163 = load i32, i32* %ix.addr, align 4
  %164 = icmp sgt i32 %163, 1072693248
  br label %lor.end.3

lor.end.3:
  %165 = phi i1 [ true, %lor.end.4 ], [ %164, %lor.rhs.3 ]
  br i1 %165, label %if.then.23, label %if.end.23

if.then.23:
  %166 = load i32, i32* %ix.addr, align 4
  %167 = load i32, i32* %hy.addr, align 4
  %168 = load i32, i32* %iy.addr, align 4
  %169 = load double, double* %s.addr, align 8
  %170 = tail call double @nish.powHugeY(i32 %166, i32 %167, i32 %168, double %169)
  ret double %170

if.end.23:
  %171 = load double, double* %ax.addr, align 8
  %172 = fsub double %171, 0x3FF0000000000000
  store double %172, double* %t.addr, align 8
  %173 = load double, double* %t.addr, align 8
  %174 = load double, double* %t.addr, align 8
  %175 = fmul double %173, %174
  %176 = load double, double* %t.addr, align 8
  %177 = load double, double* %t.addr, align 8
  %178 = fmul double %177, 0x3FD0000000000000
  %179 = fsub double %178, 0x3FD5555555555555
  %180 = fmul double %176, %179
  %181 = fadd double %180, 0x3FE0000000000000
  %182 = fmul double %175, %181
  store double %182, double* %w.addr, align 8
  %183 = load double, double* %t.addr, align 8
  %184 = fmul double %183, 0x3FF7154760000000
  store double %184, double* %u.addr, align 8
  %185 = load double, double* %t.addr, align 8
  %186 = fmul double %185, 0x3E54AE0BF85DDF44
  %187 = load double, double* %w.addr, align 8
  %188 = fmul double %187, 0x3FF71547652B82FE
  %189 = fsub double %186, %188
  store double %189, double* %v.addr, align 8
  %190 = load double, double* %u.addr, align 8
  %191 = load double, double* %v.addr, align 8
  %192 = fadd double %190, %191
  %193 = call double @nish.withLo(double %192, i32 0)
  store double %193, double* %t1.addr, align 8
  %194 = load double, double* %v.addr, align 8
  %195 = load double, double* %t1.addr, align 8
  %196 = load double, double* %u.addr, align 8
  %197 = fsub double %195, %196
  %198 = fsub double %194, %197
  store double %198, double* %t2.addr, align 8
  br label %if.end.22

if.else.3:
  %199 = load i32, i32* %ix.addr, align 4
  %200 = icmp slt i32 %199, 1048576
  store i1 %200, i1* %subnormal.addr, align 1
  %201 = load i1, i1* %subnormal.addr, align 1
  br i1 %201, label %if.then.24, label %if.end.24

if.then.24:
  %202 = load double, double* %ax.addr, align 8
  %203 = fmul double %202, 0x4340000000000000
  store double %203, double* %ax.addr, align 8
  br label %if.end.24

if.end.24:
  %204 = load i1, i1* %subnormal.addr, align 1
  br i1 %204, label %cond.true.5, label %cond.false.5

cond.true.5:
  %205 = load double, double* %ax.addr, align 8
  %206 = call i32 @nish.hiWord(double %205)
  br label %cond.end.5

cond.false.5:
  %207 = load i32, i32* %ix.addr, align 4
  br label %cond.end.5

cond.end.5:
  %208 = phi i32 [ %206, %cond.true.5 ], [ %207, %cond.false.5 ]
  store i32 %208, i32* %hix.addr, align 4
  %209 = load i32, i32* %hix.addr, align 4
  %210 = and i32 %209, 1048575
  store i32 %210, i32* %j.addr.2, align 4
  %211 = load i32, i32* %j.addr.2, align 4
  %212 = icmp sge i32 %211, 767610
  store i1 %212, i1* %big.addr, align 1
  %213 = load i32, i32* %j.addr.2, align 4
  %214 = icmp sgt i32 %213, 235662
  br i1 %214, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %215 = load i1, i1* %big.addr, align 1
  %216 = xor i1 %215, true
  br label %land.end.8

land.end.8:
  %217 = phi i1 [ false, %cond.end.5 ], [ %216, %land.rhs.8 ]
  br i1 %217, label %cond.true.6, label %cond.false.6

cond.true.6:
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %218 = phi i32 [ 1, %cond.true.6 ], [ 0, %cond.false.6 ]
  store i32 %218, i32* %k.addr, align 4
  %219 = load i32, i32* %hix.addr, align 4
  %220 = lshr i32 %219, 20
  %221 = sub nsw i32 %220, 1023
  %222 = sitofp i32 %221 to double
  %223 = load i1, i1* %subnormal.addr, align 1
  br i1 %223, label %cond.true.7, label %cond.false.7

cond.true.7:
  br label %cond.end.7

cond.false.7:
  br label %cond.end.7

cond.end.7:
  %224 = phi double [ 0x404A800000000000, %cond.true.7 ], [ 0x0000000000000000, %cond.false.7 ]
  %225 = fsub double %222, %224
  %226 = load i1, i1* %big.addr, align 1
  br i1 %226, label %cond.true.8, label %cond.false.8

cond.true.8:
  br label %cond.end.8

cond.false.8:
  br label %cond.end.8

cond.end.8:
  %227 = phi double [ 0x3FF0000000000000, %cond.true.8 ], [ 0x0000000000000000, %cond.false.8 ]
  %228 = fadd double %225, %227
  store double %228, double* %dn.addr, align 8
  %229 = load double, double* %ax.addr, align 8
  %230 = load i32, i32* %j.addr.2, align 4
  %231 = load i1, i1* %big.addr, align 1
  br i1 %231, label %cond.true.9, label %cond.false.9

cond.true.9:
  br label %cond.end.9

cond.false.9:
  br label %cond.end.9

cond.end.9:
  %232 = phi i32 [ 1071644672, %cond.true.9 ], [ 1072693248, %cond.false.9 ]
  %233 = or i32 %230, %232
  %234 = call double @nish.withHi(double %229, i32 %233)
  store double %234, double* %ax.addr, align 8
  %235 = load i32, i32* %k.addr, align 4
  %236 = icmp eq i32 %235, 0
  br i1 %236, label %cond.true.10, label %cond.false.10

cond.true.10:
  br label %cond.end.10

cond.false.10:
  br label %cond.end.10

cond.end.10:
  %237 = phi double [ 0x3FF0000000000000, %cond.true.10 ], [ 0x3FF8000000000000, %cond.false.10 ]
  store double %237, double* %bp.addr, align 8
  %238 = load i32, i32* %k.addr, align 4
  %239 = icmp eq i32 %238, 0
  br i1 %239, label %cond.true.11, label %cond.false.11

cond.true.11:
  br label %cond.end.11

cond.false.11:
  br label %cond.end.11

cond.end.11:
  %240 = phi double [ 0x0000000000000000, %cond.true.11 ], [ 0x3FE2B80340000000, %cond.false.11 ]
  store double %240, double* %dph.addr, align 8
  %241 = load i32, i32* %k.addr, align 4
  %242 = icmp eq i32 %241, 0
  br i1 %242, label %cond.true.12, label %cond.false.12

cond.true.12:
  br label %cond.end.12

cond.false.12:
  br label %cond.end.12

cond.end.12:
  %243 = phi double [ 0x0000000000000000, %cond.true.12 ], [ 0x3E4CFDEB43CFD006, %cond.false.12 ]
  store double %243, double* %dpl.addr, align 8
  %244 = load double, double* %ax.addr, align 8
  %245 = load double, double* %bp.addr, align 8
  %246 = fsub double %244, %245
  store double %246, double* %u.addr.1, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %247 = load double, double* %one.addr, align 8
  %248 = load double, double* %ax.addr, align 8
  %249 = load double, double* %bp.addr, align 8
  %250 = fadd double %248, %249
  %251 = fdiv double %247, %250
  store double %251, double* %v.addr.1, align 8
  %252 = load double, double* %u.addr.1, align 8
  %253 = load double, double* %v.addr.1, align 8
  %254 = fmul double %252, %253
  store double %254, double* %ss.addr, align 8
  %255 = load double, double* %ss.addr, align 8
  %256 = call double @nish.withLo(double %255, i32 0)
  store double %256, double* %sh.addr, align 8
  %257 = load i32, i32* %j.addr.2, align 4
  %258 = lshr i32 %257, 1
  store i32 %258, i32* %half.addr, align 4
  %259 = load i32, i32* %half.addr, align 4
  %260 = add nsw i32 %259, 1073741824
  %261 = call double @nish.withHi(double 0x0000000000000000, i32 %260)
  store double %261, double* %thn.addr, align 8
  %262 = load i1, i1* %big.addr, align 1
  br i1 %262, label %cond.true.13, label %cond.false.13

cond.true.13:
  %263 = load i32, i32* %half.addr, align 4
  %264 = add nsw i32 %263, 1073217536
  %265 = call double @nish.withHi(double 0x0000000000000000, i32 %264)
  br label %cond.end.13

cond.false.13:
  %266 = load i32, i32* %k.addr, align 4
  %267 = icmp eq i32 %266, 0
  br i1 %267, label %cond.true.14, label %cond.false.14

cond.true.14:
  %268 = load double, double* %thn.addr, align 8
  br label %cond.end.14

cond.false.14:
  %269 = load double, double* %thn.addr, align 8
  %270 = fadd double %269, 0x3FE0000000000000
  br label %cond.end.14

cond.end.14:
  %271 = phi double [ %268, %cond.true.14 ], [ %270, %cond.false.14 ]
  br label %cond.end.13

cond.end.13:
  %272 = phi double [ %265, %cond.true.13 ], [ %271, %cond.end.14 ]
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
  %362 = load double, double* %dn.addr, align 8
  store double %362, double* %t.addr.1, align 8
  %363 = load double, double* %zh.addr, align 8
  %364 = load double, double* %zl.addr, align 8
  %365 = fadd double %363, %364
  %366 = load double, double* %dph.addr, align 8
  %367 = fadd double %365, %366
  %368 = load double, double* %t.addr.1, align 8
  %369 = fadd double %367, %368
  %370 = call double @nish.withLo(double %369, i32 0)
  store double %370, double* %t1.addr, align 8
  %371 = load double, double* %zl.addr, align 8
  %372 = load double, double* %t1.addr, align 8
  %373 = load double, double* %t.addr.1, align 8
  %374 = fsub double %372, %373
  %375 = load double, double* %dph.addr, align 8
  %376 = fsub double %374, %375
  %377 = load double, double* %zh.addr, align 8
  %378 = fsub double %376, %377
  %379 = fsub double %371, %378
  store double %379, double* %t2.addr, align 8
  br label %if.end.22

if.end.22:
  %380 = call double @nish.withLo(double %y, i32 0)
  store double %380, double* %y1.addr, align 8
  %381 = load double, double* %y1.addr, align 8
  %382 = load double, double* %t1.addr, align 8
  %383 = fmul double %381, %382
  %384 = load double, double* %y1.addr, align 8
  %385 = fsub double %y, %384
  %386 = load double, double* %t1.addr, align 8
  %387 = fmul double %385, %386
  %388 = load double, double* %t2.addr, align 8
  %389 = fmul double %y, %388
  %390 = fadd double %387, %389
  %391 = load double, double* %s.addr, align 8
  %392 = tail call double @nish.powExp2(double %383, double %390, double %391)
  ret double %392
}

define internal noundef double @nish.fmodF64(double noundef %x, double noundef %y) #2 {
entry:
  %ux.addr = alloca i64, align 8
  %uy.addr = alloca i64, align 8
  %ex.addr = alloca i32, align 4
  %ey.addr = alloca i32, align 4
  %sign.addr = alloca i64, align 8
  %mant.addr = alloca i64, align 8
  %implicit.addr = alloca i64, align 8
  %lzx.addr = alloca i32, align 4
  %lzy.addr = alloca i32, align 4
  %steps.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %up.addr = alloca i32, align 4
  %e.addr = alloca double, align 8
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
  br i1 %67, label %cond.true.1, label %cond.false.1

cond.true.1:
  %68 = load i64, i64* %ux.addr, align 8
  %69 = sext i32 12 to i64
  %70 = and i64 %69, 63
  %71 = shl i64 %68, %70
  %72 = call i32 @nish.clz64(i64 %71)
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %73 = phi i32 [ %72, %cond.true.1 ], [ 0, %cond.false.1 ]
  store i32 %73, i32* %lzx.addr, align 4
  %74 = load i32, i32* %ey.addr, align 4
  %75 = icmp eq i32 %74, 0
  br i1 %75, label %cond.true.2, label %cond.false.2

cond.true.2:
  %76 = load i64, i64* %uy.addr, align 8
  %77 = sext i32 12 to i64
  %78 = and i64 %77, 63
  %79 = shl i64 %76, %78
  %80 = call i32 @nish.clz64(i64 %79)
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %81 = phi i32 [ %80, %cond.true.2 ], [ 0, %cond.false.2 ]
  store i32 %81, i32* %lzy.addr, align 4
  %82 = load i32, i32* %ex.addr, align 4
  %83 = icmp eq i32 %82, 0
  br i1 %83, label %cond.true.3, label %cond.false.3

cond.true.3:
  %84 = load i64, i64* %ux.addr, align 8
  %85 = load i32, i32* %lzx.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = and i64 %86, 63
  %88 = shl i64 %84, %87
  %89 = sext i32 1 to i64
  %90 = and i64 %89, 63
  %91 = shl i64 %88, %90
  br label %cond.end.3

cond.false.3:
  %92 = load i64, i64* %ux.addr, align 8
  %93 = load i64, i64* %mant.addr, align 8
  %94 = and i64 %92, %93
  %95 = load i64, i64* %implicit.addr, align 8
  %96 = or i64 %94, %95
  br label %cond.end.3

cond.end.3:
  %97 = phi i64 [ %91, %cond.true.3 ], [ %96, %cond.false.3 ]
  store i64 %97, i64* %ux.addr, align 8
  %98 = load i32, i32* %ey.addr, align 4
  %99 = icmp eq i32 %98, 0
  br i1 %99, label %cond.true.4, label %cond.false.4

cond.true.4:
  %100 = load i64, i64* %uy.addr, align 8
  %101 = load i32, i32* %lzy.addr, align 4
  %102 = sext i32 %101 to i64
  %103 = and i64 %102, 63
  %104 = shl i64 %100, %103
  %105 = sext i32 1 to i64
  %106 = and i64 %105, 63
  %107 = shl i64 %104, %106
  br label %cond.end.4

cond.false.4:
  %108 = load i64, i64* %uy.addr, align 8
  %109 = load i64, i64* %mant.addr, align 8
  %110 = and i64 %108, %109
  %111 = load i64, i64* %implicit.addr, align 8
  %112 = or i64 %110, %111
  br label %cond.end.4

cond.end.4:
  %113 = phi i64 [ %107, %cond.true.4 ], [ %112, %cond.false.4 ]
  store i64 %113, i64* %uy.addr, align 8
  %114 = load i32, i32* %ex.addr, align 4
  %115 = sitofp i32 %114 to double
  %116 = load i32, i32* %lzx.addr, align 4
  %117 = sitofp i32 %116 to double
  %118 = fsub double %115, %117
  %119 = load i32, i32* %ey.addr, align 4
  %120 = sitofp i32 %119 to double
  %121 = load i32, i32* %lzy.addr, align 4
  %122 = sitofp i32 %121 to double
  %123 = fsub double %120, %122
  %124 = fsub double %118, %123
  %125 = call i32 @llvm.fptosi.sat.i32.f64(double %124)
  store i32 %125, i32* %steps.addr, align 4
  store i32 0, i32* %step.addr, align 4
  br label %while.cond

while.cond:
  %126 = load i32, i32* %step.addr, align 4
  %127 = load i32, i32* %steps.addr, align 4
  %128 = icmp slt i32 %126, %127
  br i1 %128, label %while.body, label %while.end

while.body:
  %129 = load i64, i64* %ux.addr, align 8
  %130 = load i64, i64* %uy.addr, align 8
  %131 = icmp uge i64 %129, %130
  br i1 %131, label %cond.true.5, label %cond.false.5

cond.true.5:
  %132 = load i64, i64* %ux.addr, align 8
  %133 = load i64, i64* %uy.addr, align 8
  %134 = sub i64 %132, %133
  br label %cond.end.5

cond.false.5:
  %135 = load i64, i64* %ux.addr, align 8
  br label %cond.end.5

cond.end.5:
  %136 = phi i64 [ %134, %cond.true.5 ], [ %135, %cond.false.5 ]
  %137 = sext i32 1 to i64
  %138 = and i64 %137, 63
  %139 = shl i64 %136, %138
  store i64 %139, i64* %ux.addr, align 8
  %140 = load i32, i32* %step.addr, align 4
  %141 = add nsw i32 %140, 1
  store i32 %141, i32* %step.addr, align 4
  br label %while.cond

while.end:
  %142 = load i64, i64* %ux.addr, align 8
  %143 = load i64, i64* %uy.addr, align 8
  %144 = icmp uge i64 %142, %143
  br i1 %144, label %if.then.2, label %if.end.2

if.then.2:
  %145 = load i64, i64* %ux.addr, align 8
  %146 = load i64, i64* %uy.addr, align 8
  %147 = sub i64 %145, %146
  store i64 %147, i64* %ux.addr, align 8
  br label %if.end.2

if.end.2:
  %148 = load i64, i64* %ux.addr, align 8
  %149 = sext i32 0 to i64
  %150 = icmp eq i64 %148, %149
  br i1 %150, label %if.then.3, label %if.end.3

if.then.3:
  %151 = fmul double 0x0000000000000000, %x
  ret double %151

if.end.3:
  store i32 0, i32* %up.addr, align 4
  br label %while.cond.1

while.cond.1:
  %152 = load i32, i32* %up.addr, align 4
  %153 = icmp slt i32 %152, 53
  br i1 %153, label %land.rhs, label %land.end

land.rhs:
  %154 = load i64, i64* %ux.addr, align 8
  %155 = sext i32 52 to i64
  %156 = and i64 %155, 63
  %157 = lshr i64 %154, %156
  %158 = sext i32 0 to i64
  %159 = icmp eq i64 %157, %158
  br label %land.end

land.end:
  %160 = phi i1 [ false, %while.cond.1 ], [ %159, %land.rhs ]
  br i1 %160, label %while.body.1, label %while.end.1

while.body.1:
  %161 = load i64, i64* %ux.addr, align 8
  %162 = sext i32 1 to i64
  %163 = and i64 %162, 63
  %164 = shl i64 %161, %163
  store i64 %164, i64* %ux.addr, align 8
  %165 = load i32, i32* %up.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %up.addr, align 4
  br label %while.cond.1

while.end.1:
  %167 = load i32, i32* %ey.addr, align 4
  %168 = sitofp i32 %167 to double
  %169 = load i32, i32* %lzy.addr, align 4
  %170 = sitofp i32 %169 to double
  %171 = fsub double %168, %170
  %172 = load i32, i32* %up.addr, align 4
  %173 = sitofp i32 %172 to double
  %174 = fsub double %171, %173
  store double %174, double* %e.addr, align 8
  %175 = load double, double* %e.addr, align 8
  %176 = fcmp ogt double %175, 0x0000000000000000
  br i1 %176, label %if.then.4, label %if.else

if.then.4:
  %177 = load i64, i64* %ux.addr, align 8
  %178 = load i64, i64* %implicit.addr, align 8
  %179 = sub i64 %177, %178
  %180 = load double, double* %e.addr, align 8
  %181 = call i32 @llvm.fptosi.sat.i32.f64(double %180)
  %182 = sext i32 %181 to i64
  %183 = sext i32 52 to i64
  %184 = and i64 %183, 63
  %185 = shl i64 %182, %184
  %186 = or i64 %179, %185
  store i64 %186, i64* %ux.addr, align 8
  br label %if.end.4

if.else:
  %187 = load i64, i64* %ux.addr, align 8
  %188 = load double, double* %e.addr, align 8
  %189 = fsub double 0x3FF0000000000000, %188
  %190 = call i32 @llvm.fptosi.sat.i32.f64(double %189)
  %191 = sext i32 %190 to i64
  %192 = and i64 %191, 63
  %193 = lshr i64 %187, %192
  store i64 %193, i64* %ux.addr, align 8
  br label %if.end.4

if.end.4:
  %194 = load i64, i64* %ux.addr, align 8
  %195 = load i64, i64* %sign.addr, align 8
  %196 = or i64 %194, %195
  %197 = bitcast i64 %196 to double
  ret double %197
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
