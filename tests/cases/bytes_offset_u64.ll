%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare i64 @llvm.umin.i64(i64, i64) #4

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

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
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
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %3
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store i8 %11, i8* %x.addr, align 1
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load i8, i8* %x.addr, align 1
  %14 = zext i8 %13 to i64
  %15 = call i8* @nish_str_from_u64(i64 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* %15, i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = add i64 %27, 1
  store i64 %28, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %29 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %33 = load i64, i64* %32, align 8
  %34 = sub i64 %31, 1
  %35 = mul i64 %33, %34
  %36 = icmp eq i64 %31, 0
  %37 = select i1 %36, i64 0, i64 %35
  store i64 %37, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %38 = load i64, i64* %join.at, align 8
  %39 = icmp ult i64 %38, %31
  br i1 %39, label %join.sum.body, label %join.copy

join.sum.body:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %38
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %45 = load i64, i64* %join.total, align 8
  %46 = bitcast i8* %44 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = add i64 %45, %47
  store i64 %48, i64* %join.total, align 8
  %49 = add i64 %38, 1
  store i64 %49, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %50 = load i64, i64* %join.total, align 8
  %51 = icmp ugt i64 %50, 2147483647
  %52 = add i64 %50, 9
  %53 = select i1 %51, i64 4611686018427387904, i64 %52
  %54 = call i8* @nish_alloc_struct(i64 %53)
  %55 = bitcast i8* %54 to i64*
  store i64 %50, i64* %55, align 8
  %56 = getelementptr inbounds i8, i8* %54, i64 8
  store i8* %56, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %57 = load i64, i64* %join.at, align 8
  %58 = icmp ult i64 %57, %31
  br i1 %58, label %join.part, label %join.end

join.part:
  %59 = load i8*, i8** %join.p, align 8
  %60 = icmp eq i64 %57, 0
  %61 = select i1 %60, i64 0, i64 %33
  %62 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %62, i64 %61, i1 false)
  %63 = getelementptr inbounds i8, i8* %59, i64 %61
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %57
  %68 = load i8*, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = bitcast i8* %68 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = getelementptr inbounds i8, i8* %68, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %63, i64 %70
  store i8* %72, i8** %join.p, align 8
  %73 = add i64 %57, 1
  store i64 %73, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %74 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %74, align 1
  ret i8* %54
}

define noundef i32 @nish_main() #0 {
entry:
  %top.addr = alloca i64, align 8
  %all.addr = alloca i64, align 8
  %lo.addr = alloca i64, align 8
  %hi.addr = alloca i64, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %three.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 1 to i64
  %1 = shl i64 %0, 63
  store i64 %1, i64* %top.addr, align 8
  %2 = sext i32 0 to i64
  %3 = xor i64 %2, -1
  store i64 %3, i64* %all.addr, align 8
  %4 = sext i32 1 to i64
  %5 = shl i64 %4, 63
  store i64 %5, i64* %lo.addr, align 8
  %6 = load i64, i64* %lo.addr, align 8
  %7 = xor i64 %6, -1
  store i64 %7, i64* %hi.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast [5 x i8]* %arr.data to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 0
  store i8 1, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i8, i8* %12, i64 1
  store i8 2, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i8, i8* %12, i64 2
  store i8 3, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i8, i8* %12, i64 3
  store i8 4, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i8, i8* %12, i64 4
  store i8 5, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %19 = load i64, i64* %top.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = call i64 @llvm.umin.i64(i64 %19, i64 %21)
  %23 = sub i64 %21, %22
  %24 = call i64 @llvm.smax.i64(i64 %23, i64 0)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %22
  call void @llvm.memset.p0i8.i64(i8* %28, i8 9, i64 %24, i1 false), !alias.scope !4, !noalias !3
  %29 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %30 = call i64 @nish_arena_mark()
  %31 = call i8* @show(%struct.nish_array* %29)
  %32 = call i8* @nish_arena_keep(i64 %30, i8* %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %34 = load i64, i64* %top.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = call i64 @llvm.smin.i64(i64 0, i64 %36)
  %38 = call i64 @llvm.umin.i64(i64 %34, i64 %36)
  %39 = sub i64 %38, %37
  %40 = call i64 @llvm.smax.i64(i64 %39, i64 0)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %37
  call void @llvm.memset.p0i8.i64(i8* %44, i8 8, i64 %40, i1 false), !alias.scope !4, !noalias !3
  %45 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @show(%struct.nish_array* %45)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  call void @nish_print(i8* %48)
  %49 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %50 = load i64, i64* %all.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = call i64 @llvm.umin.i64(i64 %50, i64 %52)
  %54 = sub i64 %52, %53
  %55 = call i64 @llvm.smax.i64(i64 %54, i64 0)
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 %53
  call void @llvm.memset.p0i8.i64(i8* %59, i8 7, i64 %55, i1 false), !alias.scope !4, !noalias !3
  %60 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %61 = load i64, i64* %all.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = call i64 @llvm.smin.i64(i64 3, i64 %63)
  %65 = call i64 @llvm.umin.i64(i64 %61, i64 %63)
  %66 = sub i64 %65, %64
  %67 = call i64 @llvm.smax.i64(i64 %66, i64 0)
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i8*
  %71 = getelementptr inbounds i8, i8* %70, i64 %64
  call void @llvm.memset.p0i8.i64(i8* %71, i8 6, i64 %67, i1 false), !alias.scope !4, !noalias !3
  %72 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %73 = call i64 @nish_arena_mark()
  %74 = call i8* @show(%struct.nish_array* %72)
  %75 = call i8* @nish_arena_keep(i64 %73, i8* %74)
  call void @nish_print(i8* %75)
  %76 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %77 = load i64, i64* %lo.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp slt i64 %77, 0
  %81 = add i64 %79, %77
  %82 = call i64 @llvm.smax.i64(i64 %81, i64 0)
  %83 = call i64 @llvm.smin.i64(i64 %77, i64 %79)
  %84 = select i1 %80, i64 %82, i64 %83
  %85 = call i64 @llvm.smin.i64(i64 1, i64 %79)
  %86 = sub i64 %85, %84
  %87 = call i64 @llvm.smax.i64(i64 %86, i64 0)
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to i8*
  %91 = getelementptr inbounds i8, i8* %90, i64 %84
  call void @llvm.memset.p0i8.i64(i8* %91, i8 5, i64 %87, i1 false), !alias.scope !4, !noalias !3
  %92 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %93 = load i64, i64* %hi.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp slt i64 %93, 0
  %97 = add i64 %95, %93
  %98 = call i64 @llvm.smax.i64(i64 %97, i64 0)
  %99 = call i64 @llvm.smin.i64(i64 %93, i64 %95)
  %100 = select i1 %96, i64 %98, i64 %99
  %101 = sub i64 %95, %100
  %102 = call i64 @llvm.smax.i64(i64 %101, i64 0)
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to i8*
  %106 = getelementptr inbounds i8, i8* %105, i64 %100
  call void @llvm.memset.p0i8.i64(i8* %106, i8 4, i64 %102, i1 false), !alias.scope !4, !noalias !3
  %107 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %108 = load i64, i64* %lo.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = call i64 @llvm.smin.i64(i64 1, i64 %110)
  %112 = icmp slt i64 %108, 0
  %113 = add i64 %110, %108
  %114 = call i64 @llvm.smax.i64(i64 %113, i64 0)
  %115 = call i64 @llvm.smin.i64(i64 %108, i64 %110)
  %116 = select i1 %112, i64 %114, i64 %115
  %117 = sub i64 %116, %111
  %118 = call i64 @llvm.smax.i64(i64 %117, i64 0)
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to i8*
  %122 = getelementptr inbounds i8, i8* %121, i64 %111
  call void @llvm.memset.p0i8.i64(i8* %122, i8 3, i64 %118, i1 false), !alias.scope !4, !noalias !3
  %123 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %124 = call i64 @nish_arena_mark()
  %125 = call i8* @show(%struct.nish_array* %123)
  %126 = call i8* @nish_arena_keep(i64 %124, i8* %125)
  call void @nish_print(i8* %126)
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %129 = bitcast [2 x i8]* %arr.data.1 to i8*
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %129, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %131 = bitcast i8* %129 to i8*
  %132 = getelementptr inbounds i8, i8* %131, i64 0
  store i8 0, i8* %132, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %133 = getelementptr inbounds i8, i8* %131, i64 1
  store i8 0, i8* %133, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %134 = sext i32 3 to i64
  store i64 %134, i64* %three.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %136 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %137 = load i64, i64* %three.addr, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %140 = add i64 %137, %139
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %143 = icmp ule i64 %137, %140
  %144 = icmp ule i64 %140, %142
  %145 = and i1 %143, %144
  br i1 %145, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %137, i64 %140, i64 %142)
  unreachable

set.ok:
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %147 = load i8*, i8** %146, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %148 = bitcast i8* %147 to i8*
  %149 = getelementptr inbounds i8, i8* %148, i64 %137
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = bitcast i8* %151 to i8*
  %153 = getelementptr inbounds i8, i8* %152, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %149, i8* %153, i64 %139, i1 false), !alias.scope !4, !noalias !3
  %154 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %155 = call i64 @nish_arena_mark()
  %156 = call i8* @show(%struct.nish_array* %154)
  %157 = call i8* @nish_arena_keep(i64 %155, i8* %156)
  call void @nish_print(i8* %157)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
