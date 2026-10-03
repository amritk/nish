@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"<unset>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"NISH_CAPS_SETTING\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noundef nonnull align 8 i8* @setting(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %value.addr = alloca i8*, align 8
  %0 = call i8* @nish_getenv(i8* %name)
  store i8* %0, i8** %value.addr, align 8
  %1 = load i8*, i8** %value.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %value.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi i8* [ bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), %cond.true ], [ %3, %cond.false ]
  ret i8* %4
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @setting(i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish_print(i8* %2)
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
