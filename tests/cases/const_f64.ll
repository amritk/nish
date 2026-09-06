declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef) #0

define noundef i32 @sts_main() #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i8* @sts_str_from_f64(double 0x3FD0000000000000)
  call void @sts_print(i8* %0)
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
