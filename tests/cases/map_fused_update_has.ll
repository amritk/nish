%struct.Map$i32$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1

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

define internal void @mark(%struct.Map$i32$f64* noundef nonnull align 8 dereferenceable(56) %m, i32 noundef %k) #0 {
entry:
  %0 = call i64 @nish.Map$i32$f64.probe(%struct.Map$i32$f64* %m, i32 %k)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi double [ 0x4000000000000000, %cond.true ], [ 0x3FF0000000000000, %cond.false ]
  br i1 %1, label %set.found, label %set.insert

set.found:
  %3 = trunc i64 %0 to i32
  call void @nish.Map$i32$f64.setValueAt(%struct.Map$i32$f64* %m, i32 %3, double %2)
  br label %set.end

set.insert:
  call void @nish.Map$i32$f64.insertAt(%struct.Map$i32$f64* %m, i64 %0, i32 %k, double %2)
  br label %set.end

set.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Map$i32$f64*, align 8
  %k.addr = alloca i32, align 4
  %walk.idx = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i32$f64*
  call void @nish.Map$i32$f64.constructor(%struct.Map$i32$f64* %1)
  store %struct.Map$i32$f64* %1, %struct.Map$i32$f64** %m.addr, align 8
  %2 = load %struct.Map$i32$f64*, %struct.Map$i32$f64** %m.addr, align 8
  call void @mark(%struct.Map$i32$f64* %2, i32 7)
  %3 = load %struct.Map$i32$f64*, %struct.Map$i32$f64** %m.addr, align 8
  call void @mark(%struct.Map$i32$f64* %3, i32 3)
  %4 = load %struct.Map$i32$f64*, %struct.Map$i32$f64** %m.addr, align 8
  call void @mark(%struct.Map$i32$f64* %4, i32 7)
  %5 = load %struct.Map$i32$f64*, %struct.Map$i32$f64** %m.addr, align 8
  call void @nish.Map$i32$f64.walkOpen(%struct.Map$i32$f64* %5)
  %6 = call i32 @nish.Map$i32$f64.walkNext(%struct.Map$i32$f64* %5, i32 0)
  store i32 %6, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %7 = load i32, i32* %walk.idx, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %walk.body, label %walk.end

walk.body:
  %9 = call i32 @nish.Map$i32$f64.keyAt(%struct.Map$i32$f64* %5, i32 %7)
  store i32 %9, i32* %k.addr, align 4
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %11 = load i8*, i8** %10, align 8
  %12 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %13 = load i64, i64* %12, align 8
  %14 = load i32, i32* %k.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = load %struct.Map$i32$f64*, %struct.Map$i32$f64** %m.addr, align 8
  %18 = load i32, i32* %k.addr, align 4
  %19 = call i64 @nish.Map$i32$f64.probe(%struct.Map$i32$f64* %17, i32 %18)
  %20 = icmp sge i64 %19, 0
  br i1 %20, label %nullish.value, label %nullish.default

nullish.value:
  %21 = trunc i64 %19 to i32
  %22 = call double @nish.Map$i32$f64.valueAt(%struct.Map$i32$f64* %17, i32 %21)
  br label %nullish.end

nullish.default:
  %23 = fneg double 0x3FF0000000000000
  br label %nullish.end

nullish.end:
  %24 = phi double [ %22, %nullish.value ], [ %23, %nullish.default ]
  %25 = call i8* @nish_str_from_f64(double %24)
  %26 = call i8* @nish_str_concat(i8* %16, i8* %25)
  call void @nish_print(i8* %26)
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = icmp eq i8* %28, %11
  br i1 %29, label %pass.rewind, label %pass.free

pass.rewind:
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %13, i64* %30, align 8
  br label %pass.done

pass.free:
  %31 = ptrtoint i8* %11 to i64
  %32 = add i64 %31, %13
  call void @nish_arena_release(i64 %32)
  br label %pass.done

pass.done:
  br label %walk.inc

walk.inc:
  %33 = add i32 %7, 1
  %34 = call i32 @nish.Map$i32$f64.walkNext(%struct.Map$i32$f64* %5, i32 %33)
  store i32 %34, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$i32$f64.walkClose(%struct.Map$i32$f64* %5)
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

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #0 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %0)
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %1, i64 %5)
  %7 = extractvalue { i64, i1 } %6, 0
  %8 = extractvalue { i64, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %7

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = sitofp i64 %3 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  %11 = icmp slt i32 %8, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %bucket.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %5 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add nsw i32 %24, 1
  %26 = and i32 %25, %mask
  store i32 %26, i32* %bucket.addr, align 4
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
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = icmp slt i32 %5, %used
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %8 = load i32, i32* %n.addr, align 4
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 2)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = sext i32 %10 to i64
  %13 = icmp ule i64 %12, 9007199254740992
  br i1 %13, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 %12, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 %12, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %18 = mul i64 %12, 4
  %19 = call i8* @nish_alloc_struct(i64 %18)
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !4, !noalias !3
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret %struct.nish_array* %15

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

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 {
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

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  %5 = icmp slt i32 %bucket, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = sext i32 %bucket to i64
  %8 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i32 @nish.slotWord(i32 %h, i32 %9)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %7
  store i32 %11, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.else:
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %17)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i32$f64.constructor(%struct.Map$i32$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !19
  %1 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !20
  %2 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !22
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !23
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !24
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !25
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !26
  ret void
}

define internal noundef i64 @nish.Map$i32$f64.probe(%struct.Map$i32$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !26
  %6 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal void @nish.Map$i32$f64.walkOpen(%struct.Map$i32$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !22
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$i32$f64.walkNext(%struct.Map$i32$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$i32$f64.walkClose(%struct.Map$i32$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !22
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish.Map$i32$f64.keyAt(%struct.Map$i32$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %11
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %16
}

define internal noundef double @nish.Map$i32$f64.valueAt(%struct.Map$i32$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !28
  ret double %16
}

define internal void @nish.Map$i32$f64.setValueAt(%struct.Map$i32$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #3 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
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
  %9 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !28
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$f64.insertAt(%struct.Map$i32$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, double noundef %value) #0 {
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
  %6 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !21
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !22
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$i32$f64.rebuild(%struct.Map$i32$f64* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !24
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 4)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  store i32 %key, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = sitofp i64 %31 to double
  %33 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !25
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %36
  store double %value, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !28
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = sitofp i64 %44 to double
  %46 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !26
  %48 = load i32, i32* %h.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store.2

push.store.2:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  store i32 %48, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = add i64 %50, 1
  store i64 %58, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = sitofp i64 %58 to double
  %60 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
  %61 = load i32, i32* %60, align 4, !tbaa !21
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 1)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  %65 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
  store i32 %63, i32* %65, align 4, !tbaa !21
  %66 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 0
  %67 = load double, double* %66, align 8, !tbaa !19
  %68 = fadd double %67, 0x3FF0000000000000
  %69 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 0
  store double %68, double* %69, align 8, !tbaa !19
  %70 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !24
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = sitofp i64 %73 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %80 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !23
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = sitofp i64 %83 to double
  %85 = call i32 @llvm.fptosi.sat.i32.f64(double %84)
  %86 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %85, i32 3)
  %87 = extractvalue { i32, i1 } %86, 0
  %88 = extractvalue { i32, i1 } %86, 1
  br i1 %88, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %89 = icmp sgt i32 %78, %87
  br i1 %89, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i32$f64.rebuild(%struct.Map$i32$f64* %this)
  br label %if.end.2

if.else:
  %90 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  %91 = load %struct.nish_array*, %struct.nish_array** %90, align 8, !tbaa !23
  %92 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 2
  %93 = load i32, i32* %92, align 4, !tbaa !20
  %94 = load i32, i32* %bucket.addr, align 4
  %95 = load i32, i32* %h.addr, align 4
  %96 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %91, i32 %93, i32 %94, i32 %95, i32 %96)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$i32$f64.rebuild(%struct.Map$i32$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !22
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !23
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
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
  %20 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !21
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !24
  %27 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !26
  call void @nish.compactEntries$i32(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !25
  %31 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !26
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !26
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !23
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !20
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$i32$f64, %struct.Map$i32$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !26
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 {
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
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4
  %29 = sitofp i64 %15 to double
  %30 = call i32 @llvm.fptosi.sat.i32.f64(double %29)
  %31 = icmp slt i32 %28, %30
  br label %land.end

land.end:
  %32 = phi i1 [ false, %while.cond ], [ %31, %land.rhs ]
  br i1 %32, label %while.body, label %while.end

while.body:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = sext i32 %33 to i64
  %35 = bitcast i8* %17 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %34
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %37, i32* %word.addr, align 4
  %38 = load i32, i32* %word.addr, align 4
  %39 = icmp eq i32 %38, 0
  br i1 %39, label %if.then, label %if.end

if.then:
  %40 = load i32, i32* %bucket.addr, align 4
  %41 = load i32, i32* %h.addr, align 4
  %42 = tail call i64 @nish.absentAt(i32 %40, i32 %41)
  ret i64 %42

if.end:
  %43 = load i32, i32* %word.addr, align 4
  %44 = lshr i32 %43, 24
  %45 = load i32, i32* %fingerprint.addr, align 4
  %46 = icmp eq i32 %44, %45
  br i1 %46, label %if.then.1, label %if.end.1

if.then.1:
  %47 = load i32, i32* %word.addr, align 4
  %48 = and i32 %47, 16777215
  %49 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %48, i32 1)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %50, i32* %at.addr, align 4
  %52 = load i32, i32* %at.addr, align 4
  %53 = icmp sge i32 %52, 0
  br i1 %53, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %54 = load i32, i32* %at.addr, align 4
  %55 = sitofp i64 %19 to double
  %56 = call i32 @llvm.fptosi.sat.i32.f64(double %55)
  %57 = icmp slt i32 %54, %56
  br label %land.end.4

land.end.4:
  %58 = phi i1 [ false, %ovf.ok ], [ %57, %land.rhs.4 ]
  br i1 %58, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %59 = load i32, i32* %at.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = bitcast i8* %21 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %60
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %64 = load i32, i32* %h.addr, align 4
  %65 = icmp eq i32 %63, %64
  br label %land.end.3

land.end.3:
  %66 = phi i1 [ false, %land.end.4 ], [ %65, %land.rhs.3 ]
  br i1 %66, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %67 = load i32, i32* %at.addr, align 4
  %68 = sitofp i64 %23 to double
  %69 = call i32 @llvm.fptosi.sat.i32.f64(double %68)
  %70 = icmp slt i32 %67, %69
  br label %land.end.2

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ]
  br i1 %71, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = bitcast i8* %25 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %73
  %76 = load i32, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %77 = icmp eq i32 %76, %key
  br label %land.end.1

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ]
  br i1 %78, label %if.then.2, label %if.end.2

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4
  %80 = load i32, i32* %at.addr, align 4
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80)
  ret i64 %81

if.end.2:
  br label %if.end.1

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = add nsw i32 %82, 1
  %84 = and i32 %83, %mask
  store i32 %84, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %60
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
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
  %42 = bitcast i8* %11 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !28
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !4, !noalias !3, !tbaa !28
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
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !4, !noalias !3, !tbaa !28
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"double", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"i32", !6, i64 0}
!18 = !{!"Map$i32$f64", !15, i64 0, !16, i64 8, !17, i64 16, !17, i64 20, !16, i64 24, !16, i64 32, !16, i64 40, !17, i64 48}
!19 = !{!18, !15, i64 0}
!20 = !{!18, !17, i64 16}
!21 = !{!18, !17, i64 20}
!22 = !{!18, !17, i64 48}
!23 = !{!18, !16, i64 8}
!24 = !{!18, !16, i64 24}
!25 = !{!18, !16, i64 32}
!26 = !{!18, !16, i64 40}
!27 = !{!"element double", !6, i64 0}
!28 = !{!27, !27, i64 0}
