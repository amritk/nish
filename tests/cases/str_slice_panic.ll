@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @cut(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = sext i32 %to to i64
  %4 = icmp ule i64 %2, %3
  %5 = icmp ule i64 %3, %1
  %6 = and i1 %4, %5
  br i1 %6, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %3, i64 %1)
  unreachable

slice.ok:
  %7 = sub i64 %3, %2
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %2
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  ret i8* %10
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @cut(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i32 1, i32 3)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @cut(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i32 4, i32 2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
