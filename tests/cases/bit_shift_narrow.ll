declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define noundef i8 @shiftByWidth(i8 noundef %a) #0 {
entry:
  %0 = shl i8 %a, 0
  ret i8 %0
}

define noundef i16 @shiftU16(i16 noundef %a, i16 noundef %n) #0 {
entry:
  %0 = and i16 %n, 15
  %1 = shl i16 %a, %0
  ret i16 %1
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8 @shiftByWidth(i8 37)
  %1 = zext i8 %0 to i32
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call i16 @shiftU16(i16 3, i16 17)
  %4 = zext i16 %3 to i32
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
