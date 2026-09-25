%struct.Disk = type { i32, %struct.Disk* }
%struct.Holder = type { %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
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
  store i64 1, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8, !tbaa !21
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %13 = call i8* @nish_alloc_struct(i64 16)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %15 = bitcast i8* %13 to %struct.Disk**
  %16 = getelementptr inbounds %struct.Disk*, %struct.Disk** %15, i64 0
  store %struct.Disk* null, %struct.Disk** %16, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %17 = getelementptr inbounds %struct.Disk*, %struct.Disk** %15, i64 1
  store %struct.Disk* null, %struct.Disk** %17, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.nish_array* %10, %struct.nish_array** %18, align 8, !tbaa !24
  ret void
}

define internal void @grow(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 4)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  store i32 7, i32* %10, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %12 = trunc i64 %11 to i32
  ret void
}

define internal noundef i32 @viaAlias(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h, %struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %other) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 5, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 6, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %other, i32 0, i32 0
  store %struct.nish_array* %10, %struct.nish_array** %18, align 8, !tbaa !21
  %19 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !21
  %21 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %31 = add nsw i32 %30, 1
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 %31, i32* %35, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %36 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !21
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 0
  %42 = load i32, i32* %41, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %43 = mul nsw i32 %42, 10
  %44 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %45 = load %struct.nish_array*, %struct.nish_array** %44, align 8, !tbaa !21
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %48 = trunc i64 %47 to i32
  %49 = add nsw i32 %43, %48
  ret i32 %49
}

define internal noundef i32 @viaCallee(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 3, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  call void @grow(%struct.Holder* %h)
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !21
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %13 = trunc i64 %12 to i32
  %14 = mul nsw i32 %13, 10
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !21
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !21
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %21 = trunc i64 %20 to i32
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  %31 = load i32, i32* %30, align 4, !alias.scope !11, !noalias !10, !tbaa !19
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
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !24
  %4 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %10 = bitcast i8* %9 to %struct.Disk**
  %11 = getelementptr inbounds %struct.Disk*, %struct.Disk** %10, i64 0
  store %struct.Disk* %4, %struct.Disk** %11, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %12 = call i8* @nish_alloc_struct(i64 16)
  %13 = bitcast i8* %12 to %struct.Disk*
  call void @Disk.constructor(%struct.Disk* %13, i32 9)
  store %struct.Disk* %13, %struct.Disk** %under.addr, align 8
  %14 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %15 = load %struct.Disk*, %struct.Disk** %under.addr, align 8
  %16 = getelementptr inbounds %struct.Disk, %struct.Disk* %14, i32 0, i32 1
  store %struct.Disk* %15, %struct.Disk** %16, align 8, !tbaa !6
  %17 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !24
  %19 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %20 = getelementptr inbounds %struct.Disk, %struct.Disk* %19, i32 0, i32 1
  %21 = load %struct.Disk*, %struct.Disk** %20, align 8, !tbaa !6
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %24 = icmp ult i64 1, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %27 = bitcast i8* %26 to %struct.Disk**
  %28 = getelementptr inbounds %struct.Disk*, %struct.Disk** %27, i64 1
  store %struct.Disk* %21, %struct.Disk** %28, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %29 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !24
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %33 = bitcast i8* %32 to %struct.Disk**
  %34 = getelementptr inbounds %struct.Disk*, %struct.Disk** %33, i64 0
  %35 = load %struct.Disk*, %struct.Disk** %34, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  store %struct.Disk* %35, %struct.Disk** %first.addr, align 8
  %36 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !24
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %40 = bitcast i8* %39 to %struct.Disk**
  %41 = getelementptr inbounds %struct.Disk*, %struct.Disk** %40, i64 1
  %42 = load %struct.Disk*, %struct.Disk** %41, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  store %struct.Disk* %42, %struct.Disk** %second.addr, align 8
  %43 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %44 = icmp eq %struct.Disk* %43, null
  br i1 %44, label %lor.end, label %lor.rhs

lor.rhs:
  %45 = load %struct.Disk*, %struct.Disk** %second.addr, align 8
  %46 = icmp eq %struct.Disk* %45, null
  br label %lor.end

lor.end:
  %47 = phi i1 [ true, %bounds.ok.1 ], [ %46, %lor.rhs ]
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = sub nsw i32 0, 1
  ret i32 %48

if.end:
  %49 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %50 = getelementptr inbounds %struct.Disk, %struct.Disk* %49, i32 0, i32 1
  %51 = load %struct.Disk*, %struct.Disk** %50, align 8, !tbaa !6
  store %struct.Disk* %51, %struct.Disk** %below.addr, align 8
  %52 = load %struct.Disk*, %struct.Disk** %below.addr, align 8
  %53 = icmp eq %struct.Disk* %52, null
  br i1 %53, label %if.then.1, label %if.end.1

if.then.1:
  %54 = sub nsw i32 0, 2
  ret i32 %54

if.end.1:
  %55 = load %struct.Disk*, %struct.Disk** %first.addr, align 8
  %56 = getelementptr inbounds %struct.Disk, %struct.Disk* %55, i32 0, i32 0
  %57 = load i32, i32* %56, align 4, !tbaa !5
  %58 = mul nsw i32 %57, 100
  %59 = load %struct.Disk*, %struct.Disk** %second.addr, align 8
  %60 = getelementptr inbounds %struct.Disk, %struct.Disk* %59, i32 0, i32 0
  %61 = load i32, i32* %60, align 4, !tbaa !5
  %62 = mul nsw i32 %61, 10
  %63 = add nsw i32 %58, %62
  %64 = load %struct.Disk*, %struct.Disk** %below.addr, align 8
  %65 = getelementptr inbounds %struct.Disk, %struct.Disk* %64, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !5
  %67 = add nsw i32 %63, %66
  ret i32 %67
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
  %arena.mark = call i64 @nish_arena_mark()
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
  call void @nish_arena_release(i64 %arena.mark)
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
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!"Holder", !3, i64 0, !3, i64 8}
!21 = !{!20, !3, i64 0}
!22 = !{!"element ptr", !1, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!20, !3, i64 8}
