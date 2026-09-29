@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare double @llvm.floor.f64(double) #2
declare double @llvm.minnum.f64(double, double) #2
declare double @llvm.maxnum.f64(double, double) #2

define noundef i32 @nish_main() #0 {
entry:
  %nan.addr = alloca double, align 8
  %low.addr = alloca double, align 8
  %high.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fdiv double 0x0000000000000000, 0x0000000000000000
  store double %0, double* %nan.addr, align 8
  %1 = load double, double* %nan.addr, align 8
  %2 = call double @llvm.minnum.f64(double %1, double 0x3FF0000000000000)
  store double %2, double* %low.addr, align 8
  %3 = load double, double* %nan.addr, align 8
  %4 = call double @llvm.maxnum.f64(double 0x4000000000000000, double %3)
  store double %4, double* %high.addr, align 8
  %5 = fneg double 0x3FD999999999999A
  %6 = call double @llvm.floor.f64(double %5)
  %7 = fsub double %5, %6
  %8 = fcmp oge double %7, 0x3FE0000000000000
  %9 = fadd double %6, 0x3FF0000000000000
  %10 = select i1 %8, double %9, double %6
  store double %10, double* %r.addr, align 8
  %11 = load double, double* %low.addr, align 8
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load double, double* %high.addr, align 8
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load double, double* %r.addr, align 8
  %19 = fdiv double 0x3FF0000000000000, %18
  %20 = call i8* @nish_str_from_f64(double %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  call void @nish_print(i8* %21)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
