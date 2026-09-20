@.str.0 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"no-such-path-9f3c1a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"<null>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"<resolved>\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"dot: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"/\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"absolute\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"relative\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"nonempty: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @nish_realpath(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %missing.addr = alloca i8*, align 8
  %here.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_realpath(i8* bitcast ({ i64, [20 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %missing.addr, align 8
  %1 = load i8*, i8** %missing.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %cond.true ], [ bitcast ({ i64, [11 x i8] }* @.str.3 to i8*), %cond.false ]
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %3)
  call void @nish_print(i8* %4)
  %5 = call i8* @nish_realpath(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %5, i8** %here.addr, align 8
  %6 = load i8*, i8** %here.addr, align 8
  %7 = icmp eq i8* %6, null
  br i1 %7, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %8 = load i8*, i8** %here.addr, align 8
  %9 = call zeroext i1 @nish_str_at(i8* %8, i64 0, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  br i1 %9, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %10 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.7 to i8*), %cond.true.2 ], [ bitcast ({ i64, [9 x i8] }* @.str.8 to i8*), %cond.false.2 ]
  br label %cond.end.1

cond.end.1:
  %11 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), %cond.true.1 ], [ %10, %cond.end.2 ]
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8* %11)
  call void @nish_print(i8* %12)
  %13 = load i8*, i8** %here.addr, align 8
  %14 = icmp ne i8* %13, null
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i8*, i8** %here.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = icmp sgt i32 %18, 0
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.9 to i8*), i8* %20)
  call void @nish_print(i8* %21)
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
attributes #2 = { nounwind willreturn memory(argmem: read) }
