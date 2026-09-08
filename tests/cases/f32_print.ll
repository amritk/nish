@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #0

define noundef i32 @test() #0 {
entry:
  %tenth.addr = alloca float, align 4
  %d.addr = alloca double, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store float 0x3FB99999A0000000, float* %tenth.addr, align 4
  store double 0x3FB999999999999A, double* %d.addr, align 8
  %0 = load float, float* %tenth.addr, align 4
  %1 = fpext float %0 to double
  %2 = call i8* @amrit_str_from_f64(double %1)
  call void @amrit_print(i8* %2)
  %3 = load float, float* %tenth.addr, align 4
  %4 = fpext float %3 to double
  %5 = call i8* @amrit_str_from_f64(double %4)
  %6 = call i8* @amrit_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load float, float* %tenth.addr, align 4
  %8 = load float, float* %tenth.addr, align 4
  %9 = fadd float %7, %8
  %10 = fpext float %9 to double
  %11 = call i8* @amrit_str_from_f64(double %10)
  %12 = call i8* @amrit_str_concat(i8* %6, i8* %11)
  %13 = call i8* @amrit_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load double, double* %d.addr, align 8
  %15 = call i8* @amrit_str_from_f64(double %14)
  %16 = call i8* @amrit_str_concat(i8* %13, i8* %15)
  call void @amrit_print(i8* %16)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
