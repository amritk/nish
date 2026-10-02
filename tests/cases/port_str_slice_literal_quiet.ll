@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca i8*, align 8
  %u.addr = alloca i8*, align 8
  %from.addr = alloca i32, align 4
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
  %50 = bitcast i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*) to i64*
  %51 = load i64, i64* %50, align 8
  %52 = icmp ule i64 1, 5
  %53 = icmp ule i64 5, %51
  %54 = and i1 %52, %53
  br i1 %54, label %slice.ok.5, label %slice.fail.5

slice.fail.5:
  call void @nish_panic_slice(i64 1, i64 5, i64 %51)
  unreachable

slice.ok.5:
  %55 = sub i64 5, 1
  %56 = getelementptr inbounds i8, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i64 8
  %57 = getelementptr inbounds i8, i8* %56, i64 1
  %58 = call i8* @nish_str_new(i8* %57, i64 %55)
  call void @nish_print(i8* %58)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
