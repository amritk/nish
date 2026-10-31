%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %sum.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @joinAll(i8* noundef nonnull noalias readonly align 8 nocapture %sep, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts) #1 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %sep to i64*
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
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !15
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
  %32 = getelementptr inbounds i8, i8* %sep, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %32, i64 %31, i1 false)
  %33 = getelementptr inbounds i8, i8* %29, i64 %31
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %27
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !15
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

define internal noundef i32 @count(i1 noundef zeroext %first, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rest) #0 {
entry:
  br i1 %first, label %cond.true, label %cond.false

cond.true:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rest, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rest, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  br label %cond.end

cond.end:
  %9 = phi i32 [ %4, %ovf.ok ], [ %8, %cond.false ]
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @sumX(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ps) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %p.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ps, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ps, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to %struct.Point*
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %6, i64 %0
  store %struct.Point* %7, %struct.Point** %p.addr, align 8
  %8 = load i32, i32* %sum.addr, align 4
  %9 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %sum.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i8*], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x double], align 8
  %Point.obj = alloca %struct.Point, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [2 x %struct.Point], align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  %Point.obj.3 = alloca %struct.Point, align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x %struct.Point], align 8
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = call i32 @total(%struct.nish_array* %arr.hdr)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %7 = bitcast [1 x i32]* %arr.data to i8*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %7 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  store i32 5, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = call i32 @total(%struct.nish_array* %arr.hdr.1)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 4, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 4, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %15 = bitcast [4 x i32]* %arr.data.1 to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 1, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 2, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = getelementptr inbounds i32, i32* %17, i64 2
  store i32 3, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = getelementptr inbounds i32, i32* %17, i64 3
  store i32 4, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = call i32 @total(%struct.nish_array* %arr.hdr.2)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @joinAll(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), %struct.nish_array* %arr.hdr.3)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  call void @nish_print(i8* %29)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %32 = bitcast [3 x i8*]* %arr.data.2 to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %32 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %36 = getelementptr inbounds i8*, i8** %34, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %37 = getelementptr inbounds i8*, i8** %34, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %38 = call i64 @nish_arena_mark()
  %39 = call i8* @joinAll(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %struct.nish_array* %arr.hdr.4)
  %40 = call i8* @nish_arena_keep(i64 %38, i8* %39)
  call void @nish_print(i8* %40)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 0, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 0, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* null, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = call i32 @count(i1 true, %struct.nish_array* %arr.hdr.5)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %48 = bitcast [2 x double]* %arr.data.3 to i8*
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = bitcast i8* %48 to double*
  %51 = getelementptr inbounds double, double* %50, i64 0
  store double 0x3FF8000000000000, double* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %52 = getelementptr inbounds double, double* %50, i64 1
  store double 0x4004000000000000, double* %52, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %53 = call i32 @count(i1 false, %struct.nish_array* %arr.hdr.6)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %55, align 4
  %56 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %56, align 4
  %57 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 3, i32* %57, align 4
  %58 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 4, i32* %58, align 4
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 2, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 2, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %61 = bitcast [2 x %struct.Point]* %arr.data.4 to i8*
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %61, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %61 to %struct.Point*
  %64 = getelementptr inbounds %struct.Point, %struct.Point* %63, i64 0
  %65 = bitcast %struct.Point* %64 to i8*
  %66 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %65, i8* align 4 %66, i64 8, i1 false), !alias.scope !4, !noalias !3
  %67 = getelementptr inbounds %struct.Point, %struct.Point* %63, i64 1
  %68 = bitcast %struct.Point* %67 to i8*
  %69 = bitcast %struct.Point* %Point.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %68, i8* align 4 %69, i64 8, i1 false), !alias.scope !4, !noalias !3
  %70 = call i32 @sumX(%struct.nish_array* %arr.hdr.7)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  call void @nish_print(i8* %71)
  %72 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 10, i32* %72, align 4
  %73 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 0, i32* %73, align 4
  %74 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 0
  store i32 10, i32* %74, align 4
  %75 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 1
  store i32 0, i32* %75, align 4
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 2, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 2, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %78 = bitcast [2 x %struct.Point]* %arr.data.5 to i8*
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %78, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %80 = bitcast i8* %78 to %struct.Point*
  %81 = getelementptr inbounds %struct.Point, %struct.Point* %80, i64 0
  %82 = bitcast %struct.Point* %81 to i8*
  %83 = bitcast %struct.Point* %Point.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %82, i8* align 4 %83, i64 8, i1 false), !alias.scope !4, !noalias !3
  %84 = getelementptr inbounds %struct.Point, %struct.Point* %80, i64 1
  %85 = bitcast %struct.Point* %84 to i8*
  %86 = bitcast %struct.Point* %Point.obj.3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %85, i8* align 4 %86, i64 8, i1 false), !alias.scope !4, !noalias !3
  %87 = call i32 @sumX(%struct.nish_array* %arr.hdr.8)
  %88 = call i8* @nish_str_from_i32(i32 %87)
  call void @nish_print(i8* %88)
  store i32 0, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %89 = load i32, i32* %i.addr, align 4
  %90 = icmp slt i32 %89, 4
  br i1 %90, label %for.body, label %for.end

for.body:
  %91 = load i32, i32* %acc.addr, align 4
  %92 = load i32, i32* %i.addr, align 4
  %93 = load i32, i32* %i.addr, align 4
  %94 = mul nsw i32 %93, 2
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 2, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 2, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %97 = bitcast [2 x i32]* %arr.data.6 to i8*
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %97, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %99 = bitcast i8* %97 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 0
  store i32 %92, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = getelementptr inbounds i32, i32* %99, i64 1
  store i32 %94, i32* %101, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %102 = call i32 @total(%struct.nish_array* %arr.hdr.9)
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %104, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %106 = load i32, i32* %i.addr, align 4
  %107 = add nsw i32 %106, 1
  store i32 %107, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %108 = load i32, i32* %acc.addr, align 4
  %109 = call i8* @nish_str_from_i32(i32 %108)
  call void @nish_print(i8* %109)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element ptr", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
!17 = !{!"element double", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
