@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @tan(double) #0
declare double @atan2(double, double) #0

define noundef double @tangent(double noundef %x) #0 {
entry:
  %0 = call double @tan(double %x)
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
  %2 = call double @atan2(double %0, double %1)
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

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
