%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #1
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1

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

define noundef i32 @total(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = icmp slt i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %11 = load i32, i32* %x.addr, align 4
  %12 = icmp sgt i32 %11, 100
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end

if.end.1:
  %13 = load i32, i32* %sum.addr, align 4
  %14 = load i32, i32* %x.addr, align 4
  %15 = add i32 %13, %14
  store i32 %15, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

define noundef i32 @sts_main() #1 {
entry:
  %word.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = sub i32 0, 2
  %1 = call i8* @sts_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.sts_array*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 0
  store i64 5, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 1
  store i64 5, i64* %4, align 8
  %5 = call i8* @sts_alloc_struct(i64 20)
  %6 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 %0, i32* %9, align 4
  %10 = getelementptr inbounds i32, i32* %7, i64 2
  store i32 3, i32* %10, align 4
  %11 = getelementptr inbounds i32, i32* %7, i64 3
  store i32 500, i32* %11, align 4
  %12 = getelementptr inbounds i32, i32* %7, i64 4
  store i32 4, i32* %12, align 4
  %13 = call i32 @total(%struct.sts_array* %2)
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = call i8* @sts_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.sts_array*
  %17 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 0
  store i64 2, i64* %17, align 8
  %18 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 1
  store i64 2, i64* %18, align 8
  %19 = call i8* @sts_alloc_struct(i64 16)
  %20 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 2
  store i8* %19, i8** %20, align 8
  %21 = bitcast i8* %19 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %22, align 8
  %23 = getelementptr inbounds i8*, i8** %21, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %23, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %24 = load i64, i64* %forof.idx, align 8
  %25 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 0
  %26 = load i64, i64* %25, align 8
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %forof.body, label %forof.end

forof.body:
  %28 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8
  %30 = bitcast i8* %29 to i8**
  %31 = getelementptr inbounds i8*, i8** %30, i64 %24
  %32 = load i8*, i8** %31, align 8
  store i8* %32, i8** %word.addr, align 8
  %33 = load i8*, i8** %word.addr, align 8
  %34 = call i8* @sts_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %33)
  %35 = call i8* @sts_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %35, i8** %word.addr, align 8
  %36 = load i8*, i8** %word.addr, align 8
  call void @sts_print(i8* %36)
  br label %forof.inc

forof.inc:
  %37 = load i64, i64* %forof.idx, align 8
  %38 = add i64 %37, 1
  store i64 %38, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
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
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
