@.str.0 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"quote:\22 backslash:\5C end\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"h\C3\A9llo \E2\86\92 \E6\97\A5\E6\9C\AC\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"line1\0Aline2\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8

declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  call void @sts_print(i8* bitcast ({ i64, [24 x i8] }* @.str.0 to i8*))
  call void @sts_print(i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*))
  call void @sts_print(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*))
  %0 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = call i8* @sts_str_from_i32(i32 %2)
  call void @sts_print(i8* %3)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
