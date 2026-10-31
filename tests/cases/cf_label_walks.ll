%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@nish_hash_key = external global [2 x i64], align 8
@.str.14 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.hash.seed, i8* null }]
@.str.15 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal void @nish.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.14 to i8*))
  unreachable
mark:
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal noundef nonnull align 8 i8* @labelsOverArrays() #0 {
entry:
  %grid.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %struct.nish_array*], align 8
  %out.addr = alloca i8*, align 8
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %v.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %tag.addr = alloca i8*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = call i8* @nish_alloc_struct(i64 12)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 4, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 5, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 6, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 3, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 3, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = call i8* @nish_alloc_struct(i64 12)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 7, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = getelementptr inbounds i32, i32* %26, i64 1
  store i32 8, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = getelementptr inbounds i32, i32* %26, i64 2
  store i32 9, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast [3 x %struct.nish_array*]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %32 to %struct.nish_array**
  %35 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %34, i64 0
  store %struct.nish_array* %1, %struct.nish_array** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %34, i64 1
  store %struct.nish_array* %11, %struct.nish_array** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %37 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %34, i64 2
  store %struct.nish_array* %21, %struct.nish_array** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %grid.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 %39, %41
  br i1 %42, label %forof.body, label %forof.end

forof.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to %struct.nish_array**
  %46 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %45, i64 %39
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %47, %struct.nish_array** %row.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %49 = load i64, i64* %forof.idx.1, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %forof.body.1, label %forof.end.1

forof.body.1:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %57, i32* %v.addr, align 4
  %58 = load i32, i32* %v.addr, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %59)
  store i8* %60, i8** %tag.addr, align 8
  %61 = load i32, i32* %v.addr, align 4
  %62 = srem i32 %61, 3
  %63 = icmp eq i32 %62, 2
  br i1 %63, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %64 = load i32, i32* %v.addr, align 4
  %65 = icmp eq i32 %64, 7
  br i1 %65, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end

if.end.1:
  %66 = load i8*, i8** %out.addr, align 8
  %67 = load i8*, i8** %tag.addr, align 8
  %68 = call i8* @nish_str_concat(i8* %66, i8* %67)
  store i8* %68, i8** %out.addr, align 8
  br label %forof.inc.1

forof.inc.1:
  %69 = load i64, i64* %forof.idx.1, align 8
  %70 = add i64 %69, 1
  store i64 %70, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %71 = load i8*, i8** %out.addr, align 8
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %72, i8** %out.addr, align 8
  br label %forof.inc

forof.inc:
  %73 = load i64, i64* %forof.idx, align 8
  %74 = add i64 %73, 1
  store i64 %74, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %75 = load i8*, i8** %out.addr, align 8
  ret i8* %75
}

define internal noundef i32 @labelsOverMap() #0 {
entry:
  %m.addr = alloca %struct.Map$str$i32*, align 8
  %sum.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  %k.addr = alloca i8*, align 8
  %walk.idx = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$i32*
  call void @nish.Map$str$i32.constructor(%struct.Map$str$i32* %1)
  store %struct.Map$str$i32* %1, %struct.Map$str$i32** %m.addr, align 8
  %2 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %3 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i32 1)
  %4 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %5 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i32 2)
  %6 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %7 = call %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i32 3)
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %round.addr, align 4
  %9 = icmp slt i32 %8, 3
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  call void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* %10)
  %11 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %10, i32 0)
  store i32 %11, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %12 = load i32, i32* %walk.idx, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %walk.body, label %walk.end

walk.body:
  %14 = call i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* %10, i32 %12)
  store i8* %14, i8** %k.addr, align 8
  %15 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %16 = load i8*, i8** %k.addr, align 8
  %17 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %15, i8* %16)
  %18 = icmp sge i64 %17, 0
  br i1 %18, label %nullish.value, label %nullish.default

nullish.value:
  %19 = trunc i64 %17 to i32
  %20 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %15, i32 %19)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %21 = phi i32 [ %20, %nullish.value ], [ 0, %nullish.default ]
  store i32 %21, i32* %v.addr, align 4
  %22 = load i8*, i8** %k.addr, align 8
  %23 = call zeroext i1 @nish_str_eq(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %round.addr, align 4
  %25 = icmp eq i32 %24, 1
  br label %land.end

land.end:
  %26 = phi i1 [ false, %nullish.end ], [ %25, %land.rhs ]
  br i1 %26, label %if.then, label %if.end

if.then:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %10)
  br label %for.inc

if.end:
  %27 = load i8*, i8** %k.addr, align 8
  %28 = call zeroext i1 @nish_str_eq(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  br i1 %28, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %29 = load i32, i32* %round.addr, align 4
  %30 = icmp eq i32 %29, 2
  br label %land.end.1

land.end.1:
  %31 = phi i1 [ false, %if.end ], [ %30, %land.rhs.1 ]
  br i1 %31, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %10)
  br label %for.end

if.end.1:
  %32 = load i32, i32* %sum.addr, align 4
  %33 = load i32, i32* %v.addr, align 4
  %34 = load i32, i32* %round.addr, align 4
  %35 = add nsw i32 %34, 1
  %36 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %33, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok

ovf.ok:
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %37)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %40, i32* %sum.addr, align 4
  br label %walk.inc

walk.inc:
  %42 = add i32 %12, 1
  %43 = call i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* %10, i32 %42)
  store i32 %43, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* %10)
  br label %for.inc

for.inc:
  %44 = load i32, i32* %round.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %round.addr, align 4
  br label %for.cond

for.end:
  %46 = load i32, i32* %sum.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %46

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 i8* @fallMix(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %piece.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %3)
  store i8* %4, i8** %piece.addr, align 8
  %5 = load i32, i32* %i.addr, align 4
  %6 = srem i32 %5, 4
  switch i32 %6, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %7 = load i8*, i8** %s.addr, align 8
  %8 = load i8*, i8** %piece.addr, align 8
  %9 = call i8* @nish_str_concat(i8* %7, i8* %8)
  store i8* %9, i8** %s.addr, align 8
  br label %sw.case.1

sw.case.1:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp sgt i32 %10, 4
  br i1 %11, label %if.then, label %if.end

if.then:
  br label %sw.end

if.end:
  %12 = load i8*, i8** %s.addr, align 8
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  store i8* %13, i8** %s.addr, align 8
  br label %sw.end

sw.case.2:
  %14 = load i8*, i8** %s.addr, align 8
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  store i8* %15, i8** %s.addr, align 8
  br label %sw.default

sw.default:
  %16 = load i8*, i8** %s.addr, align 8
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  store i8* %17, i8** %s.addr, align 8
  br label %sw.end

sw.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i8*, i8** %s.addr, align 8
  ret i8* %20
}

define internal noundef i32 @labelledPasses() #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %t.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp slt i32 %6, 4
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %9 = load i8*, i8** %8, align 8
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*), i8* %13)
  %15 = load i32, i32* %j.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  store i8* %17, i8** %t.addr, align 8
  %18 = load i32, i32* %j.addr, align 4
  %19 = icmp eq i32 %18, 2
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %3
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %3 to i64
  %25 = add i64 %24, %5
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %for.inc

if.end:
  %26 = load i32, i32* %i.addr, align 4
  %27 = icmp eq i32 %26, 3
  br i1 %27, label %if.then.1, label %if.end.1

if.then.1:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %29 = load i8*, i8** %28, align 8
  %30 = icmp eq i8* %29, %3
  br i1 %30, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %31, align 8
  br label %pass.done.1

pass.free.1:
  %32 = ptrtoint i8* %3 to i64
  %33 = add i64 %32, %5
  call void @nish_arena_release(i64 %33)
  br label %pass.done.1

pass.done.1:
  br label %for.end

if.end.1:
  %34 = load i32, i32* %n.addr, align 4
  %35 = load i8*, i8** %t.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %40, i32* %n.addr, align 4
  %42 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %43 = load i8*, i8** %42, align 8
  %44 = icmp eq i8* %43, %9
  br i1 %44, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %11, i64* %45, align 8
  br label %pass.done.2

pass.free.2:
  %46 = ptrtoint i8* %9 to i64
  %47 = add i64 %46, %11
  call void @nish_arena_release(i64 %47)
  br label %pass.done.2

pass.done.2:
  br label %for.inc.1

for.inc.1:
  %48 = load i32, i32* %j.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %50 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %51 = load i8*, i8** %50, align 8
  %52 = icmp eq i8* %51, %3
  br i1 %52, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %53 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %53, align 8
  br label %pass.done.3

pass.free.3:
  %54 = ptrtoint i8* %3 to i64
  %55 = add i64 %54, %5
  call void @nish_arena_release(i64 %55)
  br label %pass.done.3

pass.done.3:
  br label %for.inc

for.inc:
  %56 = load i32, i32* %i.addr, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %58 = load i32, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %58

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @labelsOverArrays()
  call void @nish_print(i8* %0)
  %1 = call i32 @labelsOverMap()
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @fallMix(i32 9)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @labelledPasses()
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.11 to i8*))
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !20
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !21
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !22
  %3 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !23
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.11 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !24
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !25
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !26
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !21
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$i32* @nish.Map$str$i32.set(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %this, i64 %5, i8* %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$str$i32* %this
}

define internal void @nish.Map$str$i32.walkOpen(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !23
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$str$i32.walkNext(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$str$i32.walkClose(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !23
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 i8* @nish.Map$str$i32.keyAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.12 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !25
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %10
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  ret i8* %15
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.12 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %15
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #3 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !22
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !23
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.13 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !25
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !26
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !27
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !22
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !22
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !20
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !20
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !25
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !24
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !24
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !21
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !23
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !22
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !25
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !27
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !26
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !27
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !24
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !21
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.v0 = alloca i64, align 8
  %hash.v1 = alloca i64, align 8
  %hash.v2 = alloca i64, align 8
  %hash.v3 = alloca i64, align 8
  %hash.b = alloca i64, align 8
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  %3 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %4 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 1), align 8
  %5 = xor i64 %3, 8317987319222330741
  store i64 %5, i64* %hash.v0, align 8
  %6 = xor i64 %4, 7237128888997146477
  store i64 %6, i64* %hash.v1, align 8
  %7 = xor i64 %3, 7816392313619706465
  store i64 %7, i64* %hash.v2, align 8
  %8 = xor i64 %4, 8387220255154660723
  store i64 %8, i64* %hash.v3, align 8
  %9 = and i64 %1, -8
  store i64 0, i64* %hash.i, align 8
  br label %hash.test

hash.test:
  %10 = load i64, i64* %hash.i, align 8
  %11 = icmp ult i64 %10, %9
  br i1 %11, label %hash.word, label %hash.tail

hash.word:
  %12 = getelementptr inbounds i8, i8* %2, i64 %10
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 1
  %15 = load i64, i64* %hash.v3, align 8
  %16 = xor i64 %15, %14
  store i64 %16, i64* %hash.v3, align 8
  %17 = load i64, i64* %hash.v0, align 8
  %18 = load i64, i64* %hash.v1, align 8
  %19 = load i64, i64* %hash.v2, align 8
  %20 = load i64, i64* %hash.v3, align 8
  %21 = add i64 %17, %18
  %22 = shl i64 %18, 13
  %23 = lshr i64 %18, 51
  %24 = or i64 %22, %23
  %25 = xor i64 %24, %21
  %26 = shl i64 %21, 32
  %27 = lshr i64 %21, 32
  %28 = or i64 %26, %27
  %29 = add i64 %19, %20
  %30 = shl i64 %20, 16
  %31 = lshr i64 %20, 48
  %32 = or i64 %30, %31
  %33 = xor i64 %32, %29
  %34 = add i64 %28, %33
  %35 = shl i64 %33, 21
  %36 = lshr i64 %33, 43
  %37 = or i64 %35, %36
  %38 = xor i64 %37, %34
  %39 = add i64 %29, %25
  %40 = shl i64 %25, 17
  %41 = lshr i64 %25, 47
  %42 = or i64 %40, %41
  %43 = xor i64 %42, %39
  %44 = shl i64 %39, 32
  %45 = lshr i64 %39, 32
  %46 = or i64 %44, %45
  store i64 %34, i64* %hash.v0, align 8
  store i64 %43, i64* %hash.v1, align 8
  store i64 %46, i64* %hash.v2, align 8
  store i64 %38, i64* %hash.v3, align 8
  %47 = xor i64 %34, %14
  store i64 %47, i64* %hash.v0, align 8
  %48 = add i64 %10, 8
  store i64 %48, i64* %hash.i, align 8
  br label %hash.test

hash.tail:
  %49 = shl i64 %1, 56
  store i64 %49, i64* %hash.b, align 8
  br label %hash.more

hash.more:
  %50 = load i64, i64* %hash.i, align 8
  %51 = icmp ult i64 %50, %1
  br i1 %51, label %hash.byte, label %hash.done

hash.byte:
  %52 = getelementptr inbounds i8, i8* %2, i64 %50
  %53 = load i8, i8* %52
  %54 = zext i8 %53 to i64
  %55 = sub i64 %50, %9
  %56 = shl i64 %55, 3
  %57 = load i64, i64* %hash.b, align 8
  %58 = shl i64 %54, %56
  %59 = or i64 %57, %58
  store i64 %59, i64* %hash.b, align 8
  %60 = add i64 %50, 1
  store i64 %60, i64* %hash.i, align 8
  br label %hash.more

hash.done:
  %61 = load i64, i64* %hash.b, align 8
  %62 = load i64, i64* %hash.v3, align 8
  %63 = xor i64 %62, %61
  store i64 %63, i64* %hash.v3, align 8
  %64 = load i64, i64* %hash.v0, align 8
  %65 = load i64, i64* %hash.v1, align 8
  %66 = load i64, i64* %hash.v2, align 8
  %67 = load i64, i64* %hash.v3, align 8
  %68 = add i64 %64, %65
  %69 = shl i64 %65, 13
  %70 = lshr i64 %65, 51
  %71 = or i64 %69, %70
  %72 = xor i64 %71, %68
  %73 = shl i64 %68, 32
  %74 = lshr i64 %68, 32
  %75 = or i64 %73, %74
  %76 = add i64 %66, %67
  %77 = shl i64 %67, 16
  %78 = lshr i64 %67, 48
  %79 = or i64 %77, %78
  %80 = xor i64 %79, %76
  %81 = add i64 %75, %80
  %82 = shl i64 %80, 21
  %83 = lshr i64 %80, 43
  %84 = or i64 %82, %83
  %85 = xor i64 %84, %81
  %86 = add i64 %76, %72
  %87 = shl i64 %72, 17
  %88 = lshr i64 %72, 47
  %89 = or i64 %87, %88
  %90 = xor i64 %89, %86
  %91 = shl i64 %86, 32
  %92 = lshr i64 %86, 32
  %93 = or i64 %91, %92
  store i64 %81, i64* %hash.v0, align 8
  store i64 %90, i64* %hash.v1, align 8
  store i64 %93, i64* %hash.v2, align 8
  store i64 %85, i64* %hash.v3, align 8
  %94 = xor i64 %81, %61
  store i64 %94, i64* %hash.v0, align 8
  %95 = load i64, i64* %hash.v2, align 8
  %96 = xor i64 %95, 255
  store i64 %96, i64* %hash.v2, align 8
  %97 = load i64, i64* %hash.v0, align 8
  %98 = load i64, i64* %hash.v1, align 8
  %99 = load i64, i64* %hash.v2, align 8
  %100 = load i64, i64* %hash.v3, align 8
  %101 = add i64 %97, %98
  %102 = shl i64 %98, 13
  %103 = lshr i64 %98, 51
  %104 = or i64 %102, %103
  %105 = xor i64 %104, %101
  %106 = shl i64 %101, 32
  %107 = lshr i64 %101, 32
  %108 = or i64 %106, %107
  %109 = add i64 %99, %100
  %110 = shl i64 %100, 16
  %111 = lshr i64 %100, 48
  %112 = or i64 %110, %111
  %113 = xor i64 %112, %109
  %114 = add i64 %108, %113
  %115 = shl i64 %113, 21
  %116 = lshr i64 %113, 43
  %117 = or i64 %115, %116
  %118 = xor i64 %117, %114
  %119 = add i64 %109, %105
  %120 = shl i64 %105, 17
  %121 = lshr i64 %105, 47
  %122 = or i64 %120, %121
  %123 = xor i64 %122, %119
  %124 = shl i64 %119, 32
  %125 = lshr i64 %119, 32
  %126 = or i64 %124, %125
  %127 = add i64 %114, %123
  %128 = shl i64 %123, 13
  %129 = lshr i64 %123, 51
  %130 = or i64 %128, %129
  %131 = xor i64 %130, %127
  %132 = shl i64 %127, 32
  %133 = lshr i64 %127, 32
  %134 = or i64 %132, %133
  %135 = add i64 %126, %118
  %136 = shl i64 %118, 16
  %137 = lshr i64 %118, 48
  %138 = or i64 %136, %137
  %139 = xor i64 %138, %135
  %140 = add i64 %134, %139
  %141 = shl i64 %139, 21
  %142 = lshr i64 %139, 43
  %143 = or i64 %141, %142
  %144 = xor i64 %143, %140
  %145 = add i64 %135, %131
  %146 = shl i64 %131, 17
  %147 = lshr i64 %131, 47
  %148 = or i64 %146, %147
  %149 = xor i64 %148, %145
  %150 = shl i64 %145, 32
  %151 = lshr i64 %145, 32
  %152 = or i64 %150, %151
  %153 = add i64 %140, %149
  %154 = shl i64 %149, 13
  %155 = lshr i64 %149, 51
  %156 = or i64 %154, %155
  %157 = xor i64 %156, %153
  %158 = shl i64 %153, 32
  %159 = lshr i64 %153, 32
  %160 = or i64 %158, %159
  %161 = add i64 %152, %144
  %162 = shl i64 %144, 16
  %163 = lshr i64 %144, 48
  %164 = or i64 %162, %163
  %165 = xor i64 %164, %161
  %166 = add i64 %160, %165
  %167 = shl i64 %165, 21
  %168 = lshr i64 %165, 43
  %169 = or i64 %167, %168
  %170 = xor i64 %169, %166
  %171 = add i64 %161, %157
  %172 = shl i64 %157, 17
  %173 = lshr i64 %157, 47
  %174 = or i64 %172, %173
  %175 = xor i64 %174, %171
  %176 = shl i64 %171, 32
  %177 = lshr i64 %171, 32
  %178 = or i64 %176, %177
  store i64 %166, i64* %hash.v0, align 8
  store i64 %175, i64* %hash.v1, align 8
  store i64 %178, i64* %hash.v2, align 8
  store i64 %170, i64* %hash.v3, align 8
  %179 = xor i64 %166, %175
  %180 = xor i64 %178, %170
  %181 = xor i64 %179, %180
  %182 = trunc i64 %181 to i32
  %183 = lshr i64 %181, 32
  %184 = trunc i64 %183 to i32
  %185 = xor i32 %182, %184
  %186 = icmp eq i32 %185, 0
  %187 = select i1 %186, i32 1, i32 %185
  store i32 %187, i32* %h.addr, align 4
  %188 = load i32, i32* %h.addr, align 4
  %189 = lshr i32 %188, 24
  store i32 %189, i32* %fingerprint.addr, align 4
  %190 = load i32, i32* %h.addr, align 4
  %191 = call i32 @nish.homeBucket(i32 %190, i32 %mask)
  store i32 %191, i32* %bucket.addr, align 4
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %197 = load i64, i64* %196, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %201 = load i64, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %203 = load i8*, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %204 = load i32, i32* %bucket.addr, align 4
  %205 = icmp sge i32 %204, 0
  br i1 %205, label %land.rhs, label %land.end

land.rhs:
  %206 = load i32, i32* %bucket.addr, align 4
  %207 = trunc i64 %193 to i32
  %208 = icmp slt i32 %206, %207
  br label %land.end

land.end:
  %209 = phi i1 [ false, %while.cond ], [ %208, %land.rhs ]
  br i1 %209, label %while.body, label %while.end

while.body:
  %210 = load i32, i32* %bucket.addr, align 4
  %211 = sext i32 %210 to i64
  %212 = bitcast i8* %195 to i32*
  %213 = getelementptr inbounds i32, i32* %212, i64 %211
  %214 = load i32, i32* %213, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %214, i32* %word.addr, align 4
  %215 = load i32, i32* %word.addr, align 4
  %216 = icmp eq i32 %215, 0
  br i1 %216, label %if.then, label %if.end

if.then:
  %217 = load i32, i32* %bucket.addr, align 4
  %218 = load i32, i32* %h.addr, align 4
  %219 = tail call i64 @nish.absentAt(i32 %217, i32 %218)
  ret i64 %219

if.end:
  %220 = load i32, i32* %word.addr, align 4
  %221 = lshr i32 %220, 24
  %222 = load i32, i32* %fingerprint.addr, align 4
  %223 = icmp eq i32 %221, %222
  br i1 %223, label %if.then.1, label %if.end.1

if.then.1:
  %224 = load i32, i32* %word.addr, align 4
  %225 = and i32 %224, 16777215
  %226 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %225, i32 1)
  %227 = extractvalue { i32, i1 } %226, 0
  %228 = extractvalue { i32, i1 } %226, 1
  br i1 %228, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %227, i32* %at.addr, align 4
  %229 = load i32, i32* %at.addr, align 4
  %230 = icmp sge i32 %229, 0
  br i1 %230, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %231 = load i32, i32* %at.addr, align 4
  %232 = trunc i64 %197 to i32
  %233 = icmp slt i32 %231, %232
  br label %land.end.4

land.end.4:
  %234 = phi i1 [ false, %ovf.ok ], [ %233, %land.rhs.4 ]
  br i1 %234, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %235 = load i32, i32* %at.addr, align 4
  %236 = sext i32 %235 to i64
  %237 = bitcast i8* %199 to i32*
  %238 = getelementptr inbounds i32, i32* %237, i64 %236
  %239 = load i32, i32* %238, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %240 = load i32, i32* %h.addr, align 4
  %241 = icmp eq i32 %239, %240
  br label %land.end.3

land.end.3:
  %242 = phi i1 [ false, %land.end.4 ], [ %241, %land.rhs.3 ]
  br i1 %242, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %243 = load i32, i32* %at.addr, align 4
  %244 = trunc i64 %201 to i32
  %245 = icmp slt i32 %243, %244
  br label %land.end.2

land.end.2:
  %246 = phi i1 [ false, %land.end.3 ], [ %245, %land.rhs.2 ]
  br i1 %246, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %247 = load i32, i32* %at.addr, align 4
  %248 = sext i32 %247 to i64
  %249 = bitcast i8* %203 to i8**
  %250 = getelementptr inbounds i8*, i8** %249, i64 %248
  %251 = load i8*, i8** %250, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %252 = call zeroext i1 @nish_str_eq(i8* %251, i8* %key)
  br label %land.end.1

land.end.1:
  %253 = phi i1 [ false, %land.end.2 ], [ %252, %land.rhs.1 ]
  br i1 %253, label %if.then.2, label %if.end.2

if.then.2:
  %254 = load i32, i32* %bucket.addr, align 4
  %255 = load i32, i32* %at.addr, align 4
  %256 = tail call i64 @nish.foundAt(i32 %254, i32 %255)
  ret i64 %256

if.end.2:
  br label %if.end.1

if.end.1:
  %257 = load i32, i32* %bucket.addr, align 4
  %258 = add nsw i32 %257, 1
  %259 = and i32 %258, %mask
  store i32 %259, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.15 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!28, !29, !30, !31, !32}
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
!17 = !{!"i32", !6, i64 0}
!18 = !{!"ptr", !6, i64 0}
!19 = !{!"Map$str$i32", !17, i64 0, !18, i64 8, !17, i64 16, !17, i64 20, !18, i64 24, !18, i64 32, !18, i64 40, !17, i64 48}
!20 = !{!19, !17, i64 0}
!21 = !{!19, !17, i64 16}
!22 = !{!19, !17, i64 20}
!23 = !{!19, !17, i64 48}
!24 = !{!19, !18, i64 8}
!25 = !{!19, !18, i64 24}
!26 = !{!19, !18, i64 32}
!27 = !{!19, !18, i64 40}
!28 = !{i32 8, !"cf-protection-branch", i32 1}
!29 = !{i32 8, !"cf-protection-return", i32 1}
!30 = !{i32 8, !"branch-target-enforcement", i32 1}
!31 = !{i32 8, !"sign-return-address", i32 1}
!32 = !{i32 4, !"probe-stack", !"inline-asm"}
