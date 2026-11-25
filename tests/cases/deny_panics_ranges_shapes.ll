%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"slice out of range: [\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c") of length \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pair(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %j.addr = alloca i32, align 4
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %i, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = add nsw i32 %i, 1
  store i32 %6, i32* %j.addr, align 4
  %7 = load i32, i32* %j.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sle i32 %7, %10
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %j.addr, align 4
  %13 = call %struct.nish_array* @nish.slice$i32(%struct.nish_array* %xs, i32 %i, i32 %12)
  ret %struct.nish_array* %13

if.end.1:
  br label %if.end

if.end:
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %15
}

define internal noundef nonnull align 8 i8* @head(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sge i32 %2, 2
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = getelementptr inbounds i8, i8* %5, i64 0
  %7 = sub i64 2, 0
  %8 = call i8* @nish_str_new(i8* %6, i64 %7)
  ret i8* %8

if.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sle i32 %2, %5
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %12, i8* %16, i64 %8, i1 false), !alias.scope !4, !noalias !3
  br label %if.end

if.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @from(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %a) #0 {
entry:
  %0 = icmp sge i32 %a, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sle i32 %a, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = call %struct.nish_array* @nish.sliceFrom$i32(%struct.nish_array* %xs, i32 %a)
  ret %struct.nish_array* %6

if.end:
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %8
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %p.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i8], align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [4 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = call %struct.nish_array* @nish.slice$i32(%struct.nish_array* %8, i32 1, i32 2)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %15 = call %struct.nish_array* @pair(%struct.nish_array* %14, i32 2)
  store %struct.nish_array* %15, %struct.nish_array** %p.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %p.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = icmp sgt i32 %19, 0
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load %struct.nish_array*, %struct.nish_array** %p.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  br label %if.end

if.end:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast [3 x i8]* %arr.data.1 to i8*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %30 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 0
  store i8 104, i8* %33, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %34 = getelementptr inbounds i8, i8* %32, i64 1
  store i8 105, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = getelementptr inbounds i8, i8* %32, i64 2
  store i8 33, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %37 = call i64 @nish_arena_mark()
  %38 = call i8* @head(%struct.nish_array* %36)
  %39 = call i8* @nish_arena_keep(i64 %37, i8* %38)
  call void @nish_print(i8* %39)
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 4, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 4, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast [4 x i8]* %arr.data.2 to i8*
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %42 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 0
  store i8 0, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %46 = getelementptr inbounds i8, i8* %44, i64 1
  store i8 0, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %47 = getelementptr inbounds i8, i8* %44, i64 2
  store i8 0, i8* %47, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %48 = getelementptr inbounds i8, i8* %44, i64 3
  store i8 0, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %d.addr, align 8
  %49 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @fill(%struct.nish_array* %49, %struct.nish_array* %50)
  %51 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = trunc i64 %53 to i32
  %55 = icmp sgt i32 %54, 2
  br i1 %55, label %if.then.1, label %if.end.1

if.then.1:
  %56 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8*
  %60 = getelementptr inbounds i8, i8* %59, i64 2
  %61 = load i8, i8* %60, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %62 = zext i8 %61 to i64
  %63 = call i8* @nish_str_from_u64(i64 %62)
  call void @nish_print(i8* %63)
  br label %if.end.1

if.end.1:
  %64 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %65 = call %struct.nish_array* @from(%struct.nish_array* %64, i32 1)
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = call i8* @nish_str_from_i32(i32 %68)
  call void @nish_print(i8* %69)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.slice$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %from.addr = alloca i64, align 8
  %to.addr = alloca i64, align 8
  %len.addr = alloca i64, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %start to i64
  store i64 %0, i64* %from.addr, align 8
  %1 = sext i32 %end to i64
  store i64 %1, i64* %to.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = sext i32 %4 to i64
  store i64 %5, i64* %len.addr, align 8
  %6 = load i64, i64* %from.addr, align 8
  %7 = icmp slt i64 %6, 0
  br i1 %7, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %8 = load i64, i64* %from.addr, align 8
  %9 = load i64, i64* %to.addr, align 8
  %10 = icmp sgt i64 %8, %9
  br label %lor.end.1

lor.end.1:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs.1 ]
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i64, i64* %to.addr, align 8
  %13 = load i64, i64* %len.addr, align 8
  %14 = icmp sgt i64 %12, %13
  br label %lor.end

lor.end:
  %15 = phi i1 [ true, %lor.end.1 ], [ %14, %lor.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i64, i64* %from.addr, align 8
  %17 = call i8* @nish_str_from_i64(i64 %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.1 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %20 = load i64, i64* %to.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [13 x i8] }* @.str.3 to i8*))
  %24 = load i64, i64* %len.addr, align 8
  %25 = call i8* @nish_str_from_i64(i64 %24)
  %26 = call i8* @nish_str_concat(i8* %23, i8* %25)
  call void @nish_panic(i8* %26)
  unreachable

if.end:
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %28, %struct.nish_array** %out.addr, align 8
  %32 = load i64, i64* %from.addr, align 8
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %34 = load i32, i32* %i.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %36 = load i32, i32* %i.addr, align 4
  %37 = load i64, i64* %to.addr, align 8
  %38 = trunc i64 %37 to i32
  %39 = icmp slt i32 %36, %38
  br label %land.end.1

land.end.1:
  %40 = phi i1 [ false, %for.cond ], [ %39, %land.rhs.1 ]
  br i1 %40, label %land.rhs, label %land.end

land.rhs:
  %41 = load i32, i32* %i.addr, align 4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = icmp slt i32 %41, %44
  br label %land.end

land.end:
  %46 = phi i1 [ false, %land.end.1 ], [ %45, %land.rhs ]
  br i1 %46, label %for.body, label %for.end

for.body:
  %47 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %48 = load i32, i32* %i.addr, align 4
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 %49
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = icmp eq i64 %56, %58
  br i1 %59, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store

push.store:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %56
  store i32 %54, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = add i64 %56, 1
  store i64 %64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = trunc i64 %64 to i32
  br label %for.inc

for.inc:
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %68 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %68
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sliceFrom$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %start) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = call %struct.nish_array* @nish.slice$i32(%struct.nish_array* %xs, i32 %start, i32 %2)
  ret %struct.nish_array* %3
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
