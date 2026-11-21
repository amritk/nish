%struct.Leaf = type { i32 }
%struct.Outer = type { %struct.Leaf* }
%struct.Bag = type { %struct.nish_array* }
%struct.C = type { i32 }
%struct.B = type { %struct.C* }
%struct.A = type { %struct.B* }
%struct.Holder = type { %struct.Leaf* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef nonnull align 8 dereferenceable(4) %struct.Leaf* @makeLeaf() #0 {
entry:
  %o.addr = alloca %struct.Outer*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Outer*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Leaf*
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !4
  %5 = getelementptr inbounds %struct.Outer, %struct.Outer* %1, i32 0, i32 0
  store %struct.Leaf* %3, %struct.Leaf** %5, align 8, !tbaa !7
  store %struct.Outer* %1, %struct.Outer** %o.addr, align 8
  %6 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %7 = getelementptr inbounds %struct.Outer, %struct.Outer* %6, i32 0, i32 0
  %8 = load %struct.Leaf*, %struct.Leaf** %7, align 8, !tbaa !7
  %9 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %8, i32 0, i32 0
  store i32 4242, i32* %9, align 4, !tbaa !4
  %10 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %11 = getelementptr inbounds %struct.Outer, %struct.Outer* %10, i32 0, i32 0
  %12 = load %struct.Leaf*, %struct.Leaf** %11, align 8, !tbaa !7
  ret %struct.Leaf* %12
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @makeItems() #0 {
entry:
  %b.addr = alloca %struct.Bag*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Bag*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = getelementptr inbounds %struct.Bag, %struct.Bag* %1, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %7, align 8, !tbaa !20
  store %struct.Bag* %1, %struct.Bag** %b.addr, align 8
  %8 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %9 = getelementptr inbounds %struct.Bag, %struct.Bag* %8, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !20
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 17, i32* %19, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %21 = trunc i64 %20 to i32
  %22 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %23 = getelementptr inbounds %struct.Bag, %struct.Bag* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !20
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.C* @makeDeep() #0 {
entry:
  %a.addr = alloca %struct.A*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.A*
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.B*
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = bitcast i8* %4 to %struct.C*
  %6 = getelementptr inbounds %struct.C, %struct.C* %5, i32 0, i32 0
  store i32 0, i32* %6, align 4, !tbaa !24
  %7 = getelementptr inbounds %struct.B, %struct.B* %3, i32 0, i32 0
  store %struct.C* %5, %struct.C** %7, align 8, !tbaa !26
  %8 = getelementptr inbounds %struct.A, %struct.A* %1, i32 0, i32 0
  store %struct.B* %3, %struct.B** %8, align 8, !tbaa !28
  store %struct.A* %1, %struct.A** %a.addr, align 8
  %9 = load %struct.A*, %struct.A** %a.addr, align 8
  %10 = getelementptr inbounds %struct.A, %struct.A* %9, i32 0, i32 0
  %11 = load %struct.B*, %struct.B** %10, align 8, !tbaa !28
  %12 = getelementptr inbounds %struct.B, %struct.B* %11, i32 0, i32 0
  %13 = load %struct.C*, %struct.C** %12, align 8, !tbaa !26
  %14 = getelementptr inbounds %struct.C, %struct.C* %13, i32 0, i32 0
  store i32 31, i32* %14, align 4, !tbaa !24
  %15 = load %struct.A*, %struct.A** %a.addr, align 8
  %16 = getelementptr inbounds %struct.A, %struct.A* %15, i32 0, i32 0
  %17 = load %struct.B*, %struct.B** %16, align 8, !tbaa !28
  %18 = getelementptr inbounds %struct.B, %struct.B* %17, i32 0, i32 0
  %19 = load %struct.C*, %struct.C** %18, align 8, !tbaa !26
  ret %struct.C* %19
}

define internal void @fill(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h) #0 {
entry:
  %o.addr = alloca %struct.Outer*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Outer*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Leaf*
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !4
  %5 = getelementptr inbounds %struct.Outer, %struct.Outer* %1, i32 0, i32 0
  store %struct.Leaf* %3, %struct.Leaf** %5, align 8, !tbaa !7
  store %struct.Outer* %1, %struct.Outer** %o.addr, align 8
  %6 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %7 = getelementptr inbounds %struct.Outer, %struct.Outer* %6, i32 0, i32 0
  %8 = load %struct.Leaf*, %struct.Leaf** %7, align 8, !tbaa !7
  %9 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %8, i32 0, i32 0
  store i32 55, i32* %9, align 4, !tbaa !4
  %10 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %11 = getelementptr inbounds %struct.Outer, %struct.Outer* %10, i32 0, i32 0
  %12 = load %struct.Leaf*, %struct.Leaf** %11, align 8, !tbaa !7
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.Leaf* %12, %struct.Leaf** %13, align 8, !tbaa !30
  ret void
}

define internal void @keep(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into, %struct.Leaf* noundef nonnull align 8 dereferenceable(4) %leaf) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %into, i64 8)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = bitcast i8* %6 to %struct.Leaf**
  %8 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %7, i64 %1
  store %struct.Leaf* %leaf, %struct.Leaf** %8, align 8, !alias.scope !12, !noalias !11, !tbaa !32
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %10 = trunc i64 %9 to i32
  ret void
}

define internal void @share(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  %o.addr = alloca %struct.Outer*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Outer*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Leaf*
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !4
  %5 = getelementptr inbounds %struct.Outer, %struct.Outer* %1, i32 0, i32 0
  store %struct.Leaf* %3, %struct.Leaf** %5, align 8, !tbaa !7
  store %struct.Outer* %1, %struct.Outer** %o.addr, align 8
  %6 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %7 = getelementptr inbounds %struct.Outer, %struct.Outer* %6, i32 0, i32 0
  %8 = load %struct.Leaf*, %struct.Leaf** %7, align 8, !tbaa !7
  %9 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %8, i32 0, i32 0
  store i32 66, i32* %9, align 4, !tbaa !4
  %10 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %11 = getelementptr inbounds %struct.Outer, %struct.Outer* %10, i32 0, i32 0
  %12 = load %struct.Leaf*, %struct.Leaf** %11, align 8, !tbaa !7
  call void @keep(%struct.nish_array* %into, %struct.Leaf* %12)
  ret void
}

define internal void @capture(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  %o.addr = alloca %struct.Outer*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Outer*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Leaf*
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !4
  %5 = getelementptr inbounds %struct.Outer, %struct.Outer* %1, i32 0, i32 0
  store %struct.Leaf* %3, %struct.Leaf** %5, align 8, !tbaa !7
  store %struct.Outer* %1, %struct.Outer** %o.addr, align 8
  %6 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %7 = getelementptr inbounds %struct.Outer, %struct.Outer* %6, i32 0, i32 0
  %8 = load %struct.Leaf*, %struct.Leaf** %7, align 8, !tbaa !7
  %9 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %8, i32 0, i32 0
  store i32 77, i32* %9, align 4, !tbaa !4
  %10 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  call void @each$fn.14.capture$arrow0(%struct.nish_array* %into, %struct.Outer* %10)
  ret void
}

define internal noundef i32 @churn() #1 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 64
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 2
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %9, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %10, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %11 = bitcast [4 x i32]* %arr.data to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 %2, i32* %14, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 %4, i32* %15, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %16 = getelementptr inbounds i32, i32* %13, i64 2
  store i32 %6, i32* %16, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %17 = getelementptr inbounds i32, i32* %13, i64 3
  store i32 %8, i32* %17, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %18 = load i32, i32* %sum.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 3
  %24 = load i32, i32* %23, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %26, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %30 = load i32, i32* %sum.addr, align 4
  ret i32 %30

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %leaf.addr = alloca %struct.Leaf*, align 8
  %items.addr = alloca %struct.nish_array*, align 8
  %deep.addr = alloca %struct.C*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %last.addr = alloca %struct.Leaf*, align 8
  %i.addr = alloca i32, align 4
  %o.addr = alloca %struct.Outer*, align 8
  %stored.addr = alloca %struct.Leaf*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Leaf* @makeLeaf()
  store %struct.Leaf* %0, %struct.Leaf** %leaf.addr, align 8
  %1 = call %struct.nish_array* @makeItems()
  store %struct.nish_array* %1, %struct.nish_array** %items.addr, align 8
  %2 = call %struct.C* @makeDeep()
  store %struct.C* %2, %struct.C** %deep.addr, align 8
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store %struct.Leaf* null, %struct.Leaf** %3, align 8, !tbaa !30
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %4 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  call void @fill(%struct.Holder* %4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  call void @share(%struct.nish_array* %8)
  %9 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  call void @capture(%struct.nish_array* %9)
  store %struct.Leaf* null, %struct.Leaf** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 3
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = call i8* @nish_alloc_struct(i64 8)
  %13 = bitcast i8* %12 to %struct.Outer*
  %14 = call i8* @nish_alloc_struct(i64 4)
  %15 = bitcast i8* %14 to %struct.Leaf*
  %16 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %15, i32 0, i32 0
  store i32 0, i32* %16, align 4, !tbaa !4
  %17 = getelementptr inbounds %struct.Outer, %struct.Outer* %13, i32 0, i32 0
  store %struct.Leaf* %15, %struct.Leaf** %17, align 8, !tbaa !7
  store %struct.Outer* %13, %struct.Outer** %o.addr, align 8
  %18 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %19 = getelementptr inbounds %struct.Outer, %struct.Outer* %18, i32 0, i32 0
  %20 = load %struct.Leaf*, %struct.Leaf** %19, align 8, !tbaa !7
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 100, %21
  %23 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %20, i32 0, i32 0
  store i32 %22, i32* %23, align 4, !tbaa !4
  %24 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %25 = getelementptr inbounds %struct.Outer, %struct.Outer* %24, i32 0, i32 0
  %26 = load %struct.Leaf*, %struct.Leaf** %25, align 8, !tbaa !7
  store %struct.Leaf* %26, %struct.Leaf** %last.addr, align 8
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = call i32 @churn()
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.Leaf*, %struct.Leaf** %leaf.addr, align 8
  %32 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4, !tbaa !4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %38 = trunc i64 %37 to i32
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %49 = call i8* @nish_str_from_i32(i32 %48)
  call void @nish_print(i8* %49)
  %50 = load %struct.C*, %struct.C** %deep.addr, align 8
  %51 = getelementptr inbounds %struct.C, %struct.C* %50, i32 0, i32 0
  %52 = load i32, i32* %51, align 4, !tbaa !24
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
  %54 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %55 = getelementptr inbounds %struct.Holder, %struct.Holder* %54, i32 0, i32 0
  %56 = load %struct.Leaf*, %struct.Leaf** %55, align 8, !tbaa !30
  store %struct.Leaf* %56, %struct.Leaf** %stored.addr, align 8
  %57 = load %struct.Leaf*, %struct.Leaf** %stored.addr, align 8
  %58 = icmp ne %struct.Leaf* %57, null
  br i1 %58, label %if.then, label %if.end

if.then:
  %59 = load %struct.Leaf*, %struct.Leaf** %stored.addr, align 8
  %60 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %59, i32 0, i32 0
  %61 = load i32, i32* %60, align 4, !tbaa !4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  call void @nish_print(i8* %62)
  br label %if.end

if.end:
  %63 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %66 = icmp ult i64 0, %65
  br i1 %66, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %65)
  unreachable

bounds.ok.1:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %69 = bitcast i8* %68 to %struct.Leaf**
  %70 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %69, i64 0
  %71 = load %struct.Leaf*, %struct.Leaf** %70, align 8, !alias.scope !12, !noalias !11, !tbaa !32
  %72 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %71, i32 0, i32 0
  %73 = load i32, i32* %72, align 4, !tbaa !4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  call void @nish_print(i8* %74)
  %75 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %78 = icmp ult i64 1, %77
  br i1 %78, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %77)
  unreachable

bounds.ok.2:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %81 = bitcast i8* %80 to %struct.Leaf**
  %82 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %81, i64 1
  %83 = load %struct.Leaf*, %struct.Leaf** %82, align 8, !alias.scope !12, !noalias !11, !tbaa !32
  %84 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %83, i32 0, i32 0
  %85 = load i32, i32* %84, align 4, !tbaa !4
  %86 = call i8* @nish_str_from_i32(i32 %85)
  call void @nish_print(i8* %86)
  %87 = load %struct.Leaf*, %struct.Leaf** %last.addr, align 8
  %88 = icmp ne %struct.Leaf* %87, null
  br i1 %88, label %if.then.1, label %if.end.1

if.then.1:
  %89 = load %struct.Leaf*, %struct.Leaf** %last.addr, align 8
  %90 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %89, i32 0, i32 0
  %91 = load i32, i32* %90, align 4, !tbaa !4
  %92 = call i8* @nish_str_from_i32(i32 %91)
  call void @nish_print(i8* %92)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @capture$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into, %struct.Outer* noundef nonnull readonly align 8 dereferenceable(8) nocapture %o) #0 {
entry:
  %0 = getelementptr inbounds %struct.Outer, %struct.Outer* %o, i32 0, i32 0
  %1 = load %struct.Leaf*, %struct.Leaf** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %into, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %9 = bitcast i8* %8 to %struct.Leaf**
  %10 = getelementptr inbounds %struct.Leaf*, %struct.Leaf** %9, i64 %3
  store %struct.Leaf* %1, %struct.Leaf** %10, align 8, !alias.scope !12, !noalias !11, !tbaa !32
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %12 = trunc i64 %11 to i32
  ret void
}

define internal void @each$fn.14.capture$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.Outer* noundef nonnull readonly align 8 dereferenceable(8) nocapture %cap.1) #0 {
entry:
  call void @capture$arrow0(%struct.nish_array* %cap.0, %struct.Outer* %cap.1)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!33, !34, !35, !36, !37}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Leaf", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Outer", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"Bag", !5, i64 0}
!20 = !{!19, !5, i64 0}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"C", !2, i64 0}
!24 = !{!23, !2, i64 0}
!25 = !{!"B", !5, i64 0}
!26 = !{!25, !5, i64 0}
!27 = !{!"A", !5, i64 0}
!28 = !{!27, !5, i64 0}
!29 = !{!"Holder", !5, i64 0}
!30 = !{!29, !5, i64 0}
!31 = !{!"element ptr", !1, i64 0}
!32 = !{!31, !31, i64 0}
!33 = !{i32 8, !"cf-protection-branch", i32 1}
!34 = !{i32 8, !"cf-protection-return", i32 1}
!35 = !{i32 8, !"branch-target-enforcement", i32 1}
!36 = !{i32 8, !"sign-return-address", i32 1}
!37 = !{i32 4, !"probe-stack", !"inline-asm"}
