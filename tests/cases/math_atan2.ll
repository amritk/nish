@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @atan2(double, double) #0

define noundef double @angle(double noundef %y, double noundef %x) #0 {
entry:
  %0 = call double @atan2(double %y, double %x)
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %one.addr = alloca double, align 8
  %zero.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %one.addr, align 8
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = load double, double* %one.addr, align 8
  %2 = call double @angle(double %0, double %1)
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load double, double* %one.addr, align 8
  %6 = load double, double* %zero.addr, align 8
  %7 = call double @angle(double %5, double %6)
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %4, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load double, double* %zero.addr, align 8
  %12 = load double, double* %one.addr, align 8
  %13 = fneg double %12
  %14 = call double @angle(double %11, double %13)
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %10, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load double, double* %zero.addr, align 8
  %19 = fneg double %18
  %20 = load double, double* %one.addr, align 8
  %21 = fneg double %20
  %22 = call double @angle(double %19, double %21)
  %23 = call i8* @nish_str_from_f64(double %22)
  %24 = call i8* @nish_str_concat(i8* %17, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load double, double* %one.addr, align 8
  %26 = load double, double* %zero.addr, align 8
  %27 = fneg double %26
  %28 = load double, double* %one.addr, align 8
  %29 = call double @angle(double %27, double %28)
  %30 = fdiv double %25, %29
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load double, double* %zero.addr, align 8
  %34 = load double, double* %zero.addr, align 8
  %35 = call double @angle(double %33, double %34)
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %32, i8* %36)
  call void @nish_print(i8* %37)
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
