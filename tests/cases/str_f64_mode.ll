@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" and \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #1

define noundef double @len(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sitofp i64 %1 to double
  ret double %2
}

define noundef double @test() #1 {
entry:
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i8* @amrit_str_from_f64(double 0x3FF8000000000000)
  %1 = call i8* @amrit_str_concat(i8* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %2 = call double @len(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %3 = call i8* @amrit_str_from_f64(double %2)
  %4 = call i8* @amrit_str_concat(i8* %1, i8* %3)
  call void @amrit_print(i8* %4)
  %5 = call i8* @amrit_str_from_f64(double 0x3FD0000000000000)
  call void @amrit_print(i8* %5)
  %6 = call double @len(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  call void @amrit_arena_release(i64 %arena.mark)
  ret double %6
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
