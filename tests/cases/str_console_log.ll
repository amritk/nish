@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1

define noundef i32 @test() #0 {
entry:
  call void @sts_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %0 = call i8* @sts_str_from_i32(i32 7)
  call void @sts_print(i8* %0)
  %1 = sub i32 0, 3
  %2 = call i8* @sts_str_from_i32(i32 %1)
  call void @sts_print(i8* %2)
  %3 = select i1 false, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %3)
  %4 = icmp eq i32 1, 1
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %5)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
