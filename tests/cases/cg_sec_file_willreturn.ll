@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define void @save(i8* noundef nonnull noalias readonly align 8 nocapture %path, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  call void @nish_write_file(i8* %path, i8* %text)
  call void @nish_append_file(i8* %path, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  ret void
}

define noundef i32 @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_read_file(i8* %path)
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3
}

define noundef i32 @bump(i32 noundef %x) #1 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
