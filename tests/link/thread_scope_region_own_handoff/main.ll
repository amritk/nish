%struct.Inner = type { i32 }
%struct.Holder = type { %struct.Inner*, { %struct.nish_array, [1 x i32] } }
%struct.Wrap = type { %struct.nish_array* }
%struct.Counter = type { i32, %struct.Inner* }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Holder$i32$fn.5.read$(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Holder* noundef nonnull align 8 dereferenceable(40), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Inner*
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Inner* %1, %struct.Inner** %3, align 8, !tbaa !7
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1, i32 0
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 5, i32* %8, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 1, i64* %9, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  ret void
}

define internal void @Wrap.constructor(%struct.Wrap* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Inner*
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 1, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 1, i64* %6, align 8, !alias.scope !11, !noalias !12, !tbaa !19
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %9 = bitcast i8* %7 to %struct.Inner**
  %10 = getelementptr inbounds %struct.Inner*, %struct.Inner** %9, i64 0
  store %struct.Inner* %1, %struct.Inner** %10, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %11 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %this, i32 0, i32 0
  store %struct.nish_array* %4, %struct.nish_array** %11, align 8, !tbaa !24
  ret void
}

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !26
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Inner*
  %3 = getelementptr inbounds %struct.Inner, %struct.Inner* %2, i32 0, i32 0
  store i32 0, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store %struct.Inner* %2, %struct.Inner** %4, align 8, !tbaa !27
  ret void
}

define internal void @Counter.reset(%struct.Counter* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !26
  ret void
}

define hidden noundef i32 @read$(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(40) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Inner*, %struct.Inner** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 0
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 1, i64 0
  %9 = bitcast i32* %8 to i8*
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  %12 = load i32, i32* %11, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Wrap* @build(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(40) nocapture %src) #1 {
entry:
  %w.addr = alloca %struct.Wrap*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Wrap*
  call void @Wrap.constructor(%struct.Wrap* %1)
  store %struct.Wrap* %1, %struct.Wrap** %w.addr, align 8
  %2 = load %struct.Wrap*, %struct.Wrap** %w.addr, align 8
  %3 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %2, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !24
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = bitcast i8* %5 to %struct.Inner*
  %7 = getelementptr inbounds %struct.Inner, %struct.Inner* %6, i32 0, i32 0
  store i32 0, i32* %7, align 4, !tbaa !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !11, !noalias !12, !tbaa !19
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %4, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %15 = bitcast i8* %14 to %struct.Inner**
  %16 = getelementptr inbounds %struct.Inner*, %struct.Inner** %15, i64 %9
  store %struct.Inner* %6, %struct.Inner** %16, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %18 = trunc i64 %17 to i32
  %19 = load %struct.Wrap*, %struct.Wrap** %w.addr, align 8
  %20 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %19, i32 0, i32 0
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !24
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %27 = bitcast i8* %26 to %struct.Inner**
  %28 = getelementptr inbounds %struct.Inner*, %struct.Inner** %27, i64 0
  %29 = load %struct.Inner*, %struct.Inner** %28, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %30 = getelementptr inbounds %struct.Holder, %struct.Holder* %src, i32 0, i32 1, i32 0
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %33 = icmp ult i64 0, %32
  br i1 %33, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %32)
  unreachable

bounds.ok.1:
  %34 = getelementptr inbounds %struct.Holder, %struct.Holder* %src, i32 0, i32 1, i32 1, i64 0
  %35 = bitcast i32* %34 to i8*
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 0
  %38 = load i32, i32* %37, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  %39 = getelementptr inbounds %struct.Inner, %struct.Inner* %29, i32 0, i32 0
  store i32 %38, i32* %39, align 4, !tbaa !4
  %40 = load %struct.Wrap*, %struct.Wrap** %w.addr, align 8
  ret %struct.Wrap* %40
}

define internal noundef i32 @count(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(40) nocapture %h) #1 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  call void @Counter.constructor(%struct.Counter* %Counter.obj)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %0 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  call void @Counter.reset(%struct.Counter* %0, i32 %9)
  %10 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %11 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %12 = getelementptr inbounds %struct.Counter, %struct.Counter* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !26
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Counter, %struct.Counter* %10, i32 0, i32 0
  store i32 %15, i32* %17, align 4, !tbaa !26
  %18 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %19 = getelementptr inbounds %struct.Counter, %struct.Counter* %18, i32 0, i32 1
  %20 = load %struct.Inner*, %struct.Inner** %19, align 8, !tbaa !27
  %21 = getelementptr inbounds %struct.Inner, %struct.Inner* %20, i32 0, i32 0
  store i32 3, i32* %21, align 4, !tbaa !4
  %22 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %23 = getelementptr inbounds %struct.Counter, %struct.Counter* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !26
  %25 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %24, i32 10)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %28 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %29 = getelementptr inbounds %struct.Counter, %struct.Counter* %28, i32 0, i32 1
  %30 = load %struct.Inner*, %struct.Inner** %29, align 8, !tbaa !27
  %31 = getelementptr inbounds %struct.Inner, %struct.Inner* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %34

ovf.fail:
  %ovf.op = phi i32 [ 0, %bounds.ok ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %w.addr = alloca %struct.Wrap*, align 8
  %counted.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 40)
  %1 = bitcast i8* %0 to %struct.Holder*
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 1, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !19
  %5 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 1, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  call void @Holder.constructor(%struct.Holder* %1)
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 1, i64* %10, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 1, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !19
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 0, i32* %15, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  store %struct.nish_array* %9, %struct.nish_array** %done.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Wrap*
  call void @Wrap.constructor(%struct.Wrap* %17)
  store %struct.Wrap* %17, %struct.Wrap** %w.addr, align 8
  store i32 0, i32* %counted.addr, align 4
  %18 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %18, %struct.ThreadScope** %s.addr, align 8
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = bitcast %struct.ThreadScope* %19 to i8*
  %21 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %22 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Holder$i32$fn.5.read$(%struct.ThreadScope* %21, %struct.Holder* %22, %struct.nish_array* %23, i32 0)
  %24 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %25 = call %struct.Wrap* @build(%struct.Holder* %24)
  store %struct.Wrap* %25, %struct.Wrap** %w.addr, align 8
  %26 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %27 = call i32 @count(%struct.Holder* %26)
  store i32 %27, i32* %counted.addr, align 4
  call void @nish_scope_join(i8* %20)
  %28 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %31 = icmp ult i64 0, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  %36 = load i32, i32* %35, align 4, !alias.scope !12, !noalias !11, !tbaa !14
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load %struct.Wrap*, %struct.Wrap** %w.addr, align 8
  %40 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %39, i32 0, i32 0
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !tbaa !24
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok.1:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %47 = bitcast i8* %46 to %struct.Inner**
  %48 = getelementptr inbounds %struct.Inner*, %struct.Inner** %47, i64 0
  %49 = load %struct.Inner*, %struct.Inner** %48, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %50 = getelementptr inbounds %struct.Inner, %struct.Inner* %49, i32 0, i32 0
  %51 = load i32, i32* %50, align 4, !tbaa !4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* %38, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %55 = load %struct.Wrap*, %struct.Wrap** %w.addr, align 8
  %56 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %55, i32 0, i32 0
  %57 = load %struct.nish_array*, %struct.nish_array** %56, align 8, !tbaa !24
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %60 = trunc i64 %59 to i32
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %54, i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %64 = load i32, i32* %counted.addr, align 4
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %63, i8* %65)
  call void @nish_print(i8* %66)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Inner", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Holder", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"element i32", !1, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"Wrap", !5, i64 0}
!24 = !{!23, !5, i64 0}
!25 = !{!"Counter", !2, i64 0, !5, i64 8}
!26 = !{!25, !2, i64 0}
!27 = !{!25, !5, i64 8}
