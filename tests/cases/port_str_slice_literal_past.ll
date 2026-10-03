@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noundef zeroext i1 @never() #0 {
entry:
  ret i1 false
}

define internal noundef nonnull align 8 i8* @upTo(i32 noundef %k) #1 {
entry:
  %0 = icmp sge i32 %k, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %k, 4
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*) to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sext i32 %k to i64
  %6 = icmp ule i64 3, %5
  %7 = icmp ule i64 %5, %4
  %8 = and i1 %6, %7
  br i1 %8, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 3, i64 %5, i64 %4)
  unreachable

slice.ok:
  %9 = sub i64 %5, 3
  %10 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 3
  %12 = call i8* @nish_str_new(i8* %11, i64 %9)
  ret i8* %12

if.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*)
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
  %21 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*) to i64*
  %22 = load i64, i64* %21, align 8
  %23 = icmp ule i64 5, 2
  %24 = icmp ule i64 2, %22
  %25 = and i1 %23, %24
  br i1 %25, label %slice.ok.2, label %slice.fail.2

slice.fail.2:
  call void @nish_panic_slice(i64 5, i64 2, i64 %22)
  unreachable

slice.ok.2:
  %26 = sub i64 2, 5
  %27 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 5
  %29 = call i8* @nish_str_new(i8* %28, i64 %26)
  call void @nish_print(i8* %29)
  %30 = load i8*, i8** %t.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = icmp ule i64 5, 2
  %34 = icmp ule i64 2, %32
  %35 = and i1 %33, %34
  br i1 %35, label %slice.ok.3, label %slice.fail.3

slice.fail.3:
  call void @nish_panic_slice(i64 5, i64 2, i64 %32)
  unreachable

slice.ok.3:
  %36 = sub i64 2, 5
  %37 = getelementptr inbounds i8, i8* %30, i64 8
  %38 = getelementptr inbounds i8, i8* %37, i64 5
  %39 = call i8* @nish_str_new(i8* %38, i64 %36)
  call void @nish_print(i8* %39)
  %40 = load i8*, i8** %t.addr, align 8
  %41 = bitcast i8* %40 to i64*
  %42 = load i64, i64* %41, align 8
  %43 = icmp ule i64 5, 0
  %44 = icmp ule i64 0, %42
  %45 = and i1 %43, %44
  br i1 %45, label %slice.ok.4, label %slice.fail.4

slice.fail.4:
  call void @nish_panic_slice(i64 5, i64 0, i64 %42)
  unreachable

slice.ok.4:
  %46 = sub i64 0, 5
  %47 = getelementptr inbounds i8, i8* %40, i64 8
  %48 = getelementptr inbounds i8, i8* %47, i64 5
  %49 = call i8* @nish_str_new(i8* %48, i64 %46)
  call void @nish_print(i8* %49)
  %50 = call i64 @nish_arena_mark()
  %51 = call i8* @upTo(i32 4)
  %52 = call i8* @nish_arena_keep(i64 %50, i8* %51)
  call void @nish_print(i8* %52)
  %53 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*) to i64*
  %54 = load i64, i64* %53, align 8
  %55 = icmp ule i64 0, 2
  %56 = icmp ule i64 2, %54
  %57 = and i1 %55, %56
  br i1 %57, label %slice.ok.5, label %slice.fail.5

slice.fail.5:
  call void @nish_panic_slice(i64 0, i64 2, i64 %54)
  unreachable

slice.ok.5:
  %58 = sub i64 2, 0
  %59 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i64 8
  %60 = getelementptr inbounds i8, i8* %59, i64 0
  %61 = call i8* @nish_str_new(i8* %60, i64 %58)
  call void @nish_print(i8* %61)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %v.addr, align 8
  br label %if.end

if.end:
  %62 = load i8*, i8** %v.addr, align 8
  %63 = bitcast i8* %62 to i64*
  %64 = load i64, i64* %63, align 8
  %65 = icmp ule i64 1, 3
  %66 = icmp ule i64 3, %64
  %67 = and i1 %65, %66
  br i1 %67, label %slice.ok.6, label %slice.fail.6

slice.fail.6:
  call void @nish_panic_slice(i64 1, i64 3, i64 %64)
  unreachable

slice.ok.6:
  %68 = sub i64 3, 1
  %69 = getelementptr inbounds i8, i8* %62, i64 8
  %70 = getelementptr inbounds i8, i8* %69, i64 1
  %71 = call i8* @nish_str_new(i8* %70, i64 %68)
  call void @nish_print(i8* %71)
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
