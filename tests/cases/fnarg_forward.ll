@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @twice$i32$fn.6.square(i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call i8* @twice$str$fn.16.nish_main$arrow0(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef nonnull align 8 i8* @nish_main$arrow0(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = call i8* @nish_str_concat(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  ret i8* %0
}

define internal noundef i32 @twice$i32$fn.6.square(i32 noundef %x) #0 {
entry:
  %0 = call i32 @applyOnce$i32$fn.6.square(i32 %x)
  %1 = call i32 @applyOnce$i32$fn.6.square(i32 %0)
  ret i32 %1
}

define internal noundef nonnull align 8 i8* @twice$str$fn.16.nish_main$arrow0(i8* noundef nonnull noalias readonly align 8 %x) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @applyOnce$str$fn.16.nish_main$arrow0(i8* %x)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @applyOnce$str$fn.16.nish_main$arrow0(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5
}

define internal noundef i32 @applyOnce$i32$fn.6.square(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @square(i32 %x)
  ret i32 %0
}

define internal noundef nonnull align 8 i8* @applyOnce$str$fn.16.nish_main$arrow0(i8* noundef nonnull noalias readonly align 8 %x) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish_main$arrow0(i8* %x)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
