%struct.Set$str = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Bag$f64 = type { %struct.Map$f64$f64* }
%struct.Map$f64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Set: no entry at this index\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_exit(i32 noundef) #6
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #8 {
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

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Set$str*, align 8
  %b.addr = alloca %struct.Bag$f64*, align 8
  %Bag$f64.obj = alloca %struct.Bag$f64, align 8
  %Set$f64.obj = alloca %struct.Set$f64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Set$str*
  call void @nish.Set$str.constructor(%struct.Set$str* %1)
  store %struct.Set$str* %1, %struct.Set$str** %s.addr, align 8
  %2 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %3 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  call void @Bag$f64.constructor(%struct.Bag$f64* %Bag$f64.obj)
  store %struct.Bag$f64* %Bag$f64.obj, %struct.Bag$f64** %b.addr, align 8
  %5 = load %struct.Bag$f64*, %struct.Bag$f64** %b.addr, align 8
  %6 = getelementptr inbounds %struct.Bag$f64, %struct.Bag$f64* %5, i32 0, i32 0
  %7 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %6, align 8, !tbaa !4
  %8 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %7, double 0x3FF0000000000000, double 0x4014000000000000)
  %9 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %8, double 0x4000000000000000, double 0x4018000000000000)
  %10 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %11 = call double @count$str(%struct.Set$str* %10)
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  call void @nish.Set$f64.constructor(%struct.Set$f64* %Set$f64.obj)
  %14 = call double @count$f64(%struct.Set$f64* %Set$f64.obj)
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %18 = load %struct.Bag$f64*, %struct.Bag$f64** %b.addr, align 8
  %19 = call double @Bag$f64.total(%struct.Bag$f64* %18)
  %20 = call i8* @nish_str_from_f64(double %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  call void @nish_print(i8* %21)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @Bag$f64.constructor(%struct.Bag$f64* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %1)
  %2 = getelementptr inbounds %struct.Bag$f64, %struct.Bag$f64* %this, i32 0, i32 0
  store %struct.Map$f64$f64* %1, %struct.Map$f64$f64** %2, align 8, !tbaa !4
  ret void
}

define internal noundef double @Bag$f64.total(%struct.Bag$f64* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %t.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  %k.addr = alloca double, align 8
  %walk.idx.1 = alloca i32, align 4
  store double 0x0000000000000000, double* %t.addr, align 8
  %0 = getelementptr inbounds %struct.Bag$f64, %struct.Bag$f64* %this, i32 0, i32 0
  %1 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %0, align 8, !tbaa !4
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %1)
  %2 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %1, i32 0)
  store i32 %2, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %3 = load i32, i32* %walk.idx, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %walk.body, label %walk.end

walk.body:
  %5 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %1, i32 %3)
  store double %5, double* %v.addr, align 8
  %6 = load double, double* %t.addr, align 8
  %7 = load double, double* %v.addr, align 8
  %8 = fadd double %6, %7
  store double %8, double* %t.addr, align 8
  br label %walk.inc

walk.inc:
  %9 = add i32 %3, 1
  %10 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %1, i32 %9)
  store i32 %10, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %1)
  %11 = getelementptr inbounds %struct.Bag$f64, %struct.Bag$f64* %this, i32 0, i32 0
  %12 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %11, align 8, !tbaa !4
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %12)
  %13 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %12, i32 0)
  store i32 %13, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %14 = load i32, i32* %walk.idx.1, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %walk.body.1, label %walk.end.1

walk.body.1:
  %16 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %12, i32 %14)
  store double %16, double* %k.addr, align 8
  %17 = load double, double* %t.addr, align 8
  %18 = fadd double %17, 0x3FF0000000000000
  store double %18, double* %t.addr, align 8
  br label %walk.inc.1

walk.inc.1:
  %19 = add i32 %14, 1
  %20 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %12, i32 %19)
  store i32 %20, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %12)
  %21 = load double, double* %t.addr, align 8
  ret double %21
}

define internal noundef double @count$str(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %s) #0 {
entry:
  %n.addr = alloca double, align 8
  %x.addr = alloca i8*, align 8
  %walk.idx = alloca i32, align 4
  store double 0x0000000000000000, double* %n.addr, align 8
  call void @nish.Set$str.walkOpen(%struct.Set$str* %s)
  %0 = call i32 @nish.Set$str.walkNext(%struct.Set$str* %s, i32 0)
  store i32 %0, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %1 = load i32, i32* %walk.idx, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %walk.body, label %walk.end

walk.body:
  %3 = call i8* @nish.Set$str.keyAt(%struct.Set$str* %s, i32 %1)
  store i8* %3, i8** %x.addr, align 8
  %4 = load double, double* %n.addr, align 8
  %5 = fadd double %4, 0x3FF0000000000000
  store double %5, double* %n.addr, align 8
  br label %walk.inc

walk.inc:
  %6 = add i32 %1, 1
  %7 = call i32 @nish.Set$str.walkNext(%struct.Set$str* %s, i32 %6)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Set$str.walkClose(%struct.Set$str* %s)
  %8 = load double, double* %n.addr, align 8
  ret double %8
}

define internal noundef double @count$f64(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %s) #0 {
entry:
  %n.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  store double 0x0000000000000000, double* %n.addr, align 8
  call void @nish.Set$f64.walkOpen(%struct.Set$f64* %s)
  %0 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %s, i32 0)
  store i32 %0, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %1 = load i32, i32* %walk.idx, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %walk.body, label %walk.end

walk.body:
  %3 = call double @nish.Set$f64.keyAt(%struct.Set$f64* %s, i32 %1)
  store double %3, double* %x.addr, align 8
  %4 = load double, double* %n.addr, align 8
  %5 = fadd double %4, 0x3FF0000000000000
  store double %5, double* %n.addr, align 8
  br label %walk.inc

walk.inc:
  %6 = add i32 %1, 1
  %7 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %s, i32 %6)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Set$f64.walkClose(%struct.Set$f64* %s)
  %8 = load double, double* %n.addr, align 8
  ret double %8
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
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %17 = load i32, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %13 = load i32, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  store i32 %25, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %33 = load i64, i64* %32, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 %12, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 %12, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %18 = mul i64 %12, 4
  %19 = call i8* @nish_alloc_struct(i64 %18)
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !9, !noalias !8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %17 = load i32, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  store i32 0, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %7
  store i32 %11, i32* %15, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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

define internal void @nish.Set$str.constructor(%struct.Set$str* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !21
  %1 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !22
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !23
  %3 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !24
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !9, !noalias !8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !25
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !26
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %25 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Set$str.probe(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$str* @nish.Set$str.add(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$str.insertAt(%struct.Set$str* %this, i64 %3, i8* %key)
  br label %if.end

if.end:
  ret %struct.Set$str* %this
}

define internal void @nish.Set$str.walkOpen(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !24
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Set$str.walkNext(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$str.walkClose(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !24
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 i8* @nish.Set$str.keyAt(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %11
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !8, !tbaa !29
  ret i8* %16
}

define internal void @nish.Set$str.insertAt(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key) #0 {
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
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !23
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %17 = load i32, i32* %16, align 4, !tbaa !24
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %key, i8** %30, align 8, !alias.scope !9, !noalias !8, !tbaa !29
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %32 = sitofp i64 %31 to double
  %33 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !27
  %35 = load i32, i32* %h.addr, align 4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 4)
  br label %push.store.1

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %37
  store i32 %35, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %46 = sitofp i64 %45 to double
  %47 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %48 = load i32, i32* %47, align 4, !tbaa !23
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 1)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  %52 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 %50, i32* %52, align 4, !tbaa !23
  %53 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  %54 = load double, double* %53, align 8, !tbaa !21
  %55 = fadd double %54, 0x3FF0000000000000
  %56 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store double %55, double* %56, align 8, !tbaa !21
  %57 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !26
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = sitofp i64 %60 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  store i32 %62, i32* %used.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %67 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !25
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %71 = sitofp i64 %70 to double
  %72 = call i32 @llvm.fptosi.sat.i32.f64(double %71)
  %73 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %72, i32 3)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %76 = icmp sgt i32 %65, %74
  br i1 %76, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  br label %if.end.2

if.else:
  %77 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %78 = load %struct.nish_array*, %struct.nish_array** %77, align 8, !tbaa !25
  %79 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %80 = load i32, i32* %79, align 4, !tbaa !22
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = load i32, i32* %h.addr, align 4
  %83 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %78, i32 %80, i32 %81, i32 %82, i32 %83)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.1 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Set$str.rebuild(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %7 = load i32, i32* %6, align 4, !tbaa !24
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !23
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
  %20 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !23
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !26
  %27 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !27
  call void @nish.compactEntries$str(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %30)
  br label %if.end

if.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %32 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %31, %struct.nish_array** %32, align 8, !tbaa !25
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = sitofp i64 %35 to double
  %37 = call i32 @llvm.fptosi.sat.i32.f64(double %36)
  %38 = sub nsw i32 %37, 1
  %39 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 %38, i32* %39, align 4, !tbaa !22
  %40 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %41 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %42 = load %struct.nish_array*, %struct.nish_array** %41, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %40, %struct.nish_array* %42)
  ret void
}

define internal void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !31
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !32
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !33
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !34
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !9, !noalias !8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !35
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !36
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !37
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !38
  ret void
}

define internal noundef i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !32
  %4 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !38
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !36
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %this, double noundef %key, double noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* %this, i32 %4, double %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %this, i64 %5, double %key, double %value)
  br label %if.end

if.end:
  ret %struct.Map$f64$f64* %this
}

define internal void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !34
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !34
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !38
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !34
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !34
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !36
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !36
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  ret double %16
}

define internal noundef double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !37
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !37
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  ret double %16
}

define internal void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #3 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !37
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !37
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, double noundef %value) #0 {
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
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !36
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !33
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !34
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !36
  %22 = fadd double %key, 0.000000e+00
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %27 = icmp eq i64 %24, %26
  br i1 %27, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %30 = bitcast i8* %29 to double*
  %31 = getelementptr inbounds double, double* %30, i64 %24
  store double %22, double* %31, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  %32 = add i64 %24, 1
  store i64 %32, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %33 = sitofp i64 %32 to double
  %34 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !37
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %35, i64 8)
  br label %push.store.1

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %43 = bitcast i8* %42 to double*
  %44 = getelementptr inbounds double, double* %43, i64 %37
  store double %value, double* %44, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %46 = sitofp i64 %45 to double
  %47 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !38
  %49 = load i32, i32* %h.addr, align 4
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4)
  br label %push.store.2

push.store.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  store i32 %49, i32* %58, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %60 = sitofp i64 %59 to double
  %61 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %62 = load i32, i32* %61, align 4, !tbaa !33
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 1)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok

ovf.ok:
  %66 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %64, i32* %66, align 4, !tbaa !33
  %67 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %68 = load double, double* %67, align 8, !tbaa !31
  %69 = fadd double %68, 0x3FF0000000000000
  %70 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %69, double* %70, align 8, !tbaa !31
  %71 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !36
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %75 = sitofp i64 %74 to double
  %76 = call i32 @llvm.fptosi.sat.i32.f64(double %75)
  store i32 %76, i32* %used.addr, align 4
  %77 = load i32, i32* %used.addr, align 4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 4)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %81 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %82 = load %struct.nish_array*, %struct.nish_array** %81, align 8, !tbaa !35
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %85 = sitofp i64 %84 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %86, i32 3)
  %88 = extractvalue { i32, i1 } %87, 0
  %89 = extractvalue { i32, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %90 = icmp sgt i32 %79, %88
  br i1 %90, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  br label %if.end.2

if.else:
  %91 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %92 = load %struct.nish_array*, %struct.nish_array** %91, align 8, !tbaa !35
  %93 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %94 = load i32, i32* %93, align 4, !tbaa !32
  %95 = load i32, i32* %bucket.addr, align 4
  %96 = load i32, i32* %h.addr, align 4
  %97 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %92, i32 %94, i32 %95, i32 %96, i32 %97)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !34
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !35
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !33
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
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !33
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !36
  %27 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !38
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !37
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !38
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !38
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !35
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !32
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !38
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal void @nish.Set$f64.constructor(%struct.Set$f64* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !42
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !43
  %2 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !44
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !45
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !9, !noalias !8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !46
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !47
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %25 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !48
  ret void
}

define internal void @nish.Set$f64.walkOpen(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !45
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !45
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Set$f64.walkNext(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !48
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$f64.walkClose(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !45
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %3, i32* %5, align 4, !tbaa !45
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef double @nish.Set$f64.keyAt(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !47
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !47
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  ret double %16
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = sitofp i64 %20 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %22 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %39
  %42 = load i32, i32* %41, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %60 = sitofp i64 %24 to double
  %61 = call i32 @llvm.fptosi.sat.i32.f64(double %60)
  %62 = icmp slt i32 %59, %61
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %ovf.ok ], [ %62, %land.rhs.4 ]
  br i1 %63, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %64 = load i32, i32* %at.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %26 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %69 = load i32, i32* %h.addr, align 4
  %70 = icmp eq i32 %68, %69
  br label %land.end.3

land.end.3:
  %71 = phi i1 [ false, %land.end.4 ], [ %70, %land.rhs.3 ]
  br i1 %71, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sitofp i64 %28 to double
  %74 = call i32 @llvm.fptosi.sat.i32.f64(double %73)
  %75 = icmp slt i32 %72, %74
  br label %land.end.2

land.end.2:
  %76 = phi i1 [ false, %land.end.3 ], [ %75, %land.rhs.2 ]
  br i1 %76, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %77 = load i32, i32* %at.addr, align 4
  %78 = sext i32 %77 to i64
  %79 = bitcast i8* %30 to i8**
  %80 = getelementptr inbounds i8*, i8** %79, i64 %78
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !8, !tbaa !29
  %82 = call zeroext i1 @nish_str_eq(i8* %81, i8* %key)
  br label %land.end.1

land.end.1:
  %83 = phi i1 [ false, %land.end.2 ], [ %82, %land.rhs.1 ]
  br i1 %83, label %if.then.2, label %if.end.2

if.then.2:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = load i32, i32* %at.addr, align 4
  %86 = tail call i64 @nish.foundAt(i32 %84, i32 %85)
  ret i64 %86

if.end.2:
  br label %if.end.1

if.end.1:
  %87 = load i32, i32* %bucket.addr, align 4
  %88 = add nsw i32 %87, 1
  %89 = and i32 %88, %mask
  store i32 %89, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.8 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
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
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %24 = load i32, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %42 = bitcast i8* %11 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %41
  %44 = load i8*, i8** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !29
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !9, !noalias !8, !tbaa !29
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
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !9, !noalias !8, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal noundef i64 @nish.probeTable$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, double noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = fadd double %key, 0.000000e+00
  %1 = fcmp uno double %0, %0
  %2 = bitcast double %0 to i64
  %3 = select i1 %1, i64 9221120237041090560, i64 %2
  %4 = lshr i64 %3, 33
  %5 = xor i64 %3, %4
  %6 = mul i64 %5, -49064778989728563
  %7 = lshr i64 %6, 33
  %8 = xor i64 %6, %7
  %9 = mul i64 %8, -4265267296055464877
  %10 = lshr i64 %9, 33
  %11 = xor i64 %9, %10
  %12 = trunc i64 %11 to i32
  %13 = lshr i64 %11, 32
  %14 = trunc i64 %13 to i32
  %15 = xor i32 %12, %14
  %16 = icmp eq i32 %15, 0
  %17 = select i1 %16, i32 1, i32 %15
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = lshr i32 %18, 24
  store i32 %19, i32* %fingerprint.addr, align 4
  %20 = load i32, i32* %h.addr, align 4
  %21 = call i32 @nish.homeBucket(i32 %20, i32 %mask)
  store i32 %21, i32* %bucket.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %34 = load i32, i32* %bucket.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs, label %land.end

land.rhs:
  %36 = load i32, i32* %bucket.addr, align 4
  %37 = sitofp i64 %23 to double
  %38 = call i32 @llvm.fptosi.sat.i32.f64(double %37)
  %39 = icmp slt i32 %36, %38
  br label %land.end

land.end:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = load i32, i32* %bucket.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %25 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store i32 %45, i32* %word.addr, align 4
  %46 = load i32, i32* %word.addr, align 4
  %47 = icmp eq i32 %46, 0
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load i32, i32* %bucket.addr, align 4
  %49 = load i32, i32* %h.addr, align 4
  %50 = tail call i64 @nish.absentAt(i32 %48, i32 %49)
  ret i64 %50

if.end:
  %51 = load i32, i32* %word.addr, align 4
  %52 = lshr i32 %51, 24
  %53 = load i32, i32* %fingerprint.addr, align 4
  %54 = icmp eq i32 %52, %53
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  %55 = load i32, i32* %word.addr, align 4
  %56 = and i32 %55, 16777215
  %57 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %56, i32 1)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %58, i32* %at.addr, align 4
  %60 = load i32, i32* %at.addr, align 4
  %61 = icmp sge i32 %60, 0
  br i1 %61, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sitofp i64 %27 to double
  %64 = call i32 @llvm.fptosi.sat.i32.f64(double %63)
  %65 = icmp slt i32 %62, %64
  br label %land.end.4

land.end.4:
  %66 = phi i1 [ false, %ovf.ok ], [ %65, %land.rhs.4 ]
  br i1 %66, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %67 = load i32, i32* %at.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %29 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %68
  %71 = load i32, i32* %70, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %72 = load i32, i32* %h.addr, align 4
  %73 = icmp eq i32 %71, %72
  br label %land.end.3

land.end.3:
  %74 = phi i1 [ false, %land.end.4 ], [ %73, %land.rhs.3 ]
  br i1 %74, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sitofp i64 %31 to double
  %77 = call i32 @llvm.fptosi.sat.i32.f64(double %76)
  %78 = icmp slt i32 %75, %77
  br label %land.end.2

land.end.2:
  %79 = phi i1 [ false, %land.end.3 ], [ %78, %land.rhs.2 ]
  br i1 %79, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %80 = load i32, i32* %at.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = bitcast i8* %33 to double*
  %83 = getelementptr inbounds double, double* %82, i64 %81
  %84 = load double, double* %83, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  %85 = fcmp oeq double %84, %key
  %86 = fcmp uno double %84, %84
  %87 = fcmp uno double %key, %key
  %88 = and i1 %86, %87
  %89 = or i1 %85, %88
  br label %land.end.1

land.end.1:
  %90 = phi i1 [ false, %land.end.2 ], [ %89, %land.rhs.1 ]
  br i1 %90, label %if.then.2, label %if.end.2

if.then.2:
  %91 = load i32, i32* %bucket.addr, align 4
  %92 = load i32, i32* %at.addr, align 4
  %93 = tail call i64 @nish.foundAt(i32 %91, i32 %92)
  ret i64 %93

if.end.2:
  br label %if.end.1

if.end.1:
  %94 = load i32, i32* %bucket.addr, align 4
  %95 = add nsw i32 %94, 1
  %96 = and i32 %95, %mask
  store i32 %96, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.8 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
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
  %24 = load i32, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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
  %44 = load double, double* %43, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !9, !noalias !8, !tbaa !40
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
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !9, !noalias !8, !tbaa !40
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { noreturn nounwind }
attributes #7 = { nounwind noreturn cold }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Bag$f64", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
!18 = !{!"double", !1, i64 0}
!19 = !{!"i32", !1, i64 0}
!20 = !{!"Set$str", !18, i64 0, !2, i64 8, !19, i64 16, !19, i64 20, !2, i64 24, !2, i64 32, !19, i64 40}
!21 = !{!20, !18, i64 0}
!22 = !{!20, !19, i64 16}
!23 = !{!20, !19, i64 20}
!24 = !{!20, !19, i64 40}
!25 = !{!20, !2, i64 8}
!26 = !{!20, !2, i64 24}
!27 = !{!20, !2, i64 32}
!28 = !{!"element ptr", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!"Map$f64$f64", !18, i64 0, !2, i64 8, !19, i64 16, !19, i64 20, !2, i64 24, !2, i64 32, !2, i64 40, !19, i64 48}
!31 = !{!30, !18, i64 0}
!32 = !{!30, !19, i64 16}
!33 = !{!30, !19, i64 20}
!34 = !{!30, !19, i64 48}
!35 = !{!30, !2, i64 8}
!36 = !{!30, !2, i64 24}
!37 = !{!30, !2, i64 32}
!38 = !{!30, !2, i64 40}
!39 = !{!"element double", !1, i64 0}
!40 = !{!39, !39, i64 0}
!41 = !{!"Set$f64", !18, i64 0, !2, i64 8, !19, i64 16, !19, i64 20, !2, i64 24, !2, i64 32, !19, i64 40}
!42 = !{!41, !18, i64 0}
!43 = !{!41, !19, i64 16}
!44 = !{!41, !19, i64 20}
!45 = !{!41, !19, i64 40}
!46 = !{!41, !2, i64 8}
!47 = !{!41, !2, i64 24}
!48 = !{!41, !2, i64 32}
