@.str.0 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"NISH_CAPS_NAMED_NISH\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish.three() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_getenv(i8* bitcast ({ i64, [21 x i8] }* @.str.0 to i8*))
  %1 = icmp eq i8* %0, null
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 3, %cond.true ], [ 3, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

attributes #0 = { nounwind willreturn }
