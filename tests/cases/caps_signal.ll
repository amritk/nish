@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_signal_fd() #0

define internal noundef i32 @listen() #0 {
entry:
  %0 = call i32 @nish_signal_fd()
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @listen()
  %1 = icmp sge i32 %0, 0
  %2 = select i1 %1, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %2)
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
