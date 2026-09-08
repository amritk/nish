@.str.0 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"build/test/io_files.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"hello\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"world\0A\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @amrit_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i8* bitcast ({ i64, [24 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  call void @amrit_write_file(i8* %0, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  %1 = load i8*, i8** %path.addr, align 8
  call void @amrit_append_file(i8* %1, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %2 = load i8*, i8** %path.addr, align 8
  %3 = call i8* @amrit_read_file(i8* %2)
  store i8* %3, i8** %text.addr, align 8
  %4 = load i8*, i8** %text.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = call i8* @amrit_str_from_i32(i32 %7)
  call void @amrit_print(i8* %8)
  %9 = load i8*, i8** %text.addr, align 8
  call void @amrit_print(i8* %9)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
