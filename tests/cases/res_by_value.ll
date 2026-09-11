%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef { i1, i32 } @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = zext i32 %n to i64
  %8 = shl i64 %7, 32
  %9 = trunc i64 %8 to i1
  %10 = lshr i64 %8, 32
  %11 = trunc i64 %10 to i32
  %12 = insertvalue { i1, i32 } undef, i1 %9, 0
  %13 = insertvalue { i1, i32 } %12, i32 %11, 1
  ret { i1, i32 } %13

if.end:
  %14 = icmp eq i32 2, 0
  %15 = icmp eq i32 %n, -2147483648
  %16 = icmp eq i32 2, -1
  %17 = and i1 %15, %16
  %18 = or i1 %14, %17
  br i1 %18, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %14)
  unreachable

div.ok.1:
  %19 = sdiv i32 %n, 2
  %20 = zext i32 %19 to i64
  %21 = shl i64 %20, 32
  %22 = or i64 %21, 1
  %23 = trunc i64 %22 to i1
  %24 = lshr i64 %22, 32
  %25 = trunc i64 %24 to i32
  %26 = insertvalue { i1, i32 } undef, i1 %23, 0
  %27 = insertvalue { i1, i32 } %26, i32 %25, 1
  ret { i1, i32 } %27
}

define noundef i32 @nish_main() #0 {
entry:
  %good.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %bad.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32 } @half(i32 8)
  %1 = extractvalue { i1, i32 } %0, 0
  %2 = extractvalue { i1, i32 } %0, 1
  %3 = zext i32 %2 to i64
  %4 = shl i64 %3, 32
  %5 = zext i1 %1 to i64
  %6 = or i64 %4, %5
  %7 = trunc i64 %6 to i1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %7, i1* %8, align 1
  %9 = lshr i64 %6, 32
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %10, i32* %12, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %good.addr, align 8
  %13 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  %16 = xor i1 %15, true
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %18 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %17, i32 0, i32 2
  %19 = load i32, i32* %18, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %21 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %21, i32 0, i32 1
  %23 = load i32, i32* %22, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = call { i1, i32 } @half(i32 7)
  %26 = extractvalue { i1, i32 } %25, 0
  %27 = extractvalue { i1, i32 } %25, 1
  %28 = zext i32 %27 to i64
  %29 = shl i64 %28, 32
  %30 = zext i1 %26 to i64
  %31 = or i64 %29, %30
  %32 = trunc i64 %31 to i1
  %33 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %32, i1* %33, align 1
  %34 = lshr i64 %31, 32
  %35 = trunc i64 %34 to i32
  %36 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %35, i32* %36, align 4
  %37 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %35, i32* %37, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %bad.addr, align 8
  %38 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %38, i32 0, i32 0
  %40 = load i1, i1* %39, align 1
  br i1 %40, label %if.then.1, label %if.end.1

if.then.1:
  %41 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %41, i32 0, i32 1
  %43 = load i32, i32* %42, align 4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %45 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %46 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %45, i32 0, i32 2
  %47 = load i32, i32* %46, align 4
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
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
