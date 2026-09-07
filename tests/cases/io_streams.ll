@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"no\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c" newline\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"diagnostic\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"partial \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"line\0A\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"build/test/io_streams_absent.txt\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/test/io_streams.txt\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"present\0A\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"readFileSyncOrNull lost a file it had just written\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"found \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8

declare void @sts_free_arena() #1
declare noundef i64 @sts_arena_mark() #1
declare void @sts_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_exit(i32 noundef) #2
declare noalias noundef align 8 i8* @sts_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @sts_main() #0 {
entry:
  %missing.addr = alloca i8*, align 8
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @sts_arena_mark()
  call void @sts_write(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 1, i1 false)
  call void @sts_write(i8* bitcast ({ i64, [9 x i8] }* @.str.1 to i8*), i32 1, i1 false)
  call void @sts_write(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i32 1, i1 false)
  call void @sts_write(i8* bitcast ({ i64, [11 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @sts_write(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i32 2, i1 false)
  call void @sts_write(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i32 2, i1 false)
  %0 = call i8* @sts_read_file_or_null(i8* bitcast ({ i64, [33 x i8] }* @.str.6 to i8*))
  store i8* %0, i8** %missing.addr, align 8
  %1 = load i8*, i8** %missing.addr, align 8
  %2 = icmp eq i8* %1, null
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %4 = call i8* @sts_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* %3)
  call void @sts_print(i8* %4)
  call void @sts_write_file(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [9 x i8] }* @.str.11 to i8*))
  %5 = call i8* @sts_read_file_or_null(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*))
  store i8* %5, i8** %text.addr, align 8
  %6 = load i8*, i8** %text.addr, align 8
  %7 = icmp eq i8* %6, null
  br i1 %7, label %if.then, label %if.else

if.then:
  call void @sts_write(i8* bitcast ({ i64, [51 x i8] }* @.str.12 to i8*), i32 2, i1 true)
  call void @sts_exit(i32 1)
  unreachable

if.else:
  %8 = load i8*, i8** %text.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call i8* @sts_str_from_i32(i32 %11)
  %13 = call i8* @sts_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.13 to i8*), i8* %12)
  %14 = call i8* @sts_str_concat(i8* %13, i8* bitcast ({ i64, [7 x i8] }* @.str.14 to i8*))
  call void @sts_print(i8* %14)
  br label %if.end

if.end:
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
