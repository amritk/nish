%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #2
declare noundef i64 @sts_arena_mark() #2
declare void @sts_arena_release(i64 noundef) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #4

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

define noundef i32 @weights() #0 {
entry:
  %ws.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 5, i32* %6, align 4
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 7, i32* %7, align 4
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %ws.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %8 = load %struct.sts_array*, %struct.sts_array** %ws.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  %17 = load i32, i32* %16, align 4
  store i32 %17, i32* %w.addr, align 4
  %18 = load i32, i32* %total.addr, align 4
  %19 = load i32, i32* %w.addr, align 4
  %20 = add i32 %18, %19
  store i32 %20, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %21 = load i64, i64* %forof.idx, align 8
  %22 = add i64 %21, 1
  store i64 %22, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %23 = load i32, i32* %total.addr, align 4
  %24 = load %struct.sts_array*, %struct.sts_array** %ws.addr, align 8
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = mul i32 %23, %27
  ret i32 %28
}

define noundef i32 @zeroed() #1 {
entry:
  %zs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8
  %2 = mul i64 4, 4
  %3 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false)
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %zs.addr, align 8
  %5 = load %struct.sts_array*, %struct.sts_array** %zs.addr, align 8
  %6 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8
  %8 = icmp ult i64 2, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 2, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 2
  store i32 9, i32* %12, align 4
  %13 = load %struct.sts_array*, %struct.sts_array** %zs.addr, align 8
  %14 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8
  %16 = icmp ult i64 0, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 0, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  %21 = load i32, i32* %20, align 4
  %22 = load %struct.sts_array*, %struct.sts_array** %zs.addr, align 8
  %23 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 2, %24
  br i1 %25, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 2, i64 %24)
  unreachable

bounds.ok.2:
  %26 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 2
  %30 = load i32, i32* %29, align 4
  %31 = add i32 %21, %30
  ret i32 %31
}

define noundef i32 @grown() #1 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  %7 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %7, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 3, i32* %16, align 4
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8
  %18 = trunc i64 %17 to i32
  %19 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %20 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8
  %22 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %19, i64 0, i32 1
  %23 = load i64, i64* %22, align 8
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @sts_array_grow(%struct.sts_array* %19, i64 4)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %19, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %21
  store i32 4, i32* %28, align 4
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8
  %30 = trunc i64 %29 to i32
  %31 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %32 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8
  %34 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %31, i64 0, i32 1
  %35 = load i64, i64* %34, align 8
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @sts_array_grow(%struct.sts_array* %31, i64 4)
  br label %push.store.2

push.store.2:
  %37 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %31, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  store i32 5, i32* %40, align 4
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8
  %42 = trunc i64 %41 to i32
  %43 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %44 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8
  %46 = icmp ult i64 4, %45
  br i1 %46, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 4, i64 %45)
  unreachable

bounds.ok:
  %47 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %43, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 4
  %51 = load i32, i32* %50, align 4
  %52 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %53 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8
  %55 = trunc i64 %54 to i32
  %56 = add i32 %51, %55
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %56
}

define noundef nonnull align 8 %struct.sts_array* @escaped() #2 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8
  %4 = call i8* @sts_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4
  ret %struct.sts_array* %1
}

define noundef i32 @sts_main() #1 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i32 @weights()
  %1 = call i8* @sts_str_from_i32(i32 %0)
  call void @sts_print(i8* %1)
  %2 = call i32 @zeroed()
  %3 = call i8* @sts_str_from_i32(i32 %2)
  call void @sts_print(i8* %3)
  %4 = call i32 @grown()
  %5 = call i8* @sts_str_from_i32(i32 %4)
  call void @sts_print(i8* %5)
  %6 = call %struct.sts_array* @escaped()
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8
  %9 = icmp ult i64 1, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 1, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %6, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 1
  %14 = load i32, i32* %13, align 4
  %15 = call i8* @sts_str_from_i32(i32 %14)
  call void @sts_print(i8* %15)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
