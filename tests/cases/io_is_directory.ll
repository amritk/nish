@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cwd: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"root: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"/\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"device: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/dev/null\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/no/such/directory\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_is_dir(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %1)
  call void @nish_print(i8* %2)
  %3 = call zeroext i1 @nish_is_dir(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  %6 = call zeroext i1 @nish_is_dir(i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*))
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.6 to i8*), i8* %7)
  call void @nish_print(i8* %8)
  %9 = call zeroext i1 @nish_is_dir(i8* bitcast ({ i64, [19 x i8] }* @.str.9 to i8*))
  %10 = select i1 %9, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.8 to i8*), i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
