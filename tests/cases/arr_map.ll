%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bb\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ccc\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
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

define hidden noundef i32 @double$(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call %struct.nish_array* @nish.map$i32$str$fn.11.show$arrow0(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, 1
  %6 = mul i64 %4, %5
  %7 = icmp eq i64 %2, 0
  %8 = select i1 %7, i64 0, i64 %6
  store i64 %8, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %9 = load i64, i64* %join.at, align 8
  %10 = icmp ult i64 %9, %2
  br i1 %10, label %join.sum.body, label %join.copy

join.sum.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %9
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = load i64, i64* %join.total, align 8
  %17 = bitcast i8* %15 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = add i64 %16, %18
  store i64 %19, i64* %join.total, align 8
  %20 = add i64 %9, 1
  store i64 %20, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %21 = load i64, i64* %join.total, align 8
  %22 = icmp ugt i64 %21, 2147483647
  %23 = add i64 %21, 9
  %24 = select i1 %22, i64 4611686018427387904, i64 %23
  %25 = call i8* @nish_alloc_struct(i64 %24)
  %26 = bitcast i8* %25 to i64*
  store i64 %21, i64* %26, align 8
  %27 = getelementptr inbounds i8, i8* %25, i64 8
  store i8* %27, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %28 = load i64, i64* %join.at, align 8
  %29 = icmp ult i64 %28, %2
  br i1 %29, label %join.part, label %join.end

join.part:
  %30 = load i8*, i8** %join.p, align 8
  %31 = icmp eq i64 %28, 0
  %32 = select i1 %31, i64 0, i64 %4
  %33 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %30, i8* %33, i64 %32, i1 false)
  %34 = getelementptr inbounds i8, i8* %30, i64 %32
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %28
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = getelementptr inbounds i8, i8* %39, i64 8
  %43 = icmp eq i64 %41, 1
  br i1 %43, label %join.byte, label %join.bulk

join.byte:
  %44 = load i8, i8* %42, align 1
  store i8 %44, i8* %34, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %34, i8* %42, i64 %41, i1 false)
  br label %join.next

join.next:
  %45 = getelementptr inbounds i8, i8* %34, i64 %41
  store i8* %45, i8** %join.p, align 8
  %46 = add i64 %28, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %47 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %47, align 1
  ret i8* %25
}

define void @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %ro.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %ps.addr = alloca %struct.nish_array*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x %struct.Point], align 8
  %swapped.addr = alloca %struct.nish_array*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 5, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store %struct.nish_array* %9, %struct.nish_array** %ro.addr, align 8
  store i32 10, i32* %k.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = call %struct.nish_array* @nish.map$i32$i32$fn.6.double(%struct.nish_array* %10)
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @show(%struct.nish_array* %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load i32, i32* %k.addr, align 4
  %17 = call %struct.nish_array* @nish.mapIndexed$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* %15, i32 %16)
  %18 = call i64 @nish_arena_mark()
  %19 = call i8* @show(%struct.nish_array* %17)
  %20 = call i8* @nish_arena_keep(i64 %18, i8* %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.nish_array*, %struct.nish_array** %ro.addr, align 8
  %22 = call %struct.nish_array* @nish.map$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %21)
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @show(%struct.nish_array* %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = call %struct.nish_array* @nish.map$i32$i32$fn.6.double(%struct.nish_array* %26)
  %28 = call %struct.nish_array* @nish.map$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* %27)
  %29 = call i64 @nish_arena_mark()
  %30 = call i8* @show(%struct.nish_array* %28)
  %31 = call i8* @nish_arena_keep(i64 %29, i8* %30)
  call void @nish_print(i8* %31)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %34 = bitcast [3 x i8*]* %arr.data.1 to i8*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %34, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %34 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = getelementptr inbounds i8*, i8** %36, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %39 = getelementptr inbounds i8*, i8** %36, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %41 = call %struct.nish_array* @nish.mapIndexed$str$str$fn.16.nish_main$arrow3(%struct.nish_array* %40)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %45 = load i64, i64* %44, align 8
  %46 = sub i64 %43, 1
  %47 = mul i64 %45, %46
  %48 = icmp eq i64 %43, 0
  %49 = select i1 %48, i64 0, i64 %47
  store i64 %49, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %50 = load i64, i64* %join.at, align 8
  %51 = icmp ult i64 %50, %43
  br i1 %51, label %join.sum.body, label %join.copy

join.sum.body:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = bitcast i8* %53 to i8**
  %55 = getelementptr inbounds i8*, i8** %54, i64 %50
  %56 = load i8*, i8** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = load i64, i64* %join.total, align 8
  %58 = bitcast i8* %56 to i64*
  %59 = load i64, i64* %58, align 8
  %60 = add i64 %57, %59
  store i64 %60, i64* %join.total, align 8
  %61 = add i64 %50, 1
  store i64 %61, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %62 = load i64, i64* %join.total, align 8
  %63 = icmp ugt i64 %62, 2147483647
  %64 = add i64 %62, 9
  %65 = select i1 %63, i64 4611686018427387904, i64 %64
  %66 = call i8* @nish_alloc_struct(i64 %65)
  %67 = bitcast i8* %66 to i64*
  store i64 %62, i64* %67, align 8
  %68 = getelementptr inbounds i8, i8* %66, i64 8
  store i8* %68, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %69 = load i64, i64* %join.at, align 8
  %70 = icmp ult i64 %69, %43
  br i1 %70, label %join.part, label %join.end

join.part:
  %71 = load i8*, i8** %join.p, align 8
  %72 = icmp eq i64 %69, 0
  %73 = select i1 %72, i64 0, i64 %45
  %74 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %71, i8* %74, i64 %73, i1 false)
  %75 = getelementptr inbounds i8, i8* %71, i64 %73
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = bitcast i8* %77 to i8**
  %79 = getelementptr inbounds i8*, i8** %78, i64 %69
  %80 = load i8*, i8** %79, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %81 = bitcast i8* %80 to i64*
  %82 = load i64, i64* %81, align 8
  %83 = getelementptr inbounds i8, i8* %80, i64 8
  %84 = icmp eq i64 %82, 1
  br i1 %84, label %join.byte, label %join.bulk

join.byte:
  %85 = load i8, i8* %83, align 1
  store i8 %85, i8* %75, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %75, i8* %83, i64 %82, i1 false)
  br label %join.next

join.next:
  %86 = getelementptr inbounds i8, i8* %75, i64 %82
  store i8* %86, i8** %join.p, align 8
  %87 = add i64 %69, 1
  store i64 %87, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %88 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %88, align 1
  call void @nish_print(i8* %66)
  %89 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %89, align 4
  %90 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %90, align 4
  %91 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 3, i32* %91, align 4
  %92 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 4, i32* %92, align 4
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %95 = bitcast [2 x %struct.Point]* %arr.data.2 to i8*
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %95, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = bitcast i8* %95 to %struct.Point*
  %98 = getelementptr inbounds %struct.Point, %struct.Point* %97, i64 0
  %99 = bitcast %struct.Point* %98 to i8*
  %100 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %99, i8* align 4 %100, i64 8, i1 false), !alias.scope !4, !noalias !3
  %101 = getelementptr inbounds %struct.Point, %struct.Point* %97, i64 1
  %102 = bitcast %struct.Point* %101 to i8*
  %103 = bitcast %struct.Point* %Point.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %102, i8* align 4 %103, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %ps.addr, align 8
  %104 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %105 = call %struct.nish_array* @nish.map$$Point$$Point$fn.16.nish_main$arrow4(%struct.nish_array* %104)
  store %struct.nish_array* %105, %struct.nish_array** %swapped.addr, align 8
  %106 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %108 = load i64, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = icmp ult i64 0, %108
  br i1 %109, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %108)
  unreachable

bounds.ok:
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %112 = bitcast i8* %111 to %struct.Point*
  %113 = getelementptr inbounds %struct.Point, %struct.Point* %112, i64 0
  %114 = getelementptr inbounds %struct.Point, %struct.Point* %113, i32 0, i32 0
  %115 = load i32, i32* %114, align 4
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %116, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %118 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %121 = bitcast i8* %120 to %struct.Point*
  %122 = getelementptr inbounds %struct.Point, %struct.Point* %121, i64 0
  %123 = getelementptr inbounds %struct.Point, %struct.Point* %122, i32 0, i32 1
  %124 = load i32, i32* %123, align 4
  %125 = call i8* @nish_str_from_i32(i32 %124)
  %126 = call i8* @nish_str_concat(i8* %117, i8* %125)
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %128 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 0
  %130 = load i64, i64* %129, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = icmp ult i64 1, %130
  br i1 %131, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %130)
  unreachable

bounds.ok.1:
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %134 = bitcast i8* %133 to %struct.Point*
  %135 = getelementptr inbounds %struct.Point, %struct.Point* %134, i64 1
  %136 = getelementptr inbounds %struct.Point, %struct.Point* %135, i32 0, i32 0
  %137 = load i32, i32* %136, align 4
  %138 = call i8* @nish_str_from_i32(i32 %137)
  %139 = call i8* @nish_str_concat(i8* %127, i8* %138)
  %140 = call i8* @nish_str_concat(i8* %139, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %141 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %144 = bitcast i8* %143 to %struct.Point*
  %145 = getelementptr inbounds %struct.Point, %struct.Point* %144, i64 1
  %146 = getelementptr inbounds %struct.Point, %struct.Point* %145, i32 0, i32 1
  %147 = load i32, i32* %146, align 4
  %148 = call i8* @nish_str_from_i32(i32 %147)
  %149 = call i8* @nish_str_concat(i8* %140, i8* %148)
  call void @nish_print(i8* %149)
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %empty.addr, align 8
  %153 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %154 = call %struct.nish_array* @nish.map$i32$i32$fn.6.double(%struct.nish_array* %153)
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = trunc i64 %156 to i32
  %158 = call i8* @nish_str_from_i32(i32 %157)
  %159 = call i8* @nish_str_concat(i8* %158, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %160 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %160, i64 0, i32 0
  %162 = load i64, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %163 = trunc i64 %162 to i32
  %164 = call i8* @nish_str_from_i32(i32 %163)
  %165 = call i8* @nish_str_concat(i8* %159, i8* %164)
  call void @nish_print(i8* %165)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden noundef nonnull align 8 i8* @show$arrow0(i32 noundef %x) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  ret i8* %0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %x, i32 noundef %i, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %i)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef i32 @nish_main$arrow2(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow3(i8* noundef nonnull noalias readonly align 8 nocapture %w, i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %2 = call i8* @nish_str_concat(i8* %1, i8* %w)
  ret i8* %2
}

define hidden noundef nonnull align 4 dereferenceable(8) %struct.Point* @nish_main$arrow4(%struct.Point* noundef nonnull readonly align 4 dereferenceable(8) nocapture %p) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  ret %struct.Point* %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$i32$str$fn.11.show$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @show$arrow0(i32 %24)
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %29
  store i8* %27, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %41
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$i32$i32$fn.6.double(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = call i32 @double$(i32 %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  store i32 %25, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %39
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.mapIndexed$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %cap.0) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = load i32, i32* %i.addr, align 4
  %26 = call i32 @nish_main$arrow0(i32 %24, i32 %25, i32 %cap.0)
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %31 = icmp eq i64 %28, %30
  br i1 %31, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %28
  store i32 %26, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = add i64 %28, 1
  store i64 %36, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %40 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %40
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = call i32 @nish_main$arrow1(i32 %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  store i32 %25, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %39
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = call i32 @nish_main$arrow2(i32 %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 4)
  br label %push.store

push.store:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  store i32 %25, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %39
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.mapIndexed$str$str$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %19
  %24 = load i8*, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = load i32, i32* %i.addr, align 4
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @nish_main$arrow3(i8* %24, i32 %25)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %30
  store i8* %28, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %42
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$$Point$$Point$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to %struct.Point*
  %23 = getelementptr inbounds %struct.Point, %struct.Point* %22, i64 %19
  %24 = call %struct.Point* @nish_main$arrow4(%struct.Point* %23)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast i8* %31 to %struct.Point*
  %33 = getelementptr inbounds %struct.Point, %struct.Point* %32, i64 %26
  %34 = bitcast %struct.Point* %33 to i8*
  %35 = bitcast %struct.Point* %24 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %34, i8* align 4 %35, i64 8, i1 false), !alias.scope !4, !noalias !3
  %36 = add i64 %26, 1
  store i64 %36, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %40 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %40
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
