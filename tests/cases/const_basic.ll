@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"limit\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %0 = select i1 true, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %0)
  ret i32 10
}

attributes #0 = { nounwind willreturn }
