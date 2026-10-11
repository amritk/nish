%struct.ThreadScope = type { i32 }
%struct.Channel$i32 = type { %struct.nish_array*, i32, i64 }
%struct.Pipe = type { %struct.Channel$i32*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef i32 @produce(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i32 @consume(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #1
declare void @nish_channel_send(i64* noundef nonnull, i64 noundef) #1
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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
  call void @nish_write(i8* %4, i32 2, i1 true)
  call void @nish_exit(i32 1)
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
  call void @nish_write(i8* %5, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.ThreadScope*
  %2 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  ret %struct.ThreadScope* %1
}

define void @nish.Channel$i32.constructor(%struct.Channel$i32* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !8
  %1 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 2
  store i64 0, i64* %1, align 8, !tbaa !9
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %7 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %7, align 8, !tbaa !21
  ret void
}

define void @nish.Channel$i32.send(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture %this, i32 noundef %x) #1 {
entry:
  %0 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 2
  %1 = zext i32 %x to i64
  call void @nish_channel_send(i64* %0, i64 %1)
  ret void
}

define noundef i32 @nish.Channel$i32.take(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %x.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !8
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  %12 = load i32, i32* %11, align 4, !alias.scope !14, !noalias !13, !tbaa !23
  store i32 %12, i32* %x.addr, align 4
  %13 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !8
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 1
  store i32 %16, i32* %18, align 4, !tbaa !8
  %19 = load i32, i32* %x.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef zeroext i1 @nish.Channel$i32.ready(%struct.Channel$i32* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !8
  %2 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %this, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !21
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %1, %6
  ret i1 %7
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Pipe*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Pipe*, %struct.Pipe** %1
  %3 = call i32 @produce(%struct.Pipe* %2)
  %4 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %3, i32* %4
  %5 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %2, i32 0, i32 0
  %6 = load %struct.Channel$i32*, %struct.Channel$i32** %5
  %7 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %6, i32 0, i32 2
  call void @nish_channel_count(i64* %7, i64 -1)
  ret void
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce$finish(i8* noundef %p) #1 {
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

define void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Pipe* noundef nonnull align 8 dereferenceable(16) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Pipe*, %struct.nish_array*, i32, i32 }, align 8
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %at, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = trunc i64 %7 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %8)
  br label %if.end

if.end:
  %9 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store %struct.Pipe* %arg, %struct.Pipe** %9
  %10 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %10
  %11 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %11
  %12 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %arg, i32 0, i32 0
  %13 = load %struct.Channel$i32*, %struct.Channel$i32** %12
  %14 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %13, i32 0, i32 2
  call void @nish_channel_count(i64* %14, i64 1)
  %15 = bitcast { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce$run, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce$finish, i8* %15, i64 ptrtoint ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }* getelementptr ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Pipe*, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Pipe*, %struct.Pipe** %1
  %3 = call i32 @consume(%struct.Pipe* %2)
  %4 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %3, i32* %4
  ret void
}

define internal void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume$finish(i8* noundef %p) #1 {
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

define void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Pipe* noundef nonnull align 8 dereferenceable(16) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Pipe*, %struct.nish_array*, i32, i32 }, align 8
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %at, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = trunc i64 %7 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %8)
  br label %if.end

if.end:
  %9 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store %struct.Pipe* %arg, %struct.Pipe** %9
  %10 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %10
  %11 = getelementptr inbounds { %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %11
  %12 = bitcast { %struct.Pipe*, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %13 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %13, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume$run, void (i8*)* @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume$finish, i8* %12, i64 ptrtoint ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }* getelementptr ({ %struct.Pipe*, %struct.nish_array*, i32, i32 }, { %struct.Pipe*, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.runTask$$Pipe$i32$fn.7.produce(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @produce(%struct.Pipe* %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.runTask$$Pipe$i32$fn.7.consume(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @consume(%struct.Pipe* %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.storeResult$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i32 noundef %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  store i32 %r, i32* %10, align 4, !alias.scope !14, !noalias !13, !tbaa !23
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"i64", !1, i64 0}
!7 = !{!"Channel$i32", !5, i64 0, !2, i64 8, !6, i64 16}
!8 = !{!7, !2, i64 8}
!9 = !{!7, !6, i64 16}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!7, !5, i64 0}
!22 = !{!"element i32", !1, i64 0}
!23 = !{!22, !22, i64 0}
