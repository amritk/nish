%struct.Disk = type { i32, %struct.Disk* }
%struct.Holder = type { %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

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

define void @Disk.constructor(%struct.Disk* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %size) #0 {
entry:
  %0 = getelementptr inbounds %struct.Disk, %struct.Disk* %this, i32 0, i32 0
  store i32 %size, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Disk, %struct.Disk* %this, i32 0, i32 1
  store %struct.Disk* null, %struct.Disk** %1, align 8, !tbaa !6
  ret void
}

define void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !10, !noalias !11
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !10, !noalias !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !10, !noalias !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8, !tbaa !15
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !10, !noalias !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !10, !noalias !11
  %13 = call i8* @nish_alloc_struct(i64 16)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !10, !noalias !11
  %15 = bitcast i8* %13 to %struct.Disk**
  %16 = getelementptr inbounds %struct.Disk*, %struct.Disk** %15, i64 0
  store %struct.Disk* null, %struct.Disk** %16, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  %17 = getelementptr inbounds %struct.Disk*, %struct.Disk** %15, i64 1
  store %struct.Disk* null, %struct.Disk** %17, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.nish_array* %10, %struct.nish_array** %18, align 8, !tbaa !18
  ret void
}

define internal void @grow(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 4)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !10, !noalias !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  store i32 7, i32* %10, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !10, !noalias !11
  %12 = trunc i64 %11 to i32
  ret void
}

define internal noundef i32 @viaAlias(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h, %struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %other) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !10, !noalias !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !10, !noalias !11
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !10, !noalias !11
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 5, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 6, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %other, i32 0, i32 0
  store %struct.nish_array* %10, %struct.nish_array** %18, align 8, !tbaa !15
  %19 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !15
  %21 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !10, !noalias !11
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %31 = add nsw i32 %30, 1
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11
  %34 = icmp ult i64 0, %33
  br i1 %34, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %33)
  unreachable

bounds.ok.2:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !10, !noalias !11
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  store i32 %31, i32* %38, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %39 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !15
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !10, !noalias !11
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok.3:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !10, !noalias !11
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %49 = mul nsw i32 %48, 10
  %50 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !15
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !10, !noalias !11
  %54 = trunc i64 %53 to i32
  %55 = add nsw i32 %49, %54
  ret i32 %55
}

define internal noundef i32 @viaCallee(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 3, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  call void @grow(%struct.Holder* %h)
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11
  %13 = trunc i64 %12 to i32
  %14 = mul nsw i32 %13, 10
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !15
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11
  %21 = trunc i64 %20 to i32
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  %31 = load i32, i32* %30, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %32 = add nsw i32 %14, %31
  ret i32 %32
}

define internal noundef i32 @viaPointers(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %top.addr = alloca %struct.Disk*, align 8
  %under.addr = alloca %struct.Disk*, align 8
  %first.addr = alloca %struct.Disk*, align 8
  %second.addr = alloca %struct.Disk*, align 8
  %below.addr = alloca %struct.Disk*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Disk*
  call void @Disk.constructor(%struct.Disk* %1, i32 4)
  store %struct.Disk* %1, %struct.Disk** %top.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !18
  %4 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !10, !noalias !11
  %10 = bitcast i8* %9 to %struct.Disk**
  %11 = getelementptr inbounds %struct.Disk*, %struct.Disk** %10, i64 0
  store %struct.Disk* %4, %struct.Disk** %11, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  %12 = call i8* @nish_alloc_struct(i64 16)
  %13 = bitcast i8* %12 to %struct.Disk*
  call void @Disk.constructor(%struct.Disk* %13, i32 9)
  store %struct.Disk* %13, %struct.Disk** %under.addr, align 8
  %14 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %15 = load %struct.Disk*, %struct.Disk** %under.addr, align 8
  %16 = getelementptr inbounds %struct.Disk, %struct.Disk* %14, i32 0, i32 1
  store %struct.Disk* %15, %struct.Disk** %16, align 8, !tbaa !6
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !18
  %19 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %20 = getelementptr inbounds %struct.Disk, %struct.Disk* %19, i32 0, i32 1
  %21 = load %struct.Disk*, %struct.Disk** %20, align 8, !tbaa !6
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11
  %24 = icmp ult i64 1, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !10, !noalias !11
  %27 = bitcast i8* %26 to %struct.Disk**
  %28 = getelementptr inbounds %struct.Disk*, %struct.Disk** %27, i64 1
  store %struct.Disk* %21, %struct.Disk** %28, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  %29 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !18
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !10, !noalias !11
  %33 = icmp ult i64 0, %32
  br i1 %33, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %32)
  unreachable

bounds.ok.2:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !10, !noalias !11
  %36 = bitcast i8* %35 to %struct.Disk**
  %37 = getelementptr inbounds %struct.Disk*, %struct.Disk** %36, i64 0
  %38 = load %struct.Disk*, %struct.Disk** %37, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  store %struct.Disk* %38, %struct.Disk** %first.addr, align 8
  %39 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !18
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !10, !noalias !11
  %43 = icmp ult i64 1, %42
  br i1 %43, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %42)
  unreachable

bounds.ok.3:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !10, !noalias !11
  %46 = bitcast i8* %45 to %struct.Disk**
  %47 = getelementptr inbounds %struct.Disk*, %struct.Disk** %46, i64 1
  %48 = load %struct.Disk*, %struct.Disk** %47, align 8, !alias.scope !11, !noalias !10, !tbaa !17
  store %struct.Disk* %48, %struct.Disk** %second.addr, align 8
  %49 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %50 = icmp eq %struct.Disk* %49, null
  br i1 %50, label %lor.end, label %lor.rhs

lor.rhs:
  %51 = load %struct.Disk*, %struct.Disk** %second.addr, align 8
  %52 = icmp eq %struct.Disk* %51, null
  br label %lor.end

lor.end:
  %53 = phi i1 [ true, %bounds.ok.3 ], [ %52, %lor.rhs ]
  br i1 %53, label %if.then, label %if.end

if.then:
  %54 = sub nsw i32 0, 1
  ret i32 %54

if.end:
  %55 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %56 = getelementptr inbounds %struct.Disk, %struct.Disk* %55, i32 0, i32 1
  %57 = load %struct.Disk*, %struct.Disk** %56, align 8, !tbaa !6
  store %struct.Disk* %57, %struct.Disk** %below.addr, align 8
  %58 = load %struct.Disk*, %struct.Disk** %below.addr, align 8
  %59 = icmp eq %struct.Disk* %58, null
  br i1 %59, label %if.then.1, label %if.end.1

if.then.1:
  %60 = sub nsw i32 0, 2
  ret i32 %60

if.end.1:
  %61 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %62 = getelementptr inbounds %struct.Disk, %struct.Disk* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4, !tbaa !5
  %64 = mul nsw i32 %63, 100
  %65 = load %struct.Disk*, %struct.Disk** %second.addr, align 8
  %66 = getelementptr inbounds %struct.Disk, %struct.Disk* %65, i32 0, i32 0
  %67 = load i32, i32* %66, align 4, !tbaa !5
  %68 = mul nsw i32 %67, 10
  %69 = add nsw i32 %64, %68
  %70 = load %struct.Disk*, %struct.Disk** %below.addr, align 8
  %71 = getelementptr inbounds %struct.Disk, %struct.Disk* %70, i32 0, i32 0
  %72 = load i32, i32* %71, align 4, !tbaa !5
  %73 = add nsw i32 %69, %72
  ret i32 %73
}

define noundef i32 @test() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %c.addr = alloca i32, align 4
  %Holder.obj.2 = alloca %struct.Holder, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %0 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %1 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %2 = call i32 @viaAlias(%struct.Holder* %0, %struct.Holder* %1)
  store i32 %2, i32* %a.addr, align 4
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1)
  %3 = call i32 @viaCallee(%struct.Holder* %Holder.obj.1)
  store i32 %3, i32* %b.addr, align 4
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2)
  %4 = call i32 @viaPointers(%struct.Holder* %Holder.obj.2)
  store i32 %4, i32* %c.addr, align 4
  %5 = load i32, i32* %a.addr, align 4
  %6 = mul nsw i32 %5, 1000000
  %7 = load i32, i32* %b.addr, align 4
  %8 = mul nsw i32 %7, 1000
  %9 = add nsw i32 %6, %8
  %10 = load i32, i32* %c.addr, align 4
  %11 = add nsw i32 %9, %10
  ret i32 %11
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Disk", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"element i32", !1, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"Holder", !3, i64 0, !3, i64 8}
!15 = !{!14, !3, i64 0}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!14, !3, i64 8}
