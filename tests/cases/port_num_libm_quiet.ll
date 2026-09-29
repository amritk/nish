declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare double @llvm.floor.f64(double) #2
declare double @llvm.fabs.f64(double) #2
declare i32 @llvm.smin.i32(i32, i32) #2
declare i32 @llvm.smax.i32(i32, i32) #2

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %down.addr = alloca double, align 8
  %size.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %a.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 7)
  store i32 %1, i32* %low.addr, align 4
  %2 = load i32, i32* %a.addr, align 4
  %3 = call i32 @llvm.smax.i32(i32 %2, i32 7)
  store i32 %3, i32* %high.addr, align 4
  %4 = fneg double 0x4004000000000000
  %5 = call double @llvm.floor.f64(double %4)
  store double %5, double* %down.addr, align 8
  %6 = fneg double 0x4004000000000000
  %7 = call double @llvm.fabs.f64(double %6)
  store double %7, double* %size.addr, align 8
  %8 = load i32, i32* %low.addr, align 4
  %9 = load i32, i32* %high.addr, align 4
  %10 = add nsw i32 %8, %9
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load double, double* %down.addr, align 8
  %13 = load double, double* %size.addr, align 8
  %14 = fadd double %12, %13
  %15 = call i8* @nish_str_from_f64(double %14)
  call void @nish_print(i8* %15)
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
