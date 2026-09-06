%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
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

define noundef i32 @first(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4
  ret i32 %7
}

define noundef i32 @sts_main() #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %flags.addr = alloca %struct.sts_array*, align 8
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
  store i32 10, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4
  store %struct.sts_array* %1, %struct.sts_array** %xs.addr, align 8
  %10 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %16 = call i32 @first(%struct.sts_array* %15)
  %17 = call i8* @sts_str_from_i32(i32 %16)
  call void @sts_print(i8* %17)
  %18 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %19 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8
  %21 = icmp ult i64 2, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 2, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 2
  %26 = load i32, i32* %25, align 4
  %27 = call i8* @sts_str_from_i32(i32 %26)
  call void @sts_print(i8* %27)
  %28 = call i8* @sts_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.sts_array*
  %30 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %29, i64 0, i32 0
  store i64 2, i64* %30, align 8
  %31 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %29, i64 0, i32 1
  store i64 2, i64* %31, align 8
  %32 = call i8* @sts_alloc_struct(i64 2)
  %33 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8
  %34 = bitcast i8* %32 to i1*
  %35 = getelementptr inbounds i1, i1* %34, i64 0
  store i1 true, i1* %35, align 1
  %36 = getelementptr inbounds i1, i1* %34, i64 1
  store i1 false, i1* %36, align 1
  store %struct.sts_array* %29, %struct.sts_array** %flags.addr, align 8
  %37 = load %struct.sts_array*, %struct.sts_array** %flags.addr, align 8
  %38 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8
  %40 = icmp ult i64 1, %39
  br i1 %40, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 1, i64 %39)
  unreachable

bounds.ok.1:
  %41 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %37, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8
  %43 = bitcast i8* %42 to i1*
  %44 = getelementptr inbounds i1, i1* %43, i64 1
  %45 = load i1, i1* %44, align 1
  %46 = select i1 %45, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %46)
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
