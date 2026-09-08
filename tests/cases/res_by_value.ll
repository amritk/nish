%struct.amrit_result.i32.i32 = type { i1, i32, i32 }

declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare void @amrit_panic_div(i1 noundef zeroext) #2

define noundef i64 @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = zext i32 %n to i64
  %8 = shl i64 %7, 32
  ret i64 %8

if.end:
  %9 = icmp eq i32 2, 0
  %10 = icmp eq i32 %n, -2147483648
  %11 = icmp eq i32 2, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %9)
  unreachable

div.ok.1:
  %14 = sdiv i32 %n, 2
  %15 = zext i32 %14 to i64
  %16 = shl i64 %15, 32
  %17 = or i64 %16, 1
  ret i64 %17
}

define noundef i32 @amrit_main() #0 {
entry:
  %good.addr = alloca %struct.amrit_result.i32.i32*, align 8
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %bad.addr = alloca %struct.amrit_result.i32.i32*, align 8
  %amrit_result.i32.i32.obj.1 = alloca %struct.amrit_result.i32.i32, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i64 @half(i32 8)
  %1 = trunc i64 %0 to i1
  %2 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = lshr i64 %0, 32
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %6, align 4
  store %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, %struct.amrit_result.i32.i32** %good.addr, align 8
  %7 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %good.addr, align 8
  %8 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = xor i1 %9, true
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %good.addr, align 8
  %12 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %11, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @amrit_str_from_i32(i32 %13)
  call void @amrit_print(i8* %14)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %15 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %good.addr, align 8
  %16 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  %18 = call i8* @amrit_str_from_i32(i32 %17)
  call void @amrit_print(i8* %18)
  %19 = call i64 @half(i32 7)
  %20 = trunc i64 %19 to i1
  %21 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %20, i1* %21, align 1
  %22 = lshr i64 %19, 32
  %23 = trunc i64 %22 to i32
  %24 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %23, i32* %24, align 4
  %25 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %23, i32* %25, align 4
  store %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, %struct.amrit_result.i32.i32** %bad.addr, align 8
  %26 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %bad.addr, align 8
  %27 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %26, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  %29 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %bad.addr, align 8
  %30 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %29, i32 0, i32 1
  %31 = load i32, i32* %30, align 4
  %32 = call i8* @amrit_str_from_i32(i32 %31)
  call void @amrit_print(i8* %32)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %33 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %bad.addr, align 8
  %34 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %33, i32 0, i32 2
  %35 = load i32, i32* %34, align 4
  %36 = call i8* @amrit_str_from_i32(i32 %35)
  call void @amrit_print(i8* %36)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
