%struct.Box = type { %struct.sts_result.i32.i32* }
%struct.sts_result.i32.i32 = type { i1, i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_div(i1 noundef zeroext) #4

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @describe(i64 noundef %r) #0 {
entry:
  %sts_result.i32.i32.obj = alloca %struct.sts_result.i32.i32, align 8
  %0 = trunc i64 %r to i1
  %1 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = lshr i64 %r, 32
  %3 = trunc i64 %2 to i32
  %4 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 2
  store i32 %3, i32* %5, align 4
  %6 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = xor i1 %7, true
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = sub i32 0, %10
  ret i32 %11

if.end:
  %12 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  ret i32 %13
}

define noundef nonnull align 8 dereferenceable(8) %struct.Box* @boxed(i64 noundef %r) #1 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.sts_result.i32.i32*
  %2 = trunc i64 %r to i1
  %3 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %1, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = lshr i64 %r, 32
  %5 = trunc i64 %4 to i32
  %6 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %1, i32 0, i32 1
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %1, i32 0, i32 2
  store i32 %5, i32* %7, align 4
  %8 = call i8* @sts_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Box*
  %10 = getelementptr inbounds %struct.Box, %struct.Box* %9, i32 0, i32 0
  store %struct.sts_result.i32.i32* %1, %struct.sts_result.i32.i32** %10, align 8
  ret %struct.Box* %9
}

define noundef i64 @half(i32 noundef %n) #2 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %0)
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
  call void @sts_panic_div(i1 zeroext %9)
  unreachable

div.ok.1:
  %14 = sdiv i32 %n, 2
  %15 = zext i32 %14 to i64
  %16 = shl i64 %15, 32
  %17 = or i64 %16, 1
  ret i64 %17
}

define noundef i32 @sts_main() #2 {
entry:
  %sts_result.i32.i32.obj = alloca %struct.sts_result.i32.i32, align 8
  %sts_result.i32.i32.obj.1 = alloca %struct.sts_result.i32.i32, align 8
  %kept.addr = alloca %struct.Box*, align 8
  %inner.addr = alloca %struct.sts_result.i32.i32*, align 8
  %0 = zext i32 41 to i64
  %1 = shl i64 %0, 32
  %2 = or i64 %1, 1
  %3 = call i32 @describe(i64 %2)
  %4 = call i8* @sts_str_from_i32(i32 %3)
  call void @sts_print(i8* %4)
  %5 = call i64 @half(i32 8)
  %6 = trunc i64 %5 to i1
  %7 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 0
  store i1 %6, i1* %7, align 1
  %8 = lshr i64 %5, 32
  %9 = trunc i64 %8 to i32
  %10 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 1
  store i32 %9, i32* %10, align 4
  %11 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 2
  store i32 %9, i32* %11, align 4
  %12 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 0
  %13 = load i1, i1* %12, align 1
  %14 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 2
  %15 = load i32, i32* %14, align 4
  %16 = zext i32 %15 to i64
  %17 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  %19 = zext i32 %18 to i64
  %20 = select i1 %13, i64 %19, i64 %16
  %21 = shl i64 %20, 32
  %22 = zext i1 %13 to i64
  %23 = or i64 %21, %22
  %24 = call i32 @describe(i64 %23)
  %25 = call i8* @sts_str_from_i32(i32 %24)
  call void @sts_print(i8* %25)
  %26 = call i64 @half(i32 7)
  %27 = trunc i64 %26 to i1
  %28 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %27, i1* %28, align 1
  %29 = lshr i64 %26, 32
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %30, i32* %31, align 4
  %32 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %30, i32* %32, align 4
  %33 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 0
  %34 = load i1, i1* %33, align 1
  %35 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 2
  %36 = load i32, i32* %35, align 4
  %37 = zext i32 %36 to i64
  %38 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj.1, i32 0, i32 1
  %39 = load i32, i32* %38, align 4
  %40 = zext i32 %39 to i64
  %41 = select i1 %34, i64 %40, i64 %37
  %42 = shl i64 %41, 32
  %43 = zext i1 %34 to i64
  %44 = or i64 %42, %43
  %45 = call i32 @describe(i64 %44)
  %46 = call i8* @sts_str_from_i32(i32 %45)
  call void @sts_print(i8* %46)
  %47 = zext i32 5 to i64
  %48 = shl i64 %47, 32
  %49 = or i64 %48, 1
  %50 = call %struct.Box* @boxed(i64 %49)
  store %struct.Box* %50, %struct.Box** %kept.addr, align 8
  %51 = load %struct.Box*, %struct.Box** %kept.addr, align 8
  %52 = getelementptr inbounds %struct.Box, %struct.Box* %51, i32 0, i32 0
  %53 = load %struct.sts_result.i32.i32*, %struct.sts_result.i32.i32** %52, align 8
  store %struct.sts_result.i32.i32* %53, %struct.sts_result.i32.i32** %inner.addr, align 8
  %54 = load %struct.sts_result.i32.i32*, %struct.sts_result.i32.i32** %inner.addr, align 8
  %55 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %54, i32 0, i32 0
  %56 = load i1, i1* %55, align 1
  br i1 %56, label %if.then, label %if.end

if.then:
  %57 = load %struct.sts_result.i32.i32*, %struct.sts_result.i32.i32** %inner.addr, align 8
  %58 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %57, i32 0, i32 1
  %59 = load i32, i32* %58, align 4
  %60 = call i8* @sts_str_from_i32(i32 %59)
  call void @sts_print(i8* %60)
  br label %if.end

if.end:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
