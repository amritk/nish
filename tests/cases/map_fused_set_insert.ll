%struct.Set$i32 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" fresh:\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*))
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

define internal noundef i32 @distinct(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %fresh.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %fresh.addr, align 4
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
  %9 = load i32, i32* %x.addr, align 4
  %10 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %s, i32 %9)
  %11 = icmp sge i64 %10, 0
  %12 = xor i1 %11, true
  br i1 %12, label %if.then, label %if.end

if.then:
  call void @nish.Set$i32.insertAt(%struct.Set$i32* %s, i64 %10, i32 %9)
  %13 = load i32, i32* %fresh.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %fresh.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %17 = load i64, i64* %forof.idx, align 8
  %18 = add i64 %17, 1
  store i64 %18, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %19 = load i32, i32* %fresh.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Set$i32*, align 8
  %fresh.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i32], align 8
  %listed.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %walk.idx = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Set$i32*
  call void @nish.Set$i32.constructor(%struct.Set$i32* %1)
  store %struct.Set$i32* %1, %struct.Set$i32** %s.addr, align 8
  %2 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %5 = bitcast [7 x i32]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 1, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %7, i64 2
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %7, i64 3
  store i32 9, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = getelementptr inbounds i32, i32* %7, i64 4
  store i32 1, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = getelementptr inbounds i32, i32* %7, i64 5
  store i32 1, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = getelementptr inbounds i32, i32* %7, i64 6
  store i32 7, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = call i32 @distinct(%struct.Set$i32* %2, %struct.nish_array* %arr.hdr)
  store i32 %15, i32* %fresh.addr, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %listed.addr, align 8
  %16 = load %struct.Set$i32*, %struct.Set$i32** %s.addr, align 8
  call void @nish.Set$i32.walkOpen(%struct.Set$i32* %16)
  %17 = call i32 @nish.Set$i32.walkNext(%struct.Set$i32* %16, i32 0)
  store i32 %17, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %18 = load i32, i32* %walk.idx, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %walk.body, label %walk.end

walk.body:
  %20 = call i32 @nish.Set$i32.keyAt(%struct.Set$i32* %16, i32 %18, i32 zeroinitializer)
  store i32 %20, i32* %x.addr, align 4
  %21 = load i8*, i8** %listed.addr, align 8
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %23 = load i32, i32* %x.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  store i8* %25, i8** %listed.addr, align 8
  br label %walk.inc

walk.inc:
  %26 = add i32 %18, 1
  %27 = call i32 @nish.Set$i32.walkNext(%struct.Set$i32* %16, i32 %26)
  store i32 %27, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Set$i32.walkClose(%struct.Set$i32* %16)
  %28 = load i32, i32* %fresh.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  %31 = load i8*, i8** %listed.addr, align 8
  %32 = call i8* @nish_str_concat(i8* %30, i8* %31)
  call void @nish_print(i8* %32)
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
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
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = sitofp i64 %4 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %b.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = icmp eq i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %b.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i32, i32* %word.addr, align 4
  %23 = bitcast i8* %6 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %21
  store i32 %22, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void

if.end:
  %25 = load i32, i32* %bucket.addr, align 4
  %26 = add i32 %25, 1
  %27 = load i32, i32* %low.addr, align 4
  %28 = and i32 %26, %27
  store i32 %28, i32* %bucket.addr, align 4
  %29 = load i32, i32* %bucket.addr, align 4
  store i32 %29, i32* %b.addr, align 4
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
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %6 = load i32, i32* %from.addr, align 4
  %7 = load i32, i32* %used.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %to.addr, align 4
  %17 = icmp sge i32 %16, 0
  br label %land.end.1

land.end.1:
  %18 = phi i1 [ false, %for.body ], [ %17, %land.rhs.1 ]
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %to.addr, align 4
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp slt i32 %19, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i32, i32* %to.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %h.addr, align 4
  %26 = bitcast i8* %5 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %24
  store i32 %25, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = load i32, i32* %to.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %from.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = sitofp i64 %39 to double
  %41 = fcmp ogt double %40, 0x0000000000000000
  br label %land.end.2

land.end.2:
  %42 = phi i1 [ false, %while.cond ], [ %41, %land.rhs.2 ]
  br i1 %42, label %while.body, label %while.end

while.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = sub i64 %44, 1
  store i64 %45, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %45
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !13
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
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %n.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %10, 32768
  br label %land.end

land.end:
  %12 = phi i1 [ false, %if.end ], [ %11, %land.rhs ]
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  %13 = load i32, i32* %n.addr, align 4
  %14 = mul nsw i32 %13, 2
  %15 = trunc i32 %14 to i16
  %16 = zext i16 %15 to i64
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 %16, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 %16, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %21 = mul i64 %16, 4
  %22 = call i8* @nish_alloc_struct(i64 %21)
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 %21, i1 false), !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret %struct.nish_array* %18

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, %times
  br i1 %5, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body.1, label %for.end.1

for.body.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = sitofp i64 %18 to double
  br label %for.inc.1

for.inc.1:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %k.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %k.addr, align 4
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
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = icmp ne i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %mask.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %20, i32 %21, i32 %22)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
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
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sitofp i64 %1 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %4, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
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
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sitofp i64 %1 to double
  %8 = call i32 @llvm.fptosi.sat.i32.f64(double %7)
  %9 = icmp slt i32 %6, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.cond ], [ %9, %land.rhs ]
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = icmp ne i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  ret i32 %17

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %size.addr, align 4
  %8 = load i32, i32* %used.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = mul nsw i64 %9, 4
  %11 = load i32, i32* %size.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = mul nsw i64 %12, 3
  %14 = icmp sgt i64 %10, %13
  br i1 %14, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %15 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %16 = phi i1 [ true, %entry ], [ %15, %lor.rhs.1 ]
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = load i32, i32* %size.addr, align 4
  %18 = icmp sge i32 %bucket, %17
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %lor.end.1 ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp sgt i32 %20, 0
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = sext i32 %bucket to i64
  %23 = load i32, i32* %used.addr, align 4
  %24 = sub nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %25
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = load i32, i32* %used.addr, align 4
  %32 = sub nsw i32 %31, 1
  %33 = call i32 @nish.slotWord(i32 %30, i32 %mask, i32 %32)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %22
  store i32 %33, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Set$i32.constructor(%struct.Set$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !19
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !20
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !22
  %4 = fptosi double 0x4020000000000000 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !23
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !24
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !25
  ret void
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !25
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal void @nish.Set$i32.walkOpen(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !22
  ret void
}

define internal noundef i32 @nish.Set$i32.walkNext(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$i32.walkClose(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !22
  ret void
}

define internal noundef i32 @nish.Set$i32.keyAt(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, i32 noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %11
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %16

if.end:
  ret i32 %none
}

define internal void @nish.Set$i32.insertAt(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i32 noundef %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %key, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !25
  %16 = load i64, i64* %packed.addr, align 8
  %17 = trunc i64 %16 to i32
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store.1

push.store.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  store i32 %17, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = sitofp i64 %27 to double
  call void @nish.Set$i32.addOne(%struct.Set$i32* %this)
  %29 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !23
  %31 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2
  %32 = load i32, i32* %31, align 4, !tbaa !20
  %33 = load i64, i64* %packed.addr, align 8
  %34 = ashr i64 %33, 32
  %35 = trunc i64 %34 to i32
  %36 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !25
  %38 = call i1 @nish.fileAppended(%struct.nish_array* %30, i32 %32, i32 %35, %struct.nish_array* %37)
  %39 = xor i1 %38, true
  br i1 %39, label %if.then, label %if.end

if.then:
  call void @nish.Set$i32.rebuild(%struct.Set$i32* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Set$i32.addOne(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !21
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !21
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !19
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !19
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Set$i32.rebuild(%struct.Set$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 6
  %7 = load i32, i32* %6, align 4, !tbaa !22
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !23
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !21
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !21
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !24
  %27 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !25
  call void @nish.compactEntries$i32(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !25
  call void @nish.compactHashes(%struct.nish_array* %30)
  br label %if.end

if.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %32 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  store %struct.nish_array* %31, %struct.nish_array** %32, align 8, !tbaa !23
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = sitofp i64 %35 to double
  %37 = call i32 @llvm.fptosi.sat.i32.f64(double %36)
  %38 = sub nsw i32 %37, 1
  %39 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2
  store i32 %38, i32* %39, align 4, !tbaa !20
  %40 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %41 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %42 = load %struct.nish_array*, %struct.nish_array** %41, align 8, !tbaa !25
  call void @nish.refile(%struct.nish_array* %40, %struct.nish_array* %42)
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
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %28 = load i32, i32* %b.addr, align 4
  %29 = icmp sge i32 %28, 0
  br i1 %29, label %land.rhs, label %land.end

land.rhs:
  %30 = load i32, i32* %b.addr, align 4
  %31 = sitofp i64 %17 to double
  %32 = call i32 @llvm.fptosi.sat.i32.f64(double %31)
  %33 = icmp slt i32 %30, %32
  br label %land.end

land.end:
  %34 = phi i1 [ false, %while.cond ], [ %33, %land.rhs ]
  br i1 %34, label %while.body, label %while.end

while.body:
  %35 = load i32, i32* %b.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = bitcast i8* %19 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %36
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %39, i32* %word.addr, align 4
  %40 = load i32, i32* %word.addr, align 4
  %41 = icmp eq i32 %40, 0
  br i1 %41, label %if.then, label %if.end

if.then:
  %42 = load i32, i32* %b.addr, align 4
  %43 = load i32, i32* %h.addr, align 4
  %44 = tail call i64 @nish.absentAt(i32 %42, i32 %43)
  ret i64 %44

if.end:
  %45 = load i32, i32* %word.addr, align 4
  %46 = load i32, i32* %low.addr, align 4
  %47 = xor i32 %46, -1
  %48 = and i32 %45, %47
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = load i32, i32* %low.addr, align 4
  %53 = and i32 %51, %52
  %54 = sub i32 %53, 1
  store i32 %54, i32* %at.addr, align 4
  %55 = load i32, i32* %at.addr, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sitofp i64 %21 to double
  %59 = call i32 @llvm.fptosi.sat.i32.f64(double %58)
  %60 = icmp slt i32 %57, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %if.then.1 ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %23 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = sitofp i64 %25 to double
  %72 = call i32 @llvm.fptosi.sat.i32.f64(double %71)
  %73 = icmp slt i32 %70, %72
  br label %land.end.2

land.end.2:
  %74 = phi i1 [ false, %land.end.3 ], [ %73, %land.rhs.2 ]
  br i1 %74, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = bitcast i8* %27 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 %76
  %79 = load i32, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %80 = icmp eq i32 %79, %key
  br label %land.end.1

land.end.1:
  %81 = phi i1 [ false, %land.end.2 ], [ %80, %land.rhs.1 ]
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  %82 = load i32, i32* %b.addr, align 4
  %83 = load i32, i32* %at.addr, align 4
  %84 = tail call i64 @nish.foundAt(i32 %82, i32 %83)
  ret i64 %84

if.end.2:
  br label %if.end.1

if.end.1:
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = add i32 %85, 1
  %87 = load i32, i32* %low.addr, align 4
  %88 = and i32 %86, %87
  store i32 %88, i32* %bucket.addr, align 4
  %89 = load i32, i32* %bucket.addr, align 4
  store i32 %89, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = sitofp i64 %91 to double
  %93 = call i32 @llvm.fptosi.sat.i32.f64(double %92)
  %94 = load i32, i32* %h.addr, align 4
  %95 = tail call i64 @nish.absentAt(i32 %93, i32 %94)
  ret i64 %95
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %45 = bitcast i8* %11 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %39
  store i32 %44, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = sitofp i64 %58 to double
  %60 = fcmp ogt double %59, 0x0000000000000000
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %while.cond ], [ %60, %land.rhs.4 ]
  br i1 %61, label %while.body, label %while.end

while.body:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = sub i64 %63, 1
  store i64 %64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %64
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"double", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"i32", !6, i64 0}
!18 = !{!"Set$i32", !15, i64 0, !16, i64 8, !17, i64 16, !17, i64 20, !16, i64 24, !16, i64 32, !17, i64 40}
!19 = !{!18, !15, i64 0}
!20 = !{!18, !17, i64 16}
!21 = !{!18, !17, i64 20}
!22 = !{!18, !17, i64 40}
!23 = !{!18, !16, i64 8}
!24 = !{!18, !16, i64 24}
!25 = !{!18, !16, i64 32}
!26 = !{i32 8, !"cf-protection-branch", i32 1}
!27 = !{i32 8, !"cf-protection-return", i32 1}
!28 = !{i32 8, !"branch-target-enforcement", i32 1}
!29 = !{i32 8, !"sign-return-address", i32 1}
!30 = !{i32 4, !"probe-stack", !"inline-asm"}
