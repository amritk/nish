%struct.Rec = type { %struct.nish_array* }
%struct.Box = type { i32 }
%struct.H = type { %struct.Rec* }
%struct.Store$$Box = type { %struct.nish_array* }
%struct.Store$$Rec = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Rec* noundef nonnull align 8 dereferenceable(8) %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store %struct.Rec* %r, %struct.Rec** %0, align 8, !tbaa !7
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %boxes.addr = alloca %struct.Store$$Box*, align 8
  %Store$$Box.obj = alloca %struct.Store$$Box, align 8
  %H.obj = alloca %struct.H, align 8
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %recs.addr = alloca %struct.Store$$Rec*, align 8
  %Store$$Rec.obj = alloca %struct.Store$$Rec, align 8
  %short.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %h.addr = alloca %struct.H*, align 8
  %H.obj.1 = alloca %struct.H, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Box*
  call void @Box.constructor(%struct.Box* %1, i32 1)
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %8 = bitcast i8* %6 to %struct.Box**
  %9 = getelementptr inbounds %struct.Box*, %struct.Box** %8, i64 0
  store %struct.Box* %1, %struct.Box** %9, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  call void @Store$$Box.constructor(%struct.Store$$Box* %Store$$Box.obj, %struct.nish_array* %3)
  store %struct.Store$$Box* %Store$$Box.obj, %struct.Store$$Box** %boxes.addr, align 8
  %10 = load %struct.Store$$Box*, %struct.Store$$Box** %boxes.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 4)
  %12 = bitcast i8* %11 to %struct.Box*
  call void @Box.constructor(%struct.Box* %12, i32 2)
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = bitcast i8* %13 to %struct.Rec*
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 3, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 3, i64* %18, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %19 = call i8* @nish_alloc_struct(i64 12)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %21 = bitcast i8* %19 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 4, i32* %22, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %23 = getelementptr inbounds i32, i32* %21, i64 1
  store i32 5, i32* %23, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %24 = getelementptr inbounds i32, i32* %21, i64 2
  store i32 6, i32* %24, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %25 = getelementptr inbounds %struct.Rec, %struct.Rec* %14, i32 0, i32 0
  store %struct.nish_array* %16, %struct.nish_array** %25, align 8
  call void @H.constructor(%struct.H* %H.obj, %struct.Rec* %14)
  %26 = call i32 @Store$$Box.walk(%struct.Store$$Box* %10, %struct.Box* %12, %struct.H* %H.obj)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 3, i64* %30, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 3, i64* %31, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %32 = call i8* @nish_alloc_struct(i64 12)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 1, i32* %35, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %36 = getelementptr inbounds i32, i32* %34, i64 1
  store i32 2, i32* %36, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %37 = getelementptr inbounds i32, i32* %34, i64 2
  store i32 3, i32* %37, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %38 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %29, %struct.nish_array** %38, align 8
  %39 = call i8* @nish_alloc_struct(i64 24)
  %40 = bitcast i8* %39 to %struct.nish_array*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  store i64 1, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 1
  store i64 1, i64* %42, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %43 = call i8* @nish_alloc_struct(i64 8)
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %45 = bitcast i8* %43 to %struct.Rec*
  %46 = getelementptr inbounds %struct.Rec, %struct.Rec* %45, i64 0
  %47 = bitcast %struct.Rec* %46 to i8*
  %48 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %47, i8* align 8 %48, i64 8, i1 false), !alias.scope !12, !noalias !11
  store %struct.nish_array* %40, %struct.nish_array** %rs.addr, align 8
  %49 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  call void @Store$$Rec.constructor(%struct.Store$$Rec* %Store$$Rec.obj, %struct.nish_array* %49)
  store %struct.Store$$Rec* %Store$$Rec.obj, %struct.Store$$Rec** %recs.addr, align 8
  %50 = call i8* @nish_alloc_struct(i64 24)
  %51 = bitcast i8* %50 to %struct.nish_array*
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  store i64 1, i64* %52, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  store i64 1, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %54 = call i8* @nish_alloc_struct(i64 4)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  store i8* %54, i8** %55, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %56 = bitcast i8* %54 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 0
  store i32 7, i32* %57, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %58 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %51, %struct.nish_array** %58, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %62 = icmp ult i64 0, %61
  br i1 %62, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %61)
  unreachable

bounds.ok:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %65 = bitcast i8* %64 to %struct.Rec*
  %66 = getelementptr inbounds %struct.Rec, %struct.Rec* %65, i64 0
  call void @H.constructor(%struct.H* %H.obj.1, %struct.Rec* %66)
  store %struct.H* %H.obj.1, %struct.H** %h.addr, align 8
  %67 = load %struct.Store$$Rec*, %struct.Store$$Rec** %recs.addr, align 8
  %68 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %69 = load %struct.H*, %struct.H** %h.addr, align 8
  %70 = call i32 @Store$$Rec.walk(%struct.Store$$Rec* %67, %struct.Rec* %68, %struct.H* %69)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  call void @nish_print(i8* %71)
  ret i32 0
}

define internal void @Store$$Box.constructor(%struct.Store$$Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %rs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Store$$Box, %struct.Store$$Box* %this, i32 0, i32 0
  store %struct.nish_array* %rs, %struct.nish_array** %0, align 8, !tbaa !24
  ret void
}

define internal noundef i32 @Store$$Box.walk(%struct.Store$$Box* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Box* noundef nonnull align 8 dereferenceable(4) %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !7
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %3 = getelementptr inbounds %struct.Rec, %struct.Rec* %2, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %9 = getelementptr inbounds %struct.Store$$Box, %struct.Store$$Box* %this, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  br label %while.cond

while.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %6 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %while.body, label %while.end

while.body:
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp eq i32 %18, 1
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = icmp ult i64 0, %12
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %12)
  unreachable

bounds.ok:
  %21 = bitcast i8* %14 to %struct.Box**
  %22 = getelementptr inbounds %struct.Box*, %struct.Box** %21, i64 0
  store %struct.Box* %x, %struct.Box** %22, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  br label %if.end

if.end:
  %23 = load i32, i32* %t.addr, align 4
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %8 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %25
  %28 = load i32, i32* %27, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %29 = add nsw i32 %23, %28
  store i32 %29, i32* %t.addr, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %t.addr, align 4
  ret i32 %32
}

define internal void @Store$$Rec.constructor(%struct.Store$$Rec* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %rs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Store$$Rec, %struct.Store$$Rec* %this, i32 0, i32 0
  store %struct.nish_array* %rs, %struct.nish_array** %0, align 8, !tbaa !26
  ret void
}

define internal noundef i32 @Store$$Rec.walk(%struct.Store$$Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !7
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = getelementptr inbounds %struct.Store$$Rec, %struct.Store$$Rec* %this, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !26
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %10 = getelementptr inbounds %struct.Rec, %struct.Rec* %9, i32 0, i32 0
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %8, %14
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = icmp eq i32 %16, 1
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = icmp ult i64 0, %5
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %19 = bitcast i8* %7 to %struct.Rec*
  %20 = getelementptr inbounds %struct.Rec, %struct.Rec* %19, i64 0
  %21 = bitcast %struct.Rec* %20 to i8*
  %22 = bitcast %struct.Rec* %x to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %21, i8* align 8 %22, i64 8, i1 false), !alias.scope !12, !noalias !11
  br label %if.end

if.end:
  %23 = load i32, i32* %t.addr, align 4
  %24 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %25 = getelementptr inbounds %struct.Rec, %struct.Rec* %24, i32 0, i32 0
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %31 = icmp ult i64 %28, %30
  br i1 %31, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %28, i64 %30)
  unreachable

bounds.ok.1:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %28
  %36 = load i32, i32* %35, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %37 = add nsw i32 %23, %36
  store i32 %37, i32* %t.addr, align 4
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %40 = load i32, i32* %t.addr, align 4
  ret i32 %40
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
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"H", !5, i64 0}
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
!19 = !{!"element ptr", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"Store$$Box", !5, i64 0}
!24 = !{!23, !5, i64 0}
!25 = !{!"Store$$Rec", !5, i64 0}
!26 = !{!25, !5, i64 0}
