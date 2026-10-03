%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define void @fieldScale(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %3 to i32
  %12 = icmp slt i32 %10, %11
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %5 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %16
  %19 = load i32, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %19, i32 2)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = icmp ult i64 %14, %7
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %7)
  unreachable

bounds.ok:
  %24 = bitcast i8* %9 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %14
  store i32 %21, i32* %25, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define void @constScale(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %2 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = trunc i64 %4 to i32
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %6 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %21 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %20, i32 2)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  %24 = icmp ult i64 %15, %8
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %8)
  unreachable

bounds.ok:
  %25 = bitcast i8* %10 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %15
  store i32 %22, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @grown(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !4
  %4 = load i32, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  store i32 %4, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = trunc i64 %14 to i32
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = trunc i64 %21 to i32
  ret i32 %22
}

define noundef i32 @guarded(%struct.Holder* noundef readonly align 8 nocapture %h, i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = icmp ne %struct.Holder* %h, null
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %s.addr, align 4
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %s.addr, align 4
  br label %if.end

if.end:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %s.addr, align 4
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @replaced(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %other) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %s.addr, align 4
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !4
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %s.addr, align 4
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %other, %struct.nish_array** %18, align 8, !tbaa !4
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %s.addr, align 4
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @declaredInside(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hs, i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca %struct.Holder*, align 8
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = icmp ult i64 0, %1
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %7 = bitcast i8* %3 to %struct.Holder**
  %8 = getelementptr inbounds %struct.Holder*, %struct.Holder** %7, i64 0
  %9 = load %struct.Holder*, %struct.Holder** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  store %struct.Holder* %9, %struct.Holder** %h.addr, align 8
  %10 = load i32, i32* %s.addr, align 4
  %11 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %11, i32 0, i32 0
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = icmp ult i64 0, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  %21 = load i32, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %s.addr, align 4
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %27 = load i32, i32* %s.addr, align 4
  ret i32 %27

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %a.addr = alloca i32, align 4
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %b.addr = alloca i32, align 4
  %Holder.obj.2 = alloca %struct.Holder, align 8
  %Holder.obj.3 = alloca %struct.Holder, align 8
  %Holder.obj.4 = alloca %struct.Holder, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x %struct.Holder*], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %1, %struct.nish_array** %src.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %13 = mul i64 4, 4
  %14 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %17)
  call void @fieldScale(%struct.nish_array* %16, %struct.Holder* %Holder.obj)
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  %23 = load i32, i32* %22, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %24 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 1
  %29 = load i32, i32* %28, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 2
  %38 = load i32, i32* %37, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %42 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 3
  %47 = load i32, i32* %46, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %49, i32* %a.addr, align 4
  %51 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1, %struct.nish_array* %52)
  call void @constScale(%struct.nish_array* %51, %struct.Holder* %Holder.obj.1)
  %53 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 0
  %58 = load i32, i32* %57, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %59 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %62 = bitcast i8* %61 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 1
  %64 = load i32, i32* %63, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %64)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %68 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %71 = bitcast i8* %70 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 2
  %73 = load i32, i32* %72, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %74 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %73)
  %75 = extractvalue { i32, i1 } %74, 0
  %76 = extractvalue { i32, i1 } %74, 1
  br i1 %76, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %77 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %80 = bitcast i8* %79 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 3
  %82 = load i32, i32* %81, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %75, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %84, i32* %b.addr, align 4
  %86 = load i32, i32* %a.addr, align 4
  %87 = load i32, i32* %b.addr, align 4
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %91 = call i8* @nish_alloc_struct(i64 24)
  %92 = bitcast i8* %91 to %struct.nish_array*
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  store i64 1, i64* %93, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 1
  store i64 1, i64* %94, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %95 = call i8* @nish_alloc_struct(i64 4)
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  store i8* %95, i8** %96, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %97 = bitcast i8* %95 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 0
  store i32 0, i32* %98, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2, %struct.nish_array* %92)
  %99 = call i32 @grown(%struct.Holder* %Holder.obj.2)
  %100 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 %99)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %103 = call i32 @guarded(%struct.Holder* null, i32 0)
  %104 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %101, i32 %103)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %107 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.3, %struct.nish_array* %107)
  %108 = call i32 @guarded(%struct.Holder* %Holder.obj.3, i32 4)
  %109 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 %108)
  %110 = extractvalue { i32, i1 } %109, 0
  %111 = extractvalue { i32, i1 } %109, 1
  br i1 %111, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %112 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.4, %struct.nish_array* %112)
  %113 = call i8* @nish_alloc_struct(i64 24)
  %114 = bitcast i8* %113 to %struct.nish_array*
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  store i64 3, i64* %115, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 1
  store i64 3, i64* %116, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %117 = call i8* @nish_alloc_struct(i64 12)
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  store i8* %117, i8** %118, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %119 = bitcast i8* %117 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 0
  store i32 9, i32* %120, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %121 = getelementptr inbounds i32, i32* %119, i64 1
  store i32 9, i32* %121, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %122 = getelementptr inbounds i32, i32* %119, i64 2
  store i32 9, i32* %122, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %123 = call i32 @replaced(%struct.Holder* %Holder.obj.4, %struct.nish_array* %114)
  %124 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %110, i32 %123)
  %125 = extractvalue { i32, i1 } %124, 0
  %126 = extractvalue { i32, i1 } %124, 1
  br i1 %126, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %127 = call i8* @nish_alloc_struct(i64 8)
  %128 = bitcast i8* %127 to %struct.Holder*
  %129 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %128, %struct.nish_array* %129)
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %130, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %131, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %132 = bitcast [1 x %struct.Holder*]* %arr.data.1 to i8*
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %132, i8** %133, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %134 = bitcast i8* %132 to %struct.Holder**
  %135 = getelementptr inbounds %struct.Holder*, %struct.Holder** %134, i64 0
  store %struct.Holder* %128, %struct.Holder** %135, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %136 = call i32 @declaredInside(%struct.nish_array* %arr.hdr.1, i32 3)
  %137 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %125, i32 %136)
  %138 = extractvalue { i32, i1 } %137, 0
  %139 = extractvalue { i32, i1 } %137, 1
  br i1 %139, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %138

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
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
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
