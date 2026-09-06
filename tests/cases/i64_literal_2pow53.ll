declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef) #0

define noundef i32 @sts_main() #0 {
entry:
  %big.addr = alloca i64, align 8
  %arena.mark = call i64 @sts_arena_mark()
  store i64 9007199254740992, i64* %big.addr, align 8
  %0 = load i64, i64* %big.addr, align 8
  %1 = call i8* @sts_str_from_i64(i64 %0)
  call void @sts_print(i8* %1)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
