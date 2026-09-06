@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c": n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c", ok=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"answer\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"solo\00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1

define noundef nonnull align 8 i8* @describe(i32 noundef %n, i1 noundef zeroext %ok, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* %name, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @sts_str_from_i32(i32 %n)
  %2 = call i8* @sts_str_concat(i8* %0, i8* %1)
  %3 = call i8* @sts_str_concat(i8* %2, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %4 = select i1 %ok, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %5 = call i8* @sts_str_concat(i8* %3, i8* %4)
  %6 = call i8* @sts_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  ret i8* %6
}

define noundef i32 @test() #0 {
entry:
  %0 = call i8* @describe(i32 42, i1 true, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  call void @sts_print(i8* %0)
  call void @sts_print(i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*))
  %1 = add i32 1, 2
  %2 = call i8* @sts_str_from_i32(i32 %1)
  call void @sts_print(i8* %2)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
