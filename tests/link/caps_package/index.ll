declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noundef nonnull align 8 i8* @pkg_caps.read(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %0 = call i8* @nish_read_file(i8* %path)
  ret i8* %0
}

define noundef i32 @pkg_caps.configSize(i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @pkg_caps.read(i8* %path)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %5
}

attributes #0 = { nounwind willreturn }
