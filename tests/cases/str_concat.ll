@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"foo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bar\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef nonnull align 8 i8* @join(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @amrit_str_concat(i8* %a, i8* %b)
  ret i8* %0
}

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i8* @join(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %1 = call i8* @amrit_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  call void @amrit_print(i8* %2)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
