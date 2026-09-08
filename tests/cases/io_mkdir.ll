@.str.0 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"build/test/io_mkdir_dir\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"fresh: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"already there: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"no parent: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"build/test/io_mkdir_absent/child\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/io_mkdir_file\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"not a directory\0A\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"over a file: \00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @amrit_mkdir(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @amrit_main() #0 {
entry:
  %dir.addr = alloca i8*, align 8
  %file.addr = alloca i8*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i8* bitcast ({ i64, [24 x i8] }* @.str.0 to i8*), i8** %dir.addr, align 8
  %0 = load i8*, i8** %dir.addr, align 8
  %1 = call zeroext i1 @amrit_mkdir(i8* %0)
  %2 = select i1 %1, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %3 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %2)
  call void @amrit_print(i8* %3)
  %4 = load i8*, i8** %dir.addr, align 8
  %5 = call zeroext i1 @amrit_mkdir(i8* %4)
  %6 = select i1 %5, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %7 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.4 to i8*), i8* %6)
  call void @amrit_print(i8* %7)
  %8 = call zeroext i1 @amrit_mkdir(i8* bitcast ({ i64, [33 x i8] }* @.str.6 to i8*))
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %10 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.5 to i8*), i8* %9)
  call void @amrit_print(i8* %10)
  store i8* bitcast ({ i64, [25 x i8] }* @.str.7 to i8*), i8** %file.addr, align 8
  %11 = load i8*, i8** %file.addr, align 8
  call void @amrit_write_file(i8* %11, i8* bitcast ({ i64, [17 x i8] }* @.str.8 to i8*))
  %12 = load i8*, i8** %file.addr, align 8
  %13 = call zeroext i1 @amrit_mkdir(i8* %12)
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %15 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.9 to i8*), i8* %14)
  call void @amrit_print(i8* %15)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
