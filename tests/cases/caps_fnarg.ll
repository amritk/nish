@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"four\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"NISH_CAPS_FNARG\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef i32 @lengthOf(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @apply$fn.8.lengthOf(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @apply$fn.16.nish_main$arrow0(i8* bitcast ({ i64, [16 x i8] }* @.str.1 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @nish_main$arrow0(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %value.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_getenv(i8* %name)
  store i8* %0, i8** %value.addr, align 8
  %1 = load i8*, i8** %value.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %value.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  br label %cond.end

cond.end:
  %7 = phi i32 [ -1, %cond.true ], [ %6, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define noundef i32 @apply$fn.8.lengthOf(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = call i32 @lengthOf(i8* %s)
  ret i32 %0
}

define noundef i32 @apply$fn.16.nish_main$arrow0(i8* noundef nonnull noalias readonly align 8 %s) #1 {
entry:
  %0 = call i32 @nish_main$arrow0(i8* %s)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
