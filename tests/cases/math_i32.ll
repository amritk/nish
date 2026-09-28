declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare i32 @llvm.abs.i32(i32, i1) #0
declare i32 @llvm.smin.i32(i32, i32) #0
declare i32 @llvm.smax.i32(i32, i32) #0

define internal noundef i32 @clamp(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = call i32 @llvm.smax.i32(i32 %x, i32 %lo)
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 %hi)
  ret i32 %1
}

define noundef i32 @test() #1 {
entry:
  %tau.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @llvm.abs.i32(i32 -7, i1 false)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = sub nsw i32 3, 10
  %3 = call i32 @llvm.abs.i32(i32 %2, i1 false)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = call i32 @clamp(i32 15, i32 0, i32 10)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = call i32 @clamp(i32 -3, i32 0, i32 10)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = call i32 @llvm.smax.i32(i32 3, i32 9)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = fmul double 0x400921FB54442D18, 0x4000000000000000
  store double %11, double* %tau.addr, align 8
  %12 = load double, double* %tau.addr, align 8
  %13 = call i8* @nish_str_from_f64(double %12)
  call void @nish_print(i8* %13)
  call void @nish_arena_release(i64 %arena.mark)
  %14 = tail call i32 @clamp(i32 5, i32 0, i32 10)
  ret i32 %14
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
