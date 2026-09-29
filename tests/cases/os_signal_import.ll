@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"ready\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_signal_fd() #1
declare noundef i32 @nish_read_signal(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %fd.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_signal_fd()
  store i32 %0, i32* %fd.addr, align 4
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %1 = load i32, i32* %fd.addr, align 4
  %2 = call i32 @nish_read_signal(i32 %1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load i32, i32* %fd.addr, align 4
  %5 = call i32 @nish_read_signal(i32 %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
