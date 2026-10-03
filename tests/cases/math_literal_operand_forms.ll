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
  %22 = mul nsw i64 -1, %21
  %23 = call i8* @nish_str_from_i64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load i64, i64* %big.addr, align 8
  %26 = add nsw i64 -1, %25
  %27 = call i8* @nish_str_from_i64(i64 %26)
  %28 = call i8* @nish_str_concat(i8* %24, i8* %27)
  call void @nish_print(i8* %28)
  %29 = fneg double 0x3FF0000000000000
  %30 = load double, double* %z.addr, align 8
  %31 = fcmp olt double %29, %30
  %32 = select i1 %31, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %34 = fneg double 0x3FF0000000000000
  %35 = load double, double* %z.addr, align 8
  %36 = fcmp oeq double %34, %35
  %37 = select i1 %36, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %38 = call i8* @nish_str_concat(i8* %33, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = fneg double 0x4000000000000000
  %41 = load double, double* %z.addr, align 8
  %42 = fcmp oge double %40, %41
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  call void @nish_print(i8* %44)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
