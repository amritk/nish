%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"0123456789abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare void @nish_random_fill(%struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

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

define internal noundef nonnull align 8 i8* @hex(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  %v.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %3
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store i8 %11, i8* %x.addr, align 1
  %12 = load i8, i8* %x.addr, align 1
  %13 = zext i8 %12 to i32
  store i32 %13, i32* %v.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %15 = bitcast i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*) to i64*
  %16 = load i64, i64* %15, align 8
  %17 = load i32, i32* %v.addr, align 4
  %18 = ashr i32 %17, 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @llvm.smin.i64(i64 %19, i64 %16)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = load i32, i32* %v.addr, align 4
  %23 = ashr i32 %22, 4
  %24 = add nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = call i64 @llvm.smin.i64(i64 %25, i64 %16)
  %27 = call i64 @llvm.smax.i64(i64 %26, i64 0)
  %28 = call i64 @llvm.smin.i64(i64 %21, i64 %27)
  %29 = call i64 @llvm.smax.i64(i64 %21, i64 %27)
  %30 = sub i64 %29, %28
  %31 = getelementptr inbounds i8, i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*), i64 8
  %32 = getelementptr inbounds i8, i8* %31, i64 %28
  %33 = call i8* @nish_str_new(i8* %32, i64 %30)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store

push.store:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 %35
  store i8* %33, i8** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = sitofp i64 %43 to double
  %45 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %46 = bitcast i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*) to i64*
  %47 = load i64, i64* %46, align 8
  %48 = load i32, i32* %v.addr, align 4
  %49 = and i32 %48, 15
  %50 = sext i32 %49 to i64
  %51 = call i64 @llvm.smin.i64(i64 %50, i64 %47)
  %52 = call i64 @llvm.smax.i64(i64 %51, i64 0)
  %53 = load i32, i32* %v.addr, align 4
  %54 = and i32 %53, 15
  %55 = add nsw i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = call i64 @llvm.smin.i64(i64 %56, i64 %47)
  %58 = call i64 @llvm.smax.i64(i64 %57, i64 0)
  %59 = call i64 @llvm.smin.i64(i64 %52, i64 %58)
  %60 = call i64 @llvm.smax.i64(i64 %52, i64 %58)
  %61 = sub i64 %60, %59
  %62 = getelementptr inbounds i8, i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*), i64 8
  %63 = getelementptr inbounds i8, i8* %62, i64 %59
  %64 = call i8* @nish_str_new(i8* %63, i64 %61)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %45, i64 8)
  br label %push.store.1

push.store.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %66
  store i8* %64, i8** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = sitofp i64 %74 to double
  br label %forof.inc

forof.inc:
  %76 = load i64, i64* %forof.idx, align 8
  %77 = add i64 %76, 1
  store i64 %77, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %78 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %82 = load i64, i64* %81, align 8
  %83 = sub i64 %80, 1
  %84 = mul i64 %82, %83
  %85 = icmp eq i64 %80, 0
  %86 = select i1 %85, i64 0, i64 %84
  store i64 %86, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %87 = load i64, i64* %join.at, align 8
  %88 = icmp ult i64 %87, %80
  br i1 %88, label %join.sum.body, label %join.copy

join.sum.body:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %87
  %93 = load i8*, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %94 = load i64, i64* %join.total, align 8
  %95 = bitcast i8* %93 to i64*
  %96 = load i64, i64* %95, align 8
  %97 = add i64 %94, %96
  store i64 %97, i64* %join.total, align 8
  %98 = add i64 %87, 1
  store i64 %98, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %99 = load i64, i64* %join.total, align 8
  %100 = icmp ugt i64 %99, 2147483647
  %101 = add i64 %99, 9
  %102 = select i1 %100, i64 4611686018427387904, i64 %101
  %103 = call i8* @nish_alloc_struct(i64 %102)
  %104 = bitcast i8* %103 to i64*
  store i64 %99, i64* %104, align 8
  %105 = getelementptr inbounds i8, i8* %103, i64 8
  store i8* %105, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %106 = load i64, i64* %join.at, align 8
  %107 = icmp ult i64 %106, %80
  br i1 %107, label %join.part, label %join.end

join.part:
  %108 = load i8*, i8** %join.p, align 8
  %109 = icmp eq i64 %106, 0
  %110 = select i1 %109, i64 0, i64 %82
  %111 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %108, i8* %111, i64 %110, i1 false)
  %112 = getelementptr inbounds i8, i8* %108, i64 %110
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %115 = bitcast i8* %114 to i8**
  %116 = getelementptr inbounds i8*, i8** %115, i64 %106
  %117 = load i8*, i8** %116, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %118 = bitcast i8* %117 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = getelementptr inbounds i8, i8* %117, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %112, i8* %120, i64 %119, i1 false)
  %121 = getelementptr inbounds i8, i8* %112, i64 %119
  store i8* %121, i8** %join.p, align 8
  %122 = add i64 %106, 1
  store i64 %122, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %123 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %123, align 1
  ret i8* %103
}

define internal void @draw(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  call void @nish_random_fill(%struct.nish_array* %into)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [32 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [32 x i8], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [0 x i8], align 8
  %most.addr = alloca %struct.nish_array*, align 8
  %key.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [4 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fptosi double 0x4040000000000000 to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 %0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 %0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast [32 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %5 = fptosi double 0x4040000000000000 to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 %5, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 %5, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast [32 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @draw(%struct.nish_array* %10)
  %11 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @nish_random_fill(%struct.nish_array* %11)
  %12 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @hex(%struct.nish_array* %12)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @hex(%struct.nish_array* %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  %20 = call zeroext i1 @nish_str_eq(i8* %15, i8* %19)
  %21 = xor i1 %20, true
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %22)
  %23 = fptosi double 0x0000000000000000 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 %23, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 %23, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast [0 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %26, i8 0, i64 %23, i1 false), !alias.scope !4, !noalias !3
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %empty.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  call void @nish_random_fill(%struct.nish_array* %28)
  %29 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = sitofp i64 %31 to double
  %33 = call i8* @nish_str_from_f64(double %32)
  call void @nish_print(i8* %33)
  %34 = fptosi double 0x40F0000000000000 to i64
  %35 = call i8* @nish_alloc_struct(i64 24)
  %36 = bitcast i8* %35 to %struct.nish_array*
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  store i64 %34, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  store i64 %34, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = call i8* @nish_alloc_struct(i64 %34)
  call void @llvm.memset.p0i8.i64(i8* align 8 %39, i8 0, i64 %34, i1 false), !alias.scope !4, !noalias !3
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %36, %struct.nish_array** %most.addr, align 8
  %41 = load %struct.nish_array*, %struct.nish_array** %most.addr, align 8
  call void @nish_random_fill(%struct.nish_array* %41)
  %42 = load %struct.nish_array*, %struct.nish_array** %most.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = sitofp i64 %44 to double
  %46 = call i8* @nish_str_from_f64(double %45)
  call void @nish_print(i8* %46)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 4, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 4, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast [4 x i8]* %arr.data.3 to i8*
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %49 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 0
  store i8 0, i8* %52, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = getelementptr inbounds i8, i8* %51, i64 1
  store i8 0, i8* %53, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = getelementptr inbounds i8, i8* %51, i64 2
  store i8 0, i8* %54, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = getelementptr inbounds i8, i8* %51, i64 3
  store i8 0, i8* %55, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %key.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  call void @nish_random_fill(%struct.nish_array* %56)
  %57 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = sitofp i64 %59 to double
  %61 = call i8* @nish_str_from_f64(double %60)
  call void @nish_print(i8* %61)
  %62 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = sitofp i64 %64 to double
  %66 = fcmp ogt double %65, 0x3FF0000000000000
  br i1 %66, label %if.then, label %if.end

if.then:
  %67 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %68 = call i64 @nish_arena_mark()
  %69 = call i8* @hex(%struct.nish_array* %67)
  %70 = call i8* @nish_arena_keep(i64 %68, i8* %69)
  call void @nish_print(i8* %70)
  %71 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %72 = call i64 @nish_arena_mark()
  %73 = call i8* @hex(%struct.nish_array* %71)
  %74 = call i8* @nish_arena_keep(i64 %72, i8* %73)
  call void @nish_print(i8* %74)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
