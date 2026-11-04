%struct.Session = type { i64, i32, { i64, i8* } }
%struct.Cache = type { %struct.Map$i64$rgn.$Session*, { i64, i8* }, i32, i32, i32 }
%struct.Map$i64$rgn.$Session = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"served \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"reused \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"last byte \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hits of 4: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hits of 0: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"sum \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.9 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@.str.10 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_region_new() #2
declare i8* @nish_region_enter(i64 noundef) #2
declare void @nish_region_leave(i64 noundef, i8*) #2
declare void @nish_region_free(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_div(i1 noundef zeroext) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.9 to i8*))
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

define internal void @Session.constructor(%struct.Session* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this, i64 noundef %id, i32 noundef %size) #0 {
entry:
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Session, %struct.Session* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Session, %struct.Session* %this, i32 0, i32 0
  store i64 %id, i64* %1, align 8, !tbaa !6
  %2 = sext i32 %size to i64
  %3 = icmp ule i64 %2, 2147483647
  br i1 %3, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %4 = call i8* @nish_alloc_struct(i64 %2)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 %2, i1 false), !alias.scope !11, !noalias !10
  %5 = getelementptr inbounds %struct.Session, %struct.Session* %this, i32 0, i32 2
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 0
  store i64 %2, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 1
  store i8* %4, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  store i32 0, i32* %k.addr, align 4
  %8 = getelementptr inbounds %struct.Session, %struct.Session* %this, i32 0, i32 2
  %9 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %8, i32 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %8, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %13 = load i32, i32* %k.addr, align 4
  %14 = icmp slt i32 %13, %size
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %k.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = load i32, i32* %k.addr, align 4
  %18 = add nsw i32 %17, 1
  %19 = trunc i32 %18 to i8
  %20 = icmp ult i64 %16, %10
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %10)
  unreachable

bounds.ok:
  %21 = bitcast i8* %12 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %16
  store i8 %19, i8* %22, align 1, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %23 = load i32, i32* %k.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @payloadSize(i64 noundef %id) #0 {
entry:
  %0 = srem i64 %id, 7
  %1 = trunc i64 %0 to i32
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 dereferenceable(32) %struct.Session* @open$(i64 noundef %id) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 32)
  %1 = bitcast i8* %0 to %struct.Session*
  %2 = getelementptr inbounds %struct.Session, %struct.Session* %1, i32 0, i32 2
  %3 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %2, i32 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %2, i32 0, i32 1
  store i8* null, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %5 = call i32 @payloadSize(i64 %id)
  call void @Session.constructor(%struct.Session* %1, i64 %id, i32 %5)
  ret %struct.Session* %1
}

define hidden noundef i32 @serve$(%struct.Session* noundef nonnull align 8 dereferenceable(32) nocapture %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #0 {
entry:
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Session, %struct.Session* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Session, %struct.Session* %s, i32 0, i32 1
  store i32 %3, i32* %5, align 4, !tbaa !5
  store i32 0, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.Session, %struct.Session* %s, i32 0, i32 2
  %7 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %6, i32 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %9 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %6, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  br label %for.cond

for.cond:
  %15 = load i32, i32* %k.addr, align 4
  %16 = trunc i64 %8 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %k.addr, align 4
  %19 = trunc i64 %12 to i32
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %for.cond ], [ %20, %land.rhs ]
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load i32, i32* %k.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %k.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %10 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 %25
  %28 = load i8, i8* %27, align 1, !alias.scope !11, !noalias !10, !tbaa !18
  %29 = bitcast i8* %14 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %23
  store i8 %28, i8* %30, align 1, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %31 = load i32, i32* %k.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %33 = getelementptr inbounds %struct.Session, %struct.Session* %s, i32 0, i32 2
  %34 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %33, i32 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %36 = trunc i64 %35 to i32
  ret i32 %36

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @hitsOf$(%struct.Session* noundef nonnull readonly align 8 dereferenceable(32) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Session, %struct.Session* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !5
  ret i32 %1
}

define internal void @Cache.constructor(%struct.Cache* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this, i32 noundef %live) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4, !tbaa !24
  %1 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 3
  store i32 0, i32* %1, align 4, !tbaa !25
  %2 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 4
  store i32 0, i32* %2, align 4, !tbaa !26
  %3 = call i8* @nish_alloc_struct(i64 56)
  %4 = bitcast i8* %3 to %struct.Map$i64$rgn.$Session*
  call void @nish.Map$i64$rgn.$Session.constructor(%struct.Map$i64$rgn.$Session* %4)
  %5 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  store %struct.Map$i64$rgn.$Session* %4, %struct.Map$i64$rgn.$Session** %5, align 8, !tbaa !27
  %6 = sext i32 %live to i64
  %7 = icmp ule i64 %6, 2147483647
  br i1 %7, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %8 = mul i64 %6, 8
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !11, !noalias !10
  %10 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 1
  %11 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %10, i32 0, i32 0
  store i64 %6, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %12 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %10, i32 0, i32 1
  store i8* %9, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret void
}

define internal noundef i32 @Cache.get(%struct.Cache* noundef nonnull align 8 dereferenceable(40) nocapture %this, i64 noundef %id, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #0 {
entry:
  %old.addr = alloca i64, align 8
  %r.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  %1 = load %struct.Map$i64$rgn.$Session*, %struct.Map$i64$rgn.$Session** %0, align 8, !tbaa !27
  %2 = call i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* %1, i64 %id)
  %3 = icmp sge i64 %2, 0
  br i1 %3, label %get.found, label %get.end

get.found:
  %4 = trunc i64 %2 to i32
  %5 = call i64 @nish.Map$i64$rgn.$Session.valueAt(%struct.Map$i64$rgn.$Session* %1, i32 %4)
  br label %get.end

get.end:
  %6 = phi i64 [ %5, %get.found ], [ 0, %entry ]
  br i1 %3, label %if.then, label %if.end

if.then:
  %7 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !26
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  %12 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 4
  store i32 %10, i32* %12, align 4, !tbaa !26
  %13 = call i32 @nish.enterWith$$Session$arr.u8$i32$fn.5.serve(i64 %6, %struct.nish_array* %out)
  ret i32 %13

if.end:
  %14 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 3
  %15 = load i32, i32* %14, align 4, !tbaa !25
  %16 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 1
  %17 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %16, i32 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = trunc i64 %18 to i32
  %20 = icmp eq i32 %15, %19
  br i1 %20, label %if.then.1, label %if.else

if.then.1:
  %21 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 1
  %22 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 2
  %23 = load i32, i32* %22, align 4, !tbaa !24
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %21, i32 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %21, i32 0, i32 1
  %29 = load i8*, i8** %28, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = bitcast i8* %29 to i64*
  %31 = getelementptr inbounds i64, i64* %30, i64 %24
  %32 = load i64, i64* %31, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  store i64 %32, i64* %old.addr, align 8
  %33 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  %34 = load %struct.Map$i64$rgn.$Session*, %struct.Map$i64$rgn.$Session** %33, align 8, !tbaa !27
  %35 = load i64, i64* %old.addr, align 8
  %36 = call i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* %34, i64 %35)
  %37 = icmp sge i64 %36, 0
  br i1 %37, label %get.found.1, label %get.end.1

get.found.1:
  %38 = trunc i64 %36 to i32
  %39 = call i64 @nish.Map$i64$rgn.$Session.valueAt(%struct.Map$i64$rgn.$Session* %34, i32 %38)
  br label %get.end.1

get.end.1:
  %40 = phi i64 [ %39, %get.found.1 ], [ 0, %bounds.ok ]
  br i1 %37, label %if.then.2, label %if.end.2

if.then.2:
  call void @nish.free$$Session(i64 %40)
  %41 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  %42 = load %struct.Map$i64$rgn.$Session*, %struct.Map$i64$rgn.$Session** %41, align 8, !tbaa !27
  %43 = load i64, i64* %old.addr, align 8
  %44 = call i1 @nish.Map$i64$rgn.$Session.delete(%struct.Map$i64$rgn.$Session* %42, i64 %43)
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.else:
  %45 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 3
  %46 = load i32, i32* %45, align 4, !tbaa !25
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 1)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %50 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 3
  store i32 %48, i32* %50, align 4, !tbaa !25
  br label %if.end.1

if.end.1:
  %51 = call i64 @nish.regionWith$i64$$Session$fn.4.open(i64 %id)
  store i64 %51, i64* %r.addr, align 8
  %52 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  %53 = load %struct.Map$i64$rgn.$Session*, %struct.Map$i64$rgn.$Session** %52, align 8, !tbaa !27
  %54 = load i64, i64* %r.addr, align 8
  %55 = call %struct.Map$i64$rgn.$Session* @nish.Map$i64$rgn.$Session.set(%struct.Map$i64$rgn.$Session* %53, i64 %id, i64 %54)
  %56 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 1
  %57 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 2
  %58 = load i32, i32* %57, align 4, !tbaa !24
  %59 = sext i32 %58 to i64
  %60 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %56, i32 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %62 = icmp ult i64 %59, %61
  br i1 %62, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %59, i64 %61)
  unreachable

bounds.ok.1:
  %63 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %56, i32 0, i32 1
  %64 = load i8*, i8** %63, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %65 = bitcast i8* %64 to i64*
  %66 = getelementptr inbounds i64, i64* %65, i64 %59
  store i64 %id, i64* %66, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %67 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 2
  %68 = load i32, i32* %67, align 4, !tbaa !24
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 1)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %72 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 1
  %73 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %72, i32 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %75 = trunc i64 %74 to i32
  %76 = icmp eq i32 %75, 0
  %77 = icmp eq i32 %70, -2147483648
  %78 = icmp eq i32 %75, -1
  %79 = and i1 %77, %78
  %80 = or i1 %76, %79
  br i1 %80, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %76)
  unreachable

div.ok:
  %81 = srem i32 %70, %75
  %82 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 2
  store i32 %81, i32* %82, align 4, !tbaa !24
  %83 = load i64, i64* %r.addr, align 8
  %84 = call i32 @nish.enterWith$$Session$arr.u8$i32$fn.5.serve(i64 %83, %struct.nish_array* %out)
  ret i32 %84

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @Cache.hits(%struct.Cache* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i64 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  %1 = load %struct.Map$i64$rgn.$Session*, %struct.Map$i64$rgn.$Session** %0, align 8, !tbaa !27
  %2 = call i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* %1, i64 %id)
  %3 = icmp sge i64 %2, 0
  br i1 %3, label %get.found, label %get.end

get.found:
  %4 = trunc i64 %2 to i32
  %5 = call i64 @nish.Map$i64$rgn.$Session.valueAt(%struct.Map$i64$rgn.$Session* %1, i32 %4)
  br label %get.end

get.end:
  %6 = phi i64 [ %5, %get.found ], [ 0, %entry ]
  %7 = xor i1 %3, true
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %8 = call i32 @nish.enter$$Session$i32$fn.6.hitsOf(i64 %6)
  br label %cond.end

cond.end:
  %9 = phi i32 [ -1, %cond.true ], [ %8, %cond.false ]
  ret i32 %9
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @build$() #2 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sle i32 %5, 10
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul nsw i32 %8, %9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %24
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %cache.addr = alloca %struct.Cache*, align 8
  %Cache.obj = alloca %struct.Cache, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %served.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  %id.addr = alloca i64, align 8
  %squares.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Cache, %struct.Cache* %Cache.obj, i32 0, i32 1
  %1 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  store i8* null, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  call void @Cache.constructor(%struct.Cache* %Cache.obj, i32 3)
  store %struct.Cache* %Cache.obj, %struct.Cache** %cache.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %5 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 8, i1 false), !alias.scope !11, !noalias !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %served.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %round.addr, align 4
  %8 = icmp slt i32 %7, 50
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %round.addr, align 4
  %10 = ashr i32 %9, 1
  %11 = srem i32 %10, 5
  %12 = sext i32 %11 to i64
  store i64 %12, i64* %id.addr, align 8
  %13 = load i32, i32* %served.addr, align 4
  %14 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %15 = load i64, i64* %id.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = call i32 @Cache.get(%struct.Cache* %14, i64 %15, %struct.nish_array* %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %served.addr, align 4
  br label %for.inc

for.inc:
  %21 = load i32, i32* %round.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %round.addr, align 4
  br label %for.cond

for.end:
  %23 = load i32, i32* %served.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %27 = getelementptr inbounds %struct.Cache, %struct.Cache* %26, i32 0, i32 4
  %28 = load i32, i32* %27, align 4, !tbaa !26
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %34 = icmp ult i64 0, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 0
  %39 = load i8, i8* %38, align 1, !alias.scope !11, !noalias !10, !tbaa !18
  %40 = zext i8 %39 to i64
  %41 = call i8* @nish_str_from_u64(i64 %40)
  %42 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.3 to i8*), i8* %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %44 = sext i32 4 to i64
  %45 = call i32 @Cache.hits(%struct.Cache* %43, i64 %44)
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.4 to i8*), i8* %46)
  call void @nish_print(i8* %47)
  %48 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %49 = sext i32 0 to i64
  %50 = call i32 @Cache.hits(%struct.Cache* %48, i64 %49)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.5 to i8*), i8* %51)
  call void @nish_print(i8* %52)
  %53 = call i64 @nish.region$arr.i32$fn.5.build()
  store i64 %53, i64* %squares.addr, align 8
  %54 = load i64, i64* %squares.addr, align 8
  %55 = call i32 @nish.enter$arr.i32$i32$fn.3.sum(i64 %54)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* %56)
  call void @nish_print(i8* %57)
  %58 = load i64, i64* %squares.addr, align 8
  call void @nish.free$arr.i32(i64 %58)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #0 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #0 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i32 @nish.enterWith$$Session$arr.u8$i32$fn.5.serve(i64 noundef %r, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %arg) #0 {
entry:
  %root.addr = alloca %struct.Session*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Session* @nish.reopen$$Session(i64 %r)
  store %struct.Session* %0, %struct.Session** %root.addr, align 8
  %1 = load %struct.Session*, %struct.Session** %root.addr, align 8
  %2 = call i32 @serve$(%struct.Session* %1, %struct.nish_array* %arg)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Session*, %struct.Session** %root.addr, align 8
  call void @nish.leave$$Session(i64 %r, %struct.Session* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Session(i64 noundef %_r) #0 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.regionWith$i64$$Session$fn.4.open(i64 noundef %arg) #0 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Session* @open$(i64 %arg)
  %4 = call i64 @nish.close$$Session(i64 %2, %struct.Session* %3)
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Session$i32$fn.6.hitsOf(i64 noundef %r) #0 {
entry:
  %root.addr = alloca %struct.Session*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Session* @nish.reopen$$Session(i64 %r)
  store %struct.Session* %0, %struct.Session** %root.addr, align 8
  %1 = load %struct.Session*, %struct.Session** %root.addr, align 8
  %2 = call i32 @hitsOf$(%struct.Session* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Session*, %struct.Session** %root.addr, align 8
  call void @nish.leave$$Session(i64 %r, %struct.Session* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal noundef i64 @nish.region$arr.i32$fn.5.build() #0 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.nish_array* @build$()
  %4 = call i64 @nish.close$arr.i32(i64 %2, %struct.nish_array* %3)
  ret i64 %4
}

define internal noundef i32 @nish.enter$arr.i32$i32$fn.3.sum(i64 noundef %r) #0 {
entry:
  %root.addr = alloca %struct.nish_array*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.reopen$arr.i32(i64 %r)
  store %struct.nish_array* %0, %struct.nish_array** %root.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %root.addr, align 8
  %2 = call i32 @sum$(%struct.nish_array* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.nish_array*, %struct.nish_array** %root.addr, align 8
  call void @nish.leave$arr.i32(i64 %r, %struct.nish_array* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$arr.i32(i64 noundef %_r) #0 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(32) %struct.Session* @nish.reopen$$Session(i64 noundef %r) #0 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Session*
  ret %struct.Session* %1
}

define internal void @nish.leave$$Session(i64 noundef %r, %struct.Session* noundef nonnull align 8 dereferenceable(32) %root) #0 {
entry:
  %0 = bitcast %struct.Session* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef i64 @nish.close$$Session(i64 noundef %h, %struct.Session* noundef nonnull align 8 dereferenceable(32) %root) #0 {
entry:
  %0 = bitcast %struct.Session* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef i64 @nish.close$arr.i32(i64 noundef %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %root) #0 {
entry:
  %0 = bitcast %struct.nish_array* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.reopen$arr.i32(i64 noundef %r) #0 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.nish_array*
  ret %struct.nish_array* %1
}

define internal void @nish.leave$arr.i32(i64 noundef %r, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %root) #0 {
entry:
  %0 = bitcast %struct.nish_array* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #3 {
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

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #3 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #3 {
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
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %16 = load i32, i32* %15, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %12 = load i32, i32* %11, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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
  store i32 %24, i32* %26, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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
  %32 = load i64, i64* %31, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !11, !noalias !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %15 = load i32, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #2 {
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
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !20
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
  %14 = load i8*, i8** %13, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  store i32 16777216, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  br label %if.end

if.end:
  %17 = load i32, i32* %at.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = load i32, i32* %at.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !20
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
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %26
  store i32 0, i32* %30, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  store i32 0, i32* %10, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !20
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
  %12 = load i8*, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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

define internal void @nish.Map$i64$rgn.$Session.constructor(%struct.Map$i64$rgn.$Session* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !34
  %1 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !35
  %2 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !36
  %3 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !37
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !11, !noalias !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %13 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !38
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %19 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !39
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %25 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !40
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %31 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !41
  ret void
}

define internal noundef i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i64 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !38
  %2 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !35
  %4 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !41
  %6 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !39
  %8 = call i64 @nish.probeTable$i64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i64 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i64$rgn.$Session* @nish.Map$i64$rgn.$Session.set(%struct.Map$i64$rgn.$Session* noundef nonnull align 8 dereferenceable(56) %this, i64 noundef %key, i64 noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i64$rgn.$Session.setValueAt(%struct.Map$i64$rgn.$Session* %this, i32 %4, i64 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i64$rgn.$Session.insertAt(%struct.Map$i64$rgn.$Session* %this, i64 %5, i64 %key, i64 %value)
  br label %if.end

if.end:
  ret %struct.Map$i64$rgn.$Session* %this
}

define internal noundef zeroext i1 @nish.Map$i64$rgn.$Session.delete(%struct.Map$i64$rgn.$Session* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i64$rgn.$Session.probe(%struct.Map$i64$rgn.$Session* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !38
  %5 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !41
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !36
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  store i32 %11, i32* %13, align 4, !tbaa !36
  %14 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !34
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 0
  store i32 %17, i32* %19, align 4, !tbaa !34
  ret i1 true

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$i64$rgn.$Session.valueAt(%struct.Map$i64$rgn.$Session* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !40
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.7 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !40
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %13 = bitcast i8* %12 to i64*
  %14 = getelementptr inbounds i64, i64* %13, i64 %10
  %15 = load i64, i64* %14, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  ret i64 %15
}

define internal void @nish.Map$i64$rgn.$Session.setValueAt(%struct.Map$i64$rgn.$Session* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i64 noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !40
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !40
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %13 = bitcast i8* %12 to i64*
  %14 = getelementptr inbounds i64, i64* %13, i64 %10
  store i64 %value, i64* %14, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i64$rgn.$Session.insertAt(%struct.Map$i64$rgn.$Session* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i64 noundef %key, i64 noundef %value) #0 {
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
  %6 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !39
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !36
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !37
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.8 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$i64$rgn.$Session.rebuild(%struct.Map$i64$rgn.$Session* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !39
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %28 = bitcast i8* %27 to i64*
  %29 = getelementptr inbounds i64, i64* %28, i64 %22
  store i64 %key, i64* %29, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !40
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %41 = bitcast i8* %40 to i64*
  %42 = getelementptr inbounds i64, i64* %41, i64 %35
  store i64 %value, i64* %42, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !41
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !10, !noalias !11, !tbaa !30
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !36
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !36
  %65 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !34
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !34
  %71 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !39
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !38
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i64$rgn.$Session.rebuild(%struct.Map$i64$rgn.$Session* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !38
  %91 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !35
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

define internal void @nish.Map$i64$rgn.$Session.rebuild(%struct.Map$i64$rgn.$Session* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !39
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !37
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !38
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !36
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
  %19 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !36
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !39
  %26 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !41
  call void @nish.compactEntries$i64(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !40
  %30 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !41
  call void @nish.compactEntries$rgn.$Session(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !41
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !38
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !35
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i64$rgn.$Session, %struct.Map$i64$rgn.$Session* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !41
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i64 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %2 = xor i64 %key, %0
  %3 = zext i64 %2 to i128
  %4 = zext i64 %1 to i128
  %5 = mul i128 %3, %4
  %6 = trunc i128 %5 to i64
  %7 = lshr i128 %5, 64
  %8 = trunc i128 %7 to i64
  %9 = xor i64 %6, %8
  %10 = lshr i64 %9, 32
  %11 = trunc i64 %10 to i32
  %12 = trunc i64 %9 to i32
  %13 = xor i32 %12, %11
  %14 = icmp eq i32 %13, 0
  %15 = select i1 %14, i32 1, i32 %13
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = lshr i32 %16, 24
  store i32 %17, i32* %fingerprint.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = call i32 @nish.homeBucket(i32 %18, i32 %mask)
  store i32 %19, i32* %bucket.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  br label %while.cond

while.cond:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %bucket.addr, align 4
  %35 = trunc i64 %21 to i32
  %36 = icmp slt i32 %34, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %23 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %39
  %42 = load i32, i32* %41, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  store i32 %42, i32* %word.addr, align 4
  %43 = load i32, i32* %word.addr, align 4
  %44 = icmp eq i32 %43, 0
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i32, i32* %bucket.addr, align 4
  %46 = load i32, i32* %h.addr, align 4
  %47 = tail call i64 @nish.absentAt(i32 %45, i32 %46)
  ret i64 %47

if.end:
  %48 = load i32, i32* %word.addr, align 4
  %49 = lshr i32 %48, 24
  %50 = load i32, i32* %fingerprint.addr, align 4
  %51 = icmp eq i32 %49, %50
  br i1 %51, label %if.then.1, label %if.end.1

if.then.1:
  %52 = load i32, i32* %word.addr, align 4
  %53 = and i32 %52, 16777215
  %54 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %55, i32* %at.addr, align 4
  %57 = load i32, i32* %at.addr, align 4
  %58 = icmp sge i32 %57, 0
  br i1 %58, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %59 = load i32, i32* %at.addr, align 4
  %60 = trunc i64 %25 to i32
  %61 = icmp slt i32 %59, %60
  br label %land.end.4

land.end.4:
  %62 = phi i1 [ false, %ovf.ok ], [ %61, %land.rhs.4 ]
  br i1 %62, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %63 = load i32, i32* %at.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %27 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 %64
  %67 = load i32, i32* %66, align 4, !alias.scope !11, !noalias !10, !tbaa !32
  %68 = load i32, i32* %h.addr, align 4
  %69 = icmp eq i32 %67, %68
  br label %land.end.3

land.end.3:
  %70 = phi i1 [ false, %land.end.4 ], [ %69, %land.rhs.3 ]
  br i1 %70, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %71 = load i32, i32* %at.addr, align 4
  %72 = trunc i64 %29 to i32
  %73 = icmp slt i32 %71, %72
  br label %land.end.2

land.end.2:
  %74 = phi i1 [ false, %land.end.3 ], [ %73, %land.rhs.2 ]
  br i1 %74, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = bitcast i8* %31 to i64*
  %78 = getelementptr inbounds i64, i64* %77, i64 %76
  %79 = load i64, i64* %78, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %80 = icmp eq i64 %79, %key
  br label %land.end.1

land.end.1:
  %81 = phi i1 [ false, %land.end.2 ], [ %80, %land.rhs.1 ]
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = load i32, i32* %at.addr, align 4
  %84 = tail call i64 @nish.foundAt(i32 %82, i32 %83)
  ret i64 %84

if.end.2:
  br label %if.end.1

if.end.1:
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = add nsw i32 %85, 1
  %87 = and i32 %86, %mask
  store i32 %87, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.10 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$i64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %22 = load i32, i32* %21, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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
  %39 = bitcast i8* %10 to i64*
  %40 = getelementptr inbounds i64, i64* %39, i64 %38
  %41 = load i64, i64* %40, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %42 = bitcast i8* %10 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 %36
  store i64 %41, i64* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !29
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
  %49 = load i64, i64* %48, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %59 = bitcast i8* %58 to i64*
  %60 = getelementptr inbounds i64, i64* %59, i64 %56
  %61 = load i64, i64* %60, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$rgn.$Session(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !21
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
  %22 = load i32, i32* %21, align 4, !alias.scope !11, !noalias !10, !tbaa !32
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
  %39 = bitcast i8* %10 to i64*
  %40 = getelementptr inbounds i64, i64* %39, i64 %38
  %41 = load i64, i64* %40, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %42 = bitcast i8* %10 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 %36
  store i64 %41, i64* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !29
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
  %49 = load i64, i64* %48, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !10, !noalias !11, !tbaa !20
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !10, !noalias !11, !tbaa !21
  %59 = bitcast i8* %58 to i64*
  %60 = getelementptr inbounds i64, i64* %59, i64 %56
  %61 = load i64, i64* %60, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!42, !43, !44, !45, !46}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i64", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Session", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array slice", !12, i64 0, !13, i64 8}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 8}
!17 = !{!"element i8", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!20 = !{!19, !12, i64 0}
!21 = !{!19, !13, i64 16}
!22 = !{!"ptr", !1, i64 0}
!23 = !{!"Cache", !22, i64 0, !3, i64 24, !3, i64 28, !3, i64 32}
!24 = !{!23, !3, i64 24}
!25 = !{!23, !3, i64 28}
!26 = !{!23, !3, i64 32}
!27 = !{!23, !22, i64 0}
!28 = !{!"element i64", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!19, !12, i64 8}
!31 = !{!"element i32", !1, i64 0}
!32 = !{!31, !31, i64 0}
!33 = !{!"Map$i64$rgn.$Session", !3, i64 0, !22, i64 8, !3, i64 16, !3, i64 20, !22, i64 24, !22, i64 32, !22, i64 40, !3, i64 48}
!34 = !{!33, !3, i64 0}
!35 = !{!33, !3, i64 16}
!36 = !{!33, !3, i64 20}
!37 = !{!33, !3, i64 48}
!38 = !{!33, !22, i64 8}
!39 = !{!33, !22, i64 24}
!40 = !{!33, !22, i64 32}
!41 = !{!33, !22, i64 40}
!42 = !{i32 8, !"cf-protection-branch", i32 1}
!43 = !{i32 8, !"cf-protection-return", i32 1}
!44 = !{i32 8, !"branch-target-enforcement", i32 1}
!45 = !{i32 8, !"sign-return-address", i32 1}
!46 = !{i32 4, !"probe-stack", !"inline-asm"}
