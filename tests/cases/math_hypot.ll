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
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define noundef double @hyp(double noundef %a, double noundef %b) #0 {
entry:
  %0 = tail call double @nish.hypot(double %a, double %b)
  ret double %0
}

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca double, align 8
  %inf.addr = alloca double, align 8
  %big.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %zero.addr, align 8
  %1 = fdiv double 0x3FF0000000000000, %0
  store double %1, double* %inf.addr, align 8
  store double 0x7E51EB2D66005835, double* %big.addr, align 8
  %2 = call double @hyp(double 0x4008000000000000, double 0x4010000000000000)
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = fneg double 0x4014000000000000
  %6 = call double @hyp(double %5, double 0x4028000000000000)
  %7 = call i8* @nish_str_from_f64(double %6)
  %8 = call i8* @nish_str_concat(i8* %4, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load double, double* %zero.addr, align 8
  %11 = load double, double* %zero.addr, align 8
  %12 = fneg double %11
  %13 = call double @hyp(double %10, double %12)
  %14 = call i8* @nish_str_from_f64(double %13)
  %15 = call i8* @nish_str_concat(i8* %9, i8* %14)
  call void @nish_print(i8* %15)
  %16 = load double, double* %big.addr, align 8
  %17 = call double @hyp(double %16, double 0x7E57E43C8800759C)
  %18 = call i8* @nish_str_from_f64(double %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = load double, double* %zero.addr, align 8
  %21 = load double, double* %zero.addr, align 8
  %22 = fdiv double %20, %21
  %23 = load double, double* %inf.addr, align 8
  %24 = call double @hyp(double %22, double %23)
  %25 = call i8* @nish_str_from_f64(double %24)
  %26 = call i8* @nish_str_concat(i8* %19, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load double, double* %inf.addr, align 8
  %29 = fneg double %28
  %30 = call double @hyp(double %29, double 0x3FF0000000000000)
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %27, i8* %31)
  call void @nish_print(i8* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
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

define internal noundef double @nish.hypotRest(double noundef %ax, double noundef %ay, double noundef %a, double noundef %b) #0 {
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

define internal noundef double @nish.hypot(double noundef %x, double noundef %y) #0 {
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
  %19 = load double, double* %a.addr, align 8
  %20 = load double, double* %b.addr, align 8
  %21 = tail call double @nish.hypotCoreF(double %19, double %20)
  ret double %21

if.end:
  %22 = load double, double* %ax.addr, align 8
  %23 = load double, double* %ay.addr, align 8
  %24 = load double, double* %a.addr, align 8
  %25 = load double, double* %b.addr, align 8
  %26 = tail call double @nish.hypotRest(double %22, double %23, double %24, double %25)
  ret double %26
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
