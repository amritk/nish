%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9
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
  %19 = load i32, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %20 = mul nsw i32 %19, 2
  %21 = icmp ult i64 %14, %7
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %7)
  unreachable

bounds.ok:
  %22 = bitcast i8* %9 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %14
  store i32 %20, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void
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
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9
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
  %20 = load i32, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %21 = mul nsw i32 %20, 2
  %22 = icmp ult i64 %15, %8
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %8)
  unreachable

bounds.ok:
  %23 = bitcast i8* %10 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %15
  store i32 %21, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void
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
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  store i32 %4, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !8, !noalias !9
  %15 = trunc i64 %14 to i32
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9
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
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %16 = add nsw i32 %3, %15
  store i32 %16, i32* %s.addr, align 4
  br label %if.end

if.end:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %s.addr, align 4
  ret i32 %19
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
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %15 = add nsw i32 %2, %14
  store i32 %15, i32* %s.addr, align 4
  %16 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.nish_array* %other, %struct.nish_array** %16, align 8, !tbaa !4
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %s.addr, align 4
  ret i32 %19
}

define noundef i32 @declaredInside(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hs, i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca %struct.Holder*, align 8
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9
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
  %9 = load %struct.Holder*, %struct.Holder** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !13
  store %struct.Holder* %9, %struct.Holder** %h.addr, align 8
  %10 = load i32, i32* %s.addr, align 4
  %11 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %11, i32 0, i32 0
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9
  %16 = icmp ult i64 0, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  %21 = load i32, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %22 = add nsw i32 %10, %21
  store i32 %22, i32* %s.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %s.addr, align 4
  ret i32 %25
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
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %src.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %11, align 8, !alias.scope !8, !noalias !9
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %12, align 8, !alias.scope !8, !noalias !9
  %13 = mul i64 4, 4
  %14 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %17)
  call void @fieldScale(%struct.nish_array* %16, %struct.Holder* %Holder.obj)
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  %26 = load i32, i32* %25, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %27 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !8, !noalias !9
  %30 = icmp ult i64 1, %29
  br i1 %30, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %29)
  unreachable

bounds.ok.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !8, !noalias !9
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 1
  %35 = load i32, i32* %34, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %36 = add nsw i32 %26, %35
  %37 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9
  %40 = icmp ult i64 2, %39
  br i1 %40, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %39)
  unreachable

bounds.ok.2:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !8, !noalias !9
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 2
  %45 = load i32, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %46 = add nsw i32 %36, %45
  %47 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !8, !noalias !9
  %50 = icmp ult i64 3, %49
  br i1 %50, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %49)
  unreachable

bounds.ok.3:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !8, !noalias !9
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 3
  %55 = load i32, i32* %54, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %56 = add nsw i32 %46, %55
  store i32 %56, i32* %a.addr, align 4
  %57 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1, %struct.nish_array* %58)
  call void @constScale(%struct.nish_array* %57, %struct.Holder* %Holder.obj.1)
  %59 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !8, !noalias !9
  %62 = icmp ult i64 0, %61
  br i1 %62, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %61)
  unreachable

bounds.ok.4:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !8, !noalias !9
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 0
  %67 = load i32, i32* %66, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %68 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !8, !noalias !9
  %71 = icmp ult i64 1, %70
  br i1 %71, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %70)
  unreachable

bounds.ok.5:
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !8, !noalias !9
  %74 = bitcast i8* %73 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 1
  %76 = load i32, i32* %75, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %77 = add nsw i32 %67, %76
  %78 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !8, !noalias !9
  %81 = icmp ult i64 2, %80
  br i1 %81, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %80)
  unreachable

bounds.ok.6:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !8, !noalias !9
  %84 = bitcast i8* %83 to i32*
  %85 = getelementptr inbounds i32, i32* %84, i64 2
  %86 = load i32, i32* %85, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %87 = add nsw i32 %77, %86
  %88 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !8, !noalias !9
  %91 = icmp ult i64 3, %90
  br i1 %91, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 3, i64 %90)
  unreachable

bounds.ok.7:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !8, !noalias !9
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 3
  %96 = load i32, i32* %95, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %97 = add nsw i32 %87, %96
  store i32 %97, i32* %b.addr, align 4
  %98 = load i32, i32* %a.addr, align 4
  %99 = load i32, i32* %b.addr, align 4
  %100 = add nsw i32 %98, %99
  %101 = call i8* @nish_alloc_struct(i64 24)
  %102 = bitcast i8* %101 to %struct.nish_array*
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  store i64 1, i64* %103, align 8, !alias.scope !8, !noalias !9
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 1
  store i64 1, i64* %104, align 8, !alias.scope !8, !noalias !9
  %105 = call i8* @nish_alloc_struct(i64 4)
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  store i8* %105, i8** %106, align 8, !alias.scope !8, !noalias !9
  %107 = bitcast i8* %105 to i32*
  %108 = getelementptr inbounds i32, i32* %107, i64 0
  store i32 0, i32* %108, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2, %struct.nish_array* %102)
  %109 = call i32 @grown(%struct.Holder* %Holder.obj.2)
  %110 = add nsw i32 %100, %109
  %111 = call i32 @guarded(%struct.Holder* null, i32 0)
  %112 = add nsw i32 %110, %111
  %113 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.3, %struct.nish_array* %113)
  %114 = call i32 @guarded(%struct.Holder* %Holder.obj.3, i32 4)
  %115 = add nsw i32 %112, %114
  %116 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.4, %struct.nish_array* %116)
  %117 = call i8* @nish_alloc_struct(i64 24)
  %118 = bitcast i8* %117 to %struct.nish_array*
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  store i64 3, i64* %119, align 8, !alias.scope !8, !noalias !9
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 1
  store i64 3, i64* %120, align 8, !alias.scope !8, !noalias !9
  %121 = call i8* @nish_alloc_struct(i64 12)
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  store i8* %121, i8** %122, align 8, !alias.scope !8, !noalias !9
  %123 = bitcast i8* %121 to i32*
  %124 = getelementptr inbounds i32, i32* %123, i64 0
  store i32 9, i32* %124, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %125 = getelementptr inbounds i32, i32* %123, i64 1
  store i32 9, i32* %125, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %126 = getelementptr inbounds i32, i32* %123, i64 2
  store i32 9, i32* %126, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %127 = call i32 @replaced(%struct.Holder* %Holder.obj.4, %struct.nish_array* %118)
  %128 = add nsw i32 %115, %127
  %129 = call i8* @nish_alloc_struct(i64 8)
  %130 = bitcast i8* %129 to %struct.Holder*
  %131 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Holder.constructor(%struct.Holder* %130, %struct.nish_array* %131)
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %132, align 8, !alias.scope !8, !noalias !9
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %133, align 8, !alias.scope !8, !noalias !9
  %134 = bitcast [1 x %struct.Holder*]* %arr.data.1 to i8*
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %134, i8** %135, align 8, !alias.scope !8, !noalias !9
  %136 = bitcast i8* %134 to %struct.Holder**
  %137 = getelementptr inbounds %struct.Holder*, %struct.Holder** %136, i64 0
  store %struct.Holder* %130, %struct.Holder** %137, align 8, !alias.scope !9, !noalias !8, !tbaa !13
  %138 = call i32 @declaredInside(%struct.nish_array* %arr.hdr.1, i32 3)
  %139 = add nsw i32 %128, %138
  ret i32 %139
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"element ptr", !1, i64 0}
!13 = !{!12, !12, i64 0}
