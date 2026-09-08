@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8

declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef nonnull align 8 i8* @greeting() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

define noundef i32 @test() #1 {
entry:
  %0 = call i8* @greeting()
  call void @amrit_print(i8* %0)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
