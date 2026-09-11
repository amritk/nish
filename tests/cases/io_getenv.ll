@.str.0 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"NISH_TEST_VALUE\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"set: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"<null>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"NISH_TEST_EMPTY\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"empty: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\22\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"NISH_TEST_NOT_SET\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unset: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"length: \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %set.addr = alloca i8*, align 8
  %empty.addr = alloca i8*, align 8
  %unset.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_getenv(i8* bitcast ({ i64, [16 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %set.addr, align 8
  %1 = load i8*, i8** %set.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %set.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %cond.true ], [ %3, %cond.false ]
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i8* @nish_getenv(i8* bitcast ({ i64, [16 x i8] }* @.str.3 to i8*))
  store i8* %6, i8** %empty.addr, align 8
  %7 = load i8*, i8** %empty.addr, align 8
  %8 = icmp eq i8* %7, null
  br i1 %8, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %9 = load i8*, i8** %empty.addr, align 8
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  br label %cond.end.1

cond.end.1:
  %12 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %cond.true.1 ], [ %11, %cond.false.1 ]
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %12)
  call void @nish_print(i8* %13)
  %14 = call i8* @nish_getenv(i8* bitcast ({ i64, [18 x i8] }* @.str.6 to i8*))
  store i8* %14, i8** %unset.addr, align 8
  %15 = load i8*, i8** %unset.addr, align 8
  %16 = icmp eq i8* %15, null
  br i1 %16, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  %17 = load i8*, i8** %unset.addr, align 8
  br label %cond.end.2

cond.end.2:
  %18 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %cond.true.2 ], [ %17, %cond.false.2 ]
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %set.addr, align 8
  %21 = icmp ne i8* %20, null
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i8*, i8** %set.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.8 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  br label %if.end

if.end:
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
