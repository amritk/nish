declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare double @llvm.sqrt.f64(double) #1
declare double @llvm.fabs.f64(double) #1
declare i32 @llvm.ctlz.i32(i32, i1) #1

define noundef i32 @nish_main() #0 {
entry:
  %x.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %x.addr, align 8
  %0 = load double, double* %x.addr, align 8
  %1 = call double @nish.tanF64(double %0)
  %2 = call i8* @nish_str_from_f64(double %1)
  call void @nish_print(i8* %2)
  %3 = load double, double* %x.addr, align 8
  %4 = load double, double* %x.addr, align 8
  %5 = fneg double %4
  %6 = call double @nish.atan2F64(double %3, double %5)
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_print(i8* %7)
  %8 = load double, double* %x.addr, align 8
  %9 = load double, double* %x.addr, align 8
  %10 = call double @nish.hypotF64(double %8, double %9)
  %11 = call i8* @nish_str_from_f64(double %10)
  call void @nish_print(i8* %11)
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

define internal noundef double @nish.tanF64(double noundef %x) #2 {
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

define internal noundef double @nish.atanhi(i32 noundef %id) #1 {
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

define internal noundef double @nish.atanlo(i32 noundef %id) #1 {
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

define internal noundef double @nish.atan2F64(double noundef %y, double noundef %x) #1 {
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
  %109 = call double @nish.pow2(i32 %108)
  %110 = load i32, i32* %ix.addr, align 4
  %111 = ashr i32 %110, 20
  %112 = sub nsw i32 %111, 1024
  %113 = sub nsw i32 0, %112
  %114 = ashr i32 %113, 1
  %115 = call double @nish.pow2(i32 %114)
  %116 = fmul double %109, %115
  store double %116, double* %s.addr, align 8
  %117 = load double, double* %a.addr, align 8
  %118 = load double, double* %s.addr, align 8
  %119 = fmul double %117, %118
  store double %119, double* %a.addr, align 8
  %120 = load double, double* %b.addr, align 8
  %121 = load double, double* %s.addr, align 8
  %122 = fmul double %120, %121
  store double %122, double* %b.addr, align 8
  br label %if.end.10

if.end.10:
  %123 = load double, double* %a.addr, align 8
  %124 = load double, double* %b.addr, align 8
  %125 = fdiv double %123, %124
  store double %125, double* %q.addr.1, align 8
  %126 = load double, double* %q.addr.1, align 8
  %127 = fmul double %126, 0x41A0000002000000
  store double %127, double* %qs.addr, align 8
  %128 = load double, double* %qs.addr, align 8
  %129 = load double, double* %qs.addr, align 8
  %130 = load double, double* %q.addr.1, align 8
  %131 = fsub double %129, %130
  %132 = fsub double %128, %131
  store double %132, double* %qh.addr, align 8
  %133 = load double, double* %q.addr.1, align 8
  %134 = load double, double* %qh.addr, align 8
  %135 = fsub double %133, %134
  store double %135, double* %ql.addr, align 8
  %136 = load double, double* %b.addr, align 8
  %137 = fmul double %136, 0x41A0000002000000
  store double %137, double* %bs.addr, align 8
  %138 = load double, double* %bs.addr, align 8
  %139 = load double, double* %bs.addr, align 8
  %140 = load double, double* %b.addr, align 8
  %141 = fsub double %139, %140
  %142 = fsub double %138, %141
  store double %142, double* %bh.addr, align 8
  %143 = load double, double* %b.addr, align 8
  %144 = load double, double* %bh.addr, align 8
  %145 = fsub double %143, %144
  store double %145, double* %bl.addr, align 8
  %146 = load double, double* %q.addr.1, align 8
  %147 = load double, double* %b.addr, align 8
  %148 = fmul double %146, %147
  store double %148, double* %p.addr, align 8
  %149 = load double, double* %qh.addr, align 8
  %150 = load double, double* %bh.addr, align 8
  %151 = fmul double %149, %150
  %152 = load double, double* %p.addr, align 8
  %153 = fsub double %151, %152
  %154 = load double, double* %qh.addr, align 8
  %155 = load double, double* %bl.addr, align 8
  %156 = fmul double %154, %155
  %157 = fadd double %153, %156
  %158 = load double, double* %ql.addr, align 8
  %159 = load double, double* %bh.addr, align 8
  %160 = fmul double %158, %159
  %161 = fadd double %157, %160
  %162 = load double, double* %ql.addr, align 8
  %163 = load double, double* %bl.addr, align 8
  %164 = fmul double %162, %163
  %165 = fadd double %161, %164
  store double %165, double* %pe.addr, align 8
  %166 = load double, double* %a.addr, align 8
  %167 = load double, double* %p.addr, align 8
  %168 = fsub double %166, %167
  %169 = load double, double* %pe.addr, align 8
  %170 = fsub double %168, %169
  %171 = load double, double* %b.addr, align 8
  %172 = load double, double* %a.addr, align 8
  %173 = load double, double* %q.addr.1, align 8
  %174 = fmul double %172, %173
  %175 = fadd double %171, %174
  %176 = fdiv double %170, %175
  store double %176, double* %c.addr, align 8
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  %177 = load double, double* %q.addr.1, align 8
  %178 = call i32 @nish.hiWord(double %177)
  store i32 %178, i32* %iq.addr, align 4
  %179 = load i32, i32* %iq.addr, align 4
  %180 = icmp sge i32 %179, 1141899264
  br i1 %180, label %if.then.11, label %if.else

if.then.11:
  %181 = call double @nish.atanhi(i32 3)
  store double %181, double* %hi.addr, align 8
  %182 = call double @nish.atanlo(i32 3)
  store double %182, double* %lo.addr, align 8
  br label %if.end.11

if.else:
  %183 = load i32, i32* %iq.addr, align 4
  %184 = icmp slt i32 %183, 1044381696
  br i1 %184, label %if.then.12, label %if.else.1

if.then.12:
  %185 = load double, double* %q.addr.1, align 8
  store double %185, double* %lo.addr, align 8
  br label %if.end.12

if.else.1:
  %186 = load double, double* %q.addr.1, align 8
  store double %186, double* %t.addr, align 8
  %187 = load double, double* %c.addr, align 8
  store double %187, double* %tl.addr, align 8
  %188 = load i32, i32* %iq.addr, align 4
  %189 = icmp sge i32 %188, 1071382528
  br i1 %189, label %if.then.13, label %if.end.13

if.then.13:
  store i32 3, i32* %id.addr, align 4
  %190 = load i32, i32* %iq.addr, align 4
  %191 = icmp slt i32 %190, 1072889856
  br i1 %191, label %if.then.14, label %if.else.2

if.then.14:
  %192 = load i32, i32* %iq.addr, align 4
  %193 = icmp slt i32 %192, 1072037888
  br i1 %193, label %if.then.15, label %if.else.3

if.then.15:
  store i32 0, i32* %id.addr, align 4
  %194 = load double, double* %q.addr.1, align 8
  %195 = fmul double 0x4000000000000000, %194
  %196 = fsub double %195, 0x3FF0000000000000
  %197 = load double, double* %q.addr.1, align 8
  %198 = fadd double %197, 0x4000000000000000
  %199 = fdiv double %196, %198
  store double %199, double* %t.addr, align 8
  br label %if.end.15

if.else.3:
  store i32 1, i32* %id.addr, align 4
  %200 = load double, double* %q.addr.1, align 8
  %201 = fsub double %200, 0x3FF0000000000000
  %202 = load double, double* %q.addr.1, align 8
  %203 = fadd double %202, 0x3FF0000000000000
  %204 = fdiv double %201, %203
  store double %204, double* %t.addr, align 8
  br label %if.end.15

if.end.15:
  br label %if.end.14

if.else.2:
  %205 = load i32, i32* %iq.addr, align 4
  %206 = icmp slt i32 %205, 1073971200
  br i1 %206, label %if.then.16, label %if.else.4

if.then.16:
  store i32 2, i32* %id.addr, align 4
  %207 = load double, double* %q.addr.1, align 8
  %208 = fsub double %207, 0x3FF8000000000000
  %209 = load double, double* %q.addr.1, align 8
  %210 = fmul double %209, 0x3FF8000000000000
  %211 = fadd double %210, 0x3FF0000000000000
  %212 = fdiv double %208, %211
  store double %212, double* %t.addr, align 8
  br label %if.end.16

if.else.4:
  %213 = fneg double 0x3FF0000000000000
  %214 = load double, double* %q.addr.1, align 8
  %215 = fdiv double %213, %214
  store double %215, double* %t.addr, align 8
  br label %if.end.16

if.end.16:
  br label %if.end.14

if.end.14:
  %216 = load i32, i32* %id.addr, align 4
  %217 = call double @nish.atanhi(i32 %216)
  store double %217, double* %hi.addr, align 8
  %218 = load i32, i32* %id.addr, align 4
  %219 = call double @nish.atanlo(i32 %218)
  %220 = load double, double* %c.addr, align 8
  %221 = fadd double %219, %220
  store double %221, double* %tl.addr, align 8
  br label %if.end.13

if.end.13:
  %222 = load double, double* %t.addr, align 8
  %223 = load double, double* %t.addr, align 8
  %224 = fmul double %222, %223
  store double %224, double* %z.addr, align 8
  %225 = load double, double* %z.addr, align 8
  %226 = load double, double* %z.addr, align 8
  %227 = fmul double %225, %226
  store double %227, double* %w.addr, align 8
  %228 = load double, double* %z.addr, align 8
  %229 = load double, double* %w.addr, align 8
  %230 = fmul double 0x3F90AD3AE322DA11, %229
  %231 = fadd double %230, 0x3FA97B4B24760DEB
  %232 = load double, double* %w.addr, align 8
  %233 = fmul double %231, %232
  %234 = fadd double %233, 0x3FB10D66A0D03D51
  %235 = load double, double* %w.addr, align 8
  %236 = fmul double %234, %235
  %237 = fadd double %236, 0x3FB745CDC54C206E
  %238 = load double, double* %w.addr, align 8
  %239 = fmul double %237, %238
  %240 = fadd double %239, 0x3FC24924920083FF
  %241 = load double, double* %w.addr, align 8
  %242 = fmul double %240, %241
  %243 = fadd double %242, 0x3FD555555555550D
  %244 = fmul double %228, %243
  store double %244, double* %s1.addr, align 8
  %245 = load double, double* %w.addr, align 8
  %246 = fneg double 0x3FA2B4442C6A6C2F
  %247 = load double, double* %w.addr, align 8
  %248 = fmul double %246, %247
  %249 = fsub double %248, 0x3FADDE2D52DEFD9A
  %250 = load double, double* %w.addr, align 8
  %251 = fmul double %249, %250
  %252 = fsub double %251, 0x3FB3B0F2AF749A6D
  %253 = load double, double* %w.addr, align 8
  %254 = fmul double %252, %253
  %255 = fsub double %254, 0x3FBC71C6FE231671
  %256 = load double, double* %w.addr, align 8
  %257 = fmul double %255, %256
  %258 = fsub double %257, 0x3FC999999998EBC4
  %259 = fmul double %245, %258
  store double %259, double* %s2.addr, align 8
  %260 = load double, double* %t.addr, align 8
  %261 = load double, double* %t.addr, align 8
  %262 = load double, double* %s1.addr, align 8
  %263 = load double, double* %s2.addr, align 8
  %264 = fadd double %262, %263
  %265 = fmul double %261, %264
  %266 = load double, double* %tl.addr, align 8
  %267 = fsub double %265, %266
  %268 = fsub double %260, %267
  store double %268, double* %lo.addr, align 8
  br label %if.end.12

if.end.12:
  br label %if.end.11

if.end.11:
  store double 0x0000000000000000, double* %r.addr.1, align 8
  %269 = load i32, i32* %hx.addr, align 4
  %270 = icmp sge i32 %269, 0
  br i1 %270, label %if.then.17, label %if.else.5

if.then.17:
  %271 = load double, double* %hi.addr, align 8
  %272 = load double, double* %lo.addr, align 8
  %273 = fadd double %271, %272
  store double %273, double* %r.addr.1, align 8
  br label %if.end.17

if.else.5:
  %274 = load double, double* %pi.addr, align 8
  %275 = load double, double* %hi.addr, align 8
  %276 = fsub double %274, %275
  store double %276, double* %s.addr.1, align 8
  %277 = load double, double* %s.addr.1, align 8
  %278 = load double, double* %piLo.addr, align 8
  %279 = load double, double* %lo.addr, align 8
  %280 = fsub double %278, %279
  %281 = load double, double* %pi.addr, align 8
  %282 = load double, double* %s.addr.1, align 8
  %283 = fsub double %281, %282
  %284 = load double, double* %hi.addr, align 8
  %285 = fsub double %283, %284
  %286 = fadd double %280, %285
  %287 = fadd double %277, %286
  store double %287, double* %r.addr.1, align 8
  br label %if.end.17

if.end.17:
  %288 = load i32, i32* %hy.addr, align 4
  %289 = icmp slt i32 %288, 0
  br i1 %289, label %cond.true.5, label %cond.false.5

cond.true.5:
  %290 = load double, double* %r.addr.1, align 8
  %291 = fneg double %290
  br label %cond.end.5

cond.false.5:
  %292 = load double, double* %r.addr.1, align 8
  br label %cond.end.5

cond.end.5:
  %293 = phi double [ %291, %cond.true.5 ], [ %292, %cond.false.5 ]
  ret double %293
}

define internal noundef double @nish.hypotCoreF(double noundef %a, double noundef %b) #1 {
entry:
  %w.addr = alloca double, align 8
  %t1.addr = alloca double, align 8
  %t2.addr = alloca double, align 8
  %a2.addr = alloca double, align 8
  %y1.addr = alloca double, align 8
  %y2.addr = alloca double, align 8
  %t1.addr.1 = alloca double, align 8
  %t2.addr.1 = alloca double, align 8
  %0 = fsub double %a, %b
  store double %0, double* %w.addr, align 8
  %1 = load double, double* %w.addr, align 8
  %2 = fcmp ogt double %1, %b
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = call double @nish.clearLo(double %a)
  store double %3, double* %t1.addr, align 8
  %4 = load double, double* %t1.addr, align 8
  %5 = fsub double %a, %4
  store double %5, double* %t2.addr, align 8
  %6 = load double, double* %t1.addr, align 8
  %7 = load double, double* %t1.addr, align 8
  %8 = fmul double %6, %7
  %9 = fneg double %b
  %10 = fmul double %b, %9
  %11 = load double, double* %t2.addr, align 8
  %12 = load double, double* %t1.addr, align 8
  %13 = fadd double %a, %12
  %14 = fmul double %11, %13
  %15 = fsub double %10, %14
  %16 = fsub double %8, %15
  %17 = call double @llvm.sqrt.f64(double %16)
  ret double %17

if.end:
  %18 = fadd double %a, %a
  store double %18, double* %a2.addr, align 8
  %19 = call double @nish.clearLo(double %b)
  store double %19, double* %y1.addr, align 8
  %20 = load double, double* %y1.addr, align 8
  %21 = fsub double %b, %20
  store double %21, double* %y2.addr, align 8
  %22 = load double, double* %a2.addr, align 8
  %23 = call double @nish.clearLo(double %22)
  store double %23, double* %t1.addr.1, align 8
  %24 = load double, double* %a2.addr, align 8
  %25 = load double, double* %t1.addr.1, align 8
  %26 = fsub double %24, %25
  store double %26, double* %t2.addr.1, align 8
  %27 = load double, double* %t1.addr.1, align 8
  %28 = load double, double* %y1.addr, align 8
  %29 = fmul double %27, %28
  %30 = load double, double* %w.addr, align 8
  %31 = load double, double* %w.addr, align 8
  %32 = fneg double %31
  %33 = fmul double %30, %32
  %34 = load double, double* %t1.addr.1, align 8
  %35 = load double, double* %y2.addr, align 8
  %36 = fmul double %34, %35
  %37 = load double, double* %t2.addr.1, align 8
  %38 = fmul double %37, %b
  %39 = fadd double %36, %38
  %40 = fsub double %33, %39
  %41 = fsub double %29, %40
  %42 = call double @llvm.sqrt.f64(double %41)
  ret double %42
}

define internal noundef double @nish.hypotRest(double noundef %ax, double noundef %ay, double noundef %a, double noundef %b) #1 {
entry:
  %one.addr = alloca double, align 8
  %inf.addr = alloca double, align 8
  %down.addr = alloca double, align 8
  %up.addr = alloca double, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = fdiv double %0, 0x0000000000000000
  store double %1, double* %inf.addr, align 8
  %2 = load double, double* %inf.addr, align 8
  %3 = fcmp oeq double %ax, %2
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = load double, double* %inf.addr, align 8
  %5 = fcmp oeq double %ay, %4
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = load double, double* %inf.addr, align 8
  ret double %7

if.end:
  %8 = call i1 @nish.isNan(double %a)
  br i1 %8, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %9 = call i1 @nish.isNan(double %b)
  br label %lor.end.1

lor.end.1:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs.1 ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = fadd double %ax, %ay
  ret double %11

if.end.1:
  %12 = fcmp oeq double %b, 0x0000000000000000
  br i1 %12, label %if.then.2, label %if.end.2

if.then.2:
  ret double %a

if.end.2:
  %13 = fcmp ogt double %a, 0x3FF0000000000000
  br i1 %13, label %if.then.3, label %if.end.3

if.then.3:
  %14 = call double @nish.pow2(i32 -600)
  store double %14, double* %down.addr, align 8
  %15 = call double @nish.pow2(i32 600)
  %16 = load double, double* %down.addr, align 8
  %17 = fmul double %a, %16
  %18 = load double, double* %down.addr, align 8
  %19 = fmul double %b, %18
  %20 = call double @nish.hypotCoreF(double %17, double %19)
  %21 = fmul double %15, %20
  ret double %21

if.end.3:
  %22 = call double @nish.pow2(i32 600)
  store double %22, double* %up.addr, align 8
  %23 = call double @nish.pow2(i32 -600)
  %24 = load double, double* %up.addr, align 8
  %25 = fmul double %a, %24
  %26 = load double, double* %up.addr, align 8
  %27 = fmul double %b, %26
  %28 = call double @nish.hypotCoreF(double %25, double %27)
  %29 = fmul double %23, %28
  ret double %29
}

define internal noundef double @nish.hypotF64(double noundef %x, double noundef %y) #1 {
entry:
  %ax.addr = alloca double, align 8
  %ay.addr = alloca double, align 8
  %a.addr = alloca double, align 8
  %b.addr = alloca double, align 8
  %0 = call double @llvm.fabs.f64(double %x)
  store double %0, double* %ax.addr, align 8
  %1 = call double @llvm.fabs.f64(double %y)
  store double %1, double* %ay.addr, align 8
  %2 = load double, double* %ax.addr, align 8
  %3 = load double, double* %ay.addr, align 8
  %4 = fcmp ogt double %2, %3
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load double, double* %ax.addr, align 8
  br label %cond.end

cond.false:
  %6 = load double, double* %ay.addr, align 8
  br label %cond.end

cond.end:
  %7 = phi double [ %5, %cond.true ], [ %6, %cond.false ]
  store double %7, double* %a.addr, align 8
  %8 = load double, double* %ax.addr, align 8
  %9 = load double, double* %ay.addr, align 8
  %10 = fcmp ogt double %8, %9
  br i1 %10, label %cond.true.1, label %cond.false.1

cond.true.1:
  %11 = load double, double* %ay.addr, align 8
  br label %cond.end.1

cond.false.1:
  %12 = load double, double* %ax.addr, align 8
  br label %cond.end.1

cond.end.1:
  %13 = phi double [ %11, %cond.true.1 ], [ %12, %cond.false.1 ]
  store double %13, double* %b.addr, align 8
  %14 = load double, double* %a.addr, align 8
  %15 = fcmp olt double %14, 0x5F138D352E5096AF
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load double, double* %a.addr, align 8
  %17 = fcmp ogt double %16, 0x20CA2FE76A3F9475
  br label %land.end

land.end:
  %18 = phi i1 [ false, %cond.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load double, double* %b.addr, align 8
  %20 = fcmp oeq double %19, 0x0000000000000000
  br i1 %20, label %cond.true.2, label %cond.false.2

cond.true.2:
  %21 = load double, double* %a.addr, align 8
  br label %cond.end.2

cond.false.2:
  %22 = load double, double* %a.addr, align 8
  %23 = load double, double* %b.addr, align 8
  %24 = call double @nish.hypotCoreF(double %22, double %23)
  br label %cond.end.2

cond.end.2:
  %25 = phi double [ %21, %cond.true.2 ], [ %24, %cond.false.2 ]
  ret double %25

if.end:
  %26 = load double, double* %ax.addr, align 8
  %27 = load double, double* %ay.addr, align 8
  %28 = load double, double* %a.addr, align 8
  %29 = load double, double* %b.addr, align 8
  %30 = tail call double @nish.hypotRest(double %26, double %27, double %28, double %29)
  ret double %30
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
