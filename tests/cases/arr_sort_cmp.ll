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
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
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
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %lo.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 16)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp slt i32 %11, %13
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  %15 = load i32, i32* %lo.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 16)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  %19 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %20 = phi i32 [ %17, %ovf.ok.1 ], [ %19, %cond.false ]
  call void @nish.insertionRun$i32$fn.9.ascending(%struct.nish_array* %xs, i32 %8, i32 %20)
  br label %for.inc

for.inc:
  %21 = load i32, i32* %lo.addr, align 4
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 16)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %n.addr, align 4
  %26 = icmp sle i32 %25, 16
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = icmp ult i64 %30, %32
  br i1 %33, label %forof.body, label %forof.end

forof.body:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %30
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %38, i32* %x.addr, align 4
  %39 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %40 = load i32, i32* %x.addr, align 4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %39, i64 4)
  br label %push.store

push.store:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %42
  store i32 %40, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  br label %forof.inc

forof.inc:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = add i64 %52, 1
  store i64 %53, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 16, i32* %width.addr, align 4
  br label %for.cond.1

for.cond.1:
  %54 = load i32, i32* %width.addr, align 4
  %55 = load i32, i32* %n.addr, align 4
  %56 = icmp slt i32 %54, %55
  br i1 %56, label %for.body.1, label %for.end.1

for.body.1:
  %57 = load i1, i1* %inTmp.addr, align 1
  br i1 %57, label %if.then.2, label %if.else

if.then.2:
  %58 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %59 = load i32, i32* %n.addr, align 4
  %60 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* %58, %struct.nish_array* %xs, i32 %59, i32 %60)
  br label %if.end.2

if.else:
  %61 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %62 = load i32, i32* %n.addr, align 4
  %63 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* %xs, %struct.nish_array* %61, i32 %62, i32 %63)
  br label %if.end.2

if.end.2:
  %64 = load i1, i1* %inTmp.addr, align 1
  %65 = xor i1 %64, true
  store i1 %65, i1* %inTmp.addr, align 1
  br label %for.inc.1

for.inc.1:
  %66 = load i32, i32* %width.addr, align 4
  %67 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %66, i32 2)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %68, i32* %width.addr, align 4
  br label %for.cond.1

for.end.1:
  %70 = load i1, i1* %inTmp.addr, align 1
  br i1 %70, label %if.then.3, label %if.end.3

if.then.3:
  store i32 0, i32* %k.addr, align 4
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %80 = load i32, i32* %k.addr, align 4
  %81 = load i32, i32* %n.addr, align 4
  %82 = icmp slt i32 %80, %81
  br i1 %82, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %83 = load i32, i32* %k.addr, align 4
  %84 = trunc i64 %72 to i32
  %85 = icmp slt i32 %83, %84
  br label %land.end.1

land.end.1:
  %86 = phi i1 [ false, %for.cond.2 ], [ %85, %land.rhs.1 ]
  br i1 %86, label %land.rhs, label %land.end

land.rhs:
  %87 = load i32, i32* %k.addr, align 4
  %88 = trunc i64 %77 to i32
  %89 = icmp slt i32 %87, %88
  br label %land.end

land.end:
  %90 = phi i1 [ false, %land.end.1 ], [ %89, %land.rhs ]
  br i1 %90, label %for.body.2, label %for.end.2

for.body.2:
  %91 = load i32, i32* %k.addr, align 4
  %92 = sext i32 %91 to i64
  %93 = load i32, i32* %k.addr, align 4
  %94 = sext i32 %93 to i64
  %95 = bitcast i8* %79 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 %94
  %97 = load i32, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %98 = bitcast i8* %74 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 %92
  store i32 %97, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.2

for.inc.2:
  %100 = load i32, i32* %k.addr, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %k.addr, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.3

if.end.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %for.inc ], [ 2, %for.inc.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
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
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %lo.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 16)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp slt i32 %11, %13
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  %15 = load i32, i32* %lo.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 16)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  %19 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %20 = phi i32 [ %17, %ovf.ok.1 ], [ %19, %cond.false ]
  call void @nish.insertionRun$i32$fn.16.nish_main$arrow0(%struct.nish_array* %xs, i32 %8, i32 %20)
  br label %for.inc

for.inc:
  %21 = load i32, i32* %lo.addr, align 4
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 16)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %n.addr, align 4
  %26 = icmp sle i32 %25, 16
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = icmp ult i64 %30, %32
  br i1 %33, label %forof.body, label %forof.end

forof.body:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %30
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %38, i32* %x.addr, align 4
  %39 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %40 = load i32, i32* %x.addr, align 4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %39, i64 4)
  br label %push.store

push.store:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %42
  store i32 %40, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  br label %forof.inc

forof.inc:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = add i64 %52, 1
  store i64 %53, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 16, i32* %width.addr, align 4
  br label %for.cond.1

for.cond.1:
  %54 = load i32, i32* %width.addr, align 4
  %55 = load i32, i32* %n.addr, align 4
  %56 = icmp slt i32 %54, %55
  br i1 %56, label %for.body.1, label %for.end.1

for.body.1:
  %57 = load i1, i1* %inTmp.addr, align 1
  br i1 %57, label %if.then.2, label %if.else

if.then.2:
  %58 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %59 = load i32, i32* %n.addr, align 4
  %60 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* %58, %struct.nish_array* %xs, i32 %59, i32 %60)
  br label %if.end.2

if.else:
  %61 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %62 = load i32, i32* %n.addr, align 4
  %63 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* %xs, %struct.nish_array* %61, i32 %62, i32 %63)
  br label %if.end.2

if.end.2:
  %64 = load i1, i1* %inTmp.addr, align 1
  %65 = xor i1 %64, true
  store i1 %65, i1* %inTmp.addr, align 1
  br label %for.inc.1

for.inc.1:
  %66 = load i32, i32* %width.addr, align 4
  %67 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %66, i32 2)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %68, i32* %width.addr, align 4
  br label %for.cond.1

for.end.1:
  %70 = load i1, i1* %inTmp.addr, align 1
  br i1 %70, label %if.then.3, label %if.end.3

if.then.3:
  store i32 0, i32* %k.addr, align 4
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %80 = load i32, i32* %k.addr, align 4
  %81 = load i32, i32* %n.addr, align 4
  %82 = icmp slt i32 %80, %81
  br i1 %82, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %83 = load i32, i32* %k.addr, align 4
  %84 = trunc i64 %72 to i32
  %85 = icmp slt i32 %83, %84
  br label %land.end.1

land.end.1:
  %86 = phi i1 [ false, %for.cond.2 ], [ %85, %land.rhs.1 ]
  br i1 %86, label %land.rhs, label %land.end

land.rhs:
  %87 = load i32, i32* %k.addr, align 4
  %88 = trunc i64 %77 to i32
  %89 = icmp slt i32 %87, %88
  br label %land.end

land.end:
  %90 = phi i1 [ false, %land.end.1 ], [ %89, %land.rhs ]
  br i1 %90, label %for.body.2, label %for.end.2

for.body.2:
  %91 = load i32, i32* %k.addr, align 4
  %92 = sext i32 %91 to i64
  %93 = load i32, i32* %k.addr, align 4
  %94 = sext i32 %93 to i64
  %95 = bitcast i8* %79 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 %94
  %97 = load i32, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %98 = bitcast i8* %74 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 %92
  store i32 %97, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.2

for.inc.2:
  %100 = load i32, i32* %k.addr, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %k.addr, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.3

if.end.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %for.inc ], [ 2, %for.inc.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
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
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %lo.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 16)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp slt i32 %11, %13
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  %15 = load i32, i32* %lo.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 16)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  %19 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %20 = phi i32 [ %17, %ovf.ok.1 ], [ %19, %cond.false ]
  call void @nish.insertionRun$str$fn.16.nish_main$arrow1(%struct.nish_array* %xs, i32 %8, i32 %20)
  br label %for.inc

for.inc:
  %21 = load i32, i32* %lo.addr, align 4
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 16)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %n.addr, align 4
  %26 = icmp sle i32 %25, 16
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = icmp ult i64 %30, %32
  br i1 %33, label %forof.body, label %forof.end

forof.body:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %30
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %38, i8** %x.addr, align 8
  %39 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %40 = load i8*, i8** %x.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %39, i64 8)
  br label %push.store

push.store:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i8**
  %49 = getelementptr inbounds i8*, i8** %48, i64 %42
  store i8* %40, i8** %49, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  br label %forof.inc

forof.inc:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = add i64 %52, 1
  store i64 %53, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 16, i32* %width.addr, align 4
  br label %for.cond.1

for.cond.1:
  %54 = load i32, i32* %width.addr, align 4
  %55 = load i32, i32* %n.addr, align 4
  %56 = icmp slt i32 %54, %55
  br i1 %56, label %for.body.1, label %for.end.1

for.body.1:
  %57 = load i1, i1* %inTmp.addr, align 1
  br i1 %57, label %if.then.2, label %if.else

if.then.2:
  %58 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %59 = load i32, i32* %n.addr, align 4
  %60 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* %58, %struct.nish_array* %xs, i32 %59, i32 %60)
  br label %if.end.2

if.else:
  %61 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %62 = load i32, i32* %n.addr, align 4
  %63 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* %xs, %struct.nish_array* %61, i32 %62, i32 %63)
  br label %if.end.2

if.end.2:
  %64 = load i1, i1* %inTmp.addr, align 1
  %65 = xor i1 %64, true
  store i1 %65, i1* %inTmp.addr, align 1
  br label %for.inc.1

for.inc.1:
  %66 = load i32, i32* %width.addr, align 4
  %67 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %66, i32 2)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %68, i32* %width.addr, align 4
  br label %for.cond.1

for.end.1:
  %70 = load i1, i1* %inTmp.addr, align 1
  br i1 %70, label %if.then.3, label %if.end.3

if.then.3:
  store i32 0, i32* %k.addr, align 4
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %80 = load i32, i32* %k.addr, align 4
  %81 = load i32, i32* %n.addr, align 4
  %82 = icmp slt i32 %80, %81
  br i1 %82, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %83 = load i32, i32* %k.addr, align 4
  %84 = trunc i64 %72 to i32
  %85 = icmp slt i32 %83, %84
  br label %land.end.1

land.end.1:
  %86 = phi i1 [ false, %for.cond.2 ], [ %85, %land.rhs.1 ]
  br i1 %86, label %land.rhs, label %land.end

land.rhs:
  %87 = load i32, i32* %k.addr, align 4
  %88 = trunc i64 %77 to i32
  %89 = icmp slt i32 %87, %88
  br label %land.end

land.end:
  %90 = phi i1 [ false, %land.end.1 ], [ %89, %land.rhs ]
  br i1 %90, label %for.body.2, label %for.end.2

for.body.2:
  %91 = load i32, i32* %k.addr, align 4
  %92 = sext i32 %91 to i64
  %93 = load i32, i32* %k.addr, align 4
  %94 = sext i32 %93 to i64
  %95 = bitcast i8* %79 to i8**
  %96 = getelementptr inbounds i8*, i8** %95, i64 %94
  %97 = load i8*, i8** %96, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %98 = bitcast i8* %74 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %92
  store i8* %97, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc.2

for.inc.2:
  %100 = load i32, i32* %k.addr, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %k.addr, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.3

if.end.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %for.inc ], [ 2, %for.inc.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.insertionRun$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %6 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %20, i32* %v.addr, align 4
  %21 = load i32, i32* %i.addr, align 4
  store i32 %21, i32* %j.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %j.addr, align 4
  %27 = icmp sgt i32 %26, %lo
  br i1 %27, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %28 = load i32, i32* %j.addr, align 4
  %29 = icmp sgt i32 %28, 0
  br label %land.end.4

land.end.4:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs.4 ]
  br i1 %30, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %31 = load i32, i32* %j.addr, align 4
  %32 = trunc i64 %23 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.3

land.end.3:
  %34 = phi i1 [ false, %land.end.4 ], [ %33, %land.rhs.3 ]
  br i1 %34, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %35 = load i32, i32* %j.addr, align 4
  %36 = sub nsw i32 %35, 1
  %37 = sext i32 %36 to i64
  %38 = icmp ult i64 %37, %23
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %37, i64 %23)
  unreachable

bounds.ok:
  %39 = bitcast i8* %25 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %37
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = load i32, i32* %v.addr, align 4
  %43 = call i32 @ascending$(i32 %41, i32 %42)
  %44 = icmp sgt i32 %43, 0
  br label %land.end.2

land.end.2:
  %45 = phi i1 [ false, %land.end.3 ], [ %44, %bounds.ok ]
  br i1 %45, label %while.body, label %while.end

while.body:
  %46 = load i32, i32* %j.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %j.addr, align 4
  %49 = trunc i64 %23 to i32
  %50 = icmp slt i32 %48, %49
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %while.body ], [ %50, %land.rhs.5 ]
  br i1 %51, label %if.then, label %if.end

if.then:
  %52 = load i32, i32* %j.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = load i32, i32* %j.addr, align 4
  %55 = sub nsw i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = icmp ult i64 %56, %23
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %56, i64 %23)
  unreachable

bounds.ok.1:
  %58 = bitcast i8* %25 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %56
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = bitcast i8* %25 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %53
  store i32 %60, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  %63 = load i32, i32* %j.addr, align 4
  %64 = sub nsw i32 %63, 1
  store i32 %64, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %65 = load i32, i32* %j.addr, align 4
  %66 = icmp sge i32 %65, 0
  br i1 %66, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %67 = load i32, i32* %j.addr, align 4
  %68 = trunc i64 %4 to i32
  %69 = icmp slt i32 %67, %68
  br label %land.end.6

land.end.6:
  %70 = phi i1 [ false, %while.end ], [ %69, %land.rhs.6 ]
  br i1 %70, label %if.then.1, label %if.end.1

if.then.1:
  %71 = load i32, i32* %j.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = load i32, i32* %v.addr, align 4
  %74 = bitcast i8* %6 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %72
  store i32 %73, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %76 = load i32, i32* %i.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.mergePass$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %width)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %n
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %lo.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %width)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %11 = phi i32 [ %9, %ovf.ok.1 ], [ %n, %cond.false ]
  store i32 %11, i32* %mid.addr, align 4
  %12 = load i32, i32* %mid.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %width)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %16 = icmp slt i32 %14, %n
  br i1 %16, label %cond.true.1, label %cond.false.1

cond.true.1:
  %17 = load i32, i32* %mid.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %width)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %21 = phi i32 [ %19, %ovf.ok.3 ], [ %n, %cond.false.1 ]
  store i32 %21, i32* %hi.addr, align 4
  %22 = load i32, i32* %lo.addr, align 4
  %23 = load i32, i32* %mid.addr, align 4
  %24 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$i32$fn.9.ascending(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %22, i32 %23, i32 %24)
  br label %for.inc

for.inc:
  %25 = load i32, i32* %lo.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %width)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %27)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %30, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %cond.end ], [ 0, %cond.true.1 ], [ 2, %for.inc ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.insertionRun$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %6 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %20, i32* %v.addr, align 4
  %21 = load i32, i32* %i.addr, align 4
  store i32 %21, i32* %j.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %j.addr, align 4
  %27 = icmp sgt i32 %26, %lo
  br i1 %27, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %28 = load i32, i32* %j.addr, align 4
  %29 = icmp sgt i32 %28, 0
  br label %land.end.4

land.end.4:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs.4 ]
  br i1 %30, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %31 = load i32, i32* %j.addr, align 4
  %32 = trunc i64 %23 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.3

land.end.3:
  %34 = phi i1 [ false, %land.end.4 ], [ %33, %land.rhs.3 ]
  br i1 %34, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %35 = load i32, i32* %j.addr, align 4
  %36 = sub nsw i32 %35, 1
  %37 = sext i32 %36 to i64
  %38 = icmp ult i64 %37, %23
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %37, i64 %23)
  unreachable

bounds.ok:
  %39 = bitcast i8* %25 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %37
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = load i32, i32* %v.addr, align 4
  %43 = call i32 @nish_main$arrow0(i32 %41, i32 %42)
  %44 = icmp sgt i32 %43, 0
  br label %land.end.2

land.end.2:
  %45 = phi i1 [ false, %land.end.3 ], [ %44, %bounds.ok ]
  br i1 %45, label %while.body, label %while.end

while.body:
  %46 = load i32, i32* %j.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %j.addr, align 4
  %49 = trunc i64 %23 to i32
  %50 = icmp slt i32 %48, %49
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %while.body ], [ %50, %land.rhs.5 ]
  br i1 %51, label %if.then, label %if.end

if.then:
  %52 = load i32, i32* %j.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = load i32, i32* %j.addr, align 4
  %55 = sub nsw i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = icmp ult i64 %56, %23
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %56, i64 %23)
  unreachable

bounds.ok.1:
  %58 = bitcast i8* %25 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %56
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = bitcast i8* %25 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %53
  store i32 %60, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  %63 = load i32, i32* %j.addr, align 4
  %64 = sub nsw i32 %63, 1
  store i32 %64, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %65 = load i32, i32* %j.addr, align 4
  %66 = icmp sge i32 %65, 0
  br i1 %66, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %67 = load i32, i32* %j.addr, align 4
  %68 = trunc i64 %4 to i32
  %69 = icmp slt i32 %67, %68
  br label %land.end.6

land.end.6:
  %70 = phi i1 [ false, %while.end ], [ %69, %land.rhs.6 ]
  br i1 %70, label %if.then.1, label %if.end.1

if.then.1:
  %71 = load i32, i32* %j.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = load i32, i32* %v.addr, align 4
  %74 = bitcast i8* %6 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %72
  store i32 %73, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %76 = load i32, i32* %i.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.mergePass$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %width)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %n
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %lo.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %width)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %11 = phi i32 [ %9, %ovf.ok.1 ], [ %n, %cond.false ]
  store i32 %11, i32* %mid.addr, align 4
  %12 = load i32, i32* %mid.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %width)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %16 = icmp slt i32 %14, %n
  br i1 %16, label %cond.true.1, label %cond.false.1

cond.true.1:
  %17 = load i32, i32* %mid.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %width)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %21 = phi i32 [ %19, %ovf.ok.3 ], [ %n, %cond.false.1 ]
  store i32 %21, i32* %hi.addr, align 4
  %22 = load i32, i32* %lo.addr, align 4
  %23 = load i32, i32* %mid.addr, align 4
  %24 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$i32$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %22, i32 %23, i32 %24)
  br label %for.inc

for.inc:
  %25 = load i32, i32* %lo.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %width)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %27)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %30, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %cond.end ], [ 0, %cond.true.1 ], [ 2, %for.inc ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.insertionRun$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %v.addr = alloca i8*, align 8
  %j.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %6 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %17
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %20, i8** %v.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  store i32 %21, i32* %j.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %j.addr, align 4
  %27 = icmp sgt i32 %26, %lo
  br i1 %27, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %28 = load i32, i32* %j.addr, align 4
  %29 = icmp sgt i32 %28, 0
  br label %land.end.4

land.end.4:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs.4 ]
  br i1 %30, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %31 = load i32, i32* %j.addr, align 4
  %32 = trunc i64 %23 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.3

land.end.3:
  %34 = phi i1 [ false, %land.end.4 ], [ %33, %land.rhs.3 ]
  br i1 %34, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %35 = load i32, i32* %j.addr, align 4
  %36 = sub nsw i32 %35, 1
  %37 = sext i32 %36 to i64
  %38 = icmp ult i64 %37, %23
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %37, i64 %23)
  unreachable

bounds.ok:
  %39 = bitcast i8* %25 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %37
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = load i8*, i8** %v.addr, align 8
  %43 = call i32 @nish_main$arrow1(i8* %41, i8* %42)
  %44 = icmp sgt i32 %43, 0
  br label %land.end.2

land.end.2:
  %45 = phi i1 [ false, %land.end.3 ], [ %44, %bounds.ok ]
  br i1 %45, label %while.body, label %while.end

while.body:
  %46 = load i32, i32* %j.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %j.addr, align 4
  %49 = trunc i64 %23 to i32
  %50 = icmp slt i32 %48, %49
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %while.body ], [ %50, %land.rhs.5 ]
  br i1 %51, label %if.then, label %if.end

if.then:
  %52 = load i32, i32* %j.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = load i32, i32* %j.addr, align 4
  %55 = sub nsw i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = icmp ult i64 %56, %23
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %56, i64 %23)
  unreachable

bounds.ok.1:
  %58 = bitcast i8* %25 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %56
  %60 = load i8*, i8** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %61 = bitcast i8* %25 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 %53
  store i8* %60, i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end

if.end:
  %63 = load i32, i32* %j.addr, align 4
  %64 = sub nsw i32 %63, 1
  store i32 %64, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %65 = load i32, i32* %j.addr, align 4
  %66 = icmp sge i32 %65, 0
  br i1 %66, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %67 = load i32, i32* %j.addr, align 4
  %68 = trunc i64 %4 to i32
  %69 = icmp slt i32 %67, %68
  br label %land.end.6

land.end.6:
  %70 = phi i1 [ false, %while.end ], [ %69, %land.rhs.6 ]
  br i1 %70, label %if.then.1, label %if.end.1

if.then.1:
  %71 = load i32, i32* %j.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = load i8*, i8** %v.addr, align 8
  %74 = bitcast i8* %6 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %72
  store i8* %73, i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %76 = load i32, i32* %i.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.mergePass$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %width)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %n
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %lo.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %width)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %11 = phi i32 [ %9, %ovf.ok.1 ], [ %n, %cond.false ]
  store i32 %11, i32* %mid.addr, align 4
  %12 = load i32, i32* %mid.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %width)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %16 = icmp slt i32 %14, %n
  br i1 %16, label %cond.true.1, label %cond.false.1

cond.true.1:
  %17 = load i32, i32* %mid.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %width)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %21 = phi i32 [ %19, %ovf.ok.3 ], [ %n, %cond.false.1 ]
  store i32 %21, i32* %hi.addr, align 4
  %22 = load i32, i32* %lo.addr, align 4
  %23 = load i32, i32* %mid.addr, align 4
  %24 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$str$fn.16.nish_main$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %22, i32 %23, i32 %24)
  br label %for.inc

for.inc:
  %25 = load i32, i32* %lo.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %width)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %27)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %30, i32* %lo.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %cond.true ], [ 0, %cond.end ], [ 0, %cond.true.1 ], [ 2, %for.inc ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergeRuns$i32$fn.9.ascending(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
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
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp sge i32 %13, %mid
  store i1 %14, i1* %right.addr, align 1
  %15 = load i1, i1* %right.addr, align 1
  %16 = xor i1 %15, true
  br i1 %16, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %17 = load i32, i32* %j.addr, align 4
  %18 = icmp slt i32 %17, %hi
  br label %land.end.5

land.end.5:
  %19 = phi i1 [ false, %for.body ], [ %18, %land.rhs.5 ]
  br i1 %19, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp sge i32 %20, 0
  br label %land.end.4

land.end.4:
  %22 = phi i1 [ false, %land.end.5 ], [ %21, %land.rhs.4 ]
  br i1 %22, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %1 to i32
  %25 = icmp slt i32 %23, %24
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %land.end.4 ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %j.addr, align 4
  %28 = icmp sge i32 %27, 0
  br label %land.end.2

land.end.2:
  %29 = phi i1 [ false, %land.end.3 ], [ %28, %land.rhs.2 ]
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %j.addr, align 4
  %31 = trunc i64 %1 to i32
  %32 = icmp slt i32 %30, %31
  br label %land.end.1

land.end.1:
  %33 = phi i1 [ false, %land.end.2 ], [ %32, %land.rhs.1 ]
  br i1 %33, label %if.then, label %if.end

if.then:
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %3 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %35
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = load i32, i32* %j.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %3 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %40
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = call i32 @ascending$(i32 %38, i32 %43)
  %45 = icmp sgt i32 %44, 0
  store i1 %45, i1* %right.addr, align 1
  br label %if.end

if.end:
  %46 = load i1, i1* %right.addr, align 1
  br i1 %46, label %if.then.1, label %if.else

if.then.1:
  %47 = load i32, i32* %j.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %49 = load i32, i32* %j.addr, align 4
  %50 = trunc i64 %1 to i32
  %51 = icmp slt i32 %49, %50
  br label %land.end.7

land.end.7:
  %52 = phi i1 [ false, %if.then.1 ], [ %51, %land.rhs.7 ]
  br i1 %52, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %53 = load i32, i32* %k.addr, align 4
  %54 = trunc i64 %5 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.6

land.end.6:
  %56 = phi i1 [ false, %land.end.7 ], [ %55, %land.rhs.6 ]
  br i1 %56, label %if.then.2, label %if.end.2

if.then.2:
  %57 = load i32, i32* %k.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = load i32, i32* %j.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = bitcast i8* %3 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %60
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = bitcast i8* %7 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %58
  store i32 %63, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.2

if.end.2:
  %66 = load i32, i32* %j.addr, align 4
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %68, i32* %j.addr, align 4
  br label %if.end.1

if.else:
  %70 = load i32, i32* %i.addr, align 4
  %71 = icmp sge i32 %70, 0
  br i1 %71, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %72 = load i32, i32* %i.addr, align 4
  %73 = trunc i64 %1 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.9

land.end.9:
  %75 = phi i1 [ false, %if.else ], [ %74, %land.rhs.9 ]
  br i1 %75, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %76 = load i32, i32* %k.addr, align 4
  %77 = trunc i64 %5 to i32
  %78 = icmp slt i32 %76, %77
  br label %land.end.8

land.end.8:
  %79 = phi i1 [ false, %land.end.9 ], [ %78, %land.rhs.8 ]
  br i1 %79, label %if.then.3, label %if.end.3

if.then.3:
  %80 = load i32, i32* %k.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = load i32, i32* %i.addr, align 4
  %83 = sext i32 %82 to i64
  %84 = bitcast i8* %3 to i32*
  %85 = getelementptr inbounds i32, i32* %84, i64 %83
  %86 = load i32, i32* %85, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = bitcast i8* %7 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 %81
  store i32 %86, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.3

if.end.3:
  %89 = load i32, i32* %i.addr, align 4
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 1)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %91, i32* %i.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %93 = load i32, i32* %k.addr, align 4
  %94 = add nsw i32 %93, 1
  store i32 %94, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.mergeRuns$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
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
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp sge i32 %13, %mid
  store i1 %14, i1* %right.addr, align 1
  %15 = load i1, i1* %right.addr, align 1
  %16 = xor i1 %15, true
  br i1 %16, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %17 = load i32, i32* %j.addr, align 4
  %18 = icmp slt i32 %17, %hi
  br label %land.end.5

land.end.5:
  %19 = phi i1 [ false, %for.body ], [ %18, %land.rhs.5 ]
  br i1 %19, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp sge i32 %20, 0
  br label %land.end.4

land.end.4:
  %22 = phi i1 [ false, %land.end.5 ], [ %21, %land.rhs.4 ]
  br i1 %22, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %1 to i32
  %25 = icmp slt i32 %23, %24
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %land.end.4 ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %j.addr, align 4
  %28 = icmp sge i32 %27, 0
  br label %land.end.2

land.end.2:
  %29 = phi i1 [ false, %land.end.3 ], [ %28, %land.rhs.2 ]
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %j.addr, align 4
  %31 = trunc i64 %1 to i32
  %32 = icmp slt i32 %30, %31
  br label %land.end.1

land.end.1:
  %33 = phi i1 [ false, %land.end.2 ], [ %32, %land.rhs.1 ]
  br i1 %33, label %if.then, label %if.end

if.then:
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %3 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %35
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = load i32, i32* %j.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %3 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %40
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = call i32 @nish_main$arrow0(i32 %38, i32 %43)
  %45 = icmp sgt i32 %44, 0
  store i1 %45, i1* %right.addr, align 1
  br label %if.end

if.end:
  %46 = load i1, i1* %right.addr, align 1
  br i1 %46, label %if.then.1, label %if.else

if.then.1:
  %47 = load i32, i32* %j.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %49 = load i32, i32* %j.addr, align 4
  %50 = trunc i64 %1 to i32
  %51 = icmp slt i32 %49, %50
  br label %land.end.7

land.end.7:
  %52 = phi i1 [ false, %if.then.1 ], [ %51, %land.rhs.7 ]
  br i1 %52, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %53 = load i32, i32* %k.addr, align 4
  %54 = trunc i64 %5 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.6

land.end.6:
  %56 = phi i1 [ false, %land.end.7 ], [ %55, %land.rhs.6 ]
  br i1 %56, label %if.then.2, label %if.end.2

if.then.2:
  %57 = load i32, i32* %k.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = load i32, i32* %j.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = bitcast i8* %3 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %60
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = bitcast i8* %7 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %58
  store i32 %63, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.2

if.end.2:
  %66 = load i32, i32* %j.addr, align 4
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %68, i32* %j.addr, align 4
  br label %if.end.1

if.else:
  %70 = load i32, i32* %i.addr, align 4
  %71 = icmp sge i32 %70, 0
  br i1 %71, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %72 = load i32, i32* %i.addr, align 4
  %73 = trunc i64 %1 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.9

land.end.9:
  %75 = phi i1 [ false, %if.else ], [ %74, %land.rhs.9 ]
  br i1 %75, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %76 = load i32, i32* %k.addr, align 4
  %77 = trunc i64 %5 to i32
  %78 = icmp slt i32 %76, %77
  br label %land.end.8

land.end.8:
  %79 = phi i1 [ false, %land.end.9 ], [ %78, %land.rhs.8 ]
  br i1 %79, label %if.then.3, label %if.end.3

if.then.3:
  %80 = load i32, i32* %k.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = load i32, i32* %i.addr, align 4
  %83 = sext i32 %82 to i64
  %84 = bitcast i8* %3 to i32*
  %85 = getelementptr inbounds i32, i32* %84, i64 %83
  %86 = load i32, i32* %85, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = bitcast i8* %7 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 %81
  store i32 %86, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.3

if.end.3:
  %89 = load i32, i32* %i.addr, align 4
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 1)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %91, i32* %i.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %93 = load i32, i32* %k.addr, align 4
  %94 = add nsw i32 %93, 1
  store i32 %94, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.mergeRuns$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
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
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp sge i32 %13, %mid
  store i1 %14, i1* %right.addr, align 1
  %15 = load i1, i1* %right.addr, align 1
  %16 = xor i1 %15, true
  br i1 %16, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %17 = load i32, i32* %j.addr, align 4
  %18 = icmp slt i32 %17, %hi
  br label %land.end.5

land.end.5:
  %19 = phi i1 [ false, %for.body ], [ %18, %land.rhs.5 ]
  br i1 %19, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp sge i32 %20, 0
  br label %land.end.4

land.end.4:
  %22 = phi i1 [ false, %land.end.5 ], [ %21, %land.rhs.4 ]
  br i1 %22, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %1 to i32
  %25 = icmp slt i32 %23, %24
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %land.end.4 ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %j.addr, align 4
  %28 = icmp sge i32 %27, 0
  br label %land.end.2

land.end.2:
  %29 = phi i1 [ false, %land.end.3 ], [ %28, %land.rhs.2 ]
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %j.addr, align 4
  %31 = trunc i64 %1 to i32
  %32 = icmp slt i32 %30, %31
  br label %land.end.1

land.end.1:
  %33 = phi i1 [ false, %land.end.2 ], [ %32, %land.rhs.1 ]
  br i1 %33, label %if.then, label %if.end

if.then:
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %3 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %35
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %39 = load i32, i32* %j.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %3 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 %40
  %43 = load i8*, i8** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = call i32 @nish_main$arrow1(i8* %38, i8* %43)
  %45 = icmp sgt i32 %44, 0
  store i1 %45, i1* %right.addr, align 1
  br label %if.end

if.end:
  %46 = load i1, i1* %right.addr, align 1
  br i1 %46, label %if.then.1, label %if.else

if.then.1:
  %47 = load i32, i32* %j.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %49 = load i32, i32* %j.addr, align 4
  %50 = trunc i64 %1 to i32
  %51 = icmp slt i32 %49, %50
  br label %land.end.7

land.end.7:
  %52 = phi i1 [ false, %if.then.1 ], [ %51, %land.rhs.7 ]
  br i1 %52, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %53 = load i32, i32* %k.addr, align 4
  %54 = trunc i64 %5 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.6

land.end.6:
  %56 = phi i1 [ false, %land.end.7 ], [ %55, %land.rhs.6 ]
  br i1 %56, label %if.then.2, label %if.end.2

if.then.2:
  %57 = load i32, i32* %k.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = load i32, i32* %j.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = bitcast i8* %3 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 %60
  %63 = load i8*, i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %64 = bitcast i8* %7 to i8**
  %65 = getelementptr inbounds i8*, i8** %64, i64 %58
  store i8* %63, i8** %65, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.2

if.end.2:
  %66 = load i32, i32* %j.addr, align 4
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %68, i32* %j.addr, align 4
  br label %if.end.1

if.else:
  %70 = load i32, i32* %i.addr, align 4
  %71 = icmp sge i32 %70, 0
  br i1 %71, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %72 = load i32, i32* %i.addr, align 4
  %73 = trunc i64 %1 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.9

land.end.9:
  %75 = phi i1 [ false, %if.else ], [ %74, %land.rhs.9 ]
  br i1 %75, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %76 = load i32, i32* %k.addr, align 4
  %77 = trunc i64 %5 to i32
  %78 = icmp slt i32 %76, %77
  br label %land.end.8

land.end.8:
  %79 = phi i1 [ false, %land.end.9 ], [ %78, %land.rhs.8 ]
  br i1 %79, label %if.then.3, label %if.end.3

if.then.3:
  %80 = load i32, i32* %k.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = load i32, i32* %i.addr, align 4
  %83 = sext i32 %82 to i64
  %84 = bitcast i8* %3 to i8**
  %85 = getelementptr inbounds i8*, i8** %84, i64 %83
  %86 = load i8*, i8** %85, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %87 = bitcast i8* %7 to i8**
  %88 = getelementptr inbounds i8*, i8** %87, i64 %81
  store i8* %86, i8** %88, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.3

if.end.3:
  %89 = load i32, i32* %i.addr, align 4
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 1)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %91, i32* %i.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %93 = load i32, i32* %k.addr, align 4
  %94 = add nsw i32 %93, 1
  store i32 %94, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
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
