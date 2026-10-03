@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"finishing\00" }, align 8

declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_exit(i32 noundef) #2

define internal void @finish(i32 noundef %code) #0 {
entry:
  call void @nish_exit(i32 %code)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*))
  call void @finish(i32 0)
  ret i32 1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
