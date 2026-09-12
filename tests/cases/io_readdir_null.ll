%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/io_readdir_null.txt\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"not a directory\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"build/no-such-directory\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"plain file: \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  call void @nish_write_file(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*))
  %1 = call %struct.nish_array* @nish_readdir(i8* bitcast ({ i64, [24 x i8] }* @.str.4 to i8*))
  %2 = icmp eq %struct.nish_array* %1, null
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8* %3)
  call void @nish_print(i8* %4)
  %5 = call %struct.nish_array* @nish_readdir(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*))
  %6 = icmp eq %struct.nish_array* %5, null
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.7 to i8*), i8* %7)
  call void @nish_print(i8* %8)
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
