%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_free_arena() #3
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #3
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

define noundef i32 @len(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef nonnull align 8 i8* @last(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = sub i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8
  ret i8* %12
}

define noundef i32 @sts_main() #1 {
entry:
  %empty.addr = alloca %struct.sts_array*, align 8
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 5, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 5, i64* %3, align 8
  %4 = call i8* @sts_alloc_struct(i64 20)
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 5, i32* %11, align 4
  %12 = call i32 @len(%struct.sts_array* %1)
  %13 = call i8* @sts_str_from_i32(i32 %12)
  call void @sts_print(i8* %13)
  %14 = call i8* @sts_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.sts_array*
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8
  %17 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8
  %18 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8
  store %struct.sts_array* %15, %struct.sts_array** %empty.addr, align 8
  %19 = load %struct.sts_array*, %struct.sts_array** %empty.addr, align 8
  %20 = call i32 @len(%struct.sts_array* %19)
  %21 = call i8* @sts_str_from_i32(i32 %20)
  call void @sts_print(i8* %21)
  %22 = call i8* @sts_alloc_struct(i64 24)
  %23 = bitcast i8* %22 to %struct.sts_array*
  %24 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 0
  store i64 3, i64* %24, align 8
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 1
  store i64 3, i64* %25, align 8
  %26 = call i8* @sts_alloc_struct(i64 24)
  %27 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 2
  store i8* %26, i8** %27, align 8
  %28 = bitcast i8* %26 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %29, align 8
  %30 = getelementptr inbounds i8*, i8** %28, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %30, align 8
  %31 = getelementptr inbounds i8*, i8** %28, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %31, align 8
  %32 = call i8* @last(%struct.sts_array* %23)
  call void @sts_print(i8* %32)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }
