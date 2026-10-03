@.str.0 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"tests/link/caps_package/config.txt\00" }, align 8

declare noundef i32 @pkg_caps.configSize(i8* noundef nonnull noalias readonly align 8) #0
declare void @nish_free_arena() #1

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @pkg_caps.configSize(i8* bitcast ({ i64, [35 x i8] }* @.str.0 to i8*))
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
