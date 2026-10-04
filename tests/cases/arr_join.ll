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
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define noundef i32 @test() #1 {
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
  %43 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %42, i32 1000)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok

ovf.ok:
  %46 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %50 = load i64, i64* %49, align 8
  %51 = sub i64 %48, 1
  %52 = mul i64 %50, %51
  %53 = icmp eq i64 %48, 0
  %54 = select i1 %53, i64 0, i64 %52
  store i64 %54, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %55 = load i64, i64* %join.at, align 8
  %56 = icmp ult i64 %55, %48
  br i1 %56, label %join.sum.body, label %join.copy

join.sum.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %55
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %62 = load i64, i64* %join.total, align 8
  %63 = bitcast i8* %61 to i64*
  %64 = load i64, i64* %63, align 8
  %65 = add i64 %62, %64
  store i64 %65, i64* %join.total, align 8
  %66 = add i64 %55, 1
  store i64 %66, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %67 = load i64, i64* %join.total, align 8
  %68 = icmp ugt i64 %67, 2147483647
  %69 = add i64 %67, 9
  %70 = select i1 %68, i64 4611686018427387904, i64 %69
  %71 = call i8* @nish_alloc_struct(i64 %70)
  %72 = bitcast i8* %71 to i64*
  store i64 %67, i64* %72, align 8
  %73 = getelementptr inbounds i8, i8* %71, i64 8
  store i8* %73, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %74 = load i64, i64* %join.at, align 8
  %75 = icmp ult i64 %74, %48
  br i1 %75, label %join.part, label %join.end

join.part:
  %76 = load i8*, i8** %join.p, align 8
  %77 = icmp eq i64 %74, 0
  %78 = select i1 %77, i64 0, i64 %50
  %79 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %76, i8* %79, i64 %78, i1 false)
  %80 = getelementptr inbounds i8, i8* %76, i64 %78
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %83 = bitcast i8* %82 to i8**
  %84 = getelementptr inbounds i8*, i8** %83, i64 %74
  %85 = load i8*, i8** %84, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %86 = bitcast i8* %85 to i64*
  %87 = load i64, i64* %86, align 8
  %88 = getelementptr inbounds i8, i8* %85, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %80, i8* %88, i64 %87, i1 false)
  %89 = getelementptr inbounds i8, i8* %80, i64 %87
  store i8* %89, i8** %join.p, align 8
  %90 = add i64 %74, 1
  store i64 %90, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %91 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %91, align 1
  %92 = bitcast i8* %71 to i64*
  %93 = load i64, i64* %92, align 8
  %94 = trunc i64 %93 to i32
  %95 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %94, i32 10)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %98 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %96)
  %99 = extractvalue { i32, i1 } %98, 0
  %100 = extractvalue { i32, i1 } %98, 1
  br i1 %100, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %101 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %105 = load i64, i64* %104, align 8
  %106 = sub i64 %103, 1
  %107 = mul i64 %105, %106
  %108 = icmp eq i64 %103, 0
  %109 = select i1 %108, i64 0, i64 %107
  store i64 %109, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %110 = load i64, i64* %join.at.1, align 8
  %111 = icmp ult i64 %110, %103
  br i1 %111, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = bitcast i8* %113 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %110
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %117 = load i64, i64* %join.total.1, align 8
  %118 = bitcast i8* %116 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = add i64 %117, %119
  store i64 %120, i64* %join.total.1, align 8
  %121 = add i64 %110, 1
  store i64 %121, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %122 = load i64, i64* %join.total.1, align 8
  %123 = icmp ugt i64 %122, 2147483647
  %124 = add i64 %122, 9
  %125 = select i1 %123, i64 4611686018427387904, i64 %124
  %126 = call i8* @nish_alloc_struct(i64 %125)
  %127 = bitcast i8* %126 to i64*
  store i64 %122, i64* %127, align 8
  %128 = getelementptr inbounds i8, i8* %126, i64 8
  store i8* %128, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %129 = load i64, i64* %join.at.1, align 8
  %130 = icmp ult i64 %129, %103
  br i1 %130, label %join.part.1, label %join.end.1

join.part.1:
  %131 = load i8*, i8** %join.p.1, align 8
  %132 = icmp eq i64 %129, 0
  %133 = select i1 %132, i64 0, i64 %105
  %134 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %131, i8* %134, i64 %133, i1 false)
  %135 = getelementptr inbounds i8, i8* %131, i64 %133
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %137 to i8**
  %139 = getelementptr inbounds i8*, i8** %138, i64 %129
  %140 = load i8*, i8** %139, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %141 = bitcast i8* %140 to i64*
  %142 = load i64, i64* %141, align 8
  %143 = getelementptr inbounds i8, i8* %140, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %135, i8* %143, i64 %142, i1 false)
  %144 = getelementptr inbounds i8, i8* %135, i64 %142
  store i8* %144, i8** %join.p.1, align 8
  %145 = add i64 %129, 1
  store i64 %145, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %146 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %146, align 1
  %147 = bitcast i8* %126 to i64*
  %148 = load i64, i64* %147, align 8
  %149 = trunc i64 %148 to i32
  %150 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %99, i32 %149)
  %151 = extractvalue { i32, i1 } %150, 0
  %152 = extractvalue { i32, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %153 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*) to i64*
  %157 = load i64, i64* %156, align 8
  %158 = sub i64 %155, 1
  %159 = mul i64 %157, %158
  %160 = icmp eq i64 %155, 0
  %161 = select i1 %160, i64 0, i64 %159
  store i64 %161, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %162 = load i64, i64* %join.at.2, align 8
  %163 = icmp ult i64 %162, %155
  br i1 %163, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 2
  %165 = load i8*, i8** %164, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %166 = bitcast i8* %165 to i8**
  %167 = getelementptr inbounds i8*, i8** %166, i64 %162
  %168 = load i8*, i8** %167, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %169 = load i64, i64* %join.total.2, align 8
  %170 = bitcast i8* %168 to i64*
  %171 = load i64, i64* %170, align 8
  %172 = add i64 %169, %171
  store i64 %172, i64* %join.total.2, align 8
  %173 = add i64 %162, 1
  store i64 %173, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %174 = load i64, i64* %join.total.2, align 8
  %175 = icmp ugt i64 %174, 2147483647
  %176 = add i64 %174, 9
  %177 = select i1 %175, i64 4611686018427387904, i64 %176
  %178 = call i8* @nish_alloc_struct(i64 %177)
  %179 = bitcast i8* %178 to i64*
  store i64 %174, i64* %179, align 8
  %180 = getelementptr inbounds i8, i8* %178, i64 8
  store i8* %180, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %181 = load i64, i64* %join.at.2, align 8
  %182 = icmp ult i64 %181, %155
  br i1 %182, label %join.part.2, label %join.end.2

join.part.2:
  %183 = load i8*, i8** %join.p.2, align 8
  %184 = icmp eq i64 %181, 0
  %185 = select i1 %184, i64 0, i64 %157
  %186 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %183, i8* %186, i64 %185, i1 false)
  %187 = getelementptr inbounds i8, i8* %183, i64 %185
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 2
  %189 = load i8*, i8** %188, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %190 = bitcast i8* %189 to i8**
  %191 = getelementptr inbounds i8*, i8** %190, i64 %181
  %192 = load i8*, i8** %191, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %193 = bitcast i8* %192 to i64*
  %194 = load i64, i64* %193, align 8
  %195 = getelementptr inbounds i8, i8* %192, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %187, i8* %195, i64 %194, i1 false)
  %196 = getelementptr inbounds i8, i8* %187, i64 %194
  store i8* %196, i8** %join.p.2, align 8
  %197 = add i64 %181, 1
  store i64 %197, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %198 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %198, align 1
  %199 = bitcast i8* %178 to i64*
  %200 = load i64, i64* %199, align 8
  %201 = trunc i64 %200 to i32
  %202 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %151, i32 %201)
  %203 = extractvalue { i32, i1 } %202, 0
  %204 = extractvalue { i32, i1 } %202, 1
  br i1 %204, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %203

ovf.fail:
  %ovf.op = phi i32 [ 2, %push.store.1 ], [ 2, %join.end ], [ 0, %ovf.ok.1 ], [ 0, %join.end.1 ], [ 0, %join.end.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
