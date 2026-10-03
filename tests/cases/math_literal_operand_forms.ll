@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #3
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #3

define noundef i32 @nish_main() #0 {
entry:
  %z.addr = alloca double, align 8
  %big.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x4000000000000000, double* %z.addr, align 8
  store i64 3000000000, i64* %big.addr, align 8
  %0 = fneg double 0x3FF0000000000000
  %1 = load double, double* %z.addr, align 8
  %2 = fdiv double %0, %1
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load double, double* %z.addr, align 8
  %6 = fdiv double 0x3FF0000000000000, %5
  %7 = call i8* @nish_str_from_f64(double %6)
  %8 = call i8* @nish_str_concat(i8* %4, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = fneg double 0x3FF0000000000000
  %11 = load double, double* %z.addr, align 8
  %12 = fmul double %10, %11
  %13 = call i8* @nish_str_from_f64(double %12)
  %14 = call i8* @nish_str_concat(i8* %9, i8* %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %16 = fneg double 0x3FF0000000000000
  %17 = load double, double* %z.addr, align 8
  %18 = fsub double %16, %17
  %19 = call i8* @nish_str_from_f64(double %18)
  %20 = call i8* @nish_str_concat(i8* %15, i8* %19)
  call void @nish_print(i8* %20)
  %21 = load i64, i64* %big.addr, align 8
  %22 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 -1, i64 %21)
  %23 = extractvalue { i64, i1 } %22, 0
  %24 = extractvalue { i64, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  %25 = call i8* @nish_str_from_i64(i64 %23)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = load i64, i64* %big.addr, align 8
  %28 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 -1, i64 %27)
  %29 = extractvalue { i64, i1 } %28, 0
  %30 = extractvalue { i64, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %31 = call i8* @nish_str_from_i64(i64 %29)
  %32 = call i8* @nish_str_concat(i8* %26, i8* %31)
  call void @nish_print(i8* %32)
  %33 = fneg double 0x3FF0000000000000
  %34 = load double, double* %z.addr, align 8
  %35 = fcmp olt double %33, %34
  %36 = select i1 %35, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = fneg double 0x3FF0000000000000
  %39 = load double, double* %z.addr, align 8
  %40 = fcmp oeq double %38, %39
  %41 = select i1 %40, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %42 = call i8* @nish_str_concat(i8* %37, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = fneg double 0x4000000000000000
  %45 = load double, double* %z.addr, align 8
  %46 = fcmp oge double %44, %45
  %47 = select i1 %46, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %48 = call i8* @nish_str_concat(i8* %43, i8* %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
