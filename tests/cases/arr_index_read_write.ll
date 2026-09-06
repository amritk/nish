%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_free_arena() #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
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

define void @set(%struct.sts_array* noundef nonnull align 8 nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4
  ret void
}

define noundef i32 @get(%struct.sts_array* noundef nonnull align 8 readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

define noundef i32 @sts_main() #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8
  %4 = call i8* @sts_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4
  store %struct.sts_array* %1, %struct.sts_array** %xs.addr, align 8
  %10 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  call void @set(%struct.sts_array* %10, i32 1, i32 42)
  %11 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %12 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8
  %14 = icmp ult i64 0, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4
  %20 = add i32 %19, 5
  store i32 %20, i32* %18, align 4
  %21 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %22 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8
  %24 = icmp ult i64 2, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 2, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 2
  %29 = load i32, i32* %28, align 4
  %30 = mul i32 %29, 10
  store i32 %30, i32* %28, align 4
  %31 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %32 = call i32 @get(%struct.sts_array* %31, i32 0)
  %33 = call i8* @sts_str_from_i32(i32 %32)
  call void @sts_print(i8* %33)
  %34 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %35 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8
  %37 = icmp ult i64 1, %36
  br i1 %37, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 1, i64 %36)
  unreachable

bounds.ok.2:
  %38 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 1
  %42 = load i32, i32* %41, align 4
  %43 = call i8* @sts_str_from_i32(i32 %42)
  call void @sts_print(i8* %43)
  %44 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = icmp ult i64 2, %46
  br i1 %47, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @sts_panic_index(i64 2, i64 %46)
  unreachable

bounds.ok.3:
  %48 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 2
  %52 = load i32, i32* %51, align 4
  %53 = call i8* @sts_str_from_i32(i32 %52)
  call void @sts_print(i8* %53)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
