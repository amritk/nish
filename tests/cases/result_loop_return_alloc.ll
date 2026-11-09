%struct.Map$i32$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pass \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"call \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"ternary \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"coalesce \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"none \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.11 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@.str.12 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal void @nish.int.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_int_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.11 to i8*))
  unreachable
mark:
  %r0 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r0.s1 = lshr i64 %r0, 30
  %r0.x1 = xor i64 %r0, %r0.s1
  %r0.m1 = mul i64 %r0.x1, -4658895280553007687
  %r0.s2 = lshr i64 %r0.m1, 27
  %r0.x2 = xor i64 %r0.m1, %r0.s2
  %r0.m2 = mul i64 %r0.x2, -7723592293110705685
  %r0.s3 = lshr i64 %r0.m2, 31
  %r0.x3 = xor i64 %r0.m2, %r0.s3
  store i64 %r0.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %r1.s1 = lshr i64 %r1, 30
  %r1.x1 = xor i64 %r1, %r1.s1
  %r1.m1 = mul i64 %r1.x1, -4658895280553007687
  %r1.s2 = lshr i64 %r1.m1, 27
  %r1.x2 = xor i64 %r1.m1, %r1.s2
  %r1.m2 = mul i64 %r1.x2, -7723592293110705685
  %r1.s3 = lshr i64 %r1.m2, 31
  %r1.x3 = xor i64 %r1.m2, %r1.s3
  store i64 %r1.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

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

define internal { i1, i32, i32 } @measure(i32 noundef %i) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [0 x i32], align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 0, 4
  %3 = bitcast [0 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp sle i32 %5, %i
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %8 = load i32, i32* %k.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %k.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = icmp sgt i32 %25, 3
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %30, i32 10)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok

ovf.ok:
  %34 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %32, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %34

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %38, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %39

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal { i1, i32, i32 } @spell(i32 noundef %i) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %5, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %6
}

define internal { i1, i32, i32 } @viaCall(i32 noundef %limit) #0 {
entry:
  %i.addr = alloca i32, align 4
  %tag.addr = alloca i8*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %7)
  store i8* %8, i8** %tag.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp eq i32 %9, 4
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i8*, i8** %tag.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = icmp sgt i32 %14, 0
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.body ], [ %15, %land.rhs ]
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  %18 = call { i1, i32, i32 } @measure(i32 %17)
  %19 = extractvalue { i1, i32, i32 } %18, 0
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %19, i1* %20, align 1
  %21 = extractvalue { i1, i32, i32 } %18, 1
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %21, i32* %22, align 4
  %23 = extractvalue { i1, i32, i32 } %18, 2
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %23, i32* %24, align 4
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %26 = load i1, i1* %25, align 1
  %27 = insertvalue { i1, i32, i32 } undef, i1 %26, 0
  %28 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %29 = load i32, i32* %28, align 4
  %30 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %31 = load i32, i32* %30, align 4
  %32 = insertvalue { i1, i32, i32 } %27, i32 %31, 1
  %33 = insertvalue { i1, i32, i32 } %32, i32 %29, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %33

if.end:
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %35 = load i8*, i8** %34, align 8
  %36 = icmp eq i8* %35, %3
  br i1 %36, label %pass.rewind, label %pass.free

pass.rewind:
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %37, align 8
  br label %pass.done

pass.free:
  %38 = ptrtoint i8* %3 to i64
  %39 = add i64 %38, %5
  call void @nish_arena_release(i64 %39)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 -1, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %42
}

define internal { i1, i32, i32 } @viaTernary(i32 noundef %limit) #0 {
entry:
  %i.addr = alloca i32, align 4
  %tag.addr = alloca i8*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %7)
  store i8* %8, i8** %tag.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp eq i32 %9, 2
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i8*, i8** %tag.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = icmp sgt i32 %14, 6
  br i1 %15, label %cond.true, label %cond.false

cond.true:
  %16 = load i32, i32* %i.addr, align 4
  %17 = call { i1, i32, i32 } @measure(i32 %16)
  %18 = extractvalue { i1, i32, i32 } %17, 0
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %18, i1* %19, align 1
  %20 = extractvalue { i1, i32, i32 } %17, 1
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %20, i32* %21, align 4
  %22 = extractvalue { i1, i32, i32 } %17, 2
  %23 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %22, i32* %23, align 4
  br label %cond.end

cond.false:
  %24 = load i32, i32* %i.addr, align 4
  %25 = mul nsw i32 %24, 50
  %26 = call { i1, i32, i32 } @spell(i32 %25)
  %27 = extractvalue { i1, i32, i32 } %26, 0
  %28 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %27, i1* %28, align 1
  %29 = extractvalue { i1, i32, i32 } %26, 1
  %30 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %29, i32* %30, align 4
  %31 = extractvalue { i1, i32, i32 } %26, 2
  %32 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %31, i32* %32, align 4
  br label %cond.end

cond.end:
  %33 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %cond.false ]
  %34 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %33, i32 0, i32 0
  %35 = load i1, i1* %34, align 1
  %36 = insertvalue { i1, i32, i32 } undef, i1 %35, 0
  %37 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %33, i32 0, i32 2
  %38 = load i32, i32* %37, align 4
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %33, i32 0, i32 1
  %40 = load i32, i32* %39, align 4
  %41 = insertvalue { i1, i32, i32 } %36, i32 %40, 1
  %42 = insertvalue { i1, i32, i32 } %41, i32 %38, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %42

if.end:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %46 = load i8*, i8** %45, align 8
  %47 = icmp eq i8* %46, %3
  br i1 %47, label %pass.rewind, label %pass.free

pass.rewind:
  %48 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %48, align 8
  br label %pass.done

pass.free:
  %49 = ptrtoint i8* %3 to i64
  %50 = add i64 %49, %5
  call void @nish_arena_release(i64 %50)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %51 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 -2, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %51
}

define internal { i1, i32, i32 } @viaCoalesce(i32 noundef %limit, %struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %map) #0 {
entry:
  %i.addr = alloca i32, align 4
  %tag.addr = alloca i8*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %7)
  store i8* %8, i8** %tag.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp eq i32 %9, 1
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i8*, i8** %tag.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = icmp sgt i32 %14, 0
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.body ], [ %15, %land.rhs ]
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  %18 = call i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* %map, i32 %17)
  %19 = icmp sge i64 %18, 0
  br i1 %19, label %nullish.value, label %nullish.default

nullish.value:
  %20 = trunc i64 %18 to i32
  %21 = call i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* %map, i32 %20)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %22 = phi i32 [ %21, %nullish.value ], [ 7, %nullish.default ]
  %23 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %22, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %23

if.end:
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = icmp eq i8* %25, %3
  br i1 %26, label %pass.rewind, label %pass.free

pass.rewind:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %27, align 8
  br label %pass.done

pass.free:
  %28 = ptrtoint i8* %3 to i64
  %29 = add i64 %28, %5
  call void @nish_arena_release(i64 %29)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %32 = call { i1, i32, i32 } @measure(i32 1)
  %33 = extractvalue { i1, i32, i32 } %32, 0
  %34 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %33, i1* %34, align 1
  %35 = extractvalue { i1, i32, i32 } %32, 1
  %36 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %35, i32* %36, align 4
  %37 = extractvalue { i1, i32, i32 } %32, 2
  %38 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %37, i32* %38, align 4
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %40 = load i1, i1* %39, align 1
  %41 = insertvalue { i1, i32, i32 } undef, i1 %40, 0
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %43 = load i32, i32* %42, align 4
  %44 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %45 = load i32, i32* %44, align 4
  %46 = insertvalue { i1, i32, i32 } %41, i32 %45, 1
  %47 = insertvalue { i1, i32, i32 } %46, i32 %43, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %47
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %b.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %map.addr = alloca %struct.Map$i32$i32*, align 8
  %Map$i32$i32.obj = alloca %struct.Map$i32$i32, align 8
  %c.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %d.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.3 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32, i32 } @viaCall(i32 10)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %a.addr, align 8
  %7 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %a.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = select i1 %9, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %13 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %a.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  br i1 %15, label %cond.true, label %cond.false

cond.true:
  %16 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %a.addr, align 8
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  br label %cond.end

cond.false:
  %19 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %a.addr, align 8
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %19, i32 0, i32 2
  %21 = load i32, i32* %20, align 4
  br label %cond.end

cond.end:
  %22 = phi i32 [ %18, %cond.true ], [ %21, %cond.false ]
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %12, i8* %23)
  call void @nish_print(i8* %24)
  %25 = call { i1, i32, i32 } @viaTernary(i32 10)
  %26 = extractvalue { i1, i32, i32 } %25, 0
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %26, i1* %27, align 1
  %28 = extractvalue { i1, i32, i32 } %25, 1
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %28, i32* %29, align 4
  %30 = extractvalue { i1, i32, i32 } %25, 2
  %31 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %30, i32* %31, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %b.addr, align 8
  %32 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %b.addr, align 8
  %33 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %32, i32 0, i32 0
  %34 = load i1, i1* %33, align 1
  %35 = select i1 %34, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %36 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.6 to i8*), i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %38 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %b.addr, align 8
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %38, i32 0, i32 0
  %40 = load i1, i1* %39, align 1
  br i1 %40, label %cond.true.1, label %cond.false.1

cond.true.1:
  %41 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %b.addr, align 8
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %41, i32 0, i32 1
  %43 = load i32, i32* %42, align 4
  br label %cond.end.1

cond.false.1:
  %44 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %b.addr, align 8
  %45 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %44, i32 0, i32 2
  %46 = load i32, i32* %45, align 4
  br label %cond.end.1

cond.end.1:
  %47 = phi i32 [ %43, %cond.true.1 ], [ %46, %cond.false.1 ]
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %37, i8* %48)
  call void @nish_print(i8* %49)
  call void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* %Map$i32$i32.obj)
  store %struct.Map$i32$i32* %Map$i32$i32.obj, %struct.Map$i32$i32** %map.addr, align 8
  %50 = load %struct.Map$i32$i32*, %struct.Map$i32$i32** %map.addr, align 8
  %51 = call { i1, i32, i32 } @viaCoalesce(i32 10, %struct.Map$i32$i32* %50)
  %52 = extractvalue { i1, i32, i32 } %51, 0
  %53 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %52, i1* %53, align 1
  %54 = extractvalue { i1, i32, i32 } %51, 1
  %55 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %54, i32* %55, align 4
  %56 = extractvalue { i1, i32, i32 } %51, 2
  %57 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %56, i32* %57, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, %struct.nish_result.i32.i32** %c.addr, align 8
  %58 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %c.addr, align 8
  %59 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %58, i32 0, i32 0
  %60 = load i1, i1* %59, align 1
  %61 = select i1 %60, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %62 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %64 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %c.addr, align 8
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %64, i32 0, i32 0
  %66 = load i1, i1* %65, align 1
  br i1 %66, label %cond.true.2, label %cond.false.2

cond.true.2:
  %67 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %c.addr, align 8
  %68 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %67, i32 0, i32 1
  %69 = load i32, i32* %68, align 4
  br label %cond.end.2

cond.false.2:
  %70 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %c.addr, align 8
  %71 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %70, i32 0, i32 2
  %72 = load i32, i32* %71, align 4
  br label %cond.end.2

cond.end.2:
  %73 = phi i32 [ %69, %cond.true.2 ], [ %72, %cond.false.2 ]
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %63, i8* %74)
  call void @nish_print(i8* %75)
  %76 = call { i1, i32, i32 } @viaCall(i32 2)
  %77 = extractvalue { i1, i32, i32 } %76, 0
  %78 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %77, i1* %78, align 1
  %79 = extractvalue { i1, i32, i32 } %76, 1
  %80 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %79, i32* %80, align 4
  %81 = extractvalue { i1, i32, i32 } %76, 2
  %82 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %81, i32* %82, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, %struct.nish_result.i32.i32** %d.addr, align 8
  %83 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %d.addr, align 8
  %84 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %83, i32 0, i32 0
  %85 = load i1, i1* %84, align 1
  %86 = select i1 %85, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %87 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %89 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %d.addr, align 8
  %90 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %89, i32 0, i32 0
  %91 = load i1, i1* %90, align 1
  br i1 %91, label %cond.true.3, label %cond.false.3

cond.true.3:
  %92 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %d.addr, align 8
  %93 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %92, i32 0, i32 1
  %94 = load i32, i32* %93, align 4
  br label %cond.end.3

cond.false.3:
  %95 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %d.addr, align 8
  %96 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %95, i32 0, i32 2
  %97 = load i32, i32* %96, align 4
  br label %cond.end.3

cond.end.3:
  %98 = phi i32 [ %94, %cond.true.3 ], [ %97, %cond.false.3 ]
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %88, i8* %99)
  call void @nish_print(i8* %100)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
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

define internal void @nish.Map$i32$i32.constructor(%struct.Map$i32$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !18
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !19
  %2 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !20
  %3 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !21
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.9 to i8*))
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
  %13 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !22
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !23
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !24
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !25
  ret void
}

define internal noundef i64 @nish.Map$i32$i32.probe(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !19
  %4 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !25
  %6 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !23
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.10 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %15
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = zext i32 %key to i64
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %2 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %3 = mul i64 %0, %1
  %4 = add i64 %3, %2
  %5 = lshr i64 %4, 32
  %6 = trunc i64 %5 to i32
  %7 = icmp eq i32 %6, 0
  %8 = select i1 %7, i32 1, i32 %6
  store i32 %8, i32* %h.addr, align 4
  %9 = load i32, i32* %h.addr, align 4
  %10 = lshr i32 %9, 24
  store i32 %10, i32* %fingerprint.addr, align 4
  %11 = load i32, i32* %h.addr, align 4
  %12 = call i32 @nish.homeBucket(i32 %11, i32 %mask)
  store i32 %12, i32* %bucket.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %25 = load i32, i32* %bucket.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs, label %land.end

land.rhs:
  %27 = load i32, i32* %bucket.addr, align 4
  %28 = trunc i64 %14 to i32
  %29 = icmp slt i32 %27, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs ]
  br i1 %30, label %while.body, label %while.end

while.body:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = bitcast i8* %16 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %32
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %35, i32* %word.addr, align 4
  %36 = load i32, i32* %word.addr, align 4
  %37 = icmp eq i32 %36, 0
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = load i32, i32* %h.addr, align 4
  %40 = tail call i64 @nish.absentAt(i32 %38, i32 %39)
  ret i64 %40

if.end:
  %41 = load i32, i32* %word.addr, align 4
  %42 = lshr i32 %41, 24
  %43 = load i32, i32* %fingerprint.addr, align 4
  %44 = icmp eq i32 %42, %43
  br i1 %44, label %if.then.1, label %if.end.1

if.then.1:
  %45 = load i32, i32* %word.addr, align 4
  %46 = and i32 %45, 16777215
  %47 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %46, i32 1)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %48, i32* %at.addr, align 4
  %50 = load i32, i32* %at.addr, align 4
  %51 = icmp sge i32 %50, 0
  br i1 %51, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %52 = load i32, i32* %at.addr, align 4
  %53 = trunc i64 %18 to i32
  %54 = icmp slt i32 %52, %53
  br label %land.end.4

land.end.4:
  %55 = phi i1 [ false, %ovf.ok ], [ %54, %land.rhs.4 ]
  br i1 %55, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %56 = load i32, i32* %at.addr, align 4
  %57 = sext i32 %56 to i64
  %58 = bitcast i8* %20 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %57
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = load i32, i32* %h.addr, align 4
  %62 = icmp eq i32 %60, %61
  br label %land.end.3

land.end.3:
  %63 = phi i1 [ false, %land.end.4 ], [ %62, %land.rhs.3 ]
  br i1 %63, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %64 = load i32, i32* %at.addr, align 4
  %65 = trunc i64 %22 to i32
  %66 = icmp slt i32 %64, %65
  br label %land.end.2

land.end.2:
  %67 = phi i1 [ false, %land.end.3 ], [ %66, %land.rhs.2 ]
  br i1 %67, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %68 = load i32, i32* %at.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = bitcast i8* %24 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %69
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = icmp eq i32 %72, %key
  br label %land.end.1

land.end.1:
  %74 = phi i1 [ false, %land.end.2 ], [ %73, %land.rhs.1 ]
  br i1 %74, label %if.then.2, label %if.end.2

if.then.2:
  %75 = load i32, i32* %bucket.addr, align 4
  %76 = load i32, i32* %at.addr, align 4
  %77 = tail call i64 @nish.foundAt(i32 %75, i32 %76)
  ret i64 %77

if.end.2:
  br label %if.end.1

if.end.1:
  %78 = load i32, i32* %bucket.addr, align 4
  %79 = add nsw i32 %78, 1
  %80 = and i32 %79, %mask
  store i32 %80, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.12 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!26, !27, !28, !29, !30}
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
!15 = !{!"i32", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Map$i32$i32", !15, i64 0, !16, i64 8, !15, i64 16, !15, i64 20, !16, i64 24, !16, i64 32, !16, i64 40, !15, i64 48}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 16}
!20 = !{!17, !15, i64 20}
!21 = !{!17, !15, i64 48}
!22 = !{!17, !16, i64 8}
!23 = !{!17, !16, i64 24}
!24 = !{!17, !16, i64 32}
!25 = !{!17, !16, i64 40}
!26 = !{i32 8, !"cf-protection-branch", i32 1}
!27 = !{i32 8, !"cf-protection-return", i32 1}
!28 = !{i32 8, !"branch-target-enforcement", i32 1}
!29 = !{i32 8, !"sign-return-address", i32 1}
!30 = !{i32 4, !"probe-stack", !"inline-asm"}
