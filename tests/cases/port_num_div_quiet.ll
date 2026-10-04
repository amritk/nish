@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define internal noundef double @half(double noundef %n) #0 {
entry:
  %0 = fdiv double %n, 0x4000000000000000
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %ratio.addr = alloca double, align 8
  %scaled.addr = alloca double, align 8
  %left.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fdiv double 0x401C000000000000, 0x4000000000000000
  store double %0, double* %ratio.addr, align 8
  %1 = load double, double* %ratio.addr, align 8
  store double %1, double* %scaled.addr, align 8
  %2 = load double, double* %scaled.addr, align 8
  %3 = fdiv double %2, 0x4010000000000000
  store double %3, double* %scaled.addr, align 8
  %4 = call double @half(double 0x401C000000000000)
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  %6 = srem i32 %5, 4
  store i32 %6, i32* %left.addr, align 4
  %7 = call double @half(double 0x401C000000000000)
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load double, double* %scaled.addr, align 8
  %11 = call i8* @nish_str_from_f64(double %10)
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  call void @nish_print(i8* %12)
  %13 = load i32, i32* %left.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
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
