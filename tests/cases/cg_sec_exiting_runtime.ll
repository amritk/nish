@.str.0 = private unnamed_addr constant { i64, [38 x i8] } { i64 37, [38 x i8] c"build/test/cg_sec_exiting_runtime.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"world\0A\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define internal noundef nonnull align 8 i8* @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %0 = call i8* @nish_read_file(i8* %path)
  ret i8* %0
}

define internal void @save(i8* noundef nonnull noalias readonly align 8 nocapture %path, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  call void @nish_write_file(i8* %path, i8* %text)
  ret void
}

define internal void @extend(i8* noundef nonnull noalias readonly align 8 nocapture %path, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  call void @nish_append_file(i8* %path, i8* %text)
  ret void
}

define internal noundef nonnull align 8 i8* @glue(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* %a, i8* %b)
  ret i8* %0
}

define noundef i32 @test() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [38 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @glue(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  call void @save(i8* %0, i8* %3)
  %4 = load i8*, i8** %path.addr, align 8
  call void @extend(i8* %4, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  %5 = load i8*, i8** %path.addr, align 8
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @load(i8* %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  store i8* %8, i8** %text.addr, align 8
  %9 = load i8*, i8** %text.addr, align 8
  call void @nish_print(i8* %9)
  %10 = load i8*, i8** %text.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
