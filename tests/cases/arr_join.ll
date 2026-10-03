%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alpha\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"beta\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"solo\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
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

define internal noundef nonnull align 8 i8* @report(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*) to i64*
  %3 = load i64, i64* %2, align 8
  %4 = sub i64 %1, 1
  %5 = mul i64 %3, %4
  %6 = icmp eq i64 %1, 0
  %7 = select i1 %6, i64 0, i64 %5
  store i64 %7, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %8 = load i64, i64* %join.at, align 8
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %join.sum.body, label %join.copy

join.sum.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %8
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = load i64, i64* %join.total, align 8
  %16 = bitcast i8* %14 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = add i64 %15, %17
  store i64 %18, i64* %join.total, align 8
  %19 = add i64 %8, 1
  store i64 %19, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %20 = load i64, i64* %join.total, align 8
  %21 = icmp ugt i64 %20, 2147483647
  %22 = add i64 %20, 9
  %23 = select i1 %21, i64 4611686018427387904, i64 %22
  %24 = call i8* @nish_alloc_struct(i64 %23)
  %25 = bitcast i8* %24 to i64*
  store i64 %20, i64* %25, align 8
  %26 = getelementptr inbounds i8, i8* %24, i64 8
  store i8* %26, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %27 = load i64, i64* %join.at, align 8
  %28 = icmp ult i64 %27, %1
  br i1 %28, label %join.part, label %join.end

join.part:
  %29 = load i8*, i8** %join.p, align 8
  %30 = icmp eq i64 %27, 0
  %31 = select i1 %30, i64 0, i64 %3
  %32 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %32, i64 %31, i1 false)
  %33 = getelementptr inbounds i8, i8* %29, i64 %31
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %27
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = getelementptr inbounds i8, i8* %38, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %33, i8* %41, i64 %40, i1 false)
  %42 = getelementptr inbounds i8, i8* %33, i64 %40
  store i8* %42, i8** %join.p, align 8
  %43 = add i64 %27, 1
  store i64 %43, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %44 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %44, align 1
  ret i8* %24
}

define noundef i32 @test() #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %one.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %join.total.2 = alloca i64, align 8
  %join.at.2 = alloca i64, align 8
  %join.p.2 = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = bitcast [1 x i8*]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %32 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %one.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %37 = call i64 @nish_arena_mark()
  %38 = call i8* @report(%struct.nish_array* %36)
  %39 = call i8* @nish_arena_keep(i64 %37, i8* %38)
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = trunc i64 %41 to i32
  %43 = mul nsw i32 %42, 1000
  %44 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %48 = load i64, i64* %47, align 8
  %49 = sub i64 %46, 1
  %50 = mul i64 %48, %49
  %51 = icmp eq i64 %46, 0
  %52 = select i1 %51, i64 0, i64 %50
  store i64 %52, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %46
  br i1 %54, label %join.sum.body, label %join.copy

join.sum.body:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = bitcast i8* %56 to i8**
  %58 = getelementptr inbounds i8*, i8** %57, i64 %53
  %59 = load i8*, i8** %58, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %60 = load i64, i64* %join.total, align 8
  %61 = bitcast i8* %59 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = add i64 %60, %62
  store i64 %63, i64* %join.total, align 8
  %64 = add i64 %53, 1
  store i64 %64, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %65 = load i64, i64* %join.total, align 8
  %66 = icmp ugt i64 %65, 2147483647
  %67 = add i64 %65, 9
  %68 = select i1 %66, i64 4611686018427387904, i64 %67
  %69 = call i8* @nish_alloc_struct(i64 %68)
  %70 = bitcast i8* %69 to i64*
  store i64 %65, i64* %70, align 8
  %71 = getelementptr inbounds i8, i8* %69, i64 8
  store i8* %71, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %72 = load i64, i64* %join.at, align 8
  %73 = icmp ult i64 %72, %46
  br i1 %73, label %join.part, label %join.end

join.part:
  %74 = load i8*, i8** %join.p, align 8
  %75 = icmp eq i64 %72, 0
  %76 = select i1 %75, i64 0, i64 %48
  %77 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %74, i8* %77, i64 %76, i1 false)
  %78 = getelementptr inbounds i8, i8* %74, i64 %76
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %81 = bitcast i8* %80 to i8**
  %82 = getelementptr inbounds i8*, i8** %81, i64 %72
  %83 = load i8*, i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %84 = bitcast i8* %83 to i64*
  %85 = load i64, i64* %84, align 8
  %86 = getelementptr inbounds i8, i8* %83, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %78, i8* %86, i64 %85, i1 false)
  %87 = getelementptr inbounds i8, i8* %78, i64 %85
  store i8* %87, i8** %join.p, align 8
  %88 = add i64 %72, 1
  store i64 %88, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %89 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %89, align 1
  %90 = bitcast i8* %69 to i64*
  %91 = load i64, i64* %90, align 8
  %92 = trunc i64 %91 to i32
  %93 = mul nsw i32 %92, 10
  %94 = add nsw i32 %43, %93
  %95 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %99 = load i64, i64* %98, align 8
  %100 = sub i64 %97, 1
  %101 = mul i64 %99, %100
  %102 = icmp eq i64 %97, 0
  %103 = select i1 %102, i64 0, i64 %101
  store i64 %103, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %104 = load i64, i64* %join.at.1, align 8
  %105 = icmp ult i64 %104, %97
  br i1 %105, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %107 = load i8*, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %108 = bitcast i8* %107 to i8**
  %109 = getelementptr inbounds i8*, i8** %108, i64 %104
  %110 = load i8*, i8** %109, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %111 = load i64, i64* %join.total.1, align 8
  %112 = bitcast i8* %110 to i64*
  %113 = load i64, i64* %112, align 8
  %114 = add i64 %111, %113
  store i64 %114, i64* %join.total.1, align 8
  %115 = add i64 %104, 1
  store i64 %115, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %116 = load i64, i64* %join.total.1, align 8
  %117 = icmp ugt i64 %116, 2147483647
  %118 = add i64 %116, 9
  %119 = select i1 %117, i64 4611686018427387904, i64 %118
  %120 = call i8* @nish_alloc_struct(i64 %119)
  %121 = bitcast i8* %120 to i64*
  store i64 %116, i64* %121, align 8
  %122 = getelementptr inbounds i8, i8* %120, i64 8
  store i8* %122, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %123 = load i64, i64* %join.at.1, align 8
  %124 = icmp ult i64 %123, %97
  br i1 %124, label %join.part.1, label %join.end.1

join.part.1:
  %125 = load i8*, i8** %join.p.1, align 8
  %126 = icmp eq i64 %123, 0
  %127 = select i1 %126, i64 0, i64 %99
  %128 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %125, i8* %128, i64 %127, i1 false)
  %129 = getelementptr inbounds i8, i8* %125, i64 %127
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %132 = bitcast i8* %131 to i8**
  %133 = getelementptr inbounds i8*, i8** %132, i64 %123
  %134 = load i8*, i8** %133, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %135 = bitcast i8* %134 to i64*
  %136 = load i64, i64* %135, align 8
  %137 = getelementptr inbounds i8, i8* %134, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %129, i8* %137, i64 %136, i1 false)
  %138 = getelementptr inbounds i8, i8* %129, i64 %136
  store i8* %138, i8** %join.p.1, align 8
  %139 = add i64 %123, 1
  store i64 %139, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %140 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %140, align 1
  %141 = bitcast i8* %120 to i64*
  %142 = load i64, i64* %141, align 8
  %143 = trunc i64 %142 to i32
  %144 = add nsw i32 %94, %143
  %145 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 0
  %147 = load i64, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %148 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*) to i64*
  %149 = load i64, i64* %148, align 8
  %150 = sub i64 %147, 1
  %151 = mul i64 %149, %150
  %152 = icmp eq i64 %147, 0
  %153 = select i1 %152, i64 0, i64 %151
  store i64 %153, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %154 = load i64, i64* %join.at.2, align 8
  %155 = icmp ult i64 %154, %147
  br i1 %155, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %158 = bitcast i8* %157 to i8**
  %159 = getelementptr inbounds i8*, i8** %158, i64 %154
  %160 = load i8*, i8** %159, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %161 = load i64, i64* %join.total.2, align 8
  %162 = bitcast i8* %160 to i64*
  %163 = load i64, i64* %162, align 8
  %164 = add i64 %161, %163
  store i64 %164, i64* %join.total.2, align 8
  %165 = add i64 %154, 1
  store i64 %165, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %166 = load i64, i64* %join.total.2, align 8
  %167 = icmp ugt i64 %166, 2147483647
  %168 = add i64 %166, 9
  %169 = select i1 %167, i64 4611686018427387904, i64 %168
  %170 = call i8* @nish_alloc_struct(i64 %169)
  %171 = bitcast i8* %170 to i64*
  store i64 %166, i64* %171, align 8
  %172 = getelementptr inbounds i8, i8* %170, i64 8
  store i8* %172, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %173 = load i64, i64* %join.at.2, align 8
  %174 = icmp ult i64 %173, %147
  br i1 %174, label %join.part.2, label %join.end.2

join.part.2:
  %175 = load i8*, i8** %join.p.2, align 8
  %176 = icmp eq i64 %173, 0
  %177 = select i1 %176, i64 0, i64 %149
  %178 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %175, i8* %178, i64 %177, i1 false)
  %179 = getelementptr inbounds i8, i8* %175, i64 %177
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 2
  %181 = load i8*, i8** %180, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %182 = bitcast i8* %181 to i8**
  %183 = getelementptr inbounds i8*, i8** %182, i64 %173
  %184 = load i8*, i8** %183, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %185 = bitcast i8* %184 to i64*
  %186 = load i64, i64* %185, align 8
  %187 = getelementptr inbounds i8, i8* %184, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %179, i8* %187, i64 %186, i1 false)
  %188 = getelementptr inbounds i8, i8* %179, i64 %186
  store i8* %188, i8** %join.p.2, align 8
  %189 = add i64 %173, 1
  store i64 %189, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %190 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %190, align 1
  %191 = bitcast i8* %170 to i64*
  %192 = load i64, i64* %191, align 8
  %193 = trunc i64 %192 to i32
  %194 = add nsw i32 %144, %193
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %194
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
