@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noundef nonnull align 8 i8* @tag(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @shout(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  ret i8* %0
}

define internal noundef nonnull align 8 i8* @twice(i32 noundef %i) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @tag(i32 %i)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @shout(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5
}

define noundef i32 @nish_main() #0 {
entry:
  %held.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @tag(i32 7)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %held.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @twice(i32 1)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %held.addr, align 8
  call void @nish_print(i8* %6)
  call void @nish_arena_release(i64 %arena.mark)
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
