@.str.0 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"build/test/caps_fs_write.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"written\0A\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define internal void @save(i8* noundef nonnull noalias readonly align 8 nocapture %path, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  call void @nish_write_file(i8* %path, i8* %text)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [29 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  call void @save(i8* %0, i8* bitcast ({ i64, [9 x i8] }* @.str.1 to i8*))
  %1 = load i8*, i8** %path.addr, align 8
  %2 = call i8* @nish_read_file(i8* %1)
  call void @nish_print(i8* %2)
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
