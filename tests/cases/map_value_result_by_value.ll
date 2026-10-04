%struct.Map$i32$res.i32.i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ok \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"err \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" absent\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define internal { i1, i32, i32 } @check(i32 noundef %n) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = srem i32 %n, 2
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %n, i32* %3, align 4
  br label %cond.end

cond.false:
  %4 = sub nsw i32 0, %n
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 false, i1* %5, align 1
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %4, i32* %6, align 4
  br label %cond.end

cond.end:
  %7 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %cond.false ]
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = insertvalue { i1, i32, i32 } undef, i1 %9, 0
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 2
  %12 = load i32, i32* %11, align 4
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  %15 = insertvalue { i1, i32, i32 } %10, i32 %14, 1
  %16 = insertvalue { i1, i32, i32 } %15, i32 %12, 2
  ret { i1, i32, i32 } %16
}

define internal noundef nonnull align 8 i8* @show({ i1, i32, i32 } %r) #1 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = extractvalue { i1, i32, i32 } %r, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %r, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %r, 2
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* %10)
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* %14)
  br label %cond.end

cond.end:
  %16 = phi i8* [ %11, %cond.true ], [ %15, %cond.false ]
  ret i8* %16
}

define noundef i32 @nish_main() #1 {
entry:
  %m.addr = alloca %struct.Map$i32$res.i32.i32*, align 8
  %i.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %hundred.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %eight.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.3 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.4 = alloca %struct.nish_result.i32.i32, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %r.addr = alloca %struct.nish_result.i32.i32*, align 8
  %walk.idx = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$res.i32.i32*
  call void @nish.Map$i32$res.i32.i32.constructor(%struct.Map$i32$res.i32.i32* %1)
  store %struct.Map$i32$res.i32.i32* %1, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, 6
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = call { i1, i32, i32 } @check(i32 %6)
  %8 = extractvalue { i1, i32, i32 } %7, 0
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %8, i1* %9, align 1
  %10 = extractvalue { i1, i32, i32 } %7, 1
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = extractvalue { i1, i32, i32 } %7, 2
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %12, i32* %13, align 4
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %17 = load i32, i32* %16, align 4
  %18 = zext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %20 = load i32, i32* %19, align 4
  %21 = zext i32 %20 to i64
  %22 = select i1 %15, i64 %21, i64 %18
  %23 = shl i64 %22, 32
  %24 = zext i1 %15 to i64
  %25 = or i64 %23, %24
  %26 = call %struct.Map$i32$res.i32.i32* @nish.Map$i32$res.i32.i32.set(%struct.Map$i32$res.i32.i32* %4, i32 %5, i64 %25)
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %30 = call i1 @nish.Map$i32$res.i32.i32.delete(%struct.Map$i32$res.i32.i32* %29, i32 4)
  %31 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %32 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %31, i32 2)
  %33 = icmp sge i64 %32, 0
  br i1 %33, label %get.found, label %get.end

get.found:
  %34 = trunc i64 %32 to i32
  %35 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %31, i32 %34)
  %36 = call i8* @nish_alloc_struct(i64 12)
  %37 = bitcast i8* %36 to %struct.nish_result.i32.i32*
  %38 = trunc i64 %35 to i1
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %37, i32 0, i32 0
  store i1 %38, i1* %39, align 1
  %40 = lshr i64 %35, 32
  %41 = trunc i64 %40 to i32
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %37, i32 0, i32 1
  store i32 %41, i32* %42, align 4
  %43 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %37, i32 0, i32 2
  store i32 %41, i32* %43, align 4
  br label %get.end

get.end:
  %44 = phi %struct.nish_result.i32.i32* [ %37, %get.found ], [ null, %for.end ]
  %45 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %46 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %45, i32 4)
  %47 = icmp sge i64 %46, 0
  br i1 %47, label %get.found.1, label %get.end.1

get.found.1:
  %48 = trunc i64 %46 to i32
  %49 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %45, i32 %48)
  %50 = call i8* @nish_alloc_struct(i64 12)
  %51 = bitcast i8* %50 to %struct.nish_result.i32.i32*
  %52 = trunc i64 %49 to i1
  %53 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %51, i32 0, i32 0
  store i1 %52, i1* %53, align 1
  %54 = lshr i64 %49, 32
  %55 = trunc i64 %54 to i32
  %56 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %51, i32 0, i32 1
  store i32 %55, i32* %56, align 4
  %57 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %51, i32 0, i32 2
  store i32 %55, i32* %57, align 4
  br label %get.end.1

get.end.1:
  %58 = phi %struct.nish_result.i32.i32* [ %51, %get.found.1 ], [ null, %get.end ]
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %59 = xor i1 %47, true
  br label %land.end

land.end:
  %60 = phi i1 [ false, %get.end.1 ], [ %59, %land.rhs ]
  br i1 %60, label %if.then, label %if.end

if.then:
  %61 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %44, i32 0, i32 0
  %62 = load i1, i1* %61, align 1
  %63 = insertvalue { i1, i32, i32 } undef, i1 %62, 0
  %64 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %44, i32 0, i32 2
  %65 = load i32, i32* %64, align 4
  %66 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %44, i32 0, i32 1
  %67 = load i32, i32* %66, align 4
  %68 = insertvalue { i1, i32, i32 } %63, i32 %67, 1
  %69 = insertvalue { i1, i32, i32 } %68, i32 %65, 2
  %70 = call i64 @nish_arena_mark()
  %71 = call i8* @show({ i1, i32, i32 } %69)
  %72 = call i8* @nish_arena_keep(i64 %70, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  call void @nish_print(i8* %73)
  br label %if.end

if.end:
  %74 = call { i1, i32, i32 } @check(i32 100)
  %75 = extractvalue { i1, i32, i32 } %74, 0
  %76 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %75, i1* %76, align 1
  %77 = extractvalue { i1, i32, i32 } %74, 1
  %78 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %77, i32* %78, align 4
  %79 = extractvalue { i1, i32, i32 } %74, 2
  %80 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %79, i32* %80, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %hundred.addr, align 8
  %81 = call { i1, i32, i32 } @check(i32 8)
  %82 = extractvalue { i1, i32, i32 } %81, 0
  %83 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %82, i1* %83, align 1
  %84 = extractvalue { i1, i32, i32 } %81, 1
  %85 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %84, i32* %85, align 4
  %86 = extractvalue { i1, i32, i32 } %81, 2
  %87 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %86, i32* %87, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, %struct.nish_result.i32.i32** %eight.addr, align 8
  %88 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %89 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %88, i32 3)
  %90 = icmp sge i64 %89, 0
  br i1 %90, label %nullish.value, label %nullish.default

nullish.value:
  %91 = trunc i64 %89 to i32
  %92 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %88, i32 %91)
  %93 = call i8* @nish_alloc_struct(i64 12)
  %94 = bitcast i8* %93 to %struct.nish_result.i32.i32*
  %95 = trunc i64 %92 to i1
  %96 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %94, i32 0, i32 0
  store i1 %95, i1* %96, align 1
  %97 = lshr i64 %92, 32
  %98 = trunc i64 %97 to i32
  %99 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %94, i32 0, i32 1
  store i32 %98, i32* %99, align 4
  %100 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %94, i32 0, i32 2
  store i32 %98, i32* %100, align 4
  br label %nullish.end

nullish.default:
  %101 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %hundred.addr, align 8
  br label %nullish.end

nullish.end:
  %102 = phi %struct.nish_result.i32.i32* [ %94, %nullish.value ], [ %101, %nullish.default ]
  br i1 %90, label %set.found, label %set.insert

set.found:
  %103 = trunc i64 %89 to i32
  %104 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 0
  %105 = load i1, i1* %104, align 1
  %106 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 2
  %107 = load i32, i32* %106, align 4
  %108 = zext i32 %107 to i64
  %109 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 1
  %110 = load i32, i32* %109, align 4
  %111 = zext i32 %110 to i64
  %112 = select i1 %105, i64 %111, i64 %108
  %113 = shl i64 %112, 32
  %114 = zext i1 %105 to i64
  %115 = or i64 %113, %114
  call void @nish.Map$i32$res.i32.i32.setValueAt(%struct.Map$i32$res.i32.i32* %88, i32 %103, i64 %115)
  br label %set.end

set.insert:
  %116 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 0
  %117 = load i1, i1* %116, align 1
  %118 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 2
  %119 = load i32, i32* %118, align 4
  %120 = zext i32 %119 to i64
  %121 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %102, i32 0, i32 1
  %122 = load i32, i32* %121, align 4
  %123 = zext i32 %122 to i64
  %124 = select i1 %117, i64 %123, i64 %120
  %125 = shl i64 %124, 32
  %126 = zext i1 %117 to i64
  %127 = or i64 %125, %126
  call void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* %88, i64 %89, i32 3, i64 %127)
  br label %set.end

set.end:
  %128 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %129 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %128, i32 7)
  %130 = icmp sge i64 %129, 0
  br i1 %130, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %131 = trunc i64 %129 to i32
  %132 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %128, i32 %131)
  %133 = call i8* @nish_alloc_struct(i64 12)
  %134 = bitcast i8* %133 to %struct.nish_result.i32.i32*
  %135 = trunc i64 %132 to i1
  %136 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %134, i32 0, i32 0
  store i1 %135, i1* %136, align 1
  %137 = lshr i64 %132, 32
  %138 = trunc i64 %137 to i32
  %139 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %134, i32 0, i32 1
  store i32 %138, i32* %139, align 4
  %140 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %134, i32 0, i32 2
  store i32 %138, i32* %140, align 4
  br label %nullish.end.1

nullish.default.1:
  %141 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %eight.addr, align 8
  br label %nullish.end.1

nullish.end.1:
  %142 = phi %struct.nish_result.i32.i32* [ %134, %nullish.value.1 ], [ %141, %nullish.default.1 ]
  br i1 %130, label %set.found.1, label %set.insert.1

set.found.1:
  %143 = trunc i64 %129 to i32
  %144 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 0
  %145 = load i1, i1* %144, align 1
  %146 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 2
  %147 = load i32, i32* %146, align 4
  %148 = zext i32 %147 to i64
  %149 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 1
  %150 = load i32, i32* %149, align 4
  %151 = zext i32 %150 to i64
  %152 = select i1 %145, i64 %151, i64 %148
  %153 = shl i64 %152, 32
  %154 = zext i1 %145 to i64
  %155 = or i64 %153, %154
  call void @nish.Map$i32$res.i32.i32.setValueAt(%struct.Map$i32$res.i32.i32* %128, i32 %143, i64 %155)
  br label %set.end.1

set.insert.1:
  %156 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 0
  %157 = load i1, i1* %156, align 1
  %158 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 2
  %159 = load i32, i32* %158, align 4
  %160 = zext i32 %159 to i64
  %161 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %142, i32 0, i32 1
  %162 = load i32, i32* %161, align 4
  %163 = zext i32 %162 to i64
  %164 = select i1 %157, i64 %163, i64 %160
  %165 = shl i64 %164, 32
  %166 = zext i1 %157 to i64
  %167 = or i64 %165, %166
  call void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* %128, i64 %129, i32 7, i64 %167)
  br label %set.end.1

set.end.1:
  %168 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %169 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %168, i32 0)
  %170 = icmp sge i64 %169, 0
  br i1 %170, label %if.then.1, label %if.end.1

if.then.1:
  %171 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %hundred.addr, align 8
  %172 = trunc i64 %169 to i32
  %173 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %171, i32 0, i32 0
  %174 = load i1, i1* %173, align 1
  %175 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %171, i32 0, i32 2
  %176 = load i32, i32* %175, align 4
  %177 = zext i32 %176 to i64
  %178 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %171, i32 0, i32 1
  %179 = load i32, i32* %178, align 4
  %180 = zext i32 %179 to i64
  %181 = select i1 %174, i64 %180, i64 %177
  %182 = shl i64 %181, 32
  %183 = zext i1 %174 to i64
  %184 = or i64 %182, %183
  call void @nish.Map$i32$res.i32.i32.setValueAt(%struct.Map$i32$res.i32.i32* %168, i32 %172, i64 %184)
  br label %if.end.1

if.end.1:
  %185 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %186 = call { i1, i32, i32 } @check(i32 10)
  %187 = extractvalue { i1, i32, i32 } %186, 0
  %188 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %187, i1* %188, align 1
  %189 = extractvalue { i1, i32, i32 } %186, 1
  %190 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %189, i32* %190, align 4
  %191 = extractvalue { i1, i32, i32 } %186, 2
  %192 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %191, i32* %192, align 4
  %193 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %194 = load i1, i1* %193, align 1
  %195 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  %196 = load i32, i32* %195, align 4
  %197 = zext i32 %196 to i64
  %198 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %199 = load i32, i32* %198, align 4
  %200 = zext i32 %199 to i64
  %201 = select i1 %194, i64 %200, i64 %197
  %202 = shl i64 %201, 32
  %203 = zext i1 %194 to i64
  %204 = or i64 %202, %203
  %205 = call i8* @nish_alloc_struct(i64 12)
  %206 = bitcast i8* %205 to %struct.nish_result.i32.i32*
  %207 = trunc i64 %204 to i1
  %208 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 0
  store i1 %207, i1* %208, align 1
  %209 = lshr i64 %204, 32
  %210 = trunc i64 %209 to i32
  %211 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 1
  store i32 %210, i32* %211, align 4
  %212 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 2
  store i32 %210, i32* %212, align 4
  %213 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %185, i32 1)
  %214 = icmp sge i64 %213, 0
  br i1 %214, label %get.found.2, label %get.insert

get.found.2:
  %215 = trunc i64 %213 to i32
  %216 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %185, i32 %215)
  %217 = call i8* @nish_alloc_struct(i64 12)
  %218 = bitcast i8* %217 to %struct.nish_result.i32.i32*
  %219 = trunc i64 %216 to i1
  %220 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %218, i32 0, i32 0
  store i1 %219, i1* %220, align 1
  %221 = lshr i64 %216, 32
  %222 = trunc i64 %221 to i32
  %223 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %218, i32 0, i32 1
  store i32 %222, i32* %223, align 4
  %224 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %218, i32 0, i32 2
  store i32 %222, i32* %224, align 4
  br label %get.end.2

get.insert:
  %225 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 0
  %226 = load i1, i1* %225, align 1
  %227 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 2
  %228 = load i32, i32* %227, align 4
  %229 = zext i32 %228 to i64
  %230 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %206, i32 0, i32 1
  %231 = load i32, i32* %230, align 4
  %232 = zext i32 %231 to i64
  %233 = select i1 %226, i64 %232, i64 %229
  %234 = shl i64 %233, 32
  %235 = zext i1 %226 to i64
  %236 = or i64 %234, %235
  call void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* %185, i64 %213, i32 1, i64 %236)
  br label %get.end.2

get.end.2:
  %237 = phi %struct.nish_result.i32.i32* [ %218, %get.found.2 ], [ %206, %get.insert ]
  %238 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %237, i32 0, i32 0
  %239 = load i1, i1* %238, align 1
  %240 = insertvalue { i1, i32, i32 } undef, i1 %239, 0
  %241 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %237, i32 0, i32 2
  %242 = load i32, i32* %241, align 4
  %243 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %237, i32 0, i32 1
  %244 = load i32, i32* %243, align 4
  %245 = insertvalue { i1, i32, i32 } %240, i32 %244, 1
  %246 = insertvalue { i1, i32, i32 } %245, i32 %242, 2
  %247 = call i64 @nish_arena_mark()
  %248 = call i8* @show({ i1, i32, i32 } %246)
  %249 = call i8* @nish_arena_keep(i64 %247, i8* %248)
  call void @nish_print(i8* %249)
  %250 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %251 = call { i1, i32, i32 } @check(i32 10)
  %252 = extractvalue { i1, i32, i32 } %251, 0
  %253 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  store i1 %252, i1* %253, align 1
  %254 = extractvalue { i1, i32, i32 } %251, 1
  %255 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  store i32 %254, i32* %255, align 4
  %256 = extractvalue { i1, i32, i32 } %251, 2
  %257 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 2
  store i32 %256, i32* %257, align 4
  %258 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  %259 = load i1, i1* %258, align 1
  %260 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 2
  %261 = load i32, i32* %260, align 4
  %262 = zext i32 %261 to i64
  %263 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  %264 = load i32, i32* %263, align 4
  %265 = zext i32 %264 to i64
  %266 = select i1 %259, i64 %265, i64 %262
  %267 = shl i64 %266, 32
  %268 = zext i1 %259 to i64
  %269 = or i64 %267, %268
  %270 = call i8* @nish_alloc_struct(i64 12)
  %271 = bitcast i8* %270 to %struct.nish_result.i32.i32*
  %272 = trunc i64 %269 to i1
  %273 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 0
  store i1 %272, i1* %273, align 1
  %274 = lshr i64 %269, 32
  %275 = trunc i64 %274 to i32
  %276 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 1
  store i32 %275, i32* %276, align 4
  %277 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 2
  store i32 %275, i32* %277, align 4
  %278 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %250, i32 9)
  %279 = icmp sge i64 %278, 0
  br i1 %279, label %get.found.3, label %get.insert.1

get.found.3:
  %280 = trunc i64 %278 to i32
  %281 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %250, i32 %280)
  %282 = call i8* @nish_alloc_struct(i64 12)
  %283 = bitcast i8* %282 to %struct.nish_result.i32.i32*
  %284 = trunc i64 %281 to i1
  %285 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %283, i32 0, i32 0
  store i1 %284, i1* %285, align 1
  %286 = lshr i64 %281, 32
  %287 = trunc i64 %286 to i32
  %288 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %283, i32 0, i32 1
  store i32 %287, i32* %288, align 4
  %289 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %283, i32 0, i32 2
  store i32 %287, i32* %289, align 4
  br label %get.end.3

get.insert.1:
  %290 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 0
  %291 = load i1, i1* %290, align 1
  %292 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 2
  %293 = load i32, i32* %292, align 4
  %294 = zext i32 %293 to i64
  %295 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %271, i32 0, i32 1
  %296 = load i32, i32* %295, align 4
  %297 = zext i32 %296 to i64
  %298 = select i1 %291, i64 %297, i64 %294
  %299 = shl i64 %298, 32
  %300 = zext i1 %291 to i64
  %301 = or i64 %299, %300
  call void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* %250, i64 %278, i32 9, i64 %301)
  br label %get.end.3

get.end.3:
  %302 = phi %struct.nish_result.i32.i32* [ %283, %get.found.3 ], [ %271, %get.insert.1 ]
  %303 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %302, i32 0, i32 0
  %304 = load i1, i1* %303, align 1
  %305 = insertvalue { i1, i32, i32 } undef, i1 %304, 0
  %306 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %302, i32 0, i32 2
  %307 = load i32, i32* %306, align 4
  %308 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %302, i32 0, i32 1
  %309 = load i32, i32* %308, align 4
  %310 = insertvalue { i1, i32, i32 } %305, i32 %309, 1
  %311 = insertvalue { i1, i32, i32 } %310, i32 %307, 2
  %312 = call i64 @nish_arena_mark()
  %313 = call i8* @show({ i1, i32, i32 } %311)
  %314 = call i8* @nish_arena_keep(i64 %312, i8* %313)
  call void @nish_print(i8* %314)
  %315 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %315, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %316, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %317 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %317, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %318 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  call void @nish.Map$i32$res.i32.i32.walkOpen(%struct.Map$i32$res.i32.i32* %318)
  %319 = call i32 @nish.Map$i32$res.i32.i32.walkNext(%struct.Map$i32$res.i32.i32* %318, i32 0)
  store i32 %319, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %320 = load i32, i32* %walk.idx, align 4
  %321 = icmp sge i32 %320, 0
  br i1 %321, label %walk.body, label %walk.end

walk.body:
  %322 = call i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* %318, i32 %320)
  %323 = call i8* @nish_alloc_struct(i64 12)
  %324 = bitcast i8* %323 to %struct.nish_result.i32.i32*
  %325 = trunc i64 %322 to i1
  %326 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %324, i32 0, i32 0
  store i1 %325, i1* %326, align 1
  %327 = lshr i64 %322, 32
  %328 = trunc i64 %327 to i32
  %329 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %324, i32 0, i32 1
  store i32 %328, i32* %329, align 4
  %330 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %324, i32 0, i32 2
  store i32 %328, i32* %330, align 4
  store %struct.nish_result.i32.i32* %324, %struct.nish_result.i32.i32** %r.addr, align 8
  %331 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %332 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %333 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %332, i32 0, i32 0
  %334 = load i1, i1* %333, align 1
  %335 = insertvalue { i1, i32, i32 } undef, i1 %334, 0
  %336 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %332, i32 0, i32 2
  %337 = load i32, i32* %336, align 4
  %338 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %332, i32 0, i32 1
  %339 = load i32, i32* %338, align 4
  %340 = insertvalue { i1, i32, i32 } %335, i32 %339, 1
  %341 = insertvalue { i1, i32, i32 } %340, i32 %337, 2
  %342 = call i64 @nish_arena_mark()
  %343 = call i8* @show({ i1, i32, i32 } %341)
  %344 = call i8* @nish_arena_keep(i64 %342, i8* %343)
  %345 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %331, i64 0, i32 0
  %346 = load i64, i64* %345, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %347 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %331, i64 0, i32 1
  %348 = load i64, i64* %347, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %349 = icmp eq i64 %346, %348
  br i1 %349, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %331, i64 8)
  br label %push.store

push.store:
  %350 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %331, i64 0, i32 2
  %351 = load i8*, i8** %350, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %352 = bitcast i8* %351 to i8**
  %353 = getelementptr inbounds i8*, i8** %352, i64 %346
  store i8* %344, i8** %353, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %354 = add i64 %346, 1
  store i64 %354, i64* %345, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %355 = trunc i64 %354 to i32
  br label %walk.inc

walk.inc:
  %356 = add i32 %320, 1
  %357 = call i32 @nish.Map$i32$res.i32.i32.walkNext(%struct.Map$i32$res.i32.i32* %318, i32 %356)
  store i32 %357, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$i32$res.i32.i32.walkClose(%struct.Map$i32$res.i32.i32* %318)
  %358 = load %struct.Map$i32$res.i32.i32*, %struct.Map$i32$res.i32.i32** %m.addr, align 8
  %359 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %358, i32 0, i32 0
  %360 = load i32, i32* %359, align 4, !tbaa !18
  %361 = call i8* @nish_str_from_i32(i32 %360)
  %362 = call i8* @nish_str_concat(i8* %361, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %363 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %364 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %363, i64 0, i32 0
  %365 = load i64, i64* %364, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %366 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %367 = load i64, i64* %366, align 8
  %368 = sub i64 %365, 1
  %369 = mul i64 %367, %368
  %370 = icmp eq i64 %365, 0
  %371 = select i1 %370, i64 0, i64 %369
  store i64 %371, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %372 = load i64, i64* %join.at, align 8
  %373 = icmp ult i64 %372, %365
  br i1 %373, label %join.sum.body, label %join.copy

join.sum.body:
  %374 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %363, i64 0, i32 2
  %375 = load i8*, i8** %374, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %376 = bitcast i8* %375 to i8**
  %377 = getelementptr inbounds i8*, i8** %376, i64 %372
  %378 = load i8*, i8** %377, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %379 = load i64, i64* %join.total, align 8
  %380 = bitcast i8* %378 to i64*
  %381 = load i64, i64* %380, align 8
  %382 = add i64 %379, %381
  store i64 %382, i64* %join.total, align 8
  %383 = add i64 %372, 1
  store i64 %383, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %384 = load i64, i64* %join.total, align 8
  %385 = icmp ugt i64 %384, 2147483647
  %386 = add i64 %384, 9
  %387 = select i1 %385, i64 4611686018427387904, i64 %386
  %388 = call i8* @nish_alloc_struct(i64 %387)
  %389 = bitcast i8* %388 to i64*
  store i64 %384, i64* %389, align 8
  %390 = getelementptr inbounds i8, i8* %388, i64 8
  store i8* %390, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %391 = load i64, i64* %join.at, align 8
  %392 = icmp ult i64 %391, %365
  br i1 %392, label %join.part, label %join.end

join.part:
  %393 = load i8*, i8** %join.p, align 8
  %394 = icmp eq i64 %391, 0
  %395 = select i1 %394, i64 0, i64 %367
  %396 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %393, i8* %396, i64 %395, i1 false)
  %397 = getelementptr inbounds i8, i8* %393, i64 %395
  %398 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %363, i64 0, i32 2
  %399 = load i8*, i8** %398, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %400 = bitcast i8* %399 to i8**
  %401 = getelementptr inbounds i8*, i8** %400, i64 %391
  %402 = load i8*, i8** %401, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %403 = bitcast i8* %402 to i64*
  %404 = load i64, i64* %403, align 8
  %405 = getelementptr inbounds i8, i8* %402, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %397, i8* %405, i64 %404, i1 false)
  %406 = getelementptr inbounds i8, i8* %397, i64 %404
  store i8* %406, i8** %join.p, align 8
  %407 = add i64 %391, 1
  store i64 %407, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %408 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %408, align 1
  %409 = call i8* @nish_str_concat(i8* %362, i8* %388)
  call void @nish_print(i8* %409)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
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

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
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
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
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
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
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
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
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

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
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
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #0 {
entry:
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = trunc i64 %found to i32
  store i32 %0, i32* %at.addr, align 4
  %1 = ashr i64 %found, 32
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %bucket.addr, align 4
  %3 = load i32, i32* %bucket.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %bucket.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %entry ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %bucket.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  store i32 16777216, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  br label %if.end

if.end:
  %17 = load i32, i32* %at.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = load i32, i32* %at.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %19, %22
  br label %land.end.1

land.end.1:
  %24 = phi i1 [ false, %if.end ], [ %23, %land.rhs.1 ]
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load i32, i32* %at.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %26
  store i32 0, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
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
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
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
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #1 {
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
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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

define internal void @nish.Map$i32$res.i32.i32.constructor(%struct.Map$i32$res.i32.i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !18
  %1 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !21
  %2 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !22
  %3 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !23
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
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
  %13 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !24
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !25
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !26
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !21
  %4 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$res.i32.i32* @nish.Map$i32$res.i32.i32.set(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, i64 noundef %value) #1 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %found.addr = alloca i64, align 8
  %0 = trunc i64 %value to i1
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = lshr i64 %value, 32
  %3 = trunc i64 %2 to i32
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %3, i32* %5, align 4
  %6 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %this, i32 %key)
  store i64 %6, i64* %found.addr, align 8
  %7 = load i64, i64* %found.addr, align 8
  %8 = icmp sge i64 %7, 0
  br i1 %8, label %if.then, label %if.else

if.then:
  %9 = load i64, i64* %found.addr, align 8
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %14 = load i32, i32* %13, align 4
  %15 = zext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  %18 = zext i32 %17 to i64
  %19 = select i1 %12, i64 %18, i64 %15
  %20 = shl i64 %19, 32
  %21 = zext i1 %12 to i64
  %22 = or i64 %20, %21
  call void @nish.Map$i32$res.i32.i32.setValueAt(%struct.Map$i32$res.i32.i32* %this, i32 %10, i64 %22)
  br label %if.end

if.else:
  %23 = load i64, i64* %found.addr, align 8
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %25 = load i1, i1* %24, align 1
  %26 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %27 = load i32, i32* %26, align 4
  %28 = zext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %30 = load i32, i32* %29, align 4
  %31 = zext i32 %30 to i64
  %32 = select i1 %25, i64 %31, i64 %28
  %33 = shl i64 %32, 32
  %34 = zext i1 %25 to i64
  %35 = or i64 %33, %34
  call void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* %this, i64 %23, i32 %key, i64 %35)
  br label %if.end

if.end:
  ret %struct.Map$i32$res.i32.i32* %this
}

define internal noundef zeroext i1 @nish.Map$i32$res.i32.i32.delete(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$res.i32.i32.probe(%struct.Map$i32$res.i32.i32* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !24
  %5 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !27
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !22
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  store i32 %11, i32* %13, align 4, !tbaa !22
  %14 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !18
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 0
  store i32 %17, i32* %19, align 4, !tbaa !18
  ret i1 true

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i32$res.i32.i32.walkOpen(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !23
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$i32$res.i32.i32.walkNext(%struct.Map$i32$res.i32.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$i32$res.i32.i32.walkClose(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !23
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$i32$res.i32.i32.valueAt(%struct.Map$i32$res.i32.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
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
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to %struct.nish_result.i32.i32**
  %17 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %16, i64 %10
  %18 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %17, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 0
  %20 = load i1, i1* %19, align 1
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 2
  %22 = load i32, i32* %21, align 4
  %23 = zext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %18, i32 0, i32 1
  %25 = load i32, i32* %24, align 4
  %26 = zext i32 %25 to i64
  %27 = select i1 %20, i64 %26, i64 %23
  %28 = shl i64 %27, 32
  %29 = zext i1 %20 to i64
  %30 = or i64 %28, %29
  ret i64 %30
}

define internal void @nish.Map$i32$res.i32.i32.setValueAt(%struct.Map$i32$res.i32.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i64 noundef %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.i32*
  %2 = trunc i64 %value to i1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = lshr i64 %value, 32
  %5 = trunc i64 %4 to i32
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 1
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 2
  store i32 %5, i32* %7, align 4
  %8 = icmp sge i32 %index, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  %14 = icmp slt i32 %index, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %entry ], [ %14, %land.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !26
  %18 = sext i32 %index to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to %struct.nish_result.i32.i32**
  %22 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %21, i64 %18
  store %struct.nish_result.i32.i32* %1, %struct.nish_result.i32.i32** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$res.i32.i32.insertAt(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, i64 noundef %value) #1 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.i32*
  %2 = trunc i64 %value to i1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = lshr i64 %value, 32
  %5 = trunc i64 %4 to i32
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 1
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %1, i32 0, i32 2
  store i32 %5, i32* %7, align 4
  %8 = sub nsw i64 -1, %absent
  store i64 %8, i64* %packed.addr, align 8
  %9 = load i64, i64* %packed.addr, align 8
  %10 = ashr i64 %9, 32
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %bucket.addr, align 4
  %12 = load i64, i64* %packed.addr, align 8
  %13 = trunc i64 %12 to i32
  store i32 %13, i32* %h.addr, align 4
  %14 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !25
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = icmp sge i32 %18, 16777215
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !22
  %22 = icmp sge i32 %21, 16777215
  br i1 %22, label %lor.end, label %lor.rhs

lor.rhs:
  %23 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  %24 = load i32, i32* %23, align 4, !tbaa !23
  %25 = icmp sgt i32 %24, 0
  br label %lor.end

lor.end:
  %26 = phi i1 [ true, %if.then ], [ %25, %lor.rhs ]
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$i32$res.i32.i32.rebuild(%struct.Map$i32$res.i32.i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %27 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !25
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %30
  store i32 %key, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !tbaa !26
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %41, i64 8)
  br label %push.store.1

push.store.1:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to %struct.nish_result.i32.i32**
  %50 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %49, i64 %43
  store %struct.nish_result.i32.i32* %1, %struct.nish_result.i32.i32** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  %53 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %54 = load %struct.nish_array*, %struct.nish_array** %53, align 8, !tbaa !27
  %55 = load i32, i32* %h.addr, align 4
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 1
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = icmp eq i64 %57, %59
  br i1 %60, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %54, i64 4)
  br label %push.store.2

push.store.2:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %57
  store i32 %55, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %65 = add i64 %57, 1
  store i64 %65, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  %67 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  %68 = load i32, i32* %67, align 4, !tbaa !22
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 1)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok

ovf.ok:
  %72 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  store i32 %70, i32* %72, align 4, !tbaa !22
  %73 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 0
  %74 = load i32, i32* %73, align 4, !tbaa !18
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 1)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %78 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 0
  store i32 %76, i32* %78, align 4, !tbaa !18
  %79 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %80 = load %struct.nish_array*, %struct.nish_array** %79, align 8, !tbaa !25
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = trunc i64 %82 to i32
  store i32 %83, i32* %used.addr, align 4
  %84 = load i32, i32* %used.addr, align 4
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 4)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %88 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  %89 = load %struct.nish_array*, %struct.nish_array** %88, align 8, !tbaa !24
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = trunc i64 %91 to i32
  %93 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %92, i32 3)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %96 = icmp sgt i32 %86, %94
  br i1 %96, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i32$res.i32.i32.rebuild(%struct.Map$i32$res.i32.i32* %this)
  br label %if.end.2

if.else:
  %97 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  %98 = load %struct.nish_array*, %struct.nish_array** %97, align 8, !tbaa !24
  %99 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 2
  %100 = load i32, i32* %99, align 4, !tbaa !21
  %101 = load i32, i32* %bucket.addr, align 4
  %102 = load i32, i32* %h.addr, align 4
  %103 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %98, i32 %100, i32 %101, i32 %102, i32 %103)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$i32$res.i32.i32.rebuild(%struct.Map$i32$res.i32.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !23
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
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
  %19 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !25
  %26 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !27
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !26
  %30 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !27
  call void @nish.compactEntries$res.i32.i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !24
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !21
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$res.i32.i32, %struct.Map$i32$res.i32.i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #1 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = lshr i32 %key, 16
  %1 = xor i32 %key, %0
  %2 = mul i32 %1, -2048144789
  %3 = lshr i32 %2, 13
  %4 = xor i32 %2, %3
  %5 = mul i32 %4, -1028477387
  %6 = lshr i32 %5, 16
  %7 = xor i32 %5, %6
  %8 = icmp eq i32 %7, 0
  %9 = select i1 %8, i32 1, i32 %7
  store i32 %9, i32* %h.addr, align 4
  %10 = load i32, i32* %h.addr, align 4
  %11 = lshr i32 %10, 24
  store i32 %11, i32* %fingerprint.addr, align 4
  %12 = load i32, i32* %h.addr, align 4
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask)
  store i32 %13, i32* %bucket.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4
  %29 = trunc i64 %15 to i32
  %30 = icmp slt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ]
  br i1 %31, label %while.body, label %while.end

while.body:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %17 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  store i32 %36, i32* %word.addr, align 4
  %37 = load i32, i32* %word.addr, align 4
  %38 = icmp eq i32 %37, 0
  br i1 %38, label %if.then, label %if.end

if.then:
  %39 = load i32, i32* %bucket.addr, align 4
  %40 = load i32, i32* %h.addr, align 4
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40)
  ret i64 %41

if.end:
  %42 = load i32, i32* %word.addr, align 4
  %43 = lshr i32 %42, 24
  %44 = load i32, i32* %fingerprint.addr, align 4
  %45 = icmp eq i32 %43, %44
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  %46 = load i32, i32* %word.addr, align 4
  %47 = and i32 %46, 16777215
  %48 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %49, i32* %at.addr, align 4
  %51 = load i32, i32* %at.addr, align 4
  %52 = icmp sge i32 %51, 0
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = load i32, i32* %at.addr, align 4
  %54 = trunc i64 %19 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %ovf.ok ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = bitcast i8* %21 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %58
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %62 = load i32, i32* %h.addr, align 4
  %63 = icmp eq i32 %61, %62
  br label %land.end.3

land.end.3:
  %64 = phi i1 [ false, %land.end.4 ], [ %63, %land.rhs.3 ]
  br i1 %64, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %65 = load i32, i32* %at.addr, align 4
  %66 = trunc i64 %23 to i32
  %67 = icmp slt i32 %65, %66
  br label %land.end.2

land.end.2:
  %68 = phi i1 [ false, %land.end.3 ], [ %67, %land.rhs.2 ]
  br i1 %68, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %69 = load i32, i32* %at.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %25 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 %70
  %73 = load i32, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %74 = icmp eq i32 %73, %key
  br label %land.end.1

land.end.1:
  %75 = phi i1 [ false, %land.end.2 ], [ %74, %land.rhs.1 ]
  br i1 %75, label %if.then.2, label %if.end.2

if.then.2:
  %76 = load i32, i32* %bucket.addr, align 4
  %77 = load i32, i32* %at.addr, align 4
  %78 = tail call i64 @nish.foundAt(i32 %76, i32 %77)
  ret i64 %78

if.end.2:
  br label %if.end.1

if.end.1:
  %79 = load i32, i32* %bucket.addr, align 4
  %80 = add nsw i32 %79, 1
  %81 = and i32 %80, %mask
  store i32 %81, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.8 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !20
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$res.i32.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !20
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
  %39 = bitcast i8* %10 to %struct.nish_result.i32.i32**
  %40 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %39, i64 %38
  %41 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %10 to %struct.nish_result.i32.i32**
  %43 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %42, i64 %36
  store %struct.nish_result.i32.i32* %41, %struct.nish_result.i32.i32** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %59 = bitcast i8* %58 to %struct.nish_result.i32.i32**
  %60 = getelementptr inbounds %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %59, i64 %56
  %61 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Map$i32$res.i32.i32", !15, i64 0, !16, i64 8, !15, i64 16, !15, i64 20, !16, i64 24, !16, i64 32, !16, i64 40, !15, i64 48}
!18 = !{!17, !15, i64 0}
!19 = !{!"element i32", !6, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!17, !15, i64 16}
!22 = !{!17, !15, i64 20}
!23 = !{!17, !15, i64 48}
!24 = !{!17, !16, i64 8}
!25 = !{!17, !16, i64 24}
!26 = !{!17, !16, i64 32}
!27 = !{!17, !16, i64 40}
