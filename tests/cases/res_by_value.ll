%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal { i1, i32, i32 } @half(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %2

if.end:
  %3 = sdiv i32 %n, 2
  %4 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %3, 1
  ret { i1, i32, i32 } %4
}

define noundef i32 @nish_main() #0 {
entry:
  %good.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %bad.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32, i32 } @half(i32 8)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %good.addr, align 8
  %7 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = xor i1 %9, true
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %11, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %15 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %good.addr, align 8
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = call { i1, i32, i32 } @half(i32 7)
  %20 = extractvalue { i1, i32, i32 } %19, 0
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %20, i1* %21, align 1
  %22 = extractvalue { i1, i32, i32 } %19, 1
  %23 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %22, i32* %23, align 4
  %24 = extractvalue { i1, i32, i32 } %19, 2
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %24, i32* %25, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %bad.addr, align 8
  %26 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %26, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  %29 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %30 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %29, i32 0, i32 1
  %31 = load i32, i32* %30, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %33 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %bad.addr, align 8
  %34 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %33, i32 0, i32 2
  %35 = load i32, i32* %34, align 4
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
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
