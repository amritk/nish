@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @middle(i32 noundef %k) #0 {
entry:
  %word.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = icmp sge i32 %k, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %k, 4
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i8*, i8** %word.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = sext i32 %k to i64
  %7 = icmp ule i64 %6, 5
  %8 = icmp ule i64 5, %5
  %9 = and i1 %7, %8
  br i1 %9, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %6, i64 5, i64 %5)
  unreachable

slice.ok:
  %10 = sub i64 5, %6
  %11 = getelementptr inbounds i8, i8* %3, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %6
  %13 = call i8* @nish_str_new(i8* %12, i64 %10)
  ret i8* %13

if.end:
  %14 = load i8*, i8** %word.addr, align 8
  ret i8* %14
}

define internal noundef nonnull align 8 i8* @fromGuard(i32 noundef %i) #0 {
entry:
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %i, %4
  br label %land.end.1

land.end.1:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs.1 ]
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i8*, i8** %s.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 6
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i8*, i8** %s.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = sext i32 %i to i64
  %17 = icmp ule i64 %16, 6
  %18 = icmp ule i64 6, %15
  %19 = and i1 %17, %18
  br i1 %19, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %16, i64 6, i64 %15)
  unreachable

slice.ok:
  %20 = sub i64 6, %16
  %21 = getelementptr inbounds i8, i8* %13, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 %16
  %23 = call i8* @nish_str_new(i8* %22, i64 %20)
  ret i8* %23

if.end:
  %24 = load i8*, i8** %s.addr, align 8
  ret i8* %24
}

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca i8*, align 8
  %u.addr = alloca i8*, align 8
  %from.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ule i64 1, 3
  %3 = icmp ule i64 3, %1
  %4 = and i1 %2, %3
  br i1 %4, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 1, i64 3, i64 %1)
  unreachable

slice.ok:
  %5 = sub i64 3, 1
  %6 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i64 8
  %7 = getelementptr inbounds i8, i8* %6, i64 1
  %8 = call i8* @nish_str_new(i8* %7, i64 %5)
  call void @nish_print(i8* %8)
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %t.addr, align 8
  %9 = load i8*, i8** %t.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = icmp ule i64 1, 3
  %13 = icmp ule i64 3, %11
  %14 = and i1 %12, %13
  br i1 %14, label %slice.ok.1, label %slice.fail.1

slice.fail.1:
  call void @nish_panic_slice(i64 1, i64 3, i64 %11)
  unreachable

slice.ok.1:
  %15 = sub i64 3, 1
  %16 = getelementptr inbounds i8, i8* %9, i64 8
  %17 = getelementptr inbounds i8, i8* %16, i64 1
  %18 = call i8* @nish_str_new(i8* %17, i64 %15)
  call void @nish_print(i8* %18)
  %19 = load i8*, i8** %t.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = icmp ule i64 6, %21
  br i1 %22, label %slice.ok.2, label %slice.fail.2

slice.fail.2:
  call void @nish_panic_slice(i64 6, i64 %21, i64 %21)
  unreachable

slice.ok.2:
  %23 = sub i64 %21, 6
  %24 = getelementptr inbounds i8, i8* %19, i64 8
  %25 = getelementptr inbounds i8, i8* %24, i64 6
  %26 = call i8* @nish_str_new(i8* %25, i64 %23)
  call void @nish_print(i8* %26)
  %27 = load i8*, i8** %t.addr, align 8
  store i8* %27, i8** %u.addr, align 8
  %28 = load i8*, i8** %u.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = icmp ule i64 0, 6
  %32 = icmp ule i64 6, %30
  %33 = and i1 %31, %32
  br i1 %33, label %slice.ok.3, label %slice.fail.3

slice.fail.3:
  call void @nish_panic_slice(i64 0, i64 6, i64 %30)
  unreachable

slice.ok.3:
  %34 = sub i64 6, 0
  %35 = getelementptr inbounds i8, i8* %28, i64 8
  %36 = getelementptr inbounds i8, i8* %35, i64 0
  %37 = call i8* @nish_str_new(i8* %36, i64 %34)
  call void @nish_print(i8* %37)
  store i32 2, i32* %from.addr, align 4
  %38 = load i8*, i8** %t.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = load i32, i32* %from.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = icmp ule i64 %42, 4
  %44 = icmp ule i64 4, %40
  %45 = and i1 %43, %44
  br i1 %45, label %slice.ok.4, label %slice.fail.4

slice.fail.4:
  call void @nish_panic_slice(i64 %42, i64 4, i64 %40)
  unreachable

slice.ok.4:
  %46 = sub i64 4, %42
  %47 = getelementptr inbounds i8, i8* %38, i64 8
  %48 = getelementptr inbounds i8, i8* %47, i64 %42
  %49 = call i8* @nish_str_new(i8* %48, i64 %46)
  call void @nish_print(i8* %49)
  store i32 3, i32* %to.addr, align 4
  %50 = load i8*, i8** %t.addr, align 8
  %51 = bitcast i8* %50 to i64*
  %52 = load i64, i64* %51, align 8
  %53 = load i32, i32* %to.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = icmp ule i64 1, %54
  %56 = icmp ule i64 %54, %52
  %57 = and i1 %55, %56
  br i1 %57, label %slice.ok.5, label %slice.fail.5

slice.fail.5:
  call void @nish_panic_slice(i64 1, i64 %54, i64 %52)
  unreachable

slice.ok.5:
  %58 = sub i64 %54, 1
  %59 = getelementptr inbounds i8, i8* %50, i64 8
  %60 = getelementptr inbounds i8, i8* %59, i64 1
  %61 = call i8* @nish_str_new(i8* %60, i64 %58)
  call void @nish_print(i8* %61)
  %62 = load i32, i32* %to.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %to.addr, align 4
  %64 = call i64 @nish_arena_mark()
  %65 = call i8* @middle(i32 2)
  %66 = call i8* @nish_arena_keep(i64 %64, i8* %65)
  call void @nish_print(i8* %66)
  %67 = call i64 @nish_arena_mark()
  %68 = call i8* @fromGuard(i32 2)
  %69 = call i8* @nish_arena_keep(i64 %67, i8* %68)
  call void @nish_print(i8* %69)
  %70 = bitcast i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*) to i64*
  %71 = load i64, i64* %70, align 8
  %72 = icmp ule i64 1, 5
  %73 = icmp ule i64 5, %71
  %74 = and i1 %72, %73
  br i1 %74, label %slice.ok.6, label %slice.fail.6

slice.fail.6:
  call void @nish_panic_slice(i64 1, i64 5, i64 %71)
  unreachable

slice.ok.6:
  %75 = sub i64 5, 1
  %76 = getelementptr inbounds i8, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i64 8
  %77 = getelementptr inbounds i8, i8* %76, i64 1
  %78 = call i8* @nish_str_new(i8* %77, i64 %75)
  call void @nish_print(i8* %78)
  %79 = load i32, i32* %to.addr, align 4
  %80 = sub nsw i32 %79, 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %80
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
