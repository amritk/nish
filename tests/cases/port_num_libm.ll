@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare double @llvm.floor.f64(double) #2
declare double @llvm.minnum.f64(double, double) #2
declare double @llvm.maxnum.f64(double, double) #2

define noundef i32 @nish_main() #0 {
entry:
  %one.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %low.addr = alloca double, align 8
  %high.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = fdiv double 0x0000000000000000, 0x0000000000000000
  store double %0, double* %nan.addr, align 8
  %1 = load double, double* %nan.addr, align 8
  %2 = load double, double* %one.addr, align 8
  %3 = call double @llvm.minnum.f64(double %1, double %2)
  store double %3, double* %low.addr, align 8
  %4 = load double, double* %one.addr, align 8
  %5 = load double, double* %one.addr, align 8
  %6 = fadd double %4, %5
  %7 = load double, double* %nan.addr, align 8
  %8 = call double @llvm.maxnum.f64(double %6, double %7)
  store double %8, double* %high.addr, align 8
  %9 = fneg double 0x4010000000000000
  %10 = fdiv double %9, 0x4024000000000000
  %11 = call double @llvm.floor.f64(double %10)
  %12 = fsub double %10, %11
  %13 = fcmp oge double %12, 0x3FE0000000000000
  %14 = fadd double %11, 0x3FF0000000000000
  %15 = select i1 %13, double %14, double %11
  store double %15, double* %r.addr, align 8
  %16 = load double, double* %low.addr, align 8
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = load double, double* %high.addr, align 8
  %20 = call i8* @nish_str_from_f64(double %19)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = load double, double* %one.addr, align 8
  %24 = load double, double* %r.addr, align 8
  %25 = fdiv double %23, %24
  %26 = call i8* @nish_str_from_f64(double %25)
  %27 = call i8* @nish_str_concat(i8* %22, i8* %26)
  call void @nish_print(i8* %27)
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
attributes #2 = { nounwind willreturn readnone }
