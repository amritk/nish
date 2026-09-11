%struct.Box = type { %struct.nish_result.i32.i32* }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @describe({ i1, i32, i32 } %r) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = extractvalue { i1, i32, i32 } %r, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %r, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %r, 2
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = xor i1 %7, true
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = sub nsw i32 0, %10
  ret i32 %11

if.end:
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  ret i32 %13
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Box* @boxed({ i1, i32, i32 } %r) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.i32*
  %2 = extractvalue { i1, i32, i32 } %r, 0
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = extractvalue { i1, i32, i32 } %r, 1
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = extractvalue { i1, i32, i32 } %r, 2
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 2
  store i32 %6, i32* %7, align 4
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Box*
  %10 = getelementptr inbounds %struct.Box, %struct.Box* %9, i32 0, i32 0
  store %struct.nish_result.i32.i32* %1, %struct.nish_result.i32.i32** %10, align 8
  ret %struct.Box* %9
}

define internal { i1, i32, i32 } @half(i32 noundef %n) #2 {
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
  %7 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %7

if.end:
  %8 = icmp eq i32 2, 0
  %9 = icmp eq i32 %n, -2147483648
  %10 = icmp eq i32 2, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok.1:
  %13 = sdiv i32 %n, 2
  %14 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %13, 1
  ret { i1, i32, i32 } %14
}

define noundef i32 @nish_main() #2 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %kept.addr = alloca %struct.Box*, align 8
  %inner.addr = alloca %struct.nish_result.i32.i32*, align 8
  %0 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 41, 1
  %1 = call i32 @describe({ i1, i32, i32 } %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call { i1, i32, i32 } @half(i32 8)
  %4 = extractvalue { i1, i32, i32 } %3, 0
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %4, i1* %5, align 1
  %6 = extractvalue { i1, i32, i32 } %3, 1
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  %8 = extractvalue { i1, i32, i32 } %3, 2
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %8, i32* %9, align 4
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  %12 = insertvalue { i1, i32, i32 } undef, i1 %11, 0
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %14 = load i32, i32* %13, align 4
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %16 = load i32, i32* %15, align 4
  %17 = insertvalue { i1, i32, i32 } %12, i32 %16, 1
  %18 = insertvalue { i1, i32, i32 } %17, i32 %14, 2
  %19 = call i32 @describe({ i1, i32, i32 } %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = call { i1, i32, i32 } @half(i32 7)
  %22 = extractvalue { i1, i32, i32 } %21, 0
  %23 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %22, i1* %23, align 1
  %24 = extractvalue { i1, i32, i32 } %21, 1
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %24, i32* %25, align 4
  %26 = extractvalue { i1, i32, i32 } %21, 2
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %26, i32* %27, align 4
  %28 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %29 = load i1, i1* %28, align 1
  %30 = insertvalue { i1, i32, i32 } undef, i1 %29, 0
  %31 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  %32 = load i32, i32* %31, align 4
  %33 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %34 = load i32, i32* %33, align 4
  %35 = insertvalue { i1, i32, i32 } %30, i32 %34, 1
  %36 = insertvalue { i1, i32, i32 } %35, i32 %32, 2
  %37 = call i32 @describe({ i1, i32, i32 } %36)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  call void @nish_print(i8* %38)
  %39 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 5, 1
  %40 = call %struct.Box* @boxed({ i1, i32, i32 } %39)
  store %struct.Box* %40, %struct.Box** %kept.addr, align 8
  %41 = load %struct.Box*, %struct.Box** %kept.addr, align 8
  %42 = getelementptr inbounds %struct.Box, %struct.Box* %41, i32 0, i32 0
  %43 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %42, align 8
  store %struct.nish_result.i32.i32* %43, %struct.nish_result.i32.i32** %inner.addr, align 8
  %44 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %inner.addr, align 8
  %45 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %44, i32 0, i32 0
  %46 = load i1, i1* %45, align 1
  br i1 %46, label %if.then, label %if.end

if.then:
  %47 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %inner.addr, align 8
  %48 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %47, i32 0, i32 1
  %49 = load i32, i32* %48, align 4
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  br label %if.end

if.end:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
