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
  %42 = icmp eq i64 %40, 1
  br i1 %42, label %join.byte, label %join.bulk

join.byte:
  %43 = load i8, i8* %41, align 1
  store i8 %43, i8* %33, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %33, i8* %41, i64 %40, i1 false)
  br label %join.next

join.next:
  %44 = getelementptr inbounds i8, i8* %33, i64 %40
  store i8* %44, i8** %join.p, align 8
  %45 = add i64 %27, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %46 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %46, align 1
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
  %89 = icmp eq i64 %87, 1
  br i1 %89, label %join.byte, label %join.bulk

join.byte:
  %90 = load i8, i8* %88, align 1
  store i8 %90, i8* %80, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %80, i8* %88, i64 %87, i1 false)
  br label %join.next

join.next:
  %91 = getelementptr inbounds i8, i8* %80, i64 %87
  store i8* %91, i8** %join.p, align 8
  %92 = add i64 %74, 1
  store i64 %92, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %93 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %93, align 1
  %94 = bitcast i8* %71 to i64*
  %95 = load i64, i64* %94, align 8
  %96 = trunc i64 %95 to i32
  %97 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %96, i32 10)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %100 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %98)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %103 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %105 = load i64, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %106 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %107 = load i64, i64* %106, align 8
  %108 = sub i64 %105, 1
  %109 = mul i64 %107, %108
  %110 = icmp eq i64 %105, 0
  %111 = select i1 %110, i64 0, i64 %109
  store i64 %111, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %112 = load i64, i64* %join.at.1, align 8
  %113 = icmp ult i64 %112, %105
  br i1 %113, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast i8* %115 to i8**
  %117 = getelementptr inbounds i8*, i8** %116, i64 %112
  %118 = load i8*, i8** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %119 = load i64, i64* %join.total.1, align 8
  %120 = bitcast i8* %118 to i64*
  %121 = load i64, i64* %120, align 8
  %122 = add i64 %119, %121
  store i64 %122, i64* %join.total.1, align 8
  %123 = add i64 %112, 1
  store i64 %123, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %124 = load i64, i64* %join.total.1, align 8
  %125 = icmp ugt i64 %124, 2147483647
  %126 = add i64 %124, 9
  %127 = select i1 %125, i64 4611686018427387904, i64 %126
  %128 = call i8* @nish_alloc_struct(i64 %127)
  %129 = bitcast i8* %128 to i64*
  store i64 %124, i64* %129, align 8
  %130 = getelementptr inbounds i8, i8* %128, i64 8
  store i8* %130, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %131 = load i64, i64* %join.at.1, align 8
  %132 = icmp ult i64 %131, %105
  br i1 %132, label %join.part.1, label %join.end.1

join.part.1:
  %133 = load i8*, i8** %join.p.1, align 8
  %134 = icmp eq i64 %131, 0
  %135 = select i1 %134, i64 0, i64 %107
  %136 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %133, i8* %136, i64 %135, i1 false)
  %137 = getelementptr inbounds i8, i8* %133, i64 %135
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  %139 = load i8*, i8** %138, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = bitcast i8* %139 to i8**
  %141 = getelementptr inbounds i8*, i8** %140, i64 %131
  %142 = load i8*, i8** %141, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %143 = bitcast i8* %142 to i64*
  %144 = load i64, i64* %143, align 8
  %145 = getelementptr inbounds i8, i8* %142, i64 8
  %146 = icmp eq i64 %144, 1
  br i1 %146, label %join.byte.1, label %join.bulk.1

join.byte.1:
  %147 = load i8, i8* %145, align 1
  store i8 %147, i8* %137, align 1
  br label %join.next.1

join.bulk.1:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %137, i8* %145, i64 %144, i1 false)
  br label %join.next.1

join.next.1:
  %148 = getelementptr inbounds i8, i8* %137, i64 %144
  store i8* %148, i8** %join.p.1, align 8
  %149 = add i64 %131, 1
  store i64 %149, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %150 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %150, align 1
  %151 = bitcast i8* %128 to i64*
  %152 = load i64, i64* %151, align 8
  %153 = trunc i64 %152 to i32
  %154 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %101, i32 %153)
  %155 = extractvalue { i32, i1 } %154, 0
  %156 = extractvalue { i32, i1 } %154, 1
  br i1 %156, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %157 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %159 = load i64, i64* %158, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %160 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*) to i64*
  %161 = load i64, i64* %160, align 8
  %162 = sub i64 %159, 1
  %163 = mul i64 %161, %162
  %164 = icmp eq i64 %159, 0
  %165 = select i1 %164, i64 0, i64 %163
  store i64 %165, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %166 = load i64, i64* %join.at.2, align 8
  %167 = icmp ult i64 %166, %159
  br i1 %167, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %170 = bitcast i8* %169 to i8**
  %171 = getelementptr inbounds i8*, i8** %170, i64 %166
  %172 = load i8*, i8** %171, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %173 = load i64, i64* %join.total.2, align 8
  %174 = bitcast i8* %172 to i64*
  %175 = load i64, i64* %174, align 8
  %176 = add i64 %173, %175
  store i64 %176, i64* %join.total.2, align 8
  %177 = add i64 %166, 1
  store i64 %177, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %178 = load i64, i64* %join.total.2, align 8
  %179 = icmp ugt i64 %178, 2147483647
  %180 = add i64 %178, 9
  %181 = select i1 %179, i64 4611686018427387904, i64 %180
  %182 = call i8* @nish_alloc_struct(i64 %181)
  %183 = bitcast i8* %182 to i64*
  store i64 %178, i64* %183, align 8
  %184 = getelementptr inbounds i8, i8* %182, i64 8
  store i8* %184, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %185 = load i64, i64* %join.at.2, align 8
  %186 = icmp ult i64 %185, %159
  br i1 %186, label %join.part.2, label %join.end.2

join.part.2:
  %187 = load i8*, i8** %join.p.2, align 8
  %188 = icmp eq i64 %185, 0
  %189 = select i1 %188, i64 0, i64 %161
  %190 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %187, i8* %190, i64 %189, i1 false)
  %191 = getelementptr inbounds i8, i8* %187, i64 %189
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %193 = load i8*, i8** %192, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %194 = bitcast i8* %193 to i8**
  %195 = getelementptr inbounds i8*, i8** %194, i64 %185
  %196 = load i8*, i8** %195, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %197 = bitcast i8* %196 to i64*
  %198 = load i64, i64* %197, align 8
  %199 = getelementptr inbounds i8, i8* %196, i64 8
  %200 = icmp eq i64 %198, 1
  br i1 %200, label %join.byte.2, label %join.bulk.2

join.byte.2:
  %201 = load i8, i8* %199, align 1
  store i8 %201, i8* %191, align 1
  br label %join.next.2

join.bulk.2:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %191, i8* %199, i64 %198, i1 false)
  br label %join.next.2

join.next.2:
  %202 = getelementptr inbounds i8, i8* %191, i64 %198
  store i8* %202, i8** %join.p.2, align 8
  %203 = add i64 %185, 1
  store i64 %203, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %204 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %204, align 1
  %205 = bitcast i8* %182 to i64*
  %206 = load i64, i64* %205, align 8
  %207 = trunc i64 %206 to i32
  %208 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %155, i32 %207)
  %209 = extractvalue { i32, i1 } %208, 0
  %210 = extractvalue { i32, i1 } %208, 1
  br i1 %210, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %209

ovf.fail:
  %ovf.op = phi i32 [ 2, %push.store.1 ], [ 2, %join.end ], [ 0, %ovf.ok.1 ], [ 0, %join.end.1 ], [ 0, %join.end.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
