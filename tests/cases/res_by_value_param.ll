%struct.Box = type { %struct.amrit_result.i32.i32* }
%struct.amrit_result.i32.i32 = type { i1, i32, i32 }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #3
declare void @amrit_free_arena() #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare void @amrit_panic_div(i1 noundef zeroext) #4

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @describe({ i1, i32 } noundef %r) #0 {
entry:
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %0 = extractvalue { i1, i32 } %r, 0
  %1 = extractvalue { i1, i32 } %r, 1
  %2 = zext i32 %1 to i64
  %3 = shl i64 %2, 32
  %4 = zext i1 %0 to i64
  %5 = or i64 %3, %4
  %6 = trunc i64 %5 to i1
  %7 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %6, i1* %7, align 1
  %8 = lshr i64 %5, 32
  %9 = trunc i64 %8 to i32
  %10 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %9, i32* %10, align 4
  %11 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %9, i32* %11, align 4
  %12 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  %13 = load i1, i1* %12, align 1
  %14 = xor i1 %13, true
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  %16 = load i32, i32* %15, align 4
  %17 = sub nsw i32 0, %16
  ret i32 %17

if.end:
  %18 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  ret i32 %19
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Box* @boxed({ i1, i32 } noundef %r) #1 {
entry:
  %0 = extractvalue { i1, i32 } %r, 0
  %1 = extractvalue { i1, i32 } %r, 1
  %2 = zext i32 %1 to i64
  %3 = shl i64 %2, 32
  %4 = zext i1 %0 to i64
  %5 = or i64 %3, %4
  %6 = call i8* @amrit_alloc_struct(i64 12)
  %7 = bitcast i8* %6 to %struct.amrit_result.i32.i32*
  %8 = trunc i64 %5 to i1
  %9 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 0
  store i1 %8, i1* %9, align 1
  %10 = lshr i64 %5, 32
  %11 = trunc i64 %10 to i32
  %12 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 1
  store i32 %11, i32* %12, align 4
  %13 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 2
  store i32 %11, i32* %13, align 4
  %14 = call i8* @amrit_alloc_struct(i64 8)
  %15 = bitcast i8* %14 to %struct.Box*
  %16 = getelementptr inbounds %struct.Box, %struct.Box* %15, i32 0, i32 0
  store %struct.amrit_result.i32.i32* %7, %struct.amrit_result.i32.i32** %16, align 8
  ret %struct.Box* %15
}

define internal noundef { i1, i32 } @half(i32 noundef %n) #2 {
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
  call void @amrit_panic_div(i1 zeroext %14)
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

define noundef i32 @amrit_main() #2 {
entry:
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %amrit_result.i32.i32.obj.1 = alloca %struct.amrit_result.i32.i32, align 8
  %kept.addr = alloca %struct.Box*, align 8
  %inner.addr = alloca %struct.amrit_result.i32.i32*, align 8
  %0 = zext i32 41 to i64
  %1 = shl i64 %0, 32
  %2 = or i64 %1, 1
  %3 = trunc i64 %2 to i1
  %4 = lshr i64 %2, 32
  %5 = trunc i64 %4 to i32
  %6 = insertvalue { i1, i32 } undef, i1 %3, 0
  %7 = insertvalue { i1, i32 } %6, i32 %5, 1
  %8 = call i32 @describe({ i1, i32 } %7)
  %9 = call i8* @amrit_str_from_i32(i32 %8)
  call void @amrit_print(i8* %9)
  %10 = call { i1, i32 } @half(i32 8)
  %11 = extractvalue { i1, i32 } %10, 0
  %12 = extractvalue { i1, i32 } %10, 1
  %13 = zext i32 %12 to i64
  %14 = shl i64 %13, 32
  %15 = zext i1 %11 to i64
  %16 = or i64 %14, %15
  %17 = trunc i64 %16 to i1
  %18 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %17, i1* %18, align 1
  %19 = lshr i64 %16, 32
  %20 = trunc i64 %19 to i32
  %21 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %20, i32* %21, align 4
  %22 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %20, i32* %22, align 4
  %23 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  %24 = load i1, i1* %23, align 1
  %25 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  %26 = load i32, i32* %25, align 4
  %27 = zext i32 %26 to i64
  %28 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  %29 = load i32, i32* %28, align 4
  %30 = zext i32 %29 to i64
  %31 = select i1 %24, i64 %30, i64 %27
  %32 = shl i64 %31, 32
  %33 = zext i1 %24 to i64
  %34 = or i64 %32, %33
  %35 = trunc i64 %34 to i1
  %36 = lshr i64 %34, 32
  %37 = trunc i64 %36 to i32
  %38 = insertvalue { i1, i32 } undef, i1 %35, 0
  %39 = insertvalue { i1, i32 } %38, i32 %37, 1
  %40 = call i32 @describe({ i1, i32 } %39)
  %41 = call i8* @amrit_str_from_i32(i32 %40)
  call void @amrit_print(i8* %41)
  %42 = call { i1, i32 } @half(i32 7)
  %43 = extractvalue { i1, i32 } %42, 0
  %44 = extractvalue { i1, i32 } %42, 1
  %45 = zext i32 %44 to i64
  %46 = shl i64 %45, 32
  %47 = zext i1 %43 to i64
  %48 = or i64 %46, %47
  %49 = trunc i64 %48 to i1
  %50 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %49, i1* %50, align 1
  %51 = lshr i64 %48, 32
  %52 = trunc i64 %51 to i32
  %53 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %52, i32* %53, align 4
  %54 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %52, i32* %54, align 4
  %55 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  %56 = load i1, i1* %55, align 1
  %57 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  %58 = load i32, i32* %57, align 4
  %59 = zext i32 %58 to i64
  %60 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  %61 = load i32, i32* %60, align 4
  %62 = zext i32 %61 to i64
  %63 = select i1 %56, i64 %62, i64 %59
  %64 = shl i64 %63, 32
  %65 = zext i1 %56 to i64
  %66 = or i64 %64, %65
  %67 = trunc i64 %66 to i1
  %68 = lshr i64 %66, 32
  %69 = trunc i64 %68 to i32
  %70 = insertvalue { i1, i32 } undef, i1 %67, 0
  %71 = insertvalue { i1, i32 } %70, i32 %69, 1
  %72 = call i32 @describe({ i1, i32 } %71)
  %73 = call i8* @amrit_str_from_i32(i32 %72)
  call void @amrit_print(i8* %73)
  %74 = zext i32 5 to i64
  %75 = shl i64 %74, 32
  %76 = or i64 %75, 1
  %77 = trunc i64 %76 to i1
  %78 = lshr i64 %76, 32
  %79 = trunc i64 %78 to i32
  %80 = insertvalue { i1, i32 } undef, i1 %77, 0
  %81 = insertvalue { i1, i32 } %80, i32 %79, 1
  %82 = call %struct.Box* @boxed({ i1, i32 } %81)
  store %struct.Box* %82, %struct.Box** %kept.addr, align 8
  %83 = load %struct.Box*, %struct.Box** %kept.addr, align 8
  %84 = getelementptr inbounds %struct.Box, %struct.Box* %83, i32 0, i32 0
  %85 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %84, align 8
  store %struct.amrit_result.i32.i32* %85, %struct.amrit_result.i32.i32** %inner.addr, align 8
  %86 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %inner.addr, align 8
  %87 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %86, i32 0, i32 0
  %88 = load i1, i1* %87, align 1
  br i1 %88, label %if.then, label %if.end

if.then:
  %89 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %inner.addr, align 8
  %90 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %89, i32 0, i32 1
  %91 = load i32, i32* %90, align 4
  %92 = call i8* @amrit_str_from_i32(i32 %91)
  call void @amrit_print(i8* %92)
  br label %if.end

if.end:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
