declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #1
declare i32 @llvm.abs.i32(i32, i1) #0
declare i32 @llvm.smin.i32(i32, i32) #0
declare i32 @llvm.smax.i32(i32, i32) #0

define noundef i32 @clamp(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = call i32 @llvm.smax.i32(i32 %x, i32 %lo)
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 %hi)
  ret i32 %1
}

define noundef i32 @test() #1 {
entry:
  %tau.addr = alloca double, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = sub i32 0, 7
  %1 = call i32 @llvm.abs.i32(i32 %0, i1 false)
  %2 = call i8* @amrit_str_from_i32(i32 %1)
  call void @amrit_print(i8* %2)
  %3 = sub i32 3, 10
  %4 = call i32 @llvm.abs.i32(i32 %3, i1 false)
  %5 = call i8* @amrit_str_from_i32(i32 %4)
  call void @amrit_print(i8* %5)
  %6 = call i32 @clamp(i32 15, i32 0, i32 10)
  %7 = call i8* @amrit_str_from_i32(i32 %6)
  call void @amrit_print(i8* %7)
  %8 = sub i32 0, 3
  %9 = call i32 @clamp(i32 %8, i32 0, i32 10)
  %10 = call i8* @amrit_str_from_i32(i32 %9)
  call void @amrit_print(i8* %10)
  %11 = call i32 @llvm.smax.i32(i32 3, i32 9)
  %12 = call i8* @amrit_str_from_i32(i32 %11)
  call void @amrit_print(i8* %12)
  %13 = fmul double 0x400921FB54442D18, 0x4000000000000000
  store double %13, double* %tau.addr, align 8
  %14 = load double, double* %tau.addr, align 8
  %15 = call i8* @amrit_str_from_f64(double %14)
  call void @amrit_print(i8* %15)
  %16 = call i32 @clamp(i32 5, i32 0, i32 10)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %16
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
