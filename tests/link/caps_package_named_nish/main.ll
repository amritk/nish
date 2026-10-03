@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  ab  \00" }, align 8

declare noundef nonnull align 8 i8* @nish.trim(i8* noundef nonnull noalias readonly align 8) #0
declare noundef i32 @nish.three() #1
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.trim(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = call i32 @nish.three()
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #3 = { nounwind willreturn readnone }
