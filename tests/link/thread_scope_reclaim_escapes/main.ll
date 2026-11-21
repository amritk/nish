%struct.Holder = type { %struct.nish_array* }
%struct.Reg = type { %struct.nish_array* }
%struct.Box = type { %struct.nish_array* }
%struct.AtomicI32 = type { i32 }
%struct.Map$i32$arr.i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [56 x i8] } { i64 55, [56 x i8] c"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"field \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"return \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"push \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"map \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"ctor \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"relay \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"answer \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"capture \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"new \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"declarator \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"alias \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arena \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pass \00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.16 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare void @nish.AtomicI32.constructor(%struct.AtomicI32* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.load(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture) #1
declare void @nish.AtomicI32.store(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.add(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.sub(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.min(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.max(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.exchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$arr.i32$arr.i32$fn.4.same(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.15.captured$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.AtomicI32* noundef, %struct.nish_array* noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.16 to i8*))
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

define internal noundef i32 @churn() #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 6000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [56 x i8] }* @.str.0 to i8*), i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %9 = load i8*, i8** %s.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load i32, i32* %t.addr, align 4
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load i32, i32* %t.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %39 = sub nsw i32 %37, 6000
  ret i32 %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %t.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %8, i32* %y.addr, align 4
  %9 = load i32, i32* %t.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 31)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %y.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = srem i32 %15, 1000003
  store i32 %17, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %18 = load i64, i64* %forof.idx, align 8
  %19 = add i64 %18, 1
  store i64 %19, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %20 = load i32, i32* %t.addr, align 4
  ret i32 %20

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fresh(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %19, i32 7)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %k)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = srem i32 %24, 1009
  %27 = bitcast i8* %13 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %18
  store i32 %26, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  ret %struct.nish_array* %31

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !19
  ret void
}

define internal noundef i32 @intoField(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %16 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %15, %struct.nish_array** %16, align 8, !tbaa !19
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @returned(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  ret %struct.nish_array* %15
}

define internal noundef i32 @pushed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rows, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %rows, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to %struct.nish_array**
  %24 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %23, i64 %17
  store %struct.nish_array* %15, %struct.nish_array** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %35
}

define internal noundef i32 @mapped(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) %m, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %16 = call %struct.Map$i32$arr.i32* @nish.Map$i32$arr.i32.set(%struct.Map$i32$arr.i32* %m, i32 %k, %struct.nish_array* %15)
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %25
}

define internal void @Reg.constructor(%struct.Reg* noundef nonnull noalias align 8 dereferenceable(8) %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %list, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ys) #1 {
entry:
  %0 = getelementptr inbounds %struct.Reg, %struct.Reg* %this, i32 0, i32 0
  store %struct.nish_array* %ys, %struct.nish_array** %0, align 8, !tbaa !21
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %list, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %list, i64 0, i32 1
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = icmp eq i64 %2, %4
  br i1 %5, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %list, i64 8)
  br label %push.store

push.store:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %list, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to %struct.Reg**
  %9 = getelementptr inbounds %struct.Reg*, %struct.Reg** %8, i64 %2
  store %struct.Reg* %this, %struct.Reg** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = add i64 %2, 1
  store i64 %10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  ret void
}

define internal noundef i32 @registered(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %list, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = bitcast i8* %15 to %struct.Reg*
  %17 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @Reg.constructor(%struct.Reg* %16, %struct.nish_array* %list, %struct.nish_array* %17)
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %26
}

define internal void @keep(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ys) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %ys, %struct.nish_array** %0, align 8, !tbaa !19
  ret void
}

define internal noundef i32 @relayed(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @keep(%struct.Holder* %h, %struct.nish_array* %15)
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %24
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @same$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ys) #2 {
entry:
  ret %struct.nish_array* %ys
}

define internal noundef i32 @answered(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 1, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 1, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to %struct.nish_array**
  %13 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %12, i64 0
  store %struct.nish_array* %2, %struct.nish_array** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %7, %struct.nish_array** %out.addr, align 8
  %14 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %14, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = bitcast %struct.ThreadScope* %15 to i8*
  %17 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$arr.i32$fn.4.same(%struct.ThreadScope* %17, %struct.nish_array* %18, %struct.nish_array* %19, i32 0)
  call void @nish_scope_join(i8* %16)
  %20 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ult i64 0, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to %struct.nish_array**
  %27 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %26, i64 0
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %28, %struct.nish_array** %29, align 8, !tbaa !19
  %30 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to %struct.nish_array**
  %34 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %33, i64 0
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  ret i32 %38
}

define internal noundef i32 @captured(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, %struct.AtomicI32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %acc, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %1, %struct.ThreadScope** %s.addr, align 8
  %2 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %3 = bitcast %struct.ThreadScope* %2 to i8*
  %4 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @nish.ThreadScope.spawnThunk$void$fn.15.captured$arrow0(%struct.ThreadScope* %4, %struct.AtomicI32* %acc, %struct.nish_array* %5)
  call void @nish_scope_join(i8* %3)
  %6 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %7 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %6, %struct.nish_array** %7, align 8, !tbaa !19
  %8 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  ret i32 %11
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %ys) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %ys, %struct.nish_array** %0, align 8, !tbaa !23
  ret void
}

define internal noundef i32 @boxed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %boxes, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = bitcast i8* %15 to %struct.Box*
  %17 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @Box.constructor(%struct.Box* %16, %struct.nish_array* %17)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %boxes, i64 8)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to %struct.Box**
  %26 = getelementptr inbounds %struct.Box*, %struct.Box** %25, i64 %19
  store %struct.Box* %16, %struct.Box** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 0, %31
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %31)
  unreachable

bounds.ok:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 0
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %37
}

define internal noundef i32 @second(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %more.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %u.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 4)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 0, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %10, %struct.nish_array** %more.addr, align 8
  %17 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %17, %struct.ThreadScope** %s.addr, align 8
  %18 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %19 = bitcast %struct.ThreadScope* %18 to i8*
  %20 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %20, %struct.ThreadScope** %u.addr, align 8
  %21 = load %struct.ThreadScope*, %struct.ThreadScope** %u.addr, align 8
  %22 = bitcast %struct.ThreadScope* %21 to i8*
  %23 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %23, %struct.nish_array* %24, %struct.nish_array* %25, i32 0)
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %u.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %more.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %26, %struct.nish_array* %27, %struct.nish_array* %28, i32 0)
  call void @nish_scope_join(i8* %22)
  call void @nish_scope_join(i8* %19)
  %29 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %30 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %29, %struct.nish_array** %30, align 8, !tbaa !19
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = icmp ult i64 0, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %40 = load %struct.nish_array*, %struct.nish_array** %more.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  %52 = srem i32 %50, 1000003
  ret i32 %52

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @aliased(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n, i32 noundef %k) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @fresh(i32 %n, i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %12, %struct.nish_array* %13, %struct.nish_array* %14, i32 0)
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  store %struct.nish_array* %15, %struct.nish_array** %zs.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %16, %struct.nish_array** %17, align 8, !tbaa !19
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %26
}

define internal noundef i32 @ordered(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i64, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = mul i64 1, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %7 = call i64 @nish_arena_mark()
  store i64 %7, i64* %a.addr, align 8
  %8 = load i64, i64* %a.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = add nsw i32 %k, 40
  %13 = call %struct.nish_array* @fresh(i32 %n, i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %14, %struct.nish_array* %15, %struct.nish_array* %16, i32 0)
  call void @nish_scope_join(i8* %11)
  call void @nish_arena_release(i64 %8)
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %25
}

define internal noundef nonnull align 8 i8* @passes(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %k.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = mul i64 8, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %7 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %7, %struct.ThreadScope** %s.addr, align 8
  %8 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %9 = bitcast %struct.ThreadScope* %8 to i8*
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, 8
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %k.addr, align 4
  %13 = call %struct.nish_array* @fresh(i32 %n, i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = load i32, i32* %k.addr, align 4
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.3.sum(%struct.ThreadScope* %14, %struct.nish_array* %15, %struct.nish_array* %16, i32 %17)
  br label %for.inc

for.inc:
  %18 = load i32, i32* %k.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %k.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %9)
  %20 = call i32 @churn()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %k.addr.1, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %26 = load i32, i32* %k.addr.1, align 4
  %27 = trunc i64 %23 to i32
  %28 = icmp slt i32 %26, %27
  br i1 %28, label %for.body.1, label %for.end.1

for.body.1:
  %29 = load i32, i32* %t.addr, align 4
  %30 = load i32, i32* %k.addr.1, align 4
  %31 = sext i32 %30 to i64
  %32 = bitcast i8* %25 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %31
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %36, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %38 = load i32, i32* %k.addr.1, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %40 = load i32, i32* %t.addr, align 4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  ret i8* %41

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %t.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %r.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %struct.nish_array*], align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %k.addr.1 = alloca i32, align 4
  %m.addr = alloca %struct.Map$i32$arr.i32*, align 8
  %k.addr.2 = alloca i32, align 4
  %list.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %k.addr.3 = alloca i32, align 4
  %h2.addr = alloca %struct.Holder*, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %k.addr.4 = alloca i32, align 4
  %h3.addr = alloca %struct.Holder*, align 8
  %Holder.obj.2 = alloca %struct.Holder, align 8
  %k.addr.5 = alloca i32, align 4
  %h4.addr = alloca %struct.Holder*, align 8
  %Holder.obj.3 = alloca %struct.Holder, align 8
  %acc.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj = alloca %struct.AtomicI32, align 8
  %k.addr.6 = alloca i32, align 4
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %k.addr.7 = alloca i32, align 4
  %h5.addr = alloca %struct.Holder*, align 8
  %Holder.obj.4 = alloca %struct.Holder, align 8
  %k.addr.8 = alloca i32, align 4
  %h6.addr = alloca %struct.Holder*, align 8
  %Holder.obj.5 = alloca %struct.Holder, align 8
  %k.addr.9 = alloca i32, align 4
  %k.addr.10 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 37, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 5000, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %7 = load i64, i64* %forof.idx, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %forof.body, label %forof.end

forof.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %15, i32* %n.addr, align 4
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %16 = load i32, i32* %k.addr, align 4
  %17 = icmp slt i32 %16, 3
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %t.addr, align 4
  %19 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %20 = load i32, i32* %n.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @intoField(%struct.Holder* %19, i32 %20, i32 %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = srem i32 %24, 1000003
  store i32 %26, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %27 = load i32, i32* %k.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %29 = call i32 @churn()
  %30 = load i32, i32* %t.addr, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %34 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %35 = getelementptr inbounds %struct.Holder, %struct.Holder* %34, i32 0, i32 0
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !19
  %37 = call i32 @sum$(%struct.nish_array* %36)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %33, i8* %38)
  call void @nish_print(i8* %39)
  %40 = load i32, i32* %n.addr, align 4
  %41 = call %struct.nish_array* @returned(i32 %40, i32 1)
  %42 = load i32, i32* %n.addr, align 4
  %43 = call %struct.nish_array* @returned(i32 %42, i32 2)
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = bitcast [2 x %struct.nish_array*]* %arr.data.1 to i8*
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %46, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %46 to %struct.nish_array**
  %49 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %48, i64 0
  store %struct.nish_array* %41, %struct.nish_array** %49, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %48, i64 1
  store %struct.nish_array* %43, %struct.nish_array** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %r.addr, align 8
  %51 = call i32 @churn()
  %52 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to %struct.nish_array**
  %59 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %58, i64 0
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = call i32 @sum$(%struct.nish_array* %60)
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %62)
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %65 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = icmp ult i64 1, %67
  br i1 %68, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %67)
  unreachable

bounds.ok.1:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = bitcast i8* %70 to %struct.nish_array**
  %72 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %71, i64 1
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %74 = call i32 @sum$(%struct.nish_array* %73)
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %64, i8* %75)
  call void @nish_print(i8* %76)
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %k.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %80 = load i32, i32* %k.addr.1, align 4
  %81 = icmp slt i32 %80, 3
  br i1 %81, label %for.body.1, label %for.end.1

for.body.1:
  %82 = load i32, i32* %t.addr, align 4
  %83 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %84 = load i32, i32* %n.addr, align 4
  %85 = load i32, i32* %k.addr.1, align 4
  %86 = call i32 @pushed(%struct.nish_array* %83, i32 %84, i32 %85)
  %87 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 %86)
  %88 = extractvalue { i32, i1 } %87, 0
  %89 = extractvalue { i32, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %90 = srem i32 %88, 1000003
  store i32 %90, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %91 = load i32, i32* %k.addr.1, align 4
  %92 = add nsw i32 %91, 1
  store i32 %92, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %93 = call i32 @churn()
  %94 = load i32, i32* %t.addr, align 4
  %95 = call i8* @nish_str_from_i32(i32 %94)
  %96 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8* %95)
  %97 = call i8* @nish_str_concat(i8* %96, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %98 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp ult i64 0, %100
  br i1 %101, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %100)
  unreachable

bounds.ok.2:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %104 = bitcast i8* %103 to %struct.nish_array**
  %105 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %104, i64 0
  %106 = load %struct.nish_array*, %struct.nish_array** %105, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %107 = call i32 @sum$(%struct.nish_array* %106)
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %97, i8* %108)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %111 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = icmp ult i64 2, %113
  br i1 %114, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %113)
  unreachable

bounds.ok.3:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %117 = bitcast i8* %116 to %struct.nish_array**
  %118 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %117, i64 2
  %119 = load %struct.nish_array*, %struct.nish_array** %118, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %120 = call i32 @sum$(%struct.nish_array* %119)
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %110, i8* %121)
  call void @nish_print(i8* %122)
  %123 = call i8* @nish_alloc_struct(i64 56)
  %124 = bitcast i8* %123 to %struct.Map$i32$arr.i32*
  call void @nish.Map$i32$arr.i32.constructor(%struct.Map$i32$arr.i32* %124)
  store %struct.Map$i32$arr.i32* %124, %struct.Map$i32$arr.i32** %m.addr, align 8
  store i32 0, i32* %k.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %125 = load i32, i32* %k.addr.2, align 4
  %126 = icmp slt i32 %125, 3
  br i1 %126, label %for.body.2, label %for.end.2

for.body.2:
  %127 = load i32, i32* %t.addr, align 4
  %128 = load %struct.Map$i32$arr.i32*, %struct.Map$i32$arr.i32** %m.addr, align 8
  %129 = load i32, i32* %n.addr, align 4
  %130 = load i32, i32* %k.addr.2, align 4
  %131 = call i32 @mapped(%struct.Map$i32$arr.i32* %128, i32 %129, i32 %130)
  %132 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %127, i32 %131)
  %133 = extractvalue { i32, i1 } %132, 0
  %134 = extractvalue { i32, i1 } %132, 1
  br i1 %134, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %135 = srem i32 %133, 1000003
  store i32 %135, i32* %t.addr, align 4
  br label %for.inc.2

for.inc.2:
  %136 = load i32, i32* %k.addr.2, align 4
  %137 = add nsw i32 %136, 1
  store i32 %137, i32* %k.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %138 = call i32 @churn()
  %139 = load %struct.Map$i32$arr.i32*, %struct.Map$i32$arr.i32** %m.addr, align 8
  %140 = call i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* %139, i32 2)
  %141 = icmp sge i64 %140, 0
  br i1 %141, label %get.found, label %get.end

get.found:
  %142 = trunc i64 %140 to i32
  %143 = call %struct.nish_array* @nish.Map$i32$arr.i32.valueAt(%struct.Map$i32$arr.i32* %139, i32 %142, %struct.nish_array* zeroinitializer)
  br label %get.end

get.end:
  %144 = phi %struct.nish_array* [ %143, %get.found ], [ null, %for.end.2 ]
  %145 = load i32, i32* %t.addr, align 4
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %149 = xor i1 %141, true
  br i1 %149, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %150 = call i32 @sum$(%struct.nish_array* %144)
  br label %cond.end

cond.end:
  %151 = phi i32 [ -1, %cond.true ], [ %150, %cond.false ]
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %148, i8* %152)
  call void @nish_print(i8* %153)
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %list.addr, align 8
  store i32 0, i32* %k.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %157 = load i32, i32* %k.addr.3, align 4
  %158 = icmp slt i32 %157, 3
  br i1 %158, label %for.body.3, label %for.end.3

for.body.3:
  %159 = load i32, i32* %t.addr, align 4
  %160 = load %struct.nish_array*, %struct.nish_array** %list.addr, align 8
  %161 = load i32, i32* %n.addr, align 4
  %162 = load i32, i32* %k.addr.3, align 4
  %163 = call i32 @registered(%struct.nish_array* %160, i32 %161, i32 %162)
  %164 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %159, i32 %163)
  %165 = extractvalue { i32, i1 } %164, 0
  %166 = extractvalue { i32, i1 } %164, 1
  br i1 %166, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %167 = srem i32 %165, 1000003
  store i32 %167, i32* %t.addr, align 4
  br label %for.inc.3

for.inc.3:
  %168 = load i32, i32* %k.addr.3, align 4
  %169 = add nsw i32 %168, 1
  store i32 %169, i32* %k.addr.3, align 4
  br label %for.cond.3

for.end.3:
  %170 = call i32 @churn()
  %171 = load i32, i32* %t.addr, align 4
  %172 = call i8* @nish_str_from_i32(i32 %171)
  %173 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %172)
  %174 = call i8* @nish_str_concat(i8* %173, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %175 = load %struct.nish_array*, %struct.nish_array** %list.addr, align 8
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = icmp ult i64 0, %177
  br i1 %178, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %177)
  unreachable

bounds.ok.4:
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %181 = bitcast i8* %180 to %struct.Reg**
  %182 = getelementptr inbounds %struct.Reg*, %struct.Reg** %181, i64 0
  %183 = load %struct.Reg*, %struct.Reg** %182, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %184 = getelementptr inbounds %struct.Reg, %struct.Reg* %183, i32 0, i32 0
  %185 = load %struct.nish_array*, %struct.nish_array** %184, align 8, !tbaa !21
  %186 = call i32 @sum$(%struct.nish_array* %185)
  %187 = call i8* @nish_str_from_i32(i32 %186)
  %188 = call i8* @nish_str_concat(i8* %174, i8* %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %190 = load %struct.nish_array*, %struct.nish_array** %list.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  %192 = load i64, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = icmp ult i64 2, %192
  br i1 %193, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %192)
  unreachable

bounds.ok.5:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = bitcast i8* %195 to %struct.Reg**
  %197 = getelementptr inbounds %struct.Reg*, %struct.Reg** %196, i64 2
  %198 = load %struct.Reg*, %struct.Reg** %197, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %199 = getelementptr inbounds %struct.Reg, %struct.Reg* %198, i32 0, i32 0
  %200 = load %struct.nish_array*, %struct.nish_array** %199, align 8, !tbaa !21
  %201 = call i32 @sum$(%struct.nish_array* %200)
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* %189, i8* %202)
  call void @nish_print(i8* %203)
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1)
  store %struct.Holder* %Holder.obj.1, %struct.Holder** %h2.addr, align 8
  store i32 0, i32* %k.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %204 = load i32, i32* %k.addr.4, align 4
  %205 = icmp slt i32 %204, 3
  br i1 %205, label %for.body.4, label %for.end.4

for.body.4:
  %206 = load i32, i32* %t.addr, align 4
  %207 = load %struct.Holder*, %struct.Holder** %h2.addr, align 8
  %208 = load i32, i32* %n.addr, align 4
  %209 = load i32, i32* %k.addr.4, align 4
  %210 = call i32 @relayed(%struct.Holder* %207, i32 %208, i32 %209)
  %211 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %206, i32 %210)
  %212 = extractvalue { i32, i1 } %211, 0
  %213 = extractvalue { i32, i1 } %211, 1
  br i1 %213, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %214 = srem i32 %212, 1000003
  store i32 %214, i32* %t.addr, align 4
  br label %for.inc.4

for.inc.4:
  %215 = load i32, i32* %k.addr.4, align 4
  %216 = add nsw i32 %215, 1
  store i32 %216, i32* %k.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %217 = call i32 @churn()
  %218 = load i32, i32* %t.addr, align 4
  %219 = call i8* @nish_str_from_i32(i32 %218)
  %220 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*), i8* %219)
  %221 = call i8* @nish_str_concat(i8* %220, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %222 = load %struct.Holder*, %struct.Holder** %h2.addr, align 8
  %223 = getelementptr inbounds %struct.Holder, %struct.Holder* %222, i32 0, i32 0
  %224 = load %struct.nish_array*, %struct.nish_array** %223, align 8, !tbaa !19
  %225 = call i32 @sum$(%struct.nish_array* %224)
  %226 = call i8* @nish_str_from_i32(i32 %225)
  %227 = call i8* @nish_str_concat(i8* %221, i8* %226)
  call void @nish_print(i8* %227)
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2)
  store %struct.Holder* %Holder.obj.2, %struct.Holder** %h3.addr, align 8
  store i32 0, i32* %k.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %228 = load i32, i32* %k.addr.5, align 4
  %229 = icmp slt i32 %228, 3
  br i1 %229, label %for.body.5, label %for.end.5

for.body.5:
  %230 = load i32, i32* %t.addr, align 4
  %231 = load %struct.Holder*, %struct.Holder** %h3.addr, align 8
  %232 = load i32, i32* %n.addr, align 4
  %233 = load i32, i32* %k.addr.5, align 4
  %234 = call i32 @answered(%struct.Holder* %231, i32 %232, i32 %233)
  %235 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %230, i32 %234)
  %236 = extractvalue { i32, i1 } %235, 0
  %237 = extractvalue { i32, i1 } %235, 1
  br i1 %237, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %238 = srem i32 %236, 1000003
  store i32 %238, i32* %t.addr, align 4
  br label %for.inc.5

for.inc.5:
  %239 = load i32, i32* %k.addr.5, align 4
  %240 = add nsw i32 %239, 1
  store i32 %240, i32* %k.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %241 = call i32 @churn()
  %242 = load i32, i32* %t.addr, align 4
  %243 = call i8* @nish_str_from_i32(i32 %242)
  %244 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i8* %243)
  %245 = call i8* @nish_str_concat(i8* %244, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %246 = load %struct.Holder*, %struct.Holder** %h3.addr, align 8
  %247 = getelementptr inbounds %struct.Holder, %struct.Holder* %246, i32 0, i32 0
  %248 = load %struct.nish_array*, %struct.nish_array** %247, align 8, !tbaa !19
  %249 = call i32 @sum$(%struct.nish_array* %248)
  %250 = call i8* @nish_str_from_i32(i32 %249)
  %251 = call i8* @nish_str_concat(i8* %245, i8* %250)
  call void @nish_print(i8* %251)
  call void @Holder.constructor(%struct.Holder* %Holder.obj.3)
  store %struct.Holder* %Holder.obj.3, %struct.Holder** %h4.addr, align 8
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj, i32 0)
  store %struct.AtomicI32* %AtomicI32.obj, %struct.AtomicI32** %acc.addr, align 8
  store i32 0, i32* %k.addr.6, align 4
  br label %for.cond.6

for.cond.6:
  %252 = load i32, i32* %k.addr.6, align 4
  %253 = icmp slt i32 %252, 3
  br i1 %253, label %for.body.6, label %for.end.6

for.body.6:
  %254 = load i32, i32* %t.addr, align 4
  %255 = load %struct.Holder*, %struct.Holder** %h4.addr, align 8
  %256 = load %struct.AtomicI32*, %struct.AtomicI32** %acc.addr, align 8
  %257 = load i32, i32* %n.addr, align 4
  %258 = load i32, i32* %k.addr.6, align 4
  %259 = call i32 @captured(%struct.Holder* %255, %struct.AtomicI32* %256, i32 %257, i32 %258)
  %260 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %254, i32 %259)
  %261 = extractvalue { i32, i1 } %260, 0
  %262 = extractvalue { i32, i1 } %260, 1
  br i1 %262, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %263 = srem i32 %261, 1000003
  store i32 %263, i32* %t.addr, align 4
  br label %for.inc.6

for.inc.6:
  %264 = load i32, i32* %k.addr.6, align 4
  %265 = add nsw i32 %264, 1
  store i32 %265, i32* %k.addr.6, align 4
  br label %for.cond.6

for.end.6:
  %266 = call i32 @churn()
  %267 = load i32, i32* %t.addr, align 4
  %268 = call i8* @nish_str_from_i32(i32 %267)
  %269 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), i8* %268)
  %270 = call i8* @nish_str_concat(i8* %269, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %271 = load %struct.AtomicI32*, %struct.AtomicI32** %acc.addr, align 8
  %272 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %271)
  %273 = call i8* @nish_str_from_i32(i32 %272)
  %274 = call i8* @nish_str_concat(i8* %270, i8* %273)
  %275 = call i8* @nish_str_concat(i8* %274, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %276 = load %struct.Holder*, %struct.Holder** %h4.addr, align 8
  %277 = getelementptr inbounds %struct.Holder, %struct.Holder* %276, i32 0, i32 0
  %278 = load %struct.nish_array*, %struct.nish_array** %277, align 8, !tbaa !19
  %279 = call i32 @sum$(%struct.nish_array* %278)
  %280 = call i8* @nish_str_from_i32(i32 %279)
  %281 = call i8* @nish_str_concat(i8* %275, i8* %280)
  call void @nish_print(i8* %281)
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 0, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %283 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 0, i64* %283, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* null, i8** %284, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %boxes.addr, align 8
  store i32 0, i32* %k.addr.7, align 4
  br label %for.cond.7

for.cond.7:
  %285 = load i32, i32* %k.addr.7, align 4
  %286 = icmp slt i32 %285, 3
  br i1 %286, label %for.body.7, label %for.end.7

for.body.7:
  %287 = load i32, i32* %t.addr, align 4
  %288 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %289 = load i32, i32* %n.addr, align 4
  %290 = load i32, i32* %k.addr.7, align 4
  %291 = call i32 @boxed(%struct.nish_array* %288, i32 %289, i32 %290)
  %292 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %287, i32 %291)
  %293 = extractvalue { i32, i1 } %292, 0
  %294 = extractvalue { i32, i1 } %292, 1
  br i1 %294, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %295 = srem i32 %293, 1000003
  store i32 %295, i32* %t.addr, align 4
  br label %for.inc.7

for.inc.7:
  %296 = load i32, i32* %k.addr.7, align 4
  %297 = add nsw i32 %296, 1
  store i32 %297, i32* %k.addr.7, align 4
  br label %for.cond.7

for.end.7:
  %298 = call i32 @churn()
  %299 = load i32, i32* %t.addr, align 4
  %300 = call i8* @nish_str_from_i32(i32 %299)
  %301 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), i8* %300)
  %302 = call i8* @nish_str_concat(i8* %301, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %303 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %304 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %303, i64 0, i32 0
  %305 = load i64, i64* %304, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %306 = icmp ult i64 0, %305
  br i1 %306, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %305)
  unreachable

bounds.ok.6:
  %307 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %303, i64 0, i32 2
  %308 = load i8*, i8** %307, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %309 = bitcast i8* %308 to %struct.Box**
  %310 = getelementptr inbounds %struct.Box*, %struct.Box** %309, i64 0
  %311 = load %struct.Box*, %struct.Box** %310, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %312 = getelementptr inbounds %struct.Box, %struct.Box* %311, i32 0, i32 0
  %313 = load %struct.nish_array*, %struct.nish_array** %312, align 8, !tbaa !23
  %314 = call i32 @sum$(%struct.nish_array* %313)
  %315 = call i8* @nish_str_from_i32(i32 %314)
  %316 = call i8* @nish_str_concat(i8* %302, i8* %315)
  %317 = call i8* @nish_str_concat(i8* %316, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %318 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %319 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %318, i64 0, i32 0
  %320 = load i64, i64* %319, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %321 = icmp ult i64 2, %320
  br i1 %321, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 2, i64 %320)
  unreachable

bounds.ok.7:
  %322 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %318, i64 0, i32 2
  %323 = load i8*, i8** %322, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %324 = bitcast i8* %323 to %struct.Box**
  %325 = getelementptr inbounds %struct.Box*, %struct.Box** %324, i64 2
  %326 = load %struct.Box*, %struct.Box** %325, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %327 = getelementptr inbounds %struct.Box, %struct.Box* %326, i32 0, i32 0
  %328 = load %struct.nish_array*, %struct.nish_array** %327, align 8, !tbaa !23
  %329 = call i32 @sum$(%struct.nish_array* %328)
  %330 = call i8* @nish_str_from_i32(i32 %329)
  %331 = call i8* @nish_str_concat(i8* %317, i8* %330)
  call void @nish_print(i8* %331)
  call void @Holder.constructor(%struct.Holder* %Holder.obj.4)
  store %struct.Holder* %Holder.obj.4, %struct.Holder** %h5.addr, align 8
  store i32 0, i32* %k.addr.8, align 4
  br label %for.cond.8

for.cond.8:
  %332 = load i32, i32* %k.addr.8, align 4
  %333 = icmp slt i32 %332, 3
  br i1 %333, label %for.body.8, label %for.end.8

for.body.8:
  %334 = load i32, i32* %t.addr, align 4
  %335 = load %struct.Holder*, %struct.Holder** %h5.addr, align 8
  %336 = load i32, i32* %n.addr, align 4
  %337 = load i32, i32* %k.addr.8, align 4
  %338 = call i32 @second(%struct.Holder* %335, i32 %336, i32 %337)
  %339 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %334, i32 %338)
  %340 = extractvalue { i32, i1 } %339, 0
  %341 = extractvalue { i32, i1 } %339, 1
  br i1 %341, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %342 = srem i32 %340, 1000003
  store i32 %342, i32* %t.addr, align 4
  br label %for.inc.8

for.inc.8:
  %343 = load i32, i32* %k.addr.8, align 4
  %344 = add nsw i32 %343, 1
  store i32 %344, i32* %k.addr.8, align 4
  br label %for.cond.8

for.end.8:
  %345 = call i32 @churn()
  %346 = load i32, i32* %t.addr, align 4
  %347 = call i8* @nish_str_from_i32(i32 %346)
  %348 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.12 to i8*), i8* %347)
  %349 = call i8* @nish_str_concat(i8* %348, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %350 = load %struct.Holder*, %struct.Holder** %h5.addr, align 8
  %351 = getelementptr inbounds %struct.Holder, %struct.Holder* %350, i32 0, i32 0
  %352 = load %struct.nish_array*, %struct.nish_array** %351, align 8, !tbaa !19
  %353 = call i32 @sum$(%struct.nish_array* %352)
  %354 = call i8* @nish_str_from_i32(i32 %353)
  %355 = call i8* @nish_str_concat(i8* %349, i8* %354)
  call void @nish_print(i8* %355)
  call void @Holder.constructor(%struct.Holder* %Holder.obj.5)
  store %struct.Holder* %Holder.obj.5, %struct.Holder** %h6.addr, align 8
  store i32 0, i32* %k.addr.9, align 4
  br label %for.cond.9

for.cond.9:
  %356 = load i32, i32* %k.addr.9, align 4
  %357 = icmp slt i32 %356, 3
  br i1 %357, label %for.body.9, label %for.end.9

for.body.9:
  %358 = load i32, i32* %t.addr, align 4
  %359 = load %struct.Holder*, %struct.Holder** %h6.addr, align 8
  %360 = load i32, i32* %n.addr, align 4
  %361 = load i32, i32* %k.addr.9, align 4
  %362 = call i32 @aliased(%struct.Holder* %359, i32 %360, i32 %361)
  %363 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %358, i32 %362)
  %364 = extractvalue { i32, i1 } %363, 0
  %365 = extractvalue { i32, i1 } %363, 1
  br i1 %365, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %366 = srem i32 %364, 1000003
  store i32 %366, i32* %t.addr, align 4
  br label %for.inc.9

for.inc.9:
  %367 = load i32, i32* %k.addr.9, align 4
  %368 = add nsw i32 %367, 1
  store i32 %368, i32* %k.addr.9, align 4
  br label %for.cond.9

for.end.9:
  %369 = call i32 @churn()
  %370 = load i32, i32* %t.addr, align 4
  %371 = call i8* @nish_str_from_i32(i32 %370)
  %372 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.13 to i8*), i8* %371)
  %373 = call i8* @nish_str_concat(i8* %372, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %374 = load %struct.Holder*, %struct.Holder** %h6.addr, align 8
  %375 = getelementptr inbounds %struct.Holder, %struct.Holder* %374, i32 0, i32 0
  %376 = load %struct.nish_array*, %struct.nish_array** %375, align 8, !tbaa !19
  %377 = call i32 @sum$(%struct.nish_array* %376)
  %378 = call i8* @nish_str_from_i32(i32 %377)
  %379 = call i8* @nish_str_concat(i8* %373, i8* %378)
  call void @nish_print(i8* %379)
  store i32 0, i32* %k.addr.10, align 4
  br label %for.cond.10

for.cond.10:
  %380 = load i32, i32* %k.addr.10, align 4
  %381 = icmp slt i32 %380, 3
  br i1 %381, label %for.body.10, label %for.end.10

for.body.10:
  %382 = load i32, i32* %t.addr, align 4
  %383 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %382, i32 31)
  %384 = extractvalue { i32, i1 } %383, 0
  %385 = extractvalue { i32, i1 } %383, 1
  br i1 %385, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %386 = load i32, i32* %n.addr, align 4
  %387 = load i32, i32* %k.addr.10, align 4
  %388 = call i32 @ordered(i32 %386, i32 %387)
  %389 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %384, i32 %388)
  %390 = extractvalue { i32, i1 } %389, 0
  %391 = extractvalue { i32, i1 } %389, 1
  br i1 %391, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  %392 = srem i32 %390, 1000003
  store i32 %392, i32* %t.addr, align 4
  br label %for.inc.10

for.inc.10:
  %393 = load i32, i32* %k.addr.10, align 4
  %394 = add nsw i32 %393, 1
  store i32 %394, i32* %k.addr.10, align 4
  br label %for.cond.10

for.end.10:
  %395 = call i32 @churn()
  %396 = load i32, i32* %t.addr, align 4
  %397 = call i8* @nish_str_from_i32(i32 %396)
  %398 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.14 to i8*), i8* %397)
  call void @nish_print(i8* %398)
  %399 = load i32, i32* %n.addr, align 4
  %400 = call i64 @nish_arena_mark()
  %401 = call i8* @passes(i32 %399)
  %402 = call i8* @nish_arena_keep(i64 %400, i8* %401)
  %403 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.15 to i8*), i8* %402)
  call void @nish_print(i8* %403)
  br label %forof.inc

forof.inc:
  %404 = load i64, i64* %forof.idx, align 8
  %405 = add i64 %404, 1
  store i64 %405, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %for.body.1 ], [ 0, %for.body.2 ], [ 0, %for.body.3 ], [ 0, %for.body.4 ], [ 0, %for.body.5 ], [ 0, %for.body.6 ], [ 0, %for.body.7 ], [ 0, %for.body.8 ], [ 0, %for.body.9 ], [ 2, %for.body.10 ], [ 0, %ovf.ok.10 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden void @captured$arrow0(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %acc, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %0 = call i32 @sum$(%struct.nish_array* %ys)
  %1 = call i32 @nish.AtomicI32.add(%struct.AtomicI32* %acc, i32 %0)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
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
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %b.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %b.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %6 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add i32 %24, 1
  %26 = load i32, i32* %low.addr, align 4
  %27 = and i32 %25, %26
  store i32 %27, i32* %bucket.addr, align 4
  %28 = load i32, i32* %bucket.addr, align 4
  store i32 %28, i32* %b.addr, align 4
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
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = icmp sgt i32 %38, 0
  br label %land.end.2

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = sub i64 %42, 1
  store i64 %43, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %9, 32768
  br label %land.end

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = mul nsw i32 %12, 2
  %14 = trunc i32 %13 to i16
  %15 = zext i16 %14 to i64
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %15, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %15, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = mul i64 %15, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %17

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #1 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %times
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 0, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc.1

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
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
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %size.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = mul nsw i64 %7, 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = mul nsw i64 %10, 3
  %12 = icmp sgt i64 %8, %11
  br i1 %12, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4
  %16 = icmp sge i32 %bucket, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %18 = load i32, i32* %used.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = sext i32 %bucket to i64
  %21 = load i32, i32* %used.addr, align 4
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %23
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = load i32, i32* %used.addr, align 4
  %30 = sub nsw i32 %29, 1
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %20
  store i32 %31, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$i32$arr.i32.constructor(%struct.Map$i32$arr.i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !26
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !27
  %2 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !28
  %3 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !29
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !30
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !31
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !32
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !33
  ret void
}

define internal noundef i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !30
  %2 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !27
  %4 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !33
  %6 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !31
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$arr.i32* @nish.Map$i32$arr.i32.set(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$arr.i32.probe(%struct.Map$i32$arr.i32* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i32$arr.i32.setValueAt(%struct.Map$i32$arr.i32* %this, i32 %4, %struct.nish_array* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i32$arr.i32.insertAt(%struct.Map$i32$arr.i32* %this, i64 %5, i32 %key, %struct.nish_array* %value)
  br label %if.end

if.end:
  ret %struct.Map$i32$arr.i32* %this
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.Map$i32$arr.i32.valueAt(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !32
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.nish_array**
  %14 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %13, i64 %10
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %15

if.end:
  ret %struct.nish_array* %none
}

define internal void @nish.Map$i32$arr.i32.setValueAt(%struct.Map$i32$arr.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #1 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !32
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.nish_array**
  %14 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %13, i64 %10
  store %struct.nish_array* %value, %struct.nish_array** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$arr.i32.insertAt(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !31
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %key, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !32
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to %struct.nish_array**
  %24 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %23, i64 %17
  store %struct.nish_array* %value, %struct.nish_array** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !33
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = trunc i64 %40 to i32
  call void @nish.Map$i32$arr.i32.addOne(%struct.Map$i32$arr.i32* %this)
  %42 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !30
  %44 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !27
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !33
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$i32$arr.i32.rebuild(%struct.Map$i32$arr.i32* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$arr.i32.addOne(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !28
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !28
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !26
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !26
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$i32$arr.i32.rebuild(%struct.Map$i32$arr.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !31
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !29
  %7 = icmp ugt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !30
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !28
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
  %19 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !28
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !31
  %26 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !33
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !32
  %30 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !33
  call void @nish.compactEntries$arr.i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !33
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !30
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !27
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$arr.i32, %struct.Map$i32$arr.i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !33
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
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
  store i32 %mask, i32* %low.addr, align 4
  %9 = load i32, i32* %h.addr, align 4
  %10 = load i32, i32* %low.addr, align 4
  %11 = xor i32 %10, -1
  %12 = and i32 %9, %11
  store i32 %12, i32* %fingerprint.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = call i32 @nish.homeBucket(i32 %13, i32 %mask)
  store i32 %14, i32* %bucket.addr, align 4
  %15 = load i32, i32* %bucket.addr, align 4
  store i32 %15, i32* %b.addr, align 4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %28 = load i32, i32* %b.addr, align 4
  %29 = icmp sge i32 %28, 0
  br i1 %29, label %land.rhs, label %land.end

land.rhs:
  %30 = load i32, i32* %b.addr, align 4
  %31 = trunc i64 %17 to i32
  %32 = icmp slt i32 %30, %31
  br label %land.end

land.end:
  %33 = phi i1 [ false, %while.cond ], [ %32, %land.rhs ]
  br i1 %33, label %while.body, label %while.end

while.body:
  %34 = load i32, i32* %b.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %19 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %35
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %38, i32* %word.addr, align 4
  %39 = load i32, i32* %word.addr, align 4
  %40 = icmp eq i32 %39, 0
  br i1 %40, label %if.then, label %if.end

if.then:
  %41 = load i32, i32* %b.addr, align 4
  %42 = load i32, i32* %h.addr, align 4
  %43 = tail call i64 @nish.absentAt(i32 %41, i32 %42)
  ret i64 %43

if.end:
  %44 = load i32, i32* %word.addr, align 4
  %45 = load i32, i32* %low.addr, align 4
  %46 = xor i32 %45, -1
  %47 = and i32 %44, %46
  %48 = load i32, i32* %fingerprint.addr, align 4
  %49 = icmp eq i32 %47, %48
  br i1 %49, label %if.then.1, label %if.end.1

if.then.1:
  %50 = load i32, i32* %word.addr, align 4
  %51 = load i32, i32* %low.addr, align 4
  %52 = and i32 %50, %51
  %53 = sub i32 %52, 1
  store i32 %53, i32* %at.addr, align 4
  %54 = load i32, i32* %at.addr, align 4
  %55 = icmp sge i32 %54, 0
  br i1 %55, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4
  %57 = trunc i64 %21 to i32
  %58 = icmp slt i32 %56, %57
  br label %land.end.4

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ]
  br i1 %59, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = bitcast i8* %23 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %61
  %64 = load i32, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %65 = load i32, i32* %h.addr, align 4
  %66 = icmp eq i32 %64, %65
  br label %land.end.3

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ]
  br i1 %67, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4
  %69 = trunc i64 %25 to i32
  %70 = icmp slt i32 %68, %69
  br label %land.end.2

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ]
  br i1 %71, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = bitcast i8* %27 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %73
  %76 = load i32, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %77 = icmp eq i32 %76, %key
  br label %land.end.1

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ]
  br i1 %78, label %if.then.2, label %if.end.2

if.then.2:
  %79 = load i32, i32* %b.addr, align 4
  %80 = load i32, i32* %at.addr, align 4
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80)
  ret i64 %81

if.end.2:
  br label %if.end.1

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = add i32 %82, 1
  %84 = load i32, i32* %low.addr, align 4
  %85 = and i32 %83, %84
  store i32 %85, i32* %bucket.addr, align 4
  %86 = load i32, i32* %bucket.addr, align 4
  store i32 %86, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = trunc i64 %88 to i32
  %90 = load i32, i32* %h.addr, align 4
  %91 = tail call i64 @nish.absentAt(i32 %89, i32 %90)
  ret i64 %91
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %60
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$arr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
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
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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
  %39 = bitcast i8* %10 to %struct.nish_array**
  %40 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %39, i64 %38
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = bitcast i8* %10 to %struct.nish_array**
  %43 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %42, i64 %36
  store %struct.nish_array* %41, %struct.nish_array** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to %struct.nish_array**
  %64 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %63, i64 %60
  %65 = load %struct.nish_array*, %struct.nish_array** %64, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!34, !35, !36, !37, !38}
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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"ptr", !6, i64 0}
!18 = !{!"Holder", !17, i64 0}
!19 = !{!18, !17, i64 0}
!20 = !{!"Reg", !17, i64 0}
!21 = !{!20, !17, i64 0}
!22 = !{!"Box", !17, i64 0}
!23 = !{!22, !17, i64 0}
!24 = !{!"i32", !6, i64 0}
!25 = !{!"Map$i32$arr.i32", !24, i64 0, !17, i64 8, !24, i64 16, !24, i64 20, !17, i64 24, !17, i64 32, !17, i64 40, !24, i64 48}
!26 = !{!25, !24, i64 0}
!27 = !{!25, !24, i64 16}
!28 = !{!25, !24, i64 20}
!29 = !{!25, !24, i64 48}
!30 = !{!25, !17, i64 8}
!31 = !{!25, !17, i64 24}
!32 = !{!25, !17, i64 32}
!33 = !{!25, !17, i64 40}
!34 = !{i32 8, !"cf-protection-branch", i32 1}
!35 = !{i32 8, !"cf-protection-return", i32 1}
!36 = !{i32 8, !"branch-target-enforcement", i32 1}
!37 = !{i32 8, !"sign-return-address", i32 1}
!38 = !{i32 4, !"probe-stack", !"inline-asm"}
