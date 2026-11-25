@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare double @llvm.fabs.f64(double) #2
declare i32 @llvm.ctlz.i32(i32, i1) #2

define noundef double @tangent(double noundef %x) #0 {
entry:
  %0 = tail call double @nish.tanF64(double %x)
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %quarter.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = load double, double* %one.addr, align 8
  %2 = call double @nish.atan2F64(double %0, double %1)
  store double %2, double* %quarter.addr, align 8
  %3 = load double, double* %zero.addr, align 8
  %4 = call double @tangent(double %3)
  %5 = call i8* @nish_str_from_f64(double %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load double, double* %one.addr, align 8
  %8 = load double, double* %zero.addr, align 8
  %9 = fneg double %8
  %10 = call double @tangent(double %9)
  %11 = fdiv double %7, %10
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* %6, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load double, double* %quarter.addr, align 8
  %16 = call double @tangent(double %15)
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %14, i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = load double, double* %quarter.addr, align 8
  %21 = fneg double %20
  %22 = call double @tangent(double %21)
  %23 = call i8* @nish_str_from_f64(double %22)
  %24 = call i8* @nish_str_concat(i8* %19, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load double, double* %zero.addr, align 8
  %26 = load double, double* %zero.addr, align 8
  %27 = fdiv double %25, %26
  %28 = call double @tangent(double %27)
  %29 = call i8* @nish_str_from_f64(double %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load double, double* %one.addr, align 8
  %32 = load double, double* %zero.addr, align 8
  %33 = fdiv double %31, %32
  %34 = call double @tangent(double %33)
  %35 = call i8* @nish_str_from_f64(double %34)
  %36 = call i8* @nish_str_concat(i8* %30, i8* %35)
  call void @nish_print(i8* %36)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.hiWord(double noundef %x) #2 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = ashr i64 %0, %2
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef i32 @nish.loWord(double noundef %x) #2 {
entry:
  %0 = bitcast double %x to i64
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

define internal noundef double @nish.exp2Bits(i64 noundef %biased) #2 {
entry:
  %0 = sext i32 52 to i64
  %1 = and i64 %0, 63
  %2 = shl i64 %biased, %1
  %3 = bitcast i64 %2 to double
  ret double %3
}

define internal noundef double @nish.pow2(i32 noundef %n) #2 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 1023 to i64
  %2 = add nsw i64 %0, %1
  %3 = tail call double @nish.exp2Bits(i64 %2)
  ret double %3
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #2 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef double @nish.clearLo(double noundef %x) #2 {
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

define internal noundef i32 @nish.ipio2(i32 noundef %i) #2 {
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
  %56 = sext i32 32 to i64
  %57 = load i32, i32* %off.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = sub nsw i64 %56, %58
  %60 = and i64 %59, 63
  %61 = lshr i64 %55, %60
  %62 = or i64 %54, %61
  ret i64 %62
}

define internal noundef i64 @nish.mulHi(i64 noundef %a, i64 noundef %b) #2 {
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

define internal noundef i32 @nish.clz64(i64 noundef %v) #2 {
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

define internal noundef double @nish.trigLarge(double noundef %x, i32 noundef %ix, i32 noundef %hx, i32 noundef %mode) #0 {
entry:
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
  %q2.addr = alloca i64, align 8
  %q1.addr = alloca i64, align 8
  %q0.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
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
  store i32 %14, i32* %p.addr, align 4
  %15 = load i32, i32* %p.addr, align 4
  %16 = call i64 @nish.pio2Word(i32 %15)
  store i64 %16, i64* %w0.addr, align 8
  %17 = load i32, i32* %p.addr, align 4
  %18 = add nsw i32 %17, 64
  %19 = call i64 @nish.pio2Word(i32 %18)
  store i64 %19, i64* %w1.addr, align 8
  %20 = load i32, i32* %p.addr, align 4
  %21 = add nsw i32 %20, 128
  %22 = call i64 @nish.pio2Word(i32 %21)
  store i64 %22, i64* %w2.addr, align 8
  %23 = load i64, i64* %m.addr, align 8
  %24 = load i64, i64* %w2.addr, align 8
  %25 = mul i64 %23, %24
  store i64 %25, i64* %lo2.addr, align 8
  %26 = load i64, i64* %m.addr, align 8
  %27 = load i64, i64* %w2.addr, align 8
  %28 = call i64 @nish.mulHi(i64 %26, i64 %27)
  store i64 %28, i64* %hi2.addr, align 8
  %29 = load i64, i64* %m.addr, align 8
  %30 = load i64, i64* %w1.addr, align 8
  %31 = mul i64 %29, %30
  store i64 %31, i64* %lo1.addr, align 8
  %32 = load i64, i64* %m.addr, align 8
  %33 = load i64, i64* %w1.addr, align 8
  %34 = call i64 @nish.mulHi(i64 %32, i64 %33)
  store i64 %34, i64* %hi1.addr, align 8
  %35 = load i64, i64* %lo2.addr, align 8
  store i64 %35, i64* %p0.addr, align 8
  %36 = load i64, i64* %hi2.addr, align 8
  %37 = load i64, i64* %lo1.addr, align 8
  %38 = add i64 %36, %37
  store i64 %38, i64* %p1.addr, align 8
  %39 = load i64, i64* %p1.addr, align 8
  %40 = load i64, i64* %lo1.addr, align 8
  %41 = icmp ult i64 %39, %40
  br i1 %41, label %cond.true, label %cond.false

cond.true:
  %42 = sext i32 1 to i64
  br label %cond.end

cond.false:
  %43 = sext i32 0 to i64
  br label %cond.end

cond.end:
  %44 = phi i64 [ %42, %cond.true ], [ %43, %cond.false ]
  store i64 %44, i64* %c.addr, align 8
  %45 = load i64, i64* %hi1.addr, align 8
  %46 = load i64, i64* %m.addr, align 8
  %47 = load i64, i64* %w0.addr, align 8
  %48 = mul i64 %46, %47
  %49 = add i64 %45, %48
  %50 = load i64, i64* %c.addr, align 8
  %51 = add i64 %49, %50
  store i64 %51, i64* %p2.addr, align 8
  %52 = load i64, i64* %p2.addr, align 8
  %53 = sext i32 2 to i64
  %54 = and i64 %53, 63
  %55 = shl i64 %52, %54
  %56 = load i64, i64* %p1.addr, align 8
  %57 = sext i32 62 to i64
  %58 = and i64 %57, 63
  %59 = lshr i64 %56, %58
  %60 = or i64 %55, %59
  store i64 %60, i64* %q2.addr, align 8
  %61 = load i64, i64* %p1.addr, align 8
  %62 = sext i32 2 to i64
  %63 = and i64 %62, 63
  %64 = shl i64 %61, %63
  %65 = load i64, i64* %p0.addr, align 8
  %66 = sext i32 62 to i64
  %67 = and i64 %66, 63
  %68 = lshr i64 %65, %67
  %69 = or i64 %64, %68
  store i64 %69, i64* %q1.addr, align 8
  %70 = load i64, i64* %p0.addr, align 8
  %71 = sext i32 2 to i64
  %72 = and i64 %71, 63
  %73 = shl i64 %70, %72
  store i64 %73, i64* %q0.addr, align 8
  %74 = load i64, i64* %p2.addr, align 8
  %75 = sext i32 62 to i64
  %76 = and i64 %75, 63
  %77 = lshr i64 %74, %76
  %78 = trunc i64 %77 to i32
  %79 = and i32 %78, 3
  store i32 %79, i32* %n.addr, align 4
  store i1 false, i1* %neg.addr, align 1
  %80 = load i64, i64* %q2.addr, align 8
  %81 = sext i32 63 to i64
  %82 = and i64 %81, 63
  %83 = lshr i64 %80, %82
  %84 = sext i32 0 to i64
  %85 = icmp ne i64 %83, %84
  br i1 %85, label %if.then, label %if.end

if.then:
  %86 = load i32, i32* %n.addr, align 4
  %87 = add nsw i32 %86, 1
  store i32 %87, i32* %n.addr, align 4
  store i1 true, i1* %neg.addr, align 1
  %88 = load i64, i64* %q0.addr, align 8
  %89 = xor i64 %88, -1
  %90 = sext i32 1 to i64
  %91 = add i64 %89, %90
  store i64 %91, i64* %q0.addr, align 8
  %92 = load i64, i64* %q0.addr, align 8
  %93 = sext i32 0 to i64
  %94 = icmp eq i64 %92, %93
  br i1 %94, label %cond.true.1, label %cond.false.1

cond.true.1:
  %95 = sext i32 1 to i64
  br label %cond.end.1

cond.false.1:
  %96 = sext i32 0 to i64
  br label %cond.end.1

cond.end.1:
  %97 = phi i64 [ %95, %cond.true.1 ], [ %96, %cond.false.1 ]
  store i64 %97, i64* %k0.addr, align 8
  %98 = load i64, i64* %q1.addr, align 8
  %99 = xor i64 %98, -1
  %100 = load i64, i64* %k0.addr, align 8
  %101 = add i64 %99, %100
  store i64 %101, i64* %q1.addr, align 8
  %102 = load i64, i64* %k0.addr, align 8
  %103 = sext i32 0 to i64
  %104 = icmp ne i64 %102, %103
  br i1 %104, label %land.rhs, label %land.end

land.rhs:
  %105 = load i64, i64* %q1.addr, align 8
  %106 = sext i32 0 to i64
  %107 = icmp eq i64 %105, %106
  br label %land.end

land.end:
  %108 = phi i1 [ false, %cond.end.1 ], [ %107, %land.rhs ]
  br i1 %108, label %cond.true.2, label %cond.false.2

cond.true.2:
  %109 = sext i32 1 to i64
  br label %cond.end.2

cond.false.2:
  %110 = sext i32 0 to i64
  br label %cond.end.2

cond.end.2:
  %111 = phi i64 [ %109, %cond.true.2 ], [ %110, %cond.false.2 ]
  store i64 %111, i64* %k1.addr, align 8
  %112 = load i64, i64* %q2.addr, align 8
  %113 = xor i64 %112, -1
  %114 = load i64, i64* %k1.addr, align 8
  %115 = add i64 %113, %114
  store i64 %115, i64* %q2.addr, align 8
  br label %if.end

if.end:
  store i32 0, i32* %sh.addr, align 4
  %116 = load i64, i64* %q2.addr, align 8
  %117 = sext i32 0 to i64
  %118 = icmp eq i64 %116, %117
  br i1 %118, label %if.then.1, label %if.end.1

if.then.1:
  %119 = load i64, i64* %q1.addr, align 8
  store i64 %119, i64* %q2.addr, align 8
  %120 = load i64, i64* %q0.addr, align 8
  store i64 %120, i64* %q1.addr, align 8
  %121 = sext i32 0 to i64
  store i64 %121, i64* %q0.addr, align 8
  store i32 64, i32* %sh.addr, align 4
  br label %if.end.1

if.end.1:
  %122 = load i64, i64* %q2.addr, align 8
  %123 = call i32 @nish.clz64(i64 %122)
  store i32 %123, i32* %lz.addr, align 4
  %124 = load i32, i32* %lz.addr, align 4
  %125 = icmp sgt i32 %124, 0
  br i1 %125, label %if.then.2, label %if.end.2

if.then.2:
  %126 = load i64, i64* %q2.addr, align 8
  %127 = load i32, i32* %lz.addr, align 4
  %128 = sext i32 %127 to i64
  %129 = and i64 %128, 63
  %130 = shl i64 %126, %129
  %131 = load i64, i64* %q1.addr, align 8
  %132 = load i32, i32* %lz.addr, align 4
  %133 = sub nsw i32 64, %132
  %134 = sext i32 %133 to i64
  %135 = and i64 %134, 63
  %136 = lshr i64 %131, %135
  %137 = or i64 %130, %136
  store i64 %137, i64* %q2.addr, align 8
  %138 = load i64, i64* %q1.addr, align 8
  %139 = load i32, i32* %lz.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = and i64 %140, 63
  %142 = shl i64 %138, %141
  %143 = load i64, i64* %q0.addr, align 8
  %144 = load i32, i32* %lz.addr, align 4
  %145 = sub nsw i32 64, %144
  %146 = sext i32 %145 to i64
  %147 = and i64 %146, 63
  %148 = lshr i64 %143, %147
  %149 = or i64 %142, %148
  store i64 %149, i64* %q1.addr, align 8
  br label %if.end.2

if.end.2:
  %150 = load i64, i64* %q2.addr, align 8
  %151 = sext i32 11 to i64
  %152 = and i64 %151, 63
  %153 = lshr i64 %150, %152
  %154 = uitofp i64 %153 to double
  %155 = sext i32 970 to i64
  %156 = load i32, i32* %sh.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = sub nsw i64 %155, %157
  %159 = load i32, i32* %lz.addr, align 4
  %160 = sext i32 %159 to i64
  %161 = sub nsw i64 %158, %160
  %162 = call double @nish.exp2Bits(i64 %161)
  %163 = fmul double %154, %162
  store double %163, double* %a.addr, align 8
  %164 = load i64, i64* %q2.addr, align 8
  %165 = sext i32 2047 to i64
  %166 = and i64 %164, %165
  %167 = sext i32 53 to i64
  %168 = and i64 %167, 63
  %169 = shl i64 %166, %168
  %170 = load i64, i64* %q1.addr, align 8
  %171 = sext i32 11 to i64
  %172 = and i64 %171, 63
  %173 = lshr i64 %170, %172
  %174 = or i64 %169, %173
  %175 = uitofp i64 %174 to double
  %176 = sext i32 906 to i64
  %177 = load i32, i32* %sh.addr, align 4
  %178 = sext i32 %177 to i64
  %179 = sub nsw i64 %176, %178
  %180 = load i32, i32* %lz.addr, align 4
  %181 = sext i32 %180 to i64
  %182 = sub nsw i64 %179, %181
  %183 = call double @nish.exp2Bits(i64 %182)
  %184 = fmul double %175, %183
  store double %184, double* %b.addr, align 8
  store double 0x3FF921FB54442D18, double* %p1h.addr, align 8
  store double 0x3C91A62633145C07, double* %p1l.addr, align 8
  %185 = load double, double* %a.addr, align 8
  %186 = load double, double* %p1h.addr, align 8
  %187 = fmul double %185, %186
  store double %187, double* %t.addr, align 8
  store double 0x41A0000002000000, double* %split.addr, align 8
  %188 = load double, double* %a.addr, align 8
  %189 = load double, double* %split.addr, align 8
  %190 = fmul double %188, %189
  store double %190, double* %ac.addr, align 8
  %191 = load double, double* %ac.addr, align 8
  %192 = load double, double* %ac.addr, align 8
  %193 = load double, double* %a.addr, align 8
  %194 = fsub double %192, %193
  %195 = fsub double %191, %194
  store double %195, double* %ah.addr, align 8
  %196 = load double, double* %a.addr, align 8
  %197 = load double, double* %ah.addr, align 8
  %198 = fsub double %196, %197
  store double %198, double* %al.addr, align 8
  %199 = load double, double* %p1h.addr, align 8
  %200 = load double, double* %split.addr, align 8
  %201 = fmul double %199, %200
  store double %201, double* %pc.addr, align 8
  %202 = load double, double* %pc.addr, align 8
  %203 = load double, double* %pc.addr, align 8
  %204 = load double, double* %p1h.addr, align 8
  %205 = fsub double %203, %204
  %206 = fsub double %202, %205
  store double %206, double* %ph.addr, align 8
  %207 = load double, double* %p1h.addr, align 8
  %208 = load double, double* %ph.addr, align 8
  %209 = fsub double %207, %208
  store double %209, double* %pl.addr, align 8
  %210 = load double, double* %ah.addr, align 8
  %211 = load double, double* %ph.addr, align 8
  %212 = fmul double %210, %211
  %213 = load double, double* %t.addr, align 8
  %214 = fsub double %212, %213
  %215 = load double, double* %ah.addr, align 8
  %216 = load double, double* %pl.addr, align 8
  %217 = fmul double %215, %216
  %218 = fadd double %214, %217
  %219 = load double, double* %al.addr, align 8
  %220 = load double, double* %ph.addr, align 8
  %221 = fmul double %219, %220
  %222 = fadd double %218, %221
  %223 = load double, double* %al.addr, align 8
  %224 = load double, double* %pl.addr, align 8
  %225 = fmul double %223, %224
  %226 = fadd double %222, %225
  store double %226, double* %err.addr, align 8
  %227 = load double, double* %err.addr, align 8
  %228 = load double, double* %a.addr, align 8
  %229 = load double, double* %p1l.addr, align 8
  %230 = fmul double %228, %229
  %231 = load double, double* %b.addr, align 8
  %232 = load double, double* %p1h.addr, align 8
  %233 = fmul double %231, %232
  %234 = fadd double %230, %233
  %235 = fadd double %227, %234
  store double %235, double* %tail.addr, align 8
  %236 = load double, double* %t.addr, align 8
  %237 = load double, double* %tail.addr, align 8
  %238 = fadd double %236, %237
  store double %238, double* %y0.addr, align 8
  %239 = load double, double* %tail.addr, align 8
  %240 = load double, double* %y0.addr, align 8
  %241 = load double, double* %t.addr, align 8
  %242 = fsub double %240, %241
  %243 = fsub double %239, %242
  store double %243, double* %y1.addr, align 8
  %244 = load i1, i1* %neg.addr, align 1
  %245 = icmp slt i32 %hx, 0
  %246 = icmp ne i1 %244, %245
  br i1 %246, label %if.then.3, label %if.end.3

if.then.3:
  %247 = load double, double* %y0.addr, align 8
  %248 = fneg double %247
  store double %248, double* %y0.addr, align 8
  %249 = load double, double* %y1.addr, align 8
  %250 = fneg double %249
  store double %250, double* %y1.addr, align 8
  br label %if.end.3

if.end.3:
  %251 = load double, double* %y0.addr, align 8
  %252 = load double, double* %y1.addr, align 8
  %253 = icmp slt i32 %hx, 0
  br i1 %253, label %cond.true.3, label %cond.false.3

cond.true.3:
  %254 = load i32, i32* %n.addr, align 4
  %255 = sub nsw i32 4, %254
  br label %cond.end.3

cond.false.3:
  %256 = load i32, i32* %n.addr, align 4
  br label %cond.end.3

cond.end.3:
  %257 = phi i32 [ %255, %cond.true.3 ], [ %256, %cond.false.3 ]
  %258 = tail call double @nish.trigKernel(double %251, double %252, i32 %257, i32 %mode)
  ret double %258
}

define internal noundef double @nish.kernelTan(double noundef %x0, double noundef %y0, i1 noundef zeroext %odd) #2 {
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

define internal noundef double @nish.kernelSin(double noundef %x, double noundef %y, i1 noundef zeroext %tail) #2 {
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

define internal noundef double @nish.kernelCos(double noundef %x, double noundef %y) #2 {
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

define internal noundef double @nish.trigKernel(double noundef %y0, double noundef %y1, i32 noundef %n, i32 noundef %mode) #2 {
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

define internal noundef double @nish.tanF64(double noundef %x) #0 {
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
  ret double %x

if.end.1:
  %5 = tail call double @nish.kernelTan(double %x, double 0x0000000000000000, i1 false)
  ret double %5

if.end:
  %6 = load double, double* %ax.addr, align 8
  %7 = tail call double @nish.trigReduced(double %x, double %6, i32 0)
  ret double %7
}

define internal noundef double @nish.atanhi(i32 noundef %id) #2 {
entry:
  switch i32 %id, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret double 0x3FDDAC670561BB4F

sw.case.1:
  ret double 0x3FE921FB54442D18

sw.case.2:
  ret double 0x3FEF730BD281F69B

sw.default:
  ret double 0x3FF921FB54442D18
}

define internal noundef double @nish.atanlo(i32 noundef %id) #2 {
entry:
  switch i32 %id, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret double 0x3C7A2B7F222F65E2

sw.case.1:
  ret double 0x3C81A62633145C07

sw.case.2:
  ret double 0x3C7007887AF0CBBD

sw.default:
  ret double 0x3C91A62633145C07
}

define internal noundef double @nish.atan2F64(double noundef %y, double noundef %x) #2 {
entry:
  %piO4.addr = alloca double, align 8
  %piO2.addr = alloca double, align 8
  %pi.addr = alloca double, align 8
  %piLo.addr = alloca double, align 8
  %hx.addr = alloca i32, align 4
  %lx.addr = alloca i32, align 4
  %ix.addr = alloca i32, align 4
  %hy.addr = alloca i32, align 4
  %ly.addr = alloca i32, align 4
  %iy.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %r.addr = alloca double, align 8
  %q.addr = alloca double, align 8
  %a.addr = alloca double, align 8
  %b.addr = alloca double, align 8
  %h1.addr = alloca i32, align 4
  %s.addr = alloca double, align 8
  %q.addr.1 = alloca double, align 8
  %qs.addr = alloca double, align 8
  %qh.addr = alloca double, align 8
  %ql.addr = alloca double, align 8
  %bs.addr = alloca double, align 8
  %bh.addr = alloca double, align 8
  %bl.addr = alloca double, align 8
  %p.addr = alloca double, align 8
  %pe.addr = alloca double, align 8
  %c.addr = alloca double, align 8
  %hi.addr = alloca double, align 8
  %lo.addr = alloca double, align 8
  %iq.addr = alloca i32, align 4
  %t.addr = alloca double, align 8
  %tl.addr = alloca double, align 8
  %id.addr = alloca i32, align 4
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %s1.addr = alloca double, align 8
  %s2.addr = alloca double, align 8
  %r.addr.1 = alloca double, align 8
  %s.addr.1 = alloca double, align 8
  store double 0x3FE921FB54442D18, double* %piO4.addr, align 8
  store double 0x3FF921FB54442D18, double* %piO2.addr, align 8
  store double 0x400921FB54442D18, double* %pi.addr, align 8
  store double 0x3CA1A62633145C07, double* %piLo.addr, align 8
  %0 = call i1 @nish.isNan(double %x)
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = call i1 @nish.isNan(double %y)
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = fadd double %x, %y
  ret double %3

if.end:
  %4 = call i32 @nish.hiWord(double %x)
  store i32 %4, i32* %hx.addr, align 4
  %5 = call i32 @nish.loWord(double %x)
  store i32 %5, i32* %lx.addr, align 4
  %6 = load i32, i32* %hx.addr, align 4
  %7 = and i32 %6, 2147483647
  store i32 %7, i32* %ix.addr, align 4
  %8 = call i32 @nish.hiWord(double %y)
  store i32 %8, i32* %hy.addr, align 4
  %9 = call i32 @nish.loWord(double %y)
  store i32 %9, i32* %ly.addr, align 4
  %10 = load i32, i32* %hy.addr, align 4
  %11 = and i32 %10, 2147483647
  store i32 %11, i32* %iy.addr, align 4
  %12 = load i32, i32* %hy.addr, align 4
  %13 = ashr i32 %12, 31
  %14 = and i32 %13, 1
  %15 = load i32, i32* %hx.addr, align 4
  %16 = ashr i32 %15, 30
  %17 = and i32 %16, 2
  %18 = or i32 %14, %17
  store i32 %18, i32* %m.addr, align 4
  %19 = load i32, i32* %iy.addr, align 4
  %20 = icmp eq i32 %19, 0
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %ly.addr, align 4
  %22 = icmp eq i32 %21, 0
  br label %land.end

land.end:
  %23 = phi i1 [ false, %if.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load i32, i32* %m.addr, align 4
  %25 = icmp slt i32 %24, 2
  br i1 %25, label %if.then.2, label %if.end.2

if.then.2:
  ret double %y

if.end.2:
  %26 = load i32, i32* %m.addr, align 4
  %27 = icmp eq i32 %26, 2
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = load double, double* %pi.addr, align 8
  br label %cond.end

cond.false:
  %29 = load double, double* %pi.addr, align 8
  %30 = fneg double %29
  br label %cond.end

cond.end:
  %31 = phi double [ %28, %cond.true ], [ %30, %cond.false ]
  ret double %31

if.end.1:
  %32 = load i32, i32* %ix.addr, align 4
  %33 = icmp eq i32 %32, 0
  br i1 %33, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %34 = load i32, i32* %lx.addr, align 4
  %35 = icmp eq i32 %34, 0
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %if.end.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %if.then.3, label %if.end.3

if.then.3:
  %37 = load i32, i32* %hy.addr, align 4
  %38 = icmp slt i32 %37, 0
  br i1 %38, label %cond.true.1, label %cond.false.1

cond.true.1:
  %39 = load double, double* %piO2.addr, align 8
  %40 = fneg double %39
  br label %cond.end.1

cond.false.1:
  %41 = load double, double* %piO2.addr, align 8
  br label %cond.end.1

cond.end.1:
  %42 = phi double [ %40, %cond.true.1 ], [ %41, %cond.false.1 ]
  ret double %42

if.end.3:
  %43 = load i32, i32* %ix.addr, align 4
  %44 = icmp eq i32 %43, 2146435072
  br i1 %44, label %if.then.4, label %if.end.4

if.then.4:
  %45 = load i32, i32* %iy.addr, align 4
  %46 = icmp eq i32 %45, 2146435072
  br i1 %46, label %if.then.5, label %if.end.5

if.then.5:
  %47 = load i32, i32* %m.addr, align 4
  switch i32 %47, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %48 = load double, double* %piO4.addr, align 8
  ret double %48

sw.case.1:
  %49 = load double, double* %piO4.addr, align 8
  %50 = fneg double %49
  ret double %50

sw.case.2:
  %51 = load double, double* %piO4.addr, align 8
  %52 = fmul double 0x4008000000000000, %51
  ret double %52

sw.default:
  %53 = fneg double 0x4008000000000000
  %54 = load double, double* %piO4.addr, align 8
  %55 = fmul double %53, %54
  ret double %55

if.end.5:
  %56 = load i32, i32* %m.addr, align 4
  switch i32 %56, label %sw.default.1 [
    i32 0, label %sw.case.3
    i32 1, label %sw.case.4
    i32 2, label %sw.case.5
  ]

sw.case.3:
  ret double 0x0000000000000000

sw.case.4:
  %57 = fneg double 0x0000000000000000
  ret double %57

sw.case.5:
  %58 = load double, double* %pi.addr, align 8
  ret double %58

sw.default.1:
  %59 = load double, double* %pi.addr, align 8
  %60 = fneg double %59
  ret double %60

if.end.4:
  %61 = load i32, i32* %iy.addr, align 4
  %62 = icmp eq i32 %61, 2146435072
  br i1 %62, label %if.then.6, label %if.end.6

if.then.6:
  %63 = load i32, i32* %hy.addr, align 4
  %64 = icmp slt i32 %63, 0
  br i1 %64, label %cond.true.2, label %cond.false.2

cond.true.2:
  %65 = load double, double* %piO2.addr, align 8
  %66 = fneg double %65
  br label %cond.end.2

cond.false.2:
  %67 = load double, double* %piO2.addr, align 8
  br label %cond.end.2

cond.end.2:
  %68 = phi double [ %66, %cond.true.2 ], [ %67, %cond.false.2 ]
  ret double %68

if.end.6:
  %69 = load i32, i32* %iy.addr, align 4
  %70 = load i32, i32* %ix.addr, align 4
  %71 = sub nsw i32 %69, %70
  %72 = ashr i32 %71, 20
  store i32 %72, i32* %k.addr, align 4
  %73 = load i32, i32* %k.addr, align 4
  %74 = icmp sgt i32 %73, 60
  br i1 %74, label %if.then.7, label %if.end.7

if.then.7:
  %75 = load double, double* %piO2.addr, align 8
  %76 = load double, double* %piLo.addr, align 8
  %77 = fmul double 0x3FE0000000000000, %76
  %78 = fadd double %75, %77
  store double %78, double* %r.addr, align 8
  %79 = load i32, i32* %hy.addr, align 4
  %80 = icmp slt i32 %79, 0
  br i1 %80, label %cond.true.3, label %cond.false.3

cond.true.3:
  %81 = load double, double* %r.addr, align 8
  %82 = fneg double %81
  br label %cond.end.3

cond.false.3:
  %83 = load double, double* %r.addr, align 8
  br label %cond.end.3

cond.end.3:
  %84 = phi double [ %82, %cond.true.3 ], [ %83, %cond.false.3 ]
  ret double %84

if.end.7:
  %85 = load i32, i32* %k.addr, align 4
  %86 = icmp slt i32 %85, -60
  br i1 %86, label %if.then.8, label %if.end.8

if.then.8:
  %87 = load i32, i32* %hx.addr, align 4
  %88 = icmp slt i32 %87, 0
  br i1 %88, label %if.then.9, label %if.end.9

if.then.9:
  %89 = load i32, i32* %hy.addr, align 4
  %90 = icmp slt i32 %89, 0
  br i1 %90, label %cond.true.4, label %cond.false.4

cond.true.4:
  %91 = load double, double* %pi.addr, align 8
  %92 = fneg double %91
  br label %cond.end.4

cond.false.4:
  %93 = load double, double* %pi.addr, align 8
  br label %cond.end.4

cond.end.4:
  %94 = phi double [ %92, %cond.true.4 ], [ %93, %cond.false.4 ]
  ret double %94

if.end.9:
  %95 = fdiv double %y, %x
  store double %95, double* %q.addr, align 8
  %96 = load double, double* %q.addr, align 8
  ret double %96

if.end.8:
  %97 = call double @llvm.fabs.f64(double %y)
  store double %97, double* %a.addr, align 8
  %98 = call double @llvm.fabs.f64(double %x)
  store double %98, double* %b.addr, align 8
  %99 = load i32, i32* %ix.addr, align 4
  %100 = icmp slt i32 %99, 600834048
  br i1 %100, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %101 = load i32, i32* %ix.addr, align 4
  %102 = icmp sgt i32 %101, 1544552448
  br label %lor.end.1

lor.end.1:
  %103 = phi i1 [ true, %if.end.8 ], [ %102, %lor.rhs.1 ]
  br i1 %103, label %if.then.10, label %if.end.10

if.then.10:
  %104 = load i32, i32* %ix.addr, align 4
  %105 = ashr i32 %104, 20
  %106 = sub nsw i32 %105, 1023
  %107 = sub nsw i32 0, %106
  %108 = ashr i32 %107, 1
  store i32 %108, i32* %h1.addr, align 4
  %109 = load i32, i32* %h1.addr, align 4
  %110 = call double @nish.pow2(i32 %109)
  %111 = sext i32 2046 to i64
  %112 = load i32, i32* %ix.addr, align 4
  %113 = ashr i32 %112, 20
  %114 = sext i32 %113 to i64
  %115 = sub nsw i64 %111, %114
  %116 = load i32, i32* %h1.addr, align 4
  %117 = sext i32 %116 to i64
  %118 = sub nsw i64 %115, %117
  %119 = call double @nish.exp2Bits(i64 %118)
  %120 = fmul double %110, %119
  store double %120, double* %s.addr, align 8
  %121 = load double, double* %a.addr, align 8
  %122 = load double, double* %s.addr, align 8
  %123 = fmul double %121, %122
  store double %123, double* %a.addr, align 8
  %124 = load double, double* %b.addr, align 8
  %125 = load double, double* %s.addr, align 8
  %126 = fmul double %124, %125
  store double %126, double* %b.addr, align 8
  br label %if.end.10

if.end.10:
  %127 = load double, double* %a.addr, align 8
  %128 = load double, double* %b.addr, align 8
  %129 = fdiv double %127, %128
  store double %129, double* %q.addr.1, align 8
  %130 = load double, double* %q.addr.1, align 8
  %131 = fmul double %130, 0x41A0000002000000
  store double %131, double* %qs.addr, align 8
  %132 = load double, double* %qs.addr, align 8
  %133 = load double, double* %qs.addr, align 8
  %134 = load double, double* %q.addr.1, align 8
  %135 = fsub double %133, %134
  %136 = fsub double %132, %135
  store double %136, double* %qh.addr, align 8
  %137 = load double, double* %q.addr.1, align 8
  %138 = load double, double* %qh.addr, align 8
  %139 = fsub double %137, %138
  store double %139, double* %ql.addr, align 8
  %140 = load double, double* %b.addr, align 8
  %141 = fmul double %140, 0x41A0000002000000
  store double %141, double* %bs.addr, align 8
  %142 = load double, double* %bs.addr, align 8
  %143 = load double, double* %bs.addr, align 8
  %144 = load double, double* %b.addr, align 8
  %145 = fsub double %143, %144
  %146 = fsub double %142, %145
  store double %146, double* %bh.addr, align 8
  %147 = load double, double* %b.addr, align 8
  %148 = load double, double* %bh.addr, align 8
  %149 = fsub double %147, %148
  store double %149, double* %bl.addr, align 8
  %150 = load double, double* %q.addr.1, align 8
  %151 = load double, double* %b.addr, align 8
  %152 = fmul double %150, %151
  store double %152, double* %p.addr, align 8
  %153 = load double, double* %qh.addr, align 8
  %154 = load double, double* %bh.addr, align 8
  %155 = fmul double %153, %154
  %156 = load double, double* %p.addr, align 8
  %157 = fsub double %155, %156
  %158 = load double, double* %qh.addr, align 8
  %159 = load double, double* %bl.addr, align 8
  %160 = fmul double %158, %159
  %161 = fadd double %157, %160
  %162 = load double, double* %ql.addr, align 8
  %163 = load double, double* %bh.addr, align 8
  %164 = fmul double %162, %163
  %165 = fadd double %161, %164
  %166 = load double, double* %ql.addr, align 8
  %167 = load double, double* %bl.addr, align 8
  %168 = fmul double %166, %167
  %169 = fadd double %165, %168
  store double %169, double* %pe.addr, align 8
  %170 = load double, double* %a.addr, align 8
  %171 = load double, double* %p.addr, align 8
  %172 = fsub double %170, %171
  %173 = load double, double* %pe.addr, align 8
  %174 = fsub double %172, %173
  %175 = load double, double* %b.addr, align 8
  %176 = load double, double* %a.addr, align 8
  %177 = load double, double* %q.addr.1, align 8
  %178 = fmul double %176, %177
  %179 = fadd double %175, %178
  %180 = fdiv double %174, %179
  store double %180, double* %c.addr, align 8
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  %181 = load double, double* %q.addr.1, align 8
  %182 = call i32 @nish.hiWord(double %181)
  store i32 %182, i32* %iq.addr, align 4
  %183 = load i32, i32* %iq.addr, align 4
  %184 = icmp sge i32 %183, 1141899264
  br i1 %184, label %if.then.11, label %if.else

if.then.11:
  %185 = call double @nish.atanhi(i32 3)
  store double %185, double* %hi.addr, align 8
  %186 = call double @nish.atanlo(i32 3)
  store double %186, double* %lo.addr, align 8
  br label %if.end.11

if.else:
  %187 = load i32, i32* %iq.addr, align 4
  %188 = icmp slt i32 %187, 1044381696
  br i1 %188, label %if.then.12, label %if.else.1

if.then.12:
  %189 = load double, double* %q.addr.1, align 8
  store double %189, double* %lo.addr, align 8
  br label %if.end.12

if.else.1:
  %190 = load double, double* %q.addr.1, align 8
  store double %190, double* %t.addr, align 8
  %191 = load double, double* %c.addr, align 8
  store double %191, double* %tl.addr, align 8
  %192 = load i32, i32* %iq.addr, align 4
  %193 = icmp sge i32 %192, 1071382528
  br i1 %193, label %if.then.13, label %if.end.13

if.then.13:
  store i32 3, i32* %id.addr, align 4
  %194 = load i32, i32* %iq.addr, align 4
  %195 = icmp slt i32 %194, 1072889856
  br i1 %195, label %if.then.14, label %if.else.2

if.then.14:
  %196 = load i32, i32* %iq.addr, align 4
  %197 = icmp slt i32 %196, 1072037888
  br i1 %197, label %if.then.15, label %if.else.3

if.then.15:
  store i32 0, i32* %id.addr, align 4
  %198 = load double, double* %q.addr.1, align 8
  %199 = fmul double 0x4000000000000000, %198
  %200 = fsub double %199, 0x3FF0000000000000
  %201 = load double, double* %q.addr.1, align 8
  %202 = fadd double %201, 0x4000000000000000
  %203 = fdiv double %200, %202
  store double %203, double* %t.addr, align 8
  br label %if.end.15

if.else.3:
  store i32 1, i32* %id.addr, align 4
  %204 = load double, double* %q.addr.1, align 8
  %205 = fsub double %204, 0x3FF0000000000000
  %206 = load double, double* %q.addr.1, align 8
  %207 = fadd double %206, 0x3FF0000000000000
  %208 = fdiv double %205, %207
  store double %208, double* %t.addr, align 8
  br label %if.end.15

if.end.15:
  br label %if.end.14

if.else.2:
  %209 = load i32, i32* %iq.addr, align 4
  %210 = icmp slt i32 %209, 1073971200
  br i1 %210, label %if.then.16, label %if.else.4

if.then.16:
  store i32 2, i32* %id.addr, align 4
  %211 = load double, double* %q.addr.1, align 8
  %212 = fsub double %211, 0x3FF8000000000000
  %213 = load double, double* %q.addr.1, align 8
  %214 = fmul double %213, 0x3FF8000000000000
  %215 = fadd double %214, 0x3FF0000000000000
  %216 = fdiv double %212, %215
  store double %216, double* %t.addr, align 8
  br label %if.end.16

if.else.4:
  %217 = fneg double 0x3FF0000000000000
  %218 = load double, double* %q.addr.1, align 8
  %219 = fdiv double %217, %218
  store double %219, double* %t.addr, align 8
  br label %if.end.16

if.end.16:
  br label %if.end.14

if.end.14:
  %220 = load i32, i32* %id.addr, align 4
  %221 = call double @nish.atanhi(i32 %220)
  store double %221, double* %hi.addr, align 8
  %222 = load i32, i32* %id.addr, align 4
  %223 = call double @nish.atanlo(i32 %222)
  %224 = load double, double* %c.addr, align 8
  %225 = fadd double %223, %224
  store double %225, double* %tl.addr, align 8
  br label %if.end.13

if.end.13:
  %226 = load double, double* %t.addr, align 8
  %227 = load double, double* %t.addr, align 8
  %228 = fmul double %226, %227
  store double %228, double* %z.addr, align 8
  %229 = load double, double* %z.addr, align 8
  %230 = load double, double* %z.addr, align 8
  %231 = fmul double %229, %230
  store double %231, double* %w.addr, align 8
  %232 = load double, double* %z.addr, align 8
  %233 = load double, double* %w.addr, align 8
  %234 = fmul double 0x3F90AD3AE322DA11, %233
  %235 = fadd double %234, 0x3FA97B4B24760DEB
  %236 = load double, double* %w.addr, align 8
  %237 = fmul double %235, %236
  %238 = fadd double %237, 0x3FB10D66A0D03D51
  %239 = load double, double* %w.addr, align 8
  %240 = fmul double %238, %239
  %241 = fadd double %240, 0x3FB745CDC54C206E
  %242 = load double, double* %w.addr, align 8
  %243 = fmul double %241, %242
  %244 = fadd double %243, 0x3FC24924920083FF
  %245 = load double, double* %w.addr, align 8
  %246 = fmul double %244, %245
  %247 = fadd double %246, 0x3FD555555555550D
  %248 = fmul double %232, %247
  store double %248, double* %s1.addr, align 8
  %249 = load double, double* %w.addr, align 8
  %250 = fneg double 0x3FA2B4442C6A6C2F
  %251 = load double, double* %w.addr, align 8
  %252 = fmul double %250, %251
  %253 = fsub double %252, 0x3FADDE2D52DEFD9A
  %254 = load double, double* %w.addr, align 8
  %255 = fmul double %253, %254
  %256 = fsub double %255, 0x3FB3B0F2AF749A6D
  %257 = load double, double* %w.addr, align 8
  %258 = fmul double %256, %257
  %259 = fsub double %258, 0x3FBC71C6FE231671
  %260 = load double, double* %w.addr, align 8
  %261 = fmul double %259, %260
  %262 = fsub double %261, 0x3FC999999998EBC4
  %263 = fmul double %249, %262
  store double %263, double* %s2.addr, align 8
  %264 = load double, double* %t.addr, align 8
  %265 = load double, double* %t.addr, align 8
  %266 = load double, double* %s1.addr, align 8
  %267 = load double, double* %s2.addr, align 8
  %268 = fadd double %266, %267
  %269 = fmul double %265, %268
  %270 = load double, double* %tl.addr, align 8
  %271 = fsub double %269, %270
  %272 = fsub double %264, %271
  store double %272, double* %lo.addr, align 8
  br label %if.end.12

if.end.12:
  br label %if.end.11

if.end.11:
  store double 0x0000000000000000, double* %r.addr.1, align 8
  %273 = load i32, i32* %hx.addr, align 4
  %274 = icmp sge i32 %273, 0
  br i1 %274, label %if.then.17, label %if.else.5

if.then.17:
  %275 = load double, double* %hi.addr, align 8
  %276 = load double, double* %lo.addr, align 8
  %277 = fadd double %275, %276
  store double %277, double* %r.addr.1, align 8
  br label %if.end.17

if.else.5:
  %278 = load double, double* %pi.addr, align 8
  %279 = load double, double* %hi.addr, align 8
  %280 = fsub double %278, %279
  store double %280, double* %s.addr.1, align 8
  %281 = load double, double* %s.addr.1, align 8
  %282 = load double, double* %piLo.addr, align 8
  %283 = load double, double* %lo.addr, align 8
  %284 = fsub double %282, %283
  %285 = load double, double* %pi.addr, align 8
  %286 = load double, double* %s.addr.1, align 8
  %287 = fsub double %285, %286
  %288 = load double, double* %hi.addr, align 8
  %289 = fsub double %287, %288
  %290 = fadd double %284, %289
  %291 = fadd double %281, %290
  store double %291, double* %r.addr.1, align 8
  br label %if.end.17

if.end.17:
  %292 = load i32, i32* %hy.addr, align 4
  %293 = icmp slt i32 %292, 0
  br i1 %293, label %cond.true.5, label %cond.false.5

cond.true.5:
  %294 = load double, double* %r.addr.1, align 8
  %295 = fneg double %294
  br label %cond.end.5

cond.false.5:
  %296 = load double, double* %r.addr.1, align 8
  br label %cond.end.5

cond.end.5:
  %297 = phi double [ %295, %cond.true.5 ], [ %296, %cond.false.5 ]
  ret double %297
}

attributes #0 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
