%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"0123456789abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u16 le \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u16 be \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u32 le \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u32 be \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u64 le \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"u64 be \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"i32 le \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"i32 be \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"i64 le \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"i64 be \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"f64 le \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"f64 be \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"ends \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef double @nish.getF64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef double @nish.getF64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i32 @nish.getI32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i32 @nish.getI32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i64 @nish.getI64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i64 @nish.getI64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i16 @nish.getU16BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i16 @nish.getU16LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i32 @nish.getU32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i32 @nish.getU32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i64 @nish.getU64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare noundef i64 @nish.getU64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare void @nish.setF64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, double noundef) #0
declare void @nish.setF64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, double noundef) #0
declare void @nish.setI32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.setI32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.setI64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i64 noundef) #0
declare void @nish.setI64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i64 noundef) #0
declare void @nish.setU16BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i16 noundef) #0
declare void @nish.setU16LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i16 noundef) #0
declare void @nish.setU32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.setU32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.setU64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i64 noundef) #0
declare void @nish.setU64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal noundef nonnull align 8 i8* @hex(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %n) #0 {
entry:
  %digits.addr = alloca i8*, align 8
  %pairs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  store i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*), i8** %digits.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pairs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %from, %5
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 %7
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = zext i8 %15 to i32
  store i32 %16, i32* %v.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %pairs.addr, align 8
  %18 = load i8*, i8** %digits.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = load i32, i32* %v.addr, align 4
  %22 = ashr i32 %21, 4
  %23 = sext i32 %22 to i64
  %24 = call i64 @llvm.smin.i64(i64 %23, i64 %20)
  %25 = call i64 @llvm.smax.i64(i64 %24, i64 0)
  %26 = load i32, i32* %v.addr, align 4
  %27 = ashr i32 %26, 4
  %28 = add nsw i32 %27, 1
  %29 = sext i32 %28 to i64
  %30 = call i64 @llvm.smin.i64(i64 %29, i64 %20)
  %31 = call i64 @llvm.smax.i64(i64 %30, i64 0)
  %32 = call i64 @llvm.smin.i64(i64 %25, i64 %31)
  %33 = call i64 @llvm.smax.i64(i64 %25, i64 %31)
  %34 = sub i64 %33, %32
  %35 = getelementptr inbounds i8, i8* %18, i64 8
  %36 = getelementptr inbounds i8, i8* %35, i64 %32
  %37 = call i8* @nish_str_new(i8* %36, i64 %34)
  %38 = load i8*, i8** %digits.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = load i32, i32* %v.addr, align 4
  %42 = and i32 %41, 15
  %43 = sext i32 %42 to i64
  %44 = call i64 @llvm.smin.i64(i64 %43, i64 %40)
  %45 = call i64 @llvm.smax.i64(i64 %44, i64 0)
  %46 = load i32, i32* %v.addr, align 4
  %47 = and i32 %46, 15
  %48 = add nsw i32 %47, 1
  %49 = sext i32 %48 to i64
  %50 = call i64 @llvm.smin.i64(i64 %49, i64 %40)
  %51 = call i64 @llvm.smax.i64(i64 %50, i64 0)
  %52 = call i64 @llvm.smin.i64(i64 %45, i64 %51)
  %53 = call i64 @llvm.smax.i64(i64 %45, i64 %51)
  %54 = sub i64 %53, %52
  %55 = getelementptr inbounds i8, i8* %38, i64 8
  %56 = getelementptr inbounds i8, i8* %55, i64 %52
  %57 = call i8* @nish_str_new(i8* %56, i64 %54)
  %58 = call i8* @nish_str_concat(i8* %37, i8* %57)
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = icmp eq i64 %60, %62
  br i1 %63, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %60
  store i8* %58, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = add i64 %60, 1
  store i64 %68, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = trunc i64 %68 to i32
  br label %for.inc

for.inc:
  %70 = load i32, i32* %i.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %72 = load %struct.nish_array*, %struct.nish_array** %pairs.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %76 = load i64, i64* %75, align 8
  %77 = sub i64 %74, 1
  %78 = mul i64 %76, %77
  %79 = icmp eq i64 %74, 0
  %80 = select i1 %79, i64 0, i64 %78
  store i64 %80, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %81 = load i64, i64* %join.at, align 8
  %82 = icmp ult i64 %81, %74
  br i1 %82, label %join.sum.body, label %join.copy

join.sum.body:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = bitcast i8* %84 to i8**
  %86 = getelementptr inbounds i8*, i8** %85, i64 %81
  %87 = load i8*, i8** %86, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %88 = load i64, i64* %join.total, align 8
  %89 = bitcast i8* %87 to i64*
  %90 = load i64, i64* %89, align 8
  %91 = add i64 %88, %90
  store i64 %91, i64* %join.total, align 8
  %92 = add i64 %81, 1
  store i64 %92, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %93 = load i64, i64* %join.total, align 8
  %94 = icmp ugt i64 %93, 2147483647
  %95 = add i64 %93, 9
  %96 = select i1 %94, i64 4611686018427387904, i64 %95
  %97 = call i8* @nish_alloc_struct(i64 %96)
  %98 = bitcast i8* %97 to i64*
  store i64 %93, i64* %98, align 8
  %99 = getelementptr inbounds i8, i8* %97, i64 8
  store i8* %99, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %100 = load i64, i64* %join.at, align 8
  %101 = icmp ult i64 %100, %74
  br i1 %101, label %join.part, label %join.end

join.part:
  %102 = load i8*, i8** %join.p, align 8
  %103 = icmp eq i64 %100, 0
  %104 = select i1 %103, i64 0, i64 %76
  %105 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %102, i8* %105, i64 %104, i1 false)
  %106 = getelementptr inbounds i8, i8* %102, i64 %104
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = bitcast i8* %108 to i8**
  %110 = getelementptr inbounds i8*, i8** %109, i64 %100
  %111 = load i8*, i8** %110, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %112 = bitcast i8* %111 to i64*
  %113 = load i64, i64* %112, align 8
  %114 = getelementptr inbounds i8, i8* %111, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %106, i8* %114, i64 %113, i1 false)
  %115 = getelementptr inbounds i8, i8* %106, i64 %113
  store i8* %115, i8** %join.p, align 8
  %116 = add i64 %100, 1
  store i64 %116, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %117 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %117, align 1
  ret i8* %97
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @filled(i32 noundef %n) #1 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %b.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %8 = trunc i32 238 to i8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 1)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %10
  store i8 %8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  ret %struct.nish_array* %22
}

define noundef i32 @nish_main() #0 {
entry:
  %at.addr = alloca i32, align 4
  %b.addr = alloca %struct.nish_array*, align 8
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %wide.addr = alloca i64, align 8
  %negative.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %at.addr, align 4
  %0 = call %struct.nish_array* @filled(i32 16)
  store %struct.nish_array* %0, %struct.nish_array** %b.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %2 = load i32, i32* %at.addr, align 4
  %3 = trunc i32 41394 to i16
  call void @nish.setU16LE(%struct.nish_array* %1, i32 %2, i16 %3)
  %4 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @hex(%struct.nish_array* %4, i32 0, i32 7)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %10 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %11 = load i32, i32* %at.addr, align 4
  %12 = call i16 @nish.getU16LE(%struct.nish_array* %10, i32 %11)
  %13 = zext i16 %12 to i64
  %14 = call i8* @nish_str_from_u64(i64 %13)
  %15 = call i8* @nish_str_concat(i8* %9, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %17 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %18 = load i32, i32* %at.addr, align 4
  %19 = call i16 @nish.getU16BE(%struct.nish_array* %17, i32 %18)
  %20 = zext i16 %19 to i64
  %21 = call i8* @nish_str_from_u64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %16, i8* %21)
  call void @nish_print(i8* %22)
  %23 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %24 = load i32, i32* %at.addr, align 4
  %25 = trunc i32 41394 to i16
  call void @nish.setU16BE(%struct.nish_array* %23, i32 %24, i16 %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @hex(%struct.nish_array* %26, i32 0, i32 7)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %33 = load i32, i32* %at.addr, align 4
  %34 = call i16 @nish.getU16BE(%struct.nish_array* %32, i32 %33)
  %35 = zext i16 %34 to i64
  %36 = call i8* @nish_str_from_u64(i64 %35)
  %37 = call i8* @nish_str_concat(i8* %31, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %40 = load i32, i32* %at.addr, align 4
  %41 = call i16 @nish.getU16LE(%struct.nish_array* %39, i32 %40)
  %42 = zext i16 %41 to i64
  %43 = call i8* @nish_str_from_u64(i64 %42)
  %44 = call i8* @nish_str_concat(i8* %38, i8* %43)
  call void @nish_print(i8* %44)
  store i32 2712847316, i32* %word.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %46 = load i32, i32* %at.addr, align 4
  %47 = load i32, i32* %word.addr, align 4
  call void @nish.setU32LE(%struct.nish_array* %45, i32 %46, i32 %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @hex(%struct.nish_array* %48, i32 0, i32 9)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %54 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %55 = load i32, i32* %at.addr, align 4
  %56 = call i32 @nish.getU32LE(%struct.nish_array* %54, i32 %55)
  %57 = zext i32 %56 to i64
  %58 = call i8* @nish_str_from_u64(i64 %57)
  %59 = call i8* @nish_str_concat(i8* %53, i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %61 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %62 = load i32, i32* %at.addr, align 4
  %63 = call i32 @nish.getU32BE(%struct.nish_array* %61, i32 %62)
  %64 = zext i32 %63 to i64
  %65 = call i8* @nish_str_from_u64(i64 %64)
  %66 = call i8* @nish_str_concat(i8* %60, i8* %65)
  call void @nish_print(i8* %66)
  %67 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %68 = load i32, i32* %at.addr, align 4
  %69 = load i32, i32* %word.addr, align 4
  call void @nish.setU32BE(%struct.nish_array* %67, i32 %68, i32 %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %71 = call i64 @nish_arena_mark()
  %72 = call i8* @hex(%struct.nish_array* %70, i32 0, i32 9)
  %73 = call i8* @nish_arena_keep(i64 %71, i8* %72)
  %74 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %76 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %77 = load i32, i32* %at.addr, align 4
  %78 = call i32 @nish.getU32BE(%struct.nish_array* %76, i32 %77)
  %79 = zext i32 %78 to i64
  %80 = call i8* @nish_str_from_u64(i64 %79)
  %81 = call i8* @nish_str_concat(i8* %75, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %83 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %84 = load i32, i32* %at.addr, align 4
  %85 = call i32 @nish.getU32LE(%struct.nish_array* %83, i32 %84)
  %86 = zext i32 %85 to i64
  %87 = call i8* @nish_str_from_u64(i64 %86)
  %88 = call i8* @nish_str_concat(i8* %82, i8* %87)
  call void @nish_print(i8* %88)
  store i32 3858106136, i32* %low.addr, align 4
  %89 = load i32, i32* %word.addr, align 4
  %90 = zext i32 %89 to i64
  %91 = sext i32 32 to i64
  %92 = and i64 %91, 63
  %93 = shl i64 %90, %92
  %94 = load i32, i32* %low.addr, align 4
  %95 = zext i32 %94 to i64
  %96 = or i64 %93, %95
  store i64 %96, i64* %wide.addr, align 8
  %97 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %98 = load i32, i32* %at.addr, align 4
  %99 = load i64, i64* %wide.addr, align 8
  call void @nish.setU64LE(%struct.nish_array* %97, i32 %98, i64 %99)
  %100 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %101 = call i64 @nish_arena_mark()
  %102 = call i8* @hex(%struct.nish_array* %100, i32 0, i32 13)
  %103 = call i8* @nish_arena_keep(i64 %101, i8* %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %106 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %107 = load i32, i32* %at.addr, align 4
  %108 = call i64 @nish.getU64LE(%struct.nish_array* %106, i32 %107)
  %109 = call i8* @nish_str_from_u64(i64 %108)
  %110 = call i8* @nish_str_concat(i8* %105, i8* %109)
  %111 = call i8* @nish_str_concat(i8* %110, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %112 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %113 = load i32, i32* %at.addr, align 4
  %114 = call i64 @nish.getU64BE(%struct.nish_array* %112, i32 %113)
  %115 = call i8* @nish_str_from_u64(i64 %114)
  %116 = call i8* @nish_str_concat(i8* %111, i8* %115)
  call void @nish_print(i8* %116)
  %117 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %118 = load i32, i32* %at.addr, align 4
  %119 = load i64, i64* %wide.addr, align 8
  call void @nish.setU64BE(%struct.nish_array* %117, i32 %118, i64 %119)
  %120 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %121 = call i64 @nish_arena_mark()
  %122 = call i8* @hex(%struct.nish_array* %120, i32 0, i32 13)
  %123 = call i8* @nish_arena_keep(i64 %121, i8* %122)
  %124 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %123)
  %125 = call i8* @nish_str_concat(i8* %124, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %126 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %127 = load i32, i32* %at.addr, align 4
  %128 = call i64 @nish.getU64BE(%struct.nish_array* %126, i32 %127)
  %129 = call i8* @nish_str_from_u64(i64 %128)
  %130 = call i8* @nish_str_concat(i8* %125, i8* %129)
  %131 = call i8* @nish_str_concat(i8* %130, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %132 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %133 = load i32, i32* %at.addr, align 4
  %134 = call i64 @nish.getU64LE(%struct.nish_array* %132, i32 %133)
  %135 = call i8* @nish_str_from_u64(i64 %134)
  %136 = call i8* @nish_str_concat(i8* %131, i8* %135)
  call void @nish_print(i8* %136)
  %137 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %138 = load i32, i32* %at.addr, align 4
  call void @nish.setI32LE(%struct.nish_array* %137, i32 %138, i32 -2)
  %139 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %140 = load i32, i32* %at.addr, align 4
  %141 = call i64 @nish_arena_mark()
  %142 = call i8* @hex(%struct.nish_array* %139, i32 %140, i32 4)
  %143 = call i8* @nish_arena_keep(i64 %141, i8* %142)
  %144 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i8* %143)
  %145 = call i8* @nish_str_concat(i8* %144, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %146 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %147 = load i32, i32* %at.addr, align 4
  %148 = call i32 @nish.getI32LE(%struct.nish_array* %146, i32 %147)
  %149 = call i8* @nish_str_from_i32(i32 %148)
  %150 = call i8* @nish_str_concat(i8* %145, i8* %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %152 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %153 = load i32, i32* %at.addr, align 4
  %154 = call i32 @nish.getI32BE(%struct.nish_array* %152, i32 %153)
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %151, i8* %155)
  call void @nish_print(i8* %156)
  %157 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %158 = load i32, i32* %at.addr, align 4
  call void @nish.setI32BE(%struct.nish_array* %157, i32 %158, i32 -123456789)
  %159 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %160 = load i32, i32* %at.addr, align 4
  %161 = call i64 @nish_arena_mark()
  %162 = call i8* @hex(%struct.nish_array* %159, i32 %160, i32 4)
  %163 = call i8* @nish_arena_keep(i64 %161, i8* %162)
  %164 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* %163)
  %165 = call i8* @nish_str_concat(i8* %164, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %166 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %167 = load i32, i32* %at.addr, align 4
  %168 = call i32 @nish.getI32BE(%struct.nish_array* %166, i32 %167)
  %169 = call i8* @nish_str_from_i32(i32 %168)
  %170 = call i8* @nish_str_concat(i8* %165, i8* %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %172 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %173 = load i32, i32* %at.addr, align 4
  %174 = call i32 @nish.getI32LE(%struct.nish_array* %172, i32 %173)
  %175 = call i8* @nish_str_from_i32(i32 %174)
  %176 = call i8* @nish_str_concat(i8* %171, i8* %175)
  call void @nish_print(i8* %176)
  %177 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %178 = load i32, i32* %at.addr, align 4
  %179 = sext i32 -2 to i64
  call void @nish.setI64LE(%struct.nish_array* %177, i32 %178, i64 %179)
  %180 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %181 = load i32, i32* %at.addr, align 4
  %182 = call i64 @nish_arena_mark()
  %183 = call i8* @hex(%struct.nish_array* %180, i32 %181, i32 8)
  %184 = call i8* @nish_arena_keep(i64 %182, i8* %183)
  %185 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %184)
  %186 = call i8* @nish_str_concat(i8* %185, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %187 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %188 = load i32, i32* %at.addr, align 4
  %189 = call i64 @nish.getI64LE(%struct.nish_array* %187, i32 %188)
  %190 = call i8* @nish_str_from_i64(i64 %189)
  %191 = call i8* @nish_str_concat(i8* %186, i8* %190)
  %192 = call i8* @nish_str_concat(i8* %191, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %193 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %194 = load i32, i32* %at.addr, align 4
  %195 = call i64 @nish.getI64BE(%struct.nish_array* %193, i32 %194)
  %196 = call i8* @nish_str_from_i64(i64 %195)
  %197 = call i8* @nish_str_concat(i8* %192, i8* %196)
  call void @nish_print(i8* %197)
  store i64 -1234567890123, i64* %negative.addr, align 8
  %198 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %199 = load i32, i32* %at.addr, align 4
  %200 = load i64, i64* %negative.addr, align 8
  call void @nish.setI64BE(%struct.nish_array* %198, i32 %199, i64 %200)
  %201 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %202 = load i32, i32* %at.addr, align 4
  %203 = call i64 @nish_arena_mark()
  %204 = call i8* @hex(%struct.nish_array* %201, i32 %202, i32 8)
  %205 = call i8* @nish_arena_keep(i64 %203, i8* %204)
  %206 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* %205)
  %207 = call i8* @nish_str_concat(i8* %206, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %208 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %209 = load i32, i32* %at.addr, align 4
  %210 = call i64 @nish.getI64BE(%struct.nish_array* %208, i32 %209)
  %211 = call i8* @nish_str_from_i64(i64 %210)
  %212 = call i8* @nish_str_concat(i8* %207, i8* %211)
  call void @nish_print(i8* %212)
  %213 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %214 = load i32, i32* %at.addr, align 4
  %215 = fneg double 0x3FF8000000000000
  call void @nish.setF64LE(%struct.nish_array* %213, i32 %214, double %215)
  %216 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %217 = load i32, i32* %at.addr, align 4
  %218 = call i64 @nish_arena_mark()
  %219 = call i8* @hex(%struct.nish_array* %216, i32 %217, i32 8)
  %220 = call i8* @nish_arena_keep(i64 %218, i8* %219)
  %221 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.13 to i8*), i8* %220)
  %222 = call i8* @nish_str_concat(i8* %221, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %223 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %224 = load i32, i32* %at.addr, align 4
  %225 = call double @nish.getF64LE(%struct.nish_array* %223, i32 %224)
  %226 = call i8* @nish_str_from_f64(double %225)
  %227 = call i8* @nish_str_concat(i8* %222, i8* %226)
  call void @nish_print(i8* %227)
  %228 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %229 = load i32, i32* %at.addr, align 4
  call void @nish.setF64BE(%struct.nish_array* %228, i32 %229, double 0x400A000000000000)
  %230 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %231 = load i32, i32* %at.addr, align 4
  %232 = call i64 @nish_arena_mark()
  %233 = call i8* @hex(%struct.nish_array* %230, i32 %231, i32 8)
  %234 = call i8* @nish_arena_keep(i64 %232, i8* %233)
  %235 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*), i8* %234)
  %236 = call i8* @nish_str_concat(i8* %235, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %237 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %238 = load i32, i32* %at.addr, align 4
  %239 = call double @nish.getF64BE(%struct.nish_array* %237, i32 %238)
  %240 = call i8* @nish_str_from_f64(double %239)
  %241 = call i8* @nish_str_concat(i8* %236, i8* %240)
  call void @nish_print(i8* %241)
  %242 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @nish.setU32BE(%struct.nish_array* %242, i32 0, i32 16909060)
  %243 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @nish.setU32LE(%struct.nish_array* %243, i32 12, i32 16909060)
  %244 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %245 = call i64 @nish_arena_mark()
  %246 = call i8* @hex(%struct.nish_array* %244, i32 0, i32 16)
  %247 = call i8* @nish_arena_keep(i64 %245, i8* %246)
  %248 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.15 to i8*), i8* %247)
  %249 = call i8* @nish_str_concat(i8* %248, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %250 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %251 = call i32 @nish.getU32BE(%struct.nish_array* %250, i32 0)
  %252 = zext i32 %251 to i64
  %253 = call i8* @nish_str_from_u64(i64 %252)
  %254 = call i8* @nish_str_concat(i8* %249, i8* %253)
  %255 = call i8* @nish_str_concat(i8* %254, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %256 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %257 = call i32 @nish.getU32LE(%struct.nish_array* %256, i32 12)
  %258 = zext i32 %257 to i64
  %259 = call i8* @nish_str_from_u64(i64 %258)
  %260 = call i8* @nish_str_concat(i8* %255, i8* %259)
  call void @nish_print(i8* %260)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
