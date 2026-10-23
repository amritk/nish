@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @llvm.minimum.f64(double, double) #0
declare double @llvm.maximum.f64(double, double) #0

define noundef double @lo(double noundef %a, double noundef %b) #0 {
entry:
  %0 = call double @llvm.minimum.f64(double %a, double %b)
  ret double %0
}

define noundef double @hi(double noundef %a, double noundef %b) #0 {
entry:
  %0 = call double @llvm.maximum.f64(double %a, double %b)
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = load double, double* %zero.addr, align 8
  %1 = load double, double* %zero.addr, align 8
  %2 = fdiv double %0, %1
  store double %2, double* %nan.addr, align 8
  %3 = load double, double* %nan.addr, align 8
  %4 = load double, double* %one.addr, align 8
  %5 = call double @lo(double %3, double %4)
  %6 = call i8* @nish_str_from_f64(double %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load double, double* %one.addr, align 8
  %9 = load double, double* %nan.addr, align 8
  %10 = call double @lo(double %8, double %9)
  %11 = call i8* @nish_str_from_f64(double %10)
  %12 = call i8* @nish_str_concat(i8* %7, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load double, double* %nan.addr, align 8
  %15 = load double, double* %one.addr, align 8
  %16 = call double @hi(double %14, double %15)
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %13, i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = fneg double 0x7FE1CCF385EBC8A0
  %21 = load double, double* %nan.addr, align 8
  %22 = call double @hi(double %20, double %21)
  %23 = call i8* @nish_str_from_f64(double %22)
  %24 = call i8* @nish_str_concat(i8* %19, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load double, double* %one.addr, align 8
  %26 = load double, double* %zero.addr, align 8
  %27 = load double, double* %zero.addr, align 8
  %28 = fneg double %27
  %29 = call double @lo(double %26, double %28)
  %30 = fdiv double %25, %29
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load double, double* %one.addr, align 8
  %34 = load double, double* %zero.addr, align 8
  %35 = fneg double %34
  %36 = load double, double* %zero.addr, align 8
  %37 = call double @lo(double %35, double %36)
  %38 = fdiv double %33, %37
  %39 = call i8* @nish_str_from_f64(double %38)
  %40 = call i8* @nish_str_concat(i8* %32, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load double, double* %one.addr, align 8
  %43 = load double, double* %zero.addr, align 8
  %44 = fneg double %43
  %45 = load double, double* %zero.addr, align 8
  %46 = call double @hi(double %44, double %45)
  %47 = fdiv double %42, %46
  %48 = call i8* @nish_str_from_f64(double %47)
  %49 = call i8* @nish_str_concat(i8* %41, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %51 = load double, double* %one.addr, align 8
  %52 = load double, double* %zero.addr, align 8
  %53 = load double, double* %zero.addr, align 8
  %54 = fneg double %53
  %55 = call double @hi(double %52, double %54)
  %56 = fdiv double %51, %55
  %57 = call i8* @nish_str_from_f64(double %56)
  %58 = call i8* @nish_str_concat(i8* %50, i8* %57)
  call void @nish_print(i8* %58)
  %59 = fneg double 0x4008000000000000
  %60 = call double @lo(double 0x4000000000000000, double %59)
  %61 = call i8* @nish_str_from_f64(double %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = fneg double 0x4008000000000000
  %64 = call double @hi(double 0x4000000000000000, double %63)
  %65 = call i8* @nish_str_from_f64(double %64)
  %66 = call i8* @nish_str_concat(i8* %62, i8* %65)
  call void @nish_print(i8* %66)
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
