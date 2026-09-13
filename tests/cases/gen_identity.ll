@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @identity$i32(i32 7)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @identity$str(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @identity$i32(i32 noundef %x) #1 {
entry:
  ret i32 %x
}

define internal noundef nonnull align 8 i8* @identity$str(i8* noundef nonnull noalias readonly align 8 %x) #1 {
entry:
  ret i8* %x
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
