@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  call void @nish_print(i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  ret i32 0
}

attributes #0 = { nounwind willreturn }
