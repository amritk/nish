@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noundef zeroext i1 @never() #0 {
entry:
  ret i1 false
}

define noundef i32 @nish_main() #1 {
entry:
  %t.addr = alloca i8*, align 8
  %v.addr = alloca i8*, align 8
  %far.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %t.addr, align 8
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %v.addr, align 8
  %0 = call i1 @never()
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = load i8*, i8** %t.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = icmp ule i64 1, 7
  %5 = icmp ule i64 7, %3
  %6 = and i1 %4, %5
  br i1 %6, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 1, i64 7, i64 %3)
  unreachable

slice.ok:
  %7 = sub i64 7, 1
  %8 = getelementptr inbounds i8, i8* %1, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 1
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  call void @nish_print(i8* %10)
  store i32 7, i32* %far.addr, align 4
  %11 = load i8*, i8** %t.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = load i32, i32* %far.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = icmp ule i64 %15, %13
  br i1 %16, label %slice.ok.1, label %slice.fail.1

slice.fail.1:
  call void @nish_panic_slice(i64 %15, i64 %13, i64 %13)
  unreachable

slice.ok.1:
  %17 = sub i64 %13, %15
  %18 = getelementptr inbounds i8, i8* %11, i64 8
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = call i8* @nish_str_new(i8* %19, i64 %17)
  call void @nish_print(i8* %20)
  %21 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*) to i64*
  %22 = load i64, i64* %21, align 8
  %23 = icmp ule i64 0, 2
  %24 = icmp ule i64 2, %22
  %25 = and i1 %23, %24
  br i1 %25, label %slice.ok.2, label %slice.fail.2

slice.fail.2:
  call void @nish_panic_slice(i64 0, i64 2, i64 %22)
  unreachable

slice.ok.2:
  %26 = sub i64 2, 0
  %27 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 0
  %29 = call i8* @nish_str_new(i8* %28, i64 %26)
  call void @nish_print(i8* %29)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %v.addr, align 8
  br label %if.end

if.end:
  %30 = load i8*, i8** %v.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = icmp ule i64 1, 3
  %34 = icmp ule i64 3, %32
  %35 = and i1 %33, %34
  br i1 %35, label %slice.ok.3, label %slice.fail.3

slice.fail.3:
  call void @nish_panic_slice(i64 1, i64 3, i64 %32)
  unreachable

slice.ok.3:
  %36 = sub i64 3, 1
  %37 = getelementptr inbounds i8, i8* %30, i64 8
  %38 = getelementptr inbounds i8, i8* %37, i64 1
  %39 = call i8* @nish_str_new(i8* %38, i64 %36)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
