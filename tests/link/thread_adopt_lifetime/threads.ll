%struct.ThreadScope = type { i32 }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.Channel$str = type { %struct.nish_array*, i32, i64 }
%struct.Mutex$str = type { %struct.MutexGuard$str* }
%struct.MutexGuard$str = type { i8*, i32 }
%struct.Words = type { %struct.nish_array* }
%struct.Pipe = type { %struct.Channel$str*, i32 }
%struct.Slot = type { %struct.Mutex$str*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @reclaimable$arrow0(i32 noundef) #0
declare noundef nonnull align 8 i8* @reclaimable$arrow1(i32 noundef) #1
declare noundef i32 @nested$arrow0(i32 noundef) #1
declare noundef nonnull align 8 i8* @nested$arrow1(i32 noundef) #1
declare noundef i32 @bigRows$arrow0(i32 noundef) #0
declare noundef nonnull align 8 i8* @bigRows$arrow1(i32 noundef) #1
declare noundef nonnull align 8 i8* @tasks$arrow0(i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 i8* @joined$(%struct.Words* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #2
declare noundef nonnull align 8 i8* @tasks$arrow1(i32 noundef) #1
declare noundef nonnull align 8 i8* @fetchBig$arrow0(i32 noundef) #1
declare noundef i32 @send$(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i32 @store$(%struct.Slot* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i32 @shapes$arrow0(i32 noundef) #0
declare noundef nonnull align 8 i8* @word$(i32 noundef) #1
declare noundef nonnull align 8 i8* @label$(i32 noundef) #1
declare noundef nonnull align 8 i8* @shapes$arrow1(i32 noundef) #1
declare noundef nonnull align 8 i8* @shapes$arrow2(i32 noundef) #1
declare noundef nonnull align 8 i8* @fill$arrow0(i32 noundef) #1
declare noundef i32 @into$arrow0(i32 noundef) #0
declare noundef i32 @pick$arrow0(i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 i8* @pick$arrow1(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #1
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #1
declare void @nish_mutex_wait(i32* noundef nonnull) #1
declare void @nish_channel_send(i64* noundef nonnull, i64 noundef) #1
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #1
declare i8* @nish_cross_out(i8* noundef, i64 noundef, i64 noundef) #1
declare noundef nonnull i8* @nish_cross_send(i8* noundef nonnull) #1
declare i8* @nish_cross_in(i8* noundef, i64 noundef) #1
declare i8* @nish_cross_keep(i8* noundef, i64 noundef, i64 noundef) #1
declare void @nish_cross_begin(i8* noundef nonnull, i8** noundef) #1
declare void @nish_cross_end(i8* noundef nonnull) #1
declare void @nish_cross_adopt(i8* noundef, i8* noundef nonnull, i64 noundef) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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

define internal noundef i32 @nish.reduceBlockCount(i32 noundef %n) #0 {
entry:
  %wanted.addr = alloca i32, align 4
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 1048576 to double
  %2 = fdiv double %0, %1
  %3 = call double @llvm.ceil.f64(double %2)
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  store i32 %4, i32* %wanted.addr, align 4
  %5 = load i32, i32* %wanted.addr, align 4
  %6 = icmp slt i32 %5, 64
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %wanted.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %7, %cond.true ], [ 64, %cond.false ]
  ret i32 %8
}

define internal noundef i32 @nish.reduceBlockStart(i32 noundef %n, i32 noundef %blocks, i32 noundef %k) #0 {
entry:
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 %k to double
  %2 = fmul double %0, %1
  %3 = sitofp i32 %blocks to double
  %4 = fdiv double %2, %3
  %5 = call double @llvm.floor.f64(double %4)
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  ret i32 %6
}

define internal void @nish.dstTooShort(i32 noundef %have, i32 noundef %want) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %have)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [23 x i8] }* @.str.1 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %want)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  call void @nish_panic(i8* %4)
  unreachable
}

define internal void @nish.slotOutOfRange(i32 noundef %at, i32 noundef %length) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %at)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [34 x i8] }* @.str.3 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %length)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  call void @nish_panic(i8* %5)
  unreachable
}

define internal noundef zeroext i1 @nish.slotWritten(i32 noundef %at) #0 {
entry:
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sge i32 %at, 0
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  ret i1 %2
}

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.ThreadScope*
  %2 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  ret %struct.ThreadScope* %1
}

define void @nish.AtomicI32.constructor(%struct.AtomicI32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !6
  ret void
}

define noundef i32 @nish.AtomicI32.load(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = load atomic i32, i32* %0 seq_cst, align 4
  ret i32 %1
}

define void @nish.AtomicI32.store(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  store atomic i32 %value, i32* %0 seq_cst, align 4
  ret void
}

define noundef i32 @nish.AtomicI32.add(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw add i32* %0, i32 %delta seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.sub(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw sub i32* %0, i32 %delta seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.min(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw min i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.max(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw max i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.exchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw xchg i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %expected, i32 noundef %desired) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = cmpxchg i32* %0, i32 %expected, i32 %desired seq_cst seq_cst, align 4
  %2 = extractvalue { i32, i1 } %1, 0
  ret i32 %2
}

define void @nish.AtomicI64.constructor(%struct.AtomicI64* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  store i64 %value, i64* %0, align 8, !tbaa !9
  ret void
}

define noundef i64 @nish.AtomicI64.load(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = load atomic i64, i64* %0 seq_cst, align 8
  ret i64 %1
}

define void @nish.AtomicI64.store(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  store atomic i64 %value, i64* %0 seq_cst, align 8
  ret void
}

define noundef i64 @nish.AtomicI64.add(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw add i64* %0, i64 %delta seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.sub(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw sub i64* %0, i64 %delta seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.min(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw min i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.max(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw max i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.exchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw xchg i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.compareExchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %expected, i64 noundef %desired) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = cmpxchg i64* %0, i64 %expected, i64 %desired seq_cst seq_cst, align 8
  %2 = extractvalue { i64, i1 } %1, 0
  ret i64 %2
}

define void @nish.Channel$str.constructor(%struct.Channel$str* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 2
  store i64 0, i64* %1, align 8, !tbaa !13
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %7 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %7, align 8, !tbaa !25
  ret void
}

define void @nish.Channel$str.send(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture %this, i8* noundef nonnull noalias readonly align 8 nocapture %x) #1 {
entry:
  %0 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 2
  %1 = call i8* @nish_cross_send(i8* %x)
  %2 = ptrtoint i8* %1 to i64
  call void @nish_channel_send(i64* %0, i64 %2)
  ret void
}

define noundef nonnull align 8 i8* @nish.Channel$str.take(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %x.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !12
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  store i8* %12, i8** %x.addr, align 8
  %13 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !12
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 1
  store i32 %16, i32* %18, align 4, !tbaa !12
  %19 = load i8*, i8** %x.addr, align 8
  ret i8* %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef zeroext i1 @nish.Channel$str.ready(%struct.Channel$str* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !12
  %2 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %this, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !25
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %1, %6
  ret i1 %7
}

define void @nish.MutexGuard$str.constructor(%struct.MutexGuard$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !29
  %1 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %this, i32 0, i32 0
  store i8* %value, i8** %1, align 8, !tbaa !30
  ret void
}

define void @nish.Mutex$str.constructor(%struct.Mutex$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %init) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.MutexGuard$str*
  call void @nish.MutexGuard$str.constructor(%struct.MutexGuard$str* %1, i8* %init)
  %2 = getelementptr inbounds %struct.Mutex$str, %struct.Mutex$str* %this, i32 0, i32 0
  store %struct.MutexGuard$str* %1, %struct.MutexGuard$str** %2, align 8, !tbaa !32
  ret void
}

define noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Mutex$str, %struct.Mutex$str* %this, i32 0, i32 0
  %1 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %0, align 8, !tbaa !32
  %2 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %1, i32 0, i32 1
  %3 = cmpxchg i32* %2, i32 0, i32 1 acquire monotonic
  %4 = extractvalue { i32, i1 } %3, 1
  br i1 %4, label %lock.held, label %lock.wait

lock.wait:
  call void @nish_mutex_wait(i32* %2)
  br label %lock.held

lock.held:
  ret %struct.MutexGuard$str* %1
}

define internal void @nish.parallelFrom$i32$fn.18.reclaimable$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.18.reclaimable$arrow0(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.18.reclaimable$arrow0(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 2097152
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.18.reclaimable$arrow0(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.18.reclaimable$arrow0$chunk, i8* %16, i64 %17, i64 2097152)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelFrom$i32$fn.13.nested$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.13.nested$arrow0(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.13.nested$arrow0(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 699050
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.13.nested$arrow0(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.13.nested$arrow0$chunk, i8* %16, i64 %17, i64 699050)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.nested$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.13.nested$arrow1(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelFrom$i32$fn.14.bigRows$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.14.bigRows$arrow0(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.14.bigRows$arrow0(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 2097152
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.14.bigRows$arrow0(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.14.bigRows$arrow0$chunk, i8* %16, i64 %17, i64 2097152)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelFrom$str$fn.12.tasks$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.fromRange$str$fn.12.tasks$arrow0(%struct.nish_array* %2, i32 %5, i32 %6, i32 %4)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$str$fn.12.tasks$arrow0(i32 noundef %n, i32 noundef %cap.0) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 56679
  br i1 %14, label %par.seq, label %par.region

par.seq:
  %15 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %15, i8** null)
  call void @nish.fromRange$str$fn.12.tasks$arrow0(%struct.nish_array* %9, i32 0, i32 %13, i32 %cap.0)
  call void @nish_cross_end(i8* %15)
  br label %par.done

par.region:
  %16 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %par.ctx, i32 0, i32 1
  store i32 %cap.0, i32* %17
  %18 = getelementptr inbounds { %struct.nish_array*, i32, i8* }, { %struct.nish_array*, i32, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %18
  %19 = bitcast { %struct.nish_array*, i32, i8* }* %par.ctx to i8*
  %20 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$str$fn.12.tasks$arrow0$chunk, i8* %19, i64 %20, i64 56679)
  %21 = load i8*, i8** %18
  %22 = bitcast %struct.nish_array* %9 to i8*
  call void @nish_cross_adopt(i8* %21, i8* %22, i64 0)
  br label %par.done

par.done:
  %23 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %23
}

define internal void @nish.ThreadScope.spawn$$Words$str$fn.6.joined$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Words*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load %struct.Words*, %struct.Words** %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @joined$(%struct.Words* %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$$Words$str$fn.6.joined$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Words*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$$Words$str$fn.6.joined(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Words* noundef nonnull align 8 dereferenceable(8) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Words*, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @joined$(%struct.Words* %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store %struct.Words* %arg, %struct.Words** %14
  %15 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { %struct.Words*, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$$Words$str$fn.6.joined$run, void (i8*)* @nish.ThreadScope.spawn$$Words$str$fn.6.joined$finish, i8* %17, i64 ptrtoint ({ %struct.Words*, %struct.nish_array*, i32, i8* }* getelementptr ({ %struct.Words*, %struct.nish_array*, i32, i8* }, { %struct.Words*, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @tasks$arrow1(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @tasks$arrow1(i32 %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %14
  %15 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.12.tasks$arrow1$finish, i8* %17, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @fetchBig$arrow0(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @fetchBig$arrow0(i32 %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %14
  %15 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.15.fetchBig$arrow0$finish, i8* %17, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Pipe*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Pipe*, %struct.Pipe** %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i32 @send$(%struct.Pipe* %2)
  call void @nish_arena_release(i64 %3)
  %5 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %4, i32* %5
  %6 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %2, i32 0, i32 0
  %7 = load %struct.Channel$str*, %struct.Channel$str** %6
  %8 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %7, i32 0, i32 2
  call void @nish_channel_count(i64* %8, i64 -1)
  ret void
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Pipe*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  %6 = load i32, i32* %5
  call void @nish.storeResult$i32(%struct.nish_array* %2, i32 %4, i32 %6)
  ret void
}

define void @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Pipe* noundef nonnull align 8 dereferenceable(16) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Pipe*, %struct.nish_array*, i32, i32 }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i32 @send$(%struct.Pipe* %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store %struct.Pipe* %arg, %struct.Pipe** %12
  %13 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %arg, i32 0, i32 0
  %16 = load %struct.Channel$str*, %struct.Channel$str** %15
  %17 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %16, i32 0, i32 2
  call void @nish_channel_count(i64* %17, i64 1)
  %18 = bitcast { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %19 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %19, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send$run, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.4.send$finish, i8* %18, i64 ptrtoint ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }* getelementptr ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$$Slot$i32$fn.5.store$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Slot*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Slot*, %struct.Slot** %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i32 @store$(%struct.Slot* %2)
  call void @nish_arena_release(i64 %3)
  %5 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %4, i32* %5
  ret void
}

define internal void @nish.ThreadScope.spawn$$Slot$i32$fn.5.store$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Slot*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  %6 = load i32, i32* %5
  call void @nish.storeResult$i32(%struct.nish_array* %2, i32 %4, i32 %6)
  ret void
}

define void @nish.ThreadScope.spawn$$Slot$i32$fn.5.store(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Slot* noundef nonnull align 8 dereferenceable(16) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Slot*, %struct.nish_array*, i32, i32 }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i32 @store$(%struct.Slot* %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store %struct.Slot* %arg, %struct.Slot** %12
  %13 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { %struct.Slot*, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$$Slot$i32$fn.5.store$run, void (i8*)* @nish.ThreadScope.spawn$$Slot$i32$fn.5.store$finish, i8* %15, i64 ptrtoint ({ %struct.Slot*, %struct.nish_array*, i32, i32 }* getelementptr ({ %struct.Slot*, %struct.nish_array*, i32, i32 }, { %struct.Slot*, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.parallelFrom$i32$fn.13.shapes$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.13.shapes$arrow0(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.13.shapes$arrow0(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 2097152
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.13.shapes$arrow0(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.13.shapes$arrow0$chunk, i8* %16, i64 %17, i64 2097152)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.4.word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.4.word(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelFrom$str$fn.5.label$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i8* }, { %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  %5 = getelementptr inbounds { %struct.nish_array*, i8* }, { %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %6 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %6, i8** %5)
  %7 = call i64 @nish_arena_mark()
  call void @nish.fromRange$str$fn.5.label(%struct.nish_array* %2, i32 %3, i32 %4)
  call void @nish_cross_end(i8* %6)
  call void @nish_arena_release(i64 %7)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$str$fn.5.label(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 59918
  br i1 %14, label %par.seq, label %par.region

par.seq:
  %15 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %15, i8** null)
  call void @nish.fromRange$str$fn.5.label(%struct.nish_array* %9, i32 0, i32 %13)
  call void @nish_cross_end(i8* %15)
  br label %par.done

par.region:
  %16 = getelementptr inbounds { %struct.nish_array*, i8* }, { %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, i8* }, { %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$str$fn.5.label$chunk, i8* %18, i64 %19, i64 59918)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %9 to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  %22 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %22
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow1(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.shapes$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow2(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelMapInto$i32$str$fn.11.fill$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.11.fill$arrow0(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 233016
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.11.fill$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.11.fill$arrow0$chunk, i8* %18, i64 %19, i64 233016)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.parallelFrom$i32$fn.11.into$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.11.into$arrow0(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.11.into$arrow0(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 2097152
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.11.into$arrow0(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.11.into$arrow0$chunk, i8* %16, i64 %17, i64 2097152)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define internal void @nish.parallelFrom$i32$fn.11.pick$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i32 }*
  %1 = getelementptr inbounds { %struct.nish_array*, i32 }, { %struct.nish_array*, i32 }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i32 }, { %struct.nish_array*, i32 }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.11.pick$arrow0(%struct.nish_array* %2, i32 %5, i32 %6, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.11.pick$arrow0(i32 noundef %n, i32 noundef %cap.0) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32 }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !18, !noalias !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 699050
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.11.pick$arrow0(%struct.nish_array* %9, i32 0, i32 %13, i32 %cap.0)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, i32 }, { %struct.nish_array*, i32 }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, i32 }, { %struct.nish_array*, i32 }* %par.ctx, i32 0, i32 1
  store i32 %cap.0, i32* %16
  %17 = bitcast { %struct.nish_array*, i32 }* %par.ctx to i8*
  %18 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.11.pick$arrow0$chunk, i8* %17, i64 %18, i64 699050)
  br label %par.done

par.done:
  %19 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %19
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.11.pick$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !18, !noalias !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.11.pick$arrow1(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.fromRange$i32$fn.18.reclaimable$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @reclaimable$arrow0(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.parallelMapInto$i32$str$fn.18.reclaimable$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 299593
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.18.reclaimable$arrow1$chunk, i8* %18, i64 %19, i64 299593)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.fromRange$i32$fn.13.nested$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @nested$arrow0(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.parallelMapInto$i32$str$fn.13.nested$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.13.nested$arrow1(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.13.nested$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 59918
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.13.nested$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.13.nested$arrow1$chunk, i8* %18, i64 %19, i64 59918)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.fromRange$i32$fn.14.bigRows$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @bigRows$arrow0(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.parallelMapInto$i32$str$fn.14.bigRows$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 299593
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.14.bigRows$arrow1$chunk, i8* %18, i64 %19, i64 299593)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.fromRange$str$fn.12.tasks$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi, i32 noundef %cap.0) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @tasks$arrow0(i32 %13, i32 %cap.0)
  %16 = call i8* @nish_cross_keep(i8* %15, i64 0, i64 %14)
  store i8* %16, i8** %y.addr, align 8
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %1 to i32
  %19 = icmp slt i32 %17, %18
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %i.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i8*, i8** %y.addr, align 8
  %23 = bitcast i8* %3 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %21
  store i8* %22, i8** %24, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.runTask$$Words$str$fn.6.joined(%struct.Words* noundef nonnull readonly align 8 dereferenceable(8) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @joined$(%struct.Words* %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$i32$str$fn.12.tasks$arrow1(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @tasks$arrow1(i32 %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$i32$str$fn.15.fetchBig$arrow0(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @fetchBig$arrow0(i32 %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$$Pipe$i32$fn.4.send(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @send$(%struct.Pipe* %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.runTask$$Slot$i32$fn.5.store(%struct.Slot* noundef nonnull readonly align 8 dereferenceable(16) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @store$(%struct.Slot* %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.fromRange$i32$fn.13.shapes$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @shapes$arrow0(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.parallelMapInto$i32$str$fn.4.word$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.4.word(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.4.word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 59918
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.4.word(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.4.word$chunk, i8* %18, i64 %19, i64 59918)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.fromRange$str$fn.5.label(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @label$(i32 %13)
  %16 = call i8* @nish_cross_keep(i8* %15, i64 0, i64 %14)
  store i8* %16, i8** %y.addr, align 8
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %1 to i32
  %19 = icmp slt i32 %17, %18
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %i.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i8*, i8** %y.addr, align 8
  %23 = bitcast i8* %3 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %21
  store i8* %22, i8** %24, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.13.shapes$arrow1(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 233016
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.13.shapes$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.13.shapes$arrow1$chunk, i8* %18, i64 %19, i64 233016)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow2$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.13.shapes$arrow2(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.13.shapes$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 77672
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.13.shapes$arrow2(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.13.shapes$arrow2$chunk, i8* %18, i64 %19, i64 77672)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @fill$arrow0(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fromRange$i32$fn.11.into$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @into$arrow0(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.fromRange$i32$fn.11.pick$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi, i32 noundef %cap.0) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @pick$arrow0(i32 %13, i32 %cap.0)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
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

define internal void @nish.parallelMapInto$i32$str$fn.11.pick$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array*, i8* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  %7 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %0, i32 0, i32 2
  %8 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %8, i8** %7)
  %9 = call i64 @nish_arena_mark()
  call void @nish.mapRange$i32$str$fn.11.pick$arrow1(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  call void @nish_cross_end(i8* %8)
  call void @nish_arena_release(i64 %9)
  ret void
}

define void @nish.parallelMapInto$i32$str$fn.11.pick$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array*, i8* }, align 8
  %par.xfer = alloca { i8*, i8*, i64, i8* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 299593
  br i1 %13, label %par.seq, label %par.region

par.seq:
  %14 = bitcast { i8*, i8*, i64, i8* }* %par.xfer to i8*
  call void @nish_cross_begin(i8* %14, i8** null)
  call void @nish.mapRange$i32$str$fn.11.pick$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  call void @nish_cross_end(i8* %14)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %15
  %16 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %16
  %17 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i8* }, { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx, i32 0, i32 2
  store i8* null, i8** %17
  %18 = bitcast { %struct.nish_array*, %struct.nish_array*, i8* }* %par.ctx to i8*
  %19 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$str$fn.11.pick$arrow1$chunk, i8* %18, i64 %19, i64 299593)
  %20 = load i8*, i8** %17
  %21 = bitcast %struct.nish_array* %dst to i8*
  call void @nish_cross_adopt(i8* %20, i8* %21, i64 0)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.18.reclaimable$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @reclaimable$arrow1(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.13.nested$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @nested$arrow1(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.14.bigRows$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, %hi
  br label %land.end.2

land.end.2:
  %4 = phi i1 [ false, %for.cond ], [ %3, %land.rhs.2 ]
  br i1 %4, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end.1

land.end.1:
  %10 = phi i1 [ false, %land.end.2 ], [ %9, %land.rhs.1 ]
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %24 = call i64 @nish_arena_mark()
  %25 = call i8* @bigRows$arrow1(i32 %23)
  %26 = call i8* @nish_cross_keep(i8* %25, i64 0, i64 %24)
  store i8* %26, i8** %y.addr, align 8
  %27 = load i32, i32* %i.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %30 = trunc i64 %29 to i32
  %31 = icmp slt i32 %27, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %33
  store i8* %34, i8** %38, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.storeResult$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i8* noundef nonnull noalias readonly align 8 %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 %6
  store i8* %r, i8** %10, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i32 noundef %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  store i32 %r, i32* %10, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.4.word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @word$(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.13.shapes$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @shapes$arrow1(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.13.shapes$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, %hi
  br label %land.end.2

land.end.2:
  %4 = phi i1 [ false, %for.cond ], [ %3, %land.rhs.2 ]
  br i1 %4, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end.1

land.end.1:
  %10 = phi i1 [ false, %land.end.2 ], [ %9, %land.rhs.1 ]
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %24 = call i64 @nish_arena_mark()
  %25 = call i8* @shapes$arrow2(i32 %23)
  %26 = call i8* @nish_cross_keep(i8* %25, i64 0, i64 %24)
  store i8* %26, i8** %y.addr, align 8
  %27 = load i32, i32* %i.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %30 = trunc i64 %29 to i32
  %31 = icmp slt i32 %27, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %33
  store i8* %34, i8** %38, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mapRange$i32$str$fn.11.pick$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i8*, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !18, !noalias !17, !tbaa !34
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @pick$arrow1(i32 %25)
  %28 = call i8* @nish_cross_keep(i8* %27, i64 0, i64 %26)
  store i8* %28, i8** %y.addr, align 8
  %29 = load i32, i32* %i.addr, align 4
  %30 = trunc i64 %5 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %y.addr, align 8
  %35 = bitcast i8* %7 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %33
  store i8* %34, i8** %36, align 8, !alias.scope !18, !noalias !17, !tbaa !27
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!35, !36, !37, !38, !39}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"AtomicI32", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"i64", !1, i64 0}
!8 = !{!"AtomicI64", !7, i64 0}
!9 = !{!8, !7, i64 0}
!10 = !{!"ptr", !1, i64 0}
!11 = !{!"Channel$str", !10, i64 0, !2, i64 8, !7, i64 16}
!12 = !{!11, !2, i64 8}
!13 = !{!11, !7, i64 16}
!14 = !{!"nish array"}
!15 = !{!"header", !14}
!16 = !{!"elements", !14}
!17 = !{!15}
!18 = !{!16}
!19 = !{!"header i64", !1, i64 0}
!20 = !{!"header ptr", !1, i64 0}
!21 = !{!"array header", !19, i64 0, !19, i64 8, !20, i64 16}
!22 = !{!21, !19, i64 0}
!23 = !{!21, !19, i64 8}
!24 = !{!21, !20, i64 16}
!25 = !{!11, !10, i64 0}
!26 = !{!"element ptr", !1, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{!"MutexGuard$str", !10, i64 0, !2, i64 8}
!29 = !{!28, !2, i64 8}
!30 = !{!28, !10, i64 0}
!31 = !{!"Mutex$str", !10, i64 0}
!32 = !{!31, !10, i64 0}
!33 = !{!"element i32", !1, i64 0}
!34 = !{!33, !33, i64 0}
!35 = !{i32 8, !"cf-protection-branch", i32 1}
!36 = !{i32 8, !"cf-protection-return", i32 1}
!37 = !{i32 8, !"branch-target-enforcement", i32 1}
!38 = !{i32 8, !"sign-return-address", i32 1}
!39 = !{i32 4, !"probe-stack", !"inline-asm"}
