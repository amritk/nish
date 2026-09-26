@.str.0 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"run as a script\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [16 x i8] }* @.str.0 to i8*))
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
