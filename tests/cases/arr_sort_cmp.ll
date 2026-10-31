%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pear\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"fig\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"apple\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kiwi\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"yam\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"plum\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"lime\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"date\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define hidden noundef i32 @ascending$(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i32, align 4
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
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %11, i32* %x.addr, align 4
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load i32, i32* %x.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %14, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  br label %forof.inc

forof.inc:
  %26 = load i64, i64* %forof.idx, align 8
  %27 = add i64 %26, 1
  store i64 %27, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %32 = load i64, i64* %31, align 8
  %33 = sub i64 %30, 1
  %34 = mul i64 %32, %33
  %35 = icmp eq i64 %30, 0
  %36 = select i1 %35, i64 0, i64 %34
  store i64 %36, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %37 = load i64, i64* %join.at, align 8
  %38 = icmp ult i64 %37, %30
  br i1 %38, label %join.sum.body, label %join.copy

join.sum.body:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 %37
  %43 = load i8*, i8** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = load i64, i64* %join.total, align 8
  %45 = bitcast i8* %43 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = add i64 %44, %46
  store i64 %47, i64* %join.total, align 8
  %48 = add i64 %37, 1
  store i64 %48, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %49 = load i64, i64* %join.total, align 8
  %50 = icmp ugt i64 %49, 2147483647
  %51 = add i64 %49, 9
  %52 = select i1 %50, i64 4611686018427387904, i64 %51
  %53 = call i8* @nish_alloc_struct(i64 %52)
  %54 = bitcast i8* %53 to i64*
  store i64 %49, i64* %54, align 8
  %55 = getelementptr inbounds i8, i8* %53, i64 8
  store i8* %55, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %56 = load i64, i64* %join.at, align 8
  %57 = icmp ult i64 %56, %30
  br i1 %57, label %join.part, label %join.end

join.part:
  %58 = load i8*, i8** %join.p, align 8
  %59 = icmp eq i64 %56, 0
  %60 = select i1 %59, i64 0, i64 %32
  %61 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %58, i8* %61, i64 %60, i1 false)
  %62 = getelementptr inbounds i8, i8* %58, i64 %60
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i8**
  %66 = getelementptr inbounds i8*, i8** %65, i64 %56
  %67 = load i8*, i8** %66, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = bitcast i8* %67 to i64*
  %69 = load i64, i64* %68, align 8
  %70 = getelementptr inbounds i8, i8* %67, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %62, i8* %70, i64 %69, i1 false)
  %71 = getelementptr inbounds i8, i8* %62, i64 %69
  store i8* %71, i8** %join.p, align 8
  %72 = add i64 %56, 1
  store i64 %72, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %73 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %73, align 1
  ret i8* %53
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [20 x i32], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %one.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 20, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 20, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [20 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 17, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 3, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 99, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 -4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 42, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 8, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i32, i32* %4, i64 7
  store i32 23, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i32, i32* %4, i64 8
  store i32 15, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i32, i32* %4, i64 9
  store i32 61, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %4, i64 10
  store i32 7, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i32, i32* %4, i64 11
  store i32 88, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i32, i32* %4, i64 12
  store i32 -12, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %4, i64 13
  store i32 5, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i32, i32* %4, i64 14
  store i32 30, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i32, i32* %4, i64 15
  store i32 2, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i32, i32* %4, i64 16
  store i32 71, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i32, i32* %4, i64 17
  store i32 19, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = getelementptr inbounds i32, i32* %4, i64 18
  store i32 44, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %24 = getelementptr inbounds i32, i32* %4, i64 19
  store i32 1, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = call %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* %25)
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @show(%struct.nish_array* %27)
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = call %struct.nish_array* @nish.sortWith$i32$fn.16.nish_main$arrow0(%struct.nish_array* %31)
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = call i64 @nish_arena_mark()
  %35 = call i8* @show(%struct.nish_array* %33)
  %36 = call i8* @nish_arena_keep(i64 %34, i8* %35)
  call void @nish_print(i8* %36)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %41 = call %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* %40)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast [1 x i32]* %arr.data.1 to i8*
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %48 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 0
  store i32 7, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %one.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %53 = call %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* %52)
  %54 = call i64 @nish_arena_mark()
  %55 = call i8* @show(%struct.nish_array* %53)
  %56 = call i8* @nish_arena_keep(i64 %54, i8* %55)
  call void @nish_print(i8* %56)
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast [2 x i32]* %arr.data.2 to i8*
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %59 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  store i32 2, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = getelementptr inbounds i32, i32* %61, i64 1
  store i32 1, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %pair.addr, align 8
  %64 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %65 = call %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* %64)
  %66 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %67 = icmp eq %struct.nish_array* %65, %66
  %68 = select i1 %67, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = icmp ult i64 0, %72
  br i1 %73, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %72)
  unreachable

bounds.ok:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %69, i8* %79)
  call void @nish_print(i8* %80)
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 8, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 8, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %83 = bitcast [8 x i8*]* %arr.data.3 to i8*
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %83, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = bitcast i8* %83 to i8**
  %86 = getelementptr inbounds i8*, i8** %85, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %86, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %87 = getelementptr inbounds i8*, i8** %85, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %87, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %88 = getelementptr inbounds i8*, i8** %85, i64 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8** %88, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %89 = getelementptr inbounds i8*, i8** %85, i64 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8** %89, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %90 = getelementptr inbounds i8*, i8** %85, i64 4
  store i8* bitcast ({ i64, [4 x i8] }* @.str.7 to i8*), i8** %90, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %91 = getelementptr inbounds i8*, i8** %85, i64 5
  store i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8** %91, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %92 = getelementptr inbounds i8*, i8** %85, i64 6
  store i8* bitcast ({ i64, [5 x i8] }* @.str.9 to i8*), i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %93 = getelementptr inbounds i8*, i8** %85, i64 7
  store i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8** %93, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %words.addr, align 8
  %94 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %95 = call %struct.nish_array* @sorted$str$fn.16.nish_main$arrow1(%struct.nish_array* %94)
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*) to i64*
  %99 = load i64, i64* %98, align 8
  %100 = sub i64 %97, 1
  %101 = mul i64 %99, %100
  %102 = icmp eq i64 %97, 0
  %103 = select i1 %102, i64 0, i64 %101
  store i64 %103, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %104 = load i64, i64* %join.at, align 8
  %105 = icmp ult i64 %104, %97
  br i1 %105, label %join.sum.body, label %join.copy

join.sum.body:
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %107 = load i8*, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %108 = bitcast i8* %107 to i8**
  %109 = getelementptr inbounds i8*, i8** %108, i64 %104
  %110 = load i8*, i8** %109, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %111 = load i64, i64* %join.total, align 8
  %112 = bitcast i8* %110 to i64*
  %113 = load i64, i64* %112, align 8
  %114 = add i64 %111, %113
  store i64 %114, i64* %join.total, align 8
  %115 = add i64 %104, 1
  store i64 %115, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %116 = load i64, i64* %join.total, align 8
  %117 = icmp ugt i64 %116, 2147483647
  %118 = add i64 %116, 9
  %119 = select i1 %117, i64 4611686018427387904, i64 %118
  %120 = call i8* @nish_alloc_struct(i64 %119)
  %121 = bitcast i8* %120 to i64*
  store i64 %116, i64* %121, align 8
  %122 = getelementptr inbounds i8, i8* %120, i64 8
  store i8* %122, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %123 = load i64, i64* %join.at, align 8
  %124 = icmp ult i64 %123, %97
  br i1 %124, label %join.part, label %join.end

join.part:
  %125 = load i8*, i8** %join.p, align 8
  %126 = icmp eq i64 %123, 0
  %127 = select i1 %126, i64 0, i64 %99
  %128 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %125, i8* %128, i64 %127, i1 false)
  %129 = getelementptr inbounds i8, i8* %125, i64 %127
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %132 = bitcast i8* %131 to i8**
  %133 = getelementptr inbounds i8*, i8** %132, i64 %123
  %134 = load i8*, i8** %133, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %135 = bitcast i8* %134 to i64*
  %136 = load i64, i64* %135, align 8
  %137 = getelementptr inbounds i8, i8* %134, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %129, i8* %137, i64 %136, i1 false)
  %138 = getelementptr inbounds i8, i8* %129, i64 %136
  store i8* %138, i8** %join.p, align 8
  %139 = add i64 %123, 1
  store i64 %139, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %140 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %140, align 1
  call void @nish_print(i8* %120)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %b, i32 %a)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #1 {
entry:
  %0 = bitcast i8* %a to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = bitcast i8* %b to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = sub nsw i32 %2, %5
  ret i32 %6
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @sorted$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = call %struct.nish_array* @nish.sortWith$str$fn.16.nish_main$arrow1(%struct.nish_array* %xs)
  ret %struct.nish_array* %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.stepTo(i32 noundef %lo, i32 noundef %step, i32 noundef %n) #2 {
entry:
  %0 = sub i32 %n, %lo
  %1 = icmp sgt i32 %0, %step
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = add i32 %lo, %step
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %n, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = icmp slt i32 %3, 2
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %16, i32* %x.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %18 = load i32, i32* %x.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  store i32 %18, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %forof.inc

forof.inc:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = add i64 %30, 1
  store i64 %31, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %32 = load i32, i32* %lo.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %lo.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %lo.addr, align 4
  %39 = load i32, i32* %n.addr, align 4
  %40 = call i32 @nish.stepTo(i32 %38, i32 32, i32 %39)
  store i32 %40, i32* %hi.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %lo.addr, align 4
  %43 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$i32$fn.9.ascending(%struct.nish_array* %41, %struct.nish_array* %xs, i32 %42, i32 %43)
  %44 = load i32, i32* %hi.addr, align 4
  store i32 %44, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %45 = load i32, i32* %width.addr, align 4
  %46 = icmp sgt i32 %45, 0
  br i1 %46, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = icmp slt i32 %47, %48
  br label %land.end.1

land.end.1:
  %50 = phi i1 [ false, %while.cond.1 ], [ %49, %land.rhs.1 ]
  br i1 %50, label %while.body.1, label %while.end.1

while.body.1:
  %51 = load i1, i1* %inTmp.addr, align 1
  br i1 %51, label %if.then.1, label %if.else

if.then.1:
  %52 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  %54 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* %52, %struct.nish_array* %xs, i32 %53, i32 %54)
  br label %if.end.1

if.else:
  %55 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %56 = load i32, i32* %n.addr, align 4
  %57 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* %xs, %struct.nish_array* %55, i32 %56, i32 %57)
  br label %if.end.1

if.end.1:
  %58 = load i1, i1* %inTmp.addr, align 1
  %59 = xor i1 %58, true
  store i1 %59, i1* %inTmp.addr, align 1
  %60 = load i32, i32* %width.addr, align 4
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %n.addr, align 4
  %63 = call i32 @nish.stepTo(i32 %60, i32 %61, i32 %62)
  store i32 %63, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %64 = load i1, i1* %inTmp.addr, align 1
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %66 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$i32(%struct.nish_array* %65, %struct.nish_array* %xs, i32 0, i32 %66)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = icmp slt i32 %3, 2
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %16, i32* %x.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %18 = load i32, i32* %x.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  store i32 %18, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %forof.inc

forof.inc:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = add i64 %30, 1
  store i64 %31, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %32 = load i32, i32* %lo.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %lo.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %lo.addr, align 4
  %39 = load i32, i32* %n.addr, align 4
  %40 = call i32 @nish.stepTo(i32 %38, i32 32, i32 %39)
  store i32 %40, i32* %hi.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %lo.addr, align 4
  %43 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$i32$fn.16.nish_main$arrow0(%struct.nish_array* %41, %struct.nish_array* %xs, i32 %42, i32 %43)
  %44 = load i32, i32* %hi.addr, align 4
  store i32 %44, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %45 = load i32, i32* %width.addr, align 4
  %46 = icmp sgt i32 %45, 0
  br i1 %46, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = icmp slt i32 %47, %48
  br label %land.end.1

land.end.1:
  %50 = phi i1 [ false, %while.cond.1 ], [ %49, %land.rhs.1 ]
  br i1 %50, label %while.body.1, label %while.end.1

while.body.1:
  %51 = load i1, i1* %inTmp.addr, align 1
  br i1 %51, label %if.then.1, label %if.else

if.then.1:
  %52 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  %54 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* %52, %struct.nish_array* %xs, i32 %53, i32 %54)
  br label %if.end.1

if.else:
  %55 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %56 = load i32, i32* %n.addr, align 4
  %57 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* %xs, %struct.nish_array* %55, i32 %56, i32 %57)
  br label %if.end.1

if.end.1:
  %58 = load i1, i1* %inTmp.addr, align 1
  %59 = xor i1 %58, true
  store i1 %59, i1* %inTmp.addr, align 1
  %60 = load i32, i32* %width.addr, align 4
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %n.addr, align 4
  %63 = call i32 @nish.stepTo(i32 %60, i32 %61, i32 %62)
  store i32 %63, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %64 = load i1, i1* %inTmp.addr, align 1
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %66 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$i32(%struct.nish_array* %65, %struct.nish_array* %xs, i32 0, i32 %66)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = icmp slt i32 %3, 2
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %8
  %16 = load i8*, i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %16, i8** %x.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %18 = load i8*, i8** %x.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  store i8* %18, i8** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %forof.inc

forof.inc:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = add i64 %30, 1
  store i64 %31, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %32 = load i32, i32* %lo.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %lo.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %lo.addr, align 4
  %39 = load i32, i32* %n.addr, align 4
  %40 = call i32 @nish.stepTo(i32 %38, i32 32, i32 %39)
  store i32 %40, i32* %hi.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %lo.addr, align 4
  %43 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$str$fn.16.nish_main$arrow1(%struct.nish_array* %41, %struct.nish_array* %xs, i32 %42, i32 %43)
  %44 = load i32, i32* %hi.addr, align 4
  store i32 %44, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %45 = load i32, i32* %width.addr, align 4
  %46 = icmp sgt i32 %45, 0
  br i1 %46, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = icmp slt i32 %47, %48
  br label %land.end.1

land.end.1:
  %50 = phi i1 [ false, %while.cond.1 ], [ %49, %land.rhs.1 ]
  br i1 %50, label %while.body.1, label %while.end.1

while.body.1:
  %51 = load i1, i1* %inTmp.addr, align 1
  br i1 %51, label %if.then.1, label %if.else

if.then.1:
  %52 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  %54 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* %52, %struct.nish_array* %xs, i32 %53, i32 %54)
  br label %if.end.1

if.else:
  %55 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %56 = load i32, i32* %n.addr, align 4
  %57 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* %xs, %struct.nish_array* %55, i32 %56, i32 %57)
  br label %if.end.1

if.end.1:
  %58 = load i1, i1* %inTmp.addr, align 1
  %59 = xor i1 %58, true
  store i1 %59, i1* %inTmp.addr, align 1
  %60 = load i32, i32* %width.addr, align 4
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %n.addr, align 4
  %63 = call i32 @nish.stepTo(i32 %60, i32 %61, i32 %62)
  store i32 %63, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %64 = load i1, i1* %inTmp.addr, align 1
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %66 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$str(%struct.nish_array* %65, %struct.nish_array* %xs, i32 0, i32 %66)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal void @nish.insertionRun$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %d.addr, align 4
  %17 = sub nsw i32 %16, 1
  store i32 %17, i32* %p.addr, align 4
  %18 = load i32, i32* %p.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load i32, i32* %d.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %6 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call i32 @ascending$(i32 %22, i32 %27)
  %29 = icmp sgt i32 %28, 0
  %30 = xor i1 %29, true
  br i1 %30, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %31 = load i32, i32* %d.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %d.addr, align 4
  %34 = icmp sge i32 %33, %hi
  br i1 %34, label %if.then.1, label %if.end.1

if.then.1:
  %35 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %k.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.5

land.end.5:
  %50 = phi i1 [ false, %for.cond ], [ %49, %land.rhs.5 ]
  br i1 %50, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %51 = load i32, i32* %k.addr, align 4
  %52 = trunc i64 %39 to i32
  %53 = icmp slt i32 %51, %52
  br label %land.end.4

land.end.4:
  %54 = phi i1 [ false, %land.end.5 ], [ %53, %land.rhs.4 ]
  br i1 %54, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %55 = load i32, i32* %r.addr, align 4
  %56 = icmp sge i32 %55, 0
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %land.end.4 ], [ %56, %land.rhs.3 ]
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load i32, i32* %r.addr, align 4
  %59 = trunc i64 %43 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.2

land.end.2:
  %61 = phi i1 [ false, %land.end.3 ], [ %60, %land.rhs.2 ]
  br i1 %61, label %for.body, label %for.end

for.body:
  %62 = load i32, i32* %k.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %r.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %45 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = bitcast i8* %41 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %63
  store i32 %68, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = load i32, i32* %r.addr, align 4
  %72 = sub nsw i32 %71, 1
  store i32 %72, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %83 = load i32, i32* %i.addr, align 4
  %84 = icmp sge i32 %83, 0
  br i1 %84, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %85 = load i32, i32* %i.addr, align 4
  %86 = icmp slt i32 %85, %hi
  br label %land.end.6

land.end.6:
  %87 = phi i1 [ false, %for.cond.1 ], [ %86, %land.rhs.6 ]
  br i1 %87, label %for.body.1, label %for.end.1

for.body.1:
  %88 = load i32, i32* %i.addr, align 4
  store i32 %88, i32* %j.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %97 = load i32, i32* %j.addr, align 4
  %98 = icmp sgt i32 %97, %lo
  br i1 %98, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %99 = load i32, i32* %j.addr, align 4
  %100 = icmp sgt i32 %99, 0
  br label %land.end.9

land.end.9:
  %101 = phi i1 [ false, %while.cond.1 ], [ %100, %land.rhs.9 ]
  br i1 %101, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %102 = load i32, i32* %j.addr, align 4
  %103 = trunc i64 %90 to i32
  %104 = icmp slt i32 %102, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = trunc i64 %94 to i32
  %108 = icmp slt i32 %106, %107
  br label %land.end.7

land.end.7:
  %109 = phi i1 [ false, %land.end.8 ], [ %108, %land.rhs.7 ]
  br i1 %109, label %while.body.1, label %while.end.1

while.body.1:
  %110 = load i32, i32* %j.addr, align 4
  %111 = sub nsw i32 %110, 1
  store i32 %111, i32* %k.addr.1, align 4
  %112 = load i32, i32* %k.addr.1, align 4
  %113 = sext i32 %112 to i64
  %114 = bitcast i8* %92 to i32*
  %115 = getelementptr inbounds i32, i32* %114, i64 %113
  %116 = load i32, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = load i32, i32* %i.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %96 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 %118
  %121 = load i32, i32* %120, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = call i32 @ascending$(i32 %116, i32 %121)
  %123 = icmp sgt i32 %122, 0
  %124 = xor i1 %123, true
  br i1 %124, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %125 = load i32, i32* %k.addr.1, align 4
  %126 = icmp slt i32 %125, 0
  br label %lor.end.2

lor.end.2:
  %127 = phi i1 [ true, %while.body.1 ], [ %126, %lor.rhs.2 ]
  br i1 %127, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %128 = load i32, i32* %k.addr.1, align 4
  %129 = trunc i64 %90 to i32
  %130 = icmp sge i32 %128, %129
  br label %lor.end.1

lor.end.1:
  %131 = phi i1 [ true, %lor.end.2 ], [ %130, %lor.rhs.1 ]
  br i1 %131, label %lor.end, label %lor.rhs

lor.rhs:
  %132 = load i32, i32* %j.addr, align 4
  %133 = trunc i64 %90 to i32
  %134 = icmp sge i32 %132, %133
  br label %lor.end

lor.end:
  %135 = phi i1 [ true, %lor.end.1 ], [ %134, %lor.rhs ]
  br i1 %135, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %136 = load i32, i32* %j.addr, align 4
  %137 = sext i32 %136 to i64
  %138 = load i32, i32* %k.addr.1, align 4
  %139 = sext i32 %138 to i64
  %140 = bitcast i8* %92 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 %139
  %142 = load i32, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = bitcast i8* %92 to i32*
  %144 = getelementptr inbounds i32, i32* %143, i64 %137
  store i32 %142, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %145 = load i32, i32* %k.addr.1, align 4
  store i32 %145, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %80 to i32
  %148 = icmp slt i32 %146, %147
  br i1 %148, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %149 = load i32, i32* %j.addr, align 4
  %150 = icmp sge i32 %149, 0
  br label %land.end.11

land.end.11:
  %151 = phi i1 [ false, %while.end.1 ], [ %150, %land.rhs.11 ]
  br i1 %151, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %152 = load i32, i32* %j.addr, align 4
  %153 = trunc i64 %76 to i32
  %154 = icmp slt i32 %152, %153
  br label %land.end.10

land.end.10:
  %155 = phi i1 [ false, %land.end.11 ], [ %154, %land.rhs.10 ]
  br i1 %155, label %if.then.3, label %if.end.3

if.then.3:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = load i32, i32* %i.addr, align 4
  %159 = sext i32 %158 to i64
  %160 = bitcast i8* %82 to i32*
  %161 = getelementptr inbounds i32, i32* %160, i64 %159
  %162 = load i32, i32* %161, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = bitcast i8* %78 to i32*
  %164 = getelementptr inbounds i32, i32* %163, i64 %157
  store i32 %162, i32* %164, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %165 = load i32, i32* %i.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$i32$fn.9.ascending(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %k.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %k.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = bitcast i8* %7 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  store i32 %27, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %30 = load i32, i32* %k.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.insertionRun$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %d.addr, align 4
  %17 = sub nsw i32 %16, 1
  store i32 %17, i32* %p.addr, align 4
  %18 = load i32, i32* %p.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load i32, i32* %d.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %6 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call i32 @nish_main$arrow0(i32 %22, i32 %27)
  %29 = icmp sgt i32 %28, 0
  %30 = xor i1 %29, true
  br i1 %30, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %31 = load i32, i32* %d.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %d.addr, align 4
  %34 = icmp sge i32 %33, %hi
  br i1 %34, label %if.then.1, label %if.end.1

if.then.1:
  %35 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %k.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.5

land.end.5:
  %50 = phi i1 [ false, %for.cond ], [ %49, %land.rhs.5 ]
  br i1 %50, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %51 = load i32, i32* %k.addr, align 4
  %52 = trunc i64 %39 to i32
  %53 = icmp slt i32 %51, %52
  br label %land.end.4

land.end.4:
  %54 = phi i1 [ false, %land.end.5 ], [ %53, %land.rhs.4 ]
  br i1 %54, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %55 = load i32, i32* %r.addr, align 4
  %56 = icmp sge i32 %55, 0
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %land.end.4 ], [ %56, %land.rhs.3 ]
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load i32, i32* %r.addr, align 4
  %59 = trunc i64 %43 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.2

land.end.2:
  %61 = phi i1 [ false, %land.end.3 ], [ %60, %land.rhs.2 ]
  br i1 %61, label %for.body, label %for.end

for.body:
  %62 = load i32, i32* %k.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %r.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %45 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = bitcast i8* %41 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %63
  store i32 %68, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = load i32, i32* %r.addr, align 4
  %72 = sub nsw i32 %71, 1
  store i32 %72, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %83 = load i32, i32* %i.addr, align 4
  %84 = icmp sge i32 %83, 0
  br i1 %84, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %85 = load i32, i32* %i.addr, align 4
  %86 = icmp slt i32 %85, %hi
  br label %land.end.6

land.end.6:
  %87 = phi i1 [ false, %for.cond.1 ], [ %86, %land.rhs.6 ]
  br i1 %87, label %for.body.1, label %for.end.1

for.body.1:
  %88 = load i32, i32* %i.addr, align 4
  store i32 %88, i32* %j.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %97 = load i32, i32* %j.addr, align 4
  %98 = icmp sgt i32 %97, %lo
  br i1 %98, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %99 = load i32, i32* %j.addr, align 4
  %100 = icmp sgt i32 %99, 0
  br label %land.end.9

land.end.9:
  %101 = phi i1 [ false, %while.cond.1 ], [ %100, %land.rhs.9 ]
  br i1 %101, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %102 = load i32, i32* %j.addr, align 4
  %103 = trunc i64 %90 to i32
  %104 = icmp slt i32 %102, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = trunc i64 %94 to i32
  %108 = icmp slt i32 %106, %107
  br label %land.end.7

land.end.7:
  %109 = phi i1 [ false, %land.end.8 ], [ %108, %land.rhs.7 ]
  br i1 %109, label %while.body.1, label %while.end.1

while.body.1:
  %110 = load i32, i32* %j.addr, align 4
  %111 = sub nsw i32 %110, 1
  store i32 %111, i32* %k.addr.1, align 4
  %112 = load i32, i32* %k.addr.1, align 4
  %113 = sext i32 %112 to i64
  %114 = bitcast i8* %92 to i32*
  %115 = getelementptr inbounds i32, i32* %114, i64 %113
  %116 = load i32, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = load i32, i32* %i.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %96 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 %118
  %121 = load i32, i32* %120, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = call i32 @nish_main$arrow0(i32 %116, i32 %121)
  %123 = icmp sgt i32 %122, 0
  %124 = xor i1 %123, true
  br i1 %124, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %125 = load i32, i32* %k.addr.1, align 4
  %126 = icmp slt i32 %125, 0
  br label %lor.end.2

lor.end.2:
  %127 = phi i1 [ true, %while.body.1 ], [ %126, %lor.rhs.2 ]
  br i1 %127, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %128 = load i32, i32* %k.addr.1, align 4
  %129 = trunc i64 %90 to i32
  %130 = icmp sge i32 %128, %129
  br label %lor.end.1

lor.end.1:
  %131 = phi i1 [ true, %lor.end.2 ], [ %130, %lor.rhs.1 ]
  br i1 %131, label %lor.end, label %lor.rhs

lor.rhs:
  %132 = load i32, i32* %j.addr, align 4
  %133 = trunc i64 %90 to i32
  %134 = icmp sge i32 %132, %133
  br label %lor.end

lor.end:
  %135 = phi i1 [ true, %lor.end.1 ], [ %134, %lor.rhs ]
  br i1 %135, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %136 = load i32, i32* %j.addr, align 4
  %137 = sext i32 %136 to i64
  %138 = load i32, i32* %k.addr.1, align 4
  %139 = sext i32 %138 to i64
  %140 = bitcast i8* %92 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 %139
  %142 = load i32, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = bitcast i8* %92 to i32*
  %144 = getelementptr inbounds i32, i32* %143, i64 %137
  store i32 %142, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %145 = load i32, i32* %k.addr.1, align 4
  store i32 %145, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %80 to i32
  %148 = icmp slt i32 %146, %147
  br i1 %148, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %149 = load i32, i32* %j.addr, align 4
  %150 = icmp sge i32 %149, 0
  br label %land.end.11

land.end.11:
  %151 = phi i1 [ false, %while.end.1 ], [ %150, %land.rhs.11 ]
  br i1 %151, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %152 = load i32, i32* %j.addr, align 4
  %153 = trunc i64 %76 to i32
  %154 = icmp slt i32 %152, %153
  br label %land.end.10

land.end.10:
  %155 = phi i1 [ false, %land.end.11 ], [ %154, %land.rhs.10 ]
  br i1 %155, label %if.then.3, label %if.end.3

if.then.3:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = load i32, i32* %i.addr, align 4
  %159 = sext i32 %158 to i64
  %160 = bitcast i8* %82 to i32*
  %161 = getelementptr inbounds i32, i32* %160, i64 %159
  %162 = load i32, i32* %161, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = bitcast i8* %78 to i32*
  %164 = getelementptr inbounds i32, i32* %163, i64 %157
  store i32 %162, i32* %164, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %165 = load i32, i32* %i.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$i32$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.insertionRun$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %d.addr, align 4
  %17 = sub nsw i32 %16, 1
  store i32 %17, i32* %p.addr, align 4
  %18 = load i32, i32* %p.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %19
  %22 = load i8*, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %23 = load i32, i32* %d.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %6 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %24
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = call i32 @nish_main$arrow1(i8* %22, i8* %27)
  %29 = icmp sgt i32 %28, 0
  %30 = xor i1 %29, true
  br i1 %30, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %31 = load i32, i32* %d.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %d.addr, align 4
  %34 = icmp sge i32 %33, %hi
  br i1 %34, label %if.then.1, label %if.end.1

if.then.1:
  %35 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %k.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.5

land.end.5:
  %50 = phi i1 [ false, %for.cond ], [ %49, %land.rhs.5 ]
  br i1 %50, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %51 = load i32, i32* %k.addr, align 4
  %52 = trunc i64 %39 to i32
  %53 = icmp slt i32 %51, %52
  br label %land.end.4

land.end.4:
  %54 = phi i1 [ false, %land.end.5 ], [ %53, %land.rhs.4 ]
  br i1 %54, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %55 = load i32, i32* %r.addr, align 4
  %56 = icmp sge i32 %55, 0
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %land.end.4 ], [ %56, %land.rhs.3 ]
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load i32, i32* %r.addr, align 4
  %59 = trunc i64 %43 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.2

land.end.2:
  %61 = phi i1 [ false, %land.end.3 ], [ %60, %land.rhs.2 ]
  br i1 %61, label %for.body, label %for.end

for.body:
  %62 = load i32, i32* %k.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %r.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %45 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %65
  %68 = load i8*, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = bitcast i8* %41 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 %63
  store i8* %68, i8** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %71 = load i32, i32* %r.addr, align 4
  %72 = sub nsw i32 %71, 1
  store i32 %72, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %83 = load i32, i32* %i.addr, align 4
  %84 = icmp sge i32 %83, 0
  br i1 %84, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %85 = load i32, i32* %i.addr, align 4
  %86 = icmp slt i32 %85, %hi
  br label %land.end.6

land.end.6:
  %87 = phi i1 [ false, %for.cond.1 ], [ %86, %land.rhs.6 ]
  br i1 %87, label %for.body.1, label %for.end.1

for.body.1:
  %88 = load i32, i32* %i.addr, align 4
  store i32 %88, i32* %j.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %97 = load i32, i32* %j.addr, align 4
  %98 = icmp sgt i32 %97, %lo
  br i1 %98, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %99 = load i32, i32* %j.addr, align 4
  %100 = icmp sgt i32 %99, 0
  br label %land.end.9

land.end.9:
  %101 = phi i1 [ false, %while.cond.1 ], [ %100, %land.rhs.9 ]
  br i1 %101, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %102 = load i32, i32* %j.addr, align 4
  %103 = trunc i64 %90 to i32
  %104 = icmp slt i32 %102, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = trunc i64 %94 to i32
  %108 = icmp slt i32 %106, %107
  br label %land.end.7

land.end.7:
  %109 = phi i1 [ false, %land.end.8 ], [ %108, %land.rhs.7 ]
  br i1 %109, label %while.body.1, label %while.end.1

while.body.1:
  %110 = load i32, i32* %j.addr, align 4
  %111 = sub nsw i32 %110, 1
  store i32 %111, i32* %k.addr.1, align 4
  %112 = load i32, i32* %k.addr.1, align 4
  %113 = sext i32 %112 to i64
  %114 = bitcast i8* %92 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %113
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = load i32, i32* %i.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %96 to i8**
  %120 = getelementptr inbounds i8*, i8** %119, i64 %118
  %121 = load i8*, i8** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %122 = call i32 @nish_main$arrow1(i8* %116, i8* %121)
  %123 = icmp sgt i32 %122, 0
  %124 = xor i1 %123, true
  br i1 %124, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %125 = load i32, i32* %k.addr.1, align 4
  %126 = icmp slt i32 %125, 0
  br label %lor.end.2

lor.end.2:
  %127 = phi i1 [ true, %while.body.1 ], [ %126, %lor.rhs.2 ]
  br i1 %127, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %128 = load i32, i32* %k.addr.1, align 4
  %129 = trunc i64 %90 to i32
  %130 = icmp sge i32 %128, %129
  br label %lor.end.1

lor.end.1:
  %131 = phi i1 [ true, %lor.end.2 ], [ %130, %lor.rhs.1 ]
  br i1 %131, label %lor.end, label %lor.rhs

lor.rhs:
  %132 = load i32, i32* %j.addr, align 4
  %133 = trunc i64 %90 to i32
  %134 = icmp sge i32 %132, %133
  br label %lor.end

lor.end:
  %135 = phi i1 [ true, %lor.end.1 ], [ %134, %lor.rhs ]
  br i1 %135, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %136 = load i32, i32* %j.addr, align 4
  %137 = sext i32 %136 to i64
  %138 = load i32, i32* %k.addr.1, align 4
  %139 = sext i32 %138 to i64
  %140 = bitcast i8* %92 to i8**
  %141 = getelementptr inbounds i8*, i8** %140, i64 %139
  %142 = load i8*, i8** %141, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %143 = bitcast i8* %92 to i8**
  %144 = getelementptr inbounds i8*, i8** %143, i64 %137
  store i8* %142, i8** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %145 = load i32, i32* %k.addr.1, align 4
  store i32 %145, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %80 to i32
  %148 = icmp slt i32 %146, %147
  br i1 %148, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %149 = load i32, i32* %j.addr, align 4
  %150 = icmp sge i32 %149, 0
  br label %land.end.11

land.end.11:
  %151 = phi i1 [ false, %while.end.1 ], [ %150, %land.rhs.11 ]
  br i1 %151, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %152 = load i32, i32* %j.addr, align 4
  %153 = trunc i64 %76 to i32
  %154 = icmp slt i32 %152, %153
  br label %land.end.10

land.end.10:
  %155 = phi i1 [ false, %land.end.11 ], [ %154, %land.rhs.10 ]
  br i1 %155, label %if.then.3, label %if.end.3

if.then.3:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = load i32, i32* %i.addr, align 4
  %159 = sext i32 %158 to i64
  %160 = bitcast i8* %82 to i8**
  %161 = getelementptr inbounds i8*, i8** %160, i64 %159
  %162 = load i8*, i8** %161, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %163 = bitcast i8* %78 to i8**
  %164 = getelementptr inbounds i8*, i8** %163, i64 %157
  store i8* %162, i8** %164, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %165 = load i32, i32* %i.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$str$fn.16.nish_main$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %k.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %k.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %24
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = bitcast i8* %7 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %27, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %30 = load i32, i32* %k.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %mid, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sub nsw i32 %mid, 1
  store i32 %8, i32* %last.addr, align 4
  %9 = load i32, i32* %last.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %9, %12
  br i1 %13, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %14 = load i32, i32* %last.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %15
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = sext i32 %mid to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %21
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = call i32 @ascending$(i32 %20, i32 %26)
  %28 = icmp sgt i32 %27, 0
  %29 = xor i1 %28, true
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %if.then ], [ %29, %land.rhs.2 ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$i32(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %39 = load i32, i32* %k.addr, align 4
  %40 = icmp sge i32 %39, 0
  br i1 %40, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp slt i32 %41, %hi
  br label %land.end.3

land.end.3:
  %43 = phi i1 [ false, %for.cond ], [ %42, %land.rhs.3 ]
  br i1 %43, label %for.body, label %for.end

for.body:
  %44 = load i32, i32* %i.addr, align 4
  %45 = icmp sge i32 %44, %mid
  store i1 %45, i1* %right.addr, align 1
  %46 = load i1, i1* %right.addr, align 1
  %47 = xor i1 %46, true
  br i1 %47, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.8

land.end.8:
  %50 = phi i1 [ false, %for.body ], [ %49, %land.rhs.8 ]
  br i1 %50, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %51 = load i32, i32* %i.addr, align 4
  %52 = icmp sge i32 %51, 0
  br label %land.end.7

land.end.7:
  %53 = phi i1 [ false, %land.end.8 ], [ %52, %land.rhs.7 ]
  br i1 %53, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %54 = load i32, i32* %i.addr, align 4
  %55 = trunc i64 %32 to i32
  %56 = icmp slt i32 %54, %55
  br label %land.end.6

land.end.6:
  %57 = phi i1 [ false, %land.end.7 ], [ %56, %land.rhs.6 ]
  br i1 %57, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %58 = load i32, i32* %j.addr, align 4
  %59 = icmp sge i32 %58, 0
  br label %land.end.5

land.end.5:
  %60 = phi i1 [ false, %land.end.6 ], [ %59, %land.rhs.5 ]
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %j.addr, align 4
  %62 = trunc i64 %32 to i32
  %63 = icmp slt i32 %61, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %land.end.5 ], [ %63, %land.rhs.4 ]
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load i32, i32* %i.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %34 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %66
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = load i32, i32* %j.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %34 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 %71
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = call i32 @ascending$(i32 %69, i32 %74)
  %76 = icmp sgt i32 %75, 0
  store i1 %76, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %77 = load i1, i1* %right.addr, align 1
  br i1 %77, label %if.then.3, label %if.else

if.then.3:
  %78 = load i32, i32* %j.addr, align 4
  %79 = icmp sge i32 %78, 0
  br i1 %79, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %80 = load i32, i32* %j.addr, align 4
  %81 = trunc i64 %32 to i32
  %82 = icmp slt i32 %80, %81
  br label %land.end.10

land.end.10:
  %83 = phi i1 [ false, %if.then.3 ], [ %82, %land.rhs.10 ]
  br i1 %83, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %84 = load i32, i32* %k.addr, align 4
  %85 = trunc i64 %36 to i32
  %86 = icmp slt i32 %84, %85
  br label %land.end.9

land.end.9:
  %87 = phi i1 [ false, %land.end.10 ], [ %86, %land.rhs.9 ]
  br i1 %87, label %if.then.4, label %if.end.4

if.then.4:
  %88 = load i32, i32* %k.addr, align 4
  %89 = sext i32 %88 to i64
  %90 = load i32, i32* %j.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = bitcast i8* %34 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 %91
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = bitcast i8* %38 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 %89
  store i32 %94, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.4

if.end.4:
  %97 = load i32, i32* %j.addr, align 4
  %98 = add i32 %97, 1
  store i32 %98, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %99 = load i32, i32* %i.addr, align 4
  %100 = icmp sge i32 %99, 0
  br i1 %100, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %101 = load i32, i32* %i.addr, align 4
  %102 = trunc i64 %32 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end.12

land.end.12:
  %104 = phi i1 [ false, %if.else ], [ %103, %land.rhs.12 ]
  br i1 %104, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %105 = load i32, i32* %k.addr, align 4
  %106 = trunc i64 %36 to i32
  %107 = icmp slt i32 %105, %106
  br label %land.end.11

land.end.11:
  %108 = phi i1 [ false, %land.end.12 ], [ %107, %land.rhs.11 ]
  br i1 %108, label %if.then.5, label %if.end.5

if.then.5:
  %109 = load i32, i32* %k.addr, align 4
  %110 = sext i32 %109 to i64
  %111 = load i32, i32* %i.addr, align 4
  %112 = sext i32 %111 to i64
  %113 = bitcast i8* %34 to i32*
  %114 = getelementptr inbounds i32, i32* %113, i64 %112
  %115 = load i32, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %116 = bitcast i8* %38 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 %110
  store i32 %115, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.5

if.end.5:
  %118 = load i32, i32* %i.addr, align 4
  %119 = add i32 %118, 1
  store i32 %119, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %120 = load i32, i32* %k.addr, align 4
  %121 = add nsw i32 %120, 1
  store i32 %121, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %mid, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sub nsw i32 %mid, 1
  store i32 %8, i32* %last.addr, align 4
  %9 = load i32, i32* %last.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %9, %12
  br i1 %13, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %14 = load i32, i32* %last.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %15
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = sext i32 %mid to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %21
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = call i32 @nish_main$arrow0(i32 %20, i32 %26)
  %28 = icmp sgt i32 %27, 0
  %29 = xor i1 %28, true
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %if.then ], [ %29, %land.rhs.2 ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$i32(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %39 = load i32, i32* %k.addr, align 4
  %40 = icmp sge i32 %39, 0
  br i1 %40, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp slt i32 %41, %hi
  br label %land.end.3

land.end.3:
  %43 = phi i1 [ false, %for.cond ], [ %42, %land.rhs.3 ]
  br i1 %43, label %for.body, label %for.end

for.body:
  %44 = load i32, i32* %i.addr, align 4
  %45 = icmp sge i32 %44, %mid
  store i1 %45, i1* %right.addr, align 1
  %46 = load i1, i1* %right.addr, align 1
  %47 = xor i1 %46, true
  br i1 %47, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.8

land.end.8:
  %50 = phi i1 [ false, %for.body ], [ %49, %land.rhs.8 ]
  br i1 %50, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %51 = load i32, i32* %i.addr, align 4
  %52 = icmp sge i32 %51, 0
  br label %land.end.7

land.end.7:
  %53 = phi i1 [ false, %land.end.8 ], [ %52, %land.rhs.7 ]
  br i1 %53, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %54 = load i32, i32* %i.addr, align 4
  %55 = trunc i64 %32 to i32
  %56 = icmp slt i32 %54, %55
  br label %land.end.6

land.end.6:
  %57 = phi i1 [ false, %land.end.7 ], [ %56, %land.rhs.6 ]
  br i1 %57, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %58 = load i32, i32* %j.addr, align 4
  %59 = icmp sge i32 %58, 0
  br label %land.end.5

land.end.5:
  %60 = phi i1 [ false, %land.end.6 ], [ %59, %land.rhs.5 ]
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %j.addr, align 4
  %62 = trunc i64 %32 to i32
  %63 = icmp slt i32 %61, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %land.end.5 ], [ %63, %land.rhs.4 ]
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load i32, i32* %i.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %34 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %66
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = load i32, i32* %j.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %34 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 %71
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = call i32 @nish_main$arrow0(i32 %69, i32 %74)
  %76 = icmp sgt i32 %75, 0
  store i1 %76, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %77 = load i1, i1* %right.addr, align 1
  br i1 %77, label %if.then.3, label %if.else

if.then.3:
  %78 = load i32, i32* %j.addr, align 4
  %79 = icmp sge i32 %78, 0
  br i1 %79, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %80 = load i32, i32* %j.addr, align 4
  %81 = trunc i64 %32 to i32
  %82 = icmp slt i32 %80, %81
  br label %land.end.10

land.end.10:
  %83 = phi i1 [ false, %if.then.3 ], [ %82, %land.rhs.10 ]
  br i1 %83, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %84 = load i32, i32* %k.addr, align 4
  %85 = trunc i64 %36 to i32
  %86 = icmp slt i32 %84, %85
  br label %land.end.9

land.end.9:
  %87 = phi i1 [ false, %land.end.10 ], [ %86, %land.rhs.9 ]
  br i1 %87, label %if.then.4, label %if.end.4

if.then.4:
  %88 = load i32, i32* %k.addr, align 4
  %89 = sext i32 %88 to i64
  %90 = load i32, i32* %j.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = bitcast i8* %34 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 %91
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = bitcast i8* %38 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 %89
  store i32 %94, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.4

if.end.4:
  %97 = load i32, i32* %j.addr, align 4
  %98 = add i32 %97, 1
  store i32 %98, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %99 = load i32, i32* %i.addr, align 4
  %100 = icmp sge i32 %99, 0
  br i1 %100, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %101 = load i32, i32* %i.addr, align 4
  %102 = trunc i64 %32 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end.12

land.end.12:
  %104 = phi i1 [ false, %if.else ], [ %103, %land.rhs.12 ]
  br i1 %104, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %105 = load i32, i32* %k.addr, align 4
  %106 = trunc i64 %36 to i32
  %107 = icmp slt i32 %105, %106
  br label %land.end.11

land.end.11:
  %108 = phi i1 [ false, %land.end.12 ], [ %107, %land.rhs.11 ]
  br i1 %108, label %if.then.5, label %if.end.5

if.then.5:
  %109 = load i32, i32* %k.addr, align 4
  %110 = sext i32 %109 to i64
  %111 = load i32, i32* %i.addr, align 4
  %112 = sext i32 %111 to i64
  %113 = bitcast i8* %34 to i32*
  %114 = getelementptr inbounds i32, i32* %113, i64 %112
  %115 = load i32, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %116 = bitcast i8* %38 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 %110
  store i32 %115, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.5

if.end.5:
  %118 = load i32, i32* %i.addr, align 4
  %119 = add i32 %118, 1
  store i32 %119, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %120 = load i32, i32* %k.addr, align 4
  %121 = add nsw i32 %120, 1
  store i32 %121, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %mid, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sub nsw i32 %mid, 1
  store i32 %8, i32* %last.addr, align 4
  %9 = load i32, i32* %last.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %9, %12
  br i1 %13, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %14 = load i32, i32* %last.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %15
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %21 = sext i32 %mid to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %21
  %26 = load i8*, i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = call i32 @nish_main$arrow1(i8* %20, i8* %26)
  %28 = icmp sgt i32 %27, 0
  %29 = xor i1 %28, true
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %if.then ], [ %29, %land.rhs.2 ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$str(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %39 = load i32, i32* %k.addr, align 4
  %40 = icmp sge i32 %39, 0
  br i1 %40, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp slt i32 %41, %hi
  br label %land.end.3

land.end.3:
  %43 = phi i1 [ false, %for.cond ], [ %42, %land.rhs.3 ]
  br i1 %43, label %for.body, label %for.end

for.body:
  %44 = load i32, i32* %i.addr, align 4
  %45 = icmp sge i32 %44, %mid
  store i1 %45, i1* %right.addr, align 1
  %46 = load i1, i1* %right.addr, align 1
  %47 = xor i1 %46, true
  br i1 %47, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.8

land.end.8:
  %50 = phi i1 [ false, %for.body ], [ %49, %land.rhs.8 ]
  br i1 %50, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %51 = load i32, i32* %i.addr, align 4
  %52 = icmp sge i32 %51, 0
  br label %land.end.7

land.end.7:
  %53 = phi i1 [ false, %land.end.8 ], [ %52, %land.rhs.7 ]
  br i1 %53, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %54 = load i32, i32* %i.addr, align 4
  %55 = trunc i64 %32 to i32
  %56 = icmp slt i32 %54, %55
  br label %land.end.6

land.end.6:
  %57 = phi i1 [ false, %land.end.7 ], [ %56, %land.rhs.6 ]
  br i1 %57, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %58 = load i32, i32* %j.addr, align 4
  %59 = icmp sge i32 %58, 0
  br label %land.end.5

land.end.5:
  %60 = phi i1 [ false, %land.end.6 ], [ %59, %land.rhs.5 ]
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %j.addr, align 4
  %62 = trunc i64 %32 to i32
  %63 = icmp slt i32 %61, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %land.end.5 ], [ %63, %land.rhs.4 ]
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load i32, i32* %i.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %34 to i8**
  %68 = getelementptr inbounds i8*, i8** %67, i64 %66
  %69 = load i8*, i8** %68, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %70 = load i32, i32* %j.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %34 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %71
  %74 = load i8*, i8** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %75 = call i32 @nish_main$arrow1(i8* %69, i8* %74)
  %76 = icmp sgt i32 %75, 0
  store i1 %76, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %77 = load i1, i1* %right.addr, align 1
  br i1 %77, label %if.then.3, label %if.else

if.then.3:
  %78 = load i32, i32* %j.addr, align 4
  %79 = icmp sge i32 %78, 0
  br i1 %79, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %80 = load i32, i32* %j.addr, align 4
  %81 = trunc i64 %32 to i32
  %82 = icmp slt i32 %80, %81
  br label %land.end.10

land.end.10:
  %83 = phi i1 [ false, %if.then.3 ], [ %82, %land.rhs.10 ]
  br i1 %83, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %84 = load i32, i32* %k.addr, align 4
  %85 = trunc i64 %36 to i32
  %86 = icmp slt i32 %84, %85
  br label %land.end.9

land.end.9:
  %87 = phi i1 [ false, %land.end.10 ], [ %86, %land.rhs.9 ]
  br i1 %87, label %if.then.4, label %if.end.4

if.then.4:
  %88 = load i32, i32* %k.addr, align 4
  %89 = sext i32 %88 to i64
  %90 = load i32, i32* %j.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = bitcast i8* %34 to i8**
  %93 = getelementptr inbounds i8*, i8** %92, i64 %91
  %94 = load i8*, i8** %93, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %95 = bitcast i8* %38 to i8**
  %96 = getelementptr inbounds i8*, i8** %95, i64 %89
  store i8* %94, i8** %96, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.4

if.end.4:
  %97 = load i32, i32* %j.addr, align 4
  %98 = add i32 %97, 1
  store i32 %98, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %99 = load i32, i32* %i.addr, align 4
  %100 = icmp sge i32 %99, 0
  br i1 %100, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %101 = load i32, i32* %i.addr, align 4
  %102 = trunc i64 %32 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end.12

land.end.12:
  %104 = phi i1 [ false, %if.else ], [ %103, %land.rhs.12 ]
  br i1 %104, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %105 = load i32, i32* %k.addr, align 4
  %106 = trunc i64 %36 to i32
  %107 = icmp slt i32 %105, %106
  br label %land.end.11

land.end.11:
  %108 = phi i1 [ false, %land.end.12 ], [ %107, %land.rhs.11 ]
  br i1 %108, label %if.then.5, label %if.end.5

if.then.5:
  %109 = load i32, i32* %k.addr, align 4
  %110 = sext i32 %109 to i64
  %111 = load i32, i32* %i.addr, align 4
  %112 = sext i32 %111 to i64
  %113 = bitcast i8* %34 to i8**
  %114 = getelementptr inbounds i8*, i8** %113, i64 %112
  %115 = load i8*, i8** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %116 = bitcast i8* %38 to i8**
  %117 = getelementptr inbounds i8*, i8** %116, i64 %110
  store i8* %115, i8** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.5

if.end.5:
  %118 = load i32, i32* %i.addr, align 4
  %119 = add i32 %118, 1
  store i32 %119, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %120 = load i32, i32* %k.addr, align 4
  %121 = add nsw i32 %120, 1
  store i32 %121, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
