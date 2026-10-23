@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @hypot(double, double) #0

define noundef double @hyp(double noundef %a, double noundef %b) #0 {
entry:
  %0 = call double @hypot(double %a, double %b)
  ret double %0
}

define noundef i32 @nish_main() #1 {
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
