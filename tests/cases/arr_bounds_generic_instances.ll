%struct.Rec = type { %struct.nish_array* }
%struct.Box = type { i32 }
%struct.H = type { %struct.Rec* }
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
  %bs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Box*], align 8
  %H.obj = alloca %struct.H, align 8
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x %struct.Rec], align 8
  %short.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %h.addr = alloca %struct.H*, align 8
  %H.obj.1 = alloca %struct.H, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Box*
  call void @Box.constructor(%struct.Box* %1, i32 1)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !11, !noalias !12
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !11, !noalias !12
  %4 = bitcast [1 x %struct.Box*]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !11, !noalias !12
  %6 = bitcast i8* %4 to %struct.Box**
  %7 = getelementptr inbounds %struct.Box*, %struct.Box** %6, i64 0
  store %struct.Box* %1, %struct.Box** %7, align 8, !alias.scope !12, !noalias !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %9 = call i8* @nish_alloc_struct(i64 4)
  %10 = bitcast i8* %9 to %struct.Box*
  call void @Box.constructor(%struct.Box* %10, i32 2)
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Rec*
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 3, i64* %15, align 8, !alias.scope !11, !noalias !12
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 3, i64* %16, align 8, !alias.scope !11, !noalias !12
  %17 = call i8* @nish_alloc_struct(i64 12)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !11, !noalias !12
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 4, i32* %20, align 4, !alias.scope !12, !noalias !11
  %21 = getelementptr inbounds i32, i32* %19, i64 1
  store i32 5, i32* %21, align 4, !alias.scope !12, !noalias !11
  %22 = getelementptr inbounds i32, i32* %19, i64 2
  store i32 6, i32* %22, align 4, !alias.scope !12, !noalias !11
  %23 = getelementptr inbounds %struct.Rec, %struct.Rec* %12, i32 0, i32 0
  store %struct.nish_array* %14, %struct.nish_array** %23, align 8
  call void @H.constructor(%struct.H* %H.obj, %struct.Rec* %12)
  %24 = call i32 @walk$$Box(%struct.nish_array* %8, %struct.Box* %10, %struct.H* %H.obj)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 3, i64* %28, align 8, !alias.scope !11, !noalias !12
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 3, i64* %29, align 8, !alias.scope !11, !noalias !12
  %30 = call i8* @nish_alloc_struct(i64 12)
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !11, !noalias !12
  %32 = bitcast i8* %30 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  store i32 1, i32* %33, align 4, !alias.scope !12, !noalias !11
  %34 = getelementptr inbounds i32, i32* %32, i64 1
  store i32 2, i32* %34, align 4, !alias.scope !12, !noalias !11
  %35 = getelementptr inbounds i32, i32* %32, i64 2
  store i32 3, i32* %35, align 4, !alias.scope !12, !noalias !11
  %36 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %27, %struct.nish_array** %36, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %37, align 8, !alias.scope !11, !noalias !12
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %38, align 8, !alias.scope !11, !noalias !12
  %39 = bitcast [1 x %struct.Rec]* %arr.data.1 to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !11, !noalias !12
  %41 = bitcast i8* %39 to %struct.Rec*
  %42 = getelementptr inbounds %struct.Rec, %struct.Rec* %41, i64 0
  %43 = bitcast %struct.Rec* %42 to i8*
  %44 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %43, i8* align 8 %44, i64 8, i1 false), !alias.scope !12, !noalias !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %rs.addr, align 8
  %45 = call i8* @nish_alloc_struct(i64 24)
  %46 = bitcast i8* %45 to %struct.nish_array*
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  store i64 1, i64* %47, align 8, !alias.scope !11, !noalias !12
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  store i64 1, i64* %48, align 8, !alias.scope !11, !noalias !12
  %49 = call i8* @nish_alloc_struct(i64 4)
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !11, !noalias !12
  %51 = bitcast i8* %49 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 0
  store i32 7, i32* %52, align 4, !alias.scope !12, !noalias !11
  %53 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %46, %struct.nish_array** %53, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !11, !noalias !12
  %57 = bitcast i8* %56 to %struct.Rec*
  %58 = getelementptr inbounds %struct.Rec, %struct.Rec* %57, i64 0
  call void @H.constructor(%struct.H* %H.obj.1, %struct.Rec* %58)
  store %struct.H* %H.obj.1, %struct.H** %h.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %60 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %61 = load %struct.H*, %struct.H** %h.addr, align 8
  %62 = call i32 @walk$$Rec(%struct.nish_array* %59, %struct.Rec* %60, %struct.H* %61)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  call void @nish_print(i8* %63)
  ret i32 0
}

define internal noundef i32 @walk$$Box(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rs, %struct.Box* noundef nonnull align 8 dereferenceable(4) %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
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
  %6 = load i64, i64* %5, align 8, !alias.scope !11, !noalias !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !11, !noalias !12
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !11, !noalias !12
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12
  br label %while.cond

while.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %6 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = icmp eq i32 %16, 1
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = icmp ult i64 0, %10
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok:
  %19 = bitcast i8* %12 to %struct.Box**
  %20 = getelementptr inbounds %struct.Box*, %struct.Box** %19, i64 0
  store %struct.Box* %x, %struct.Box** %20, align 8, !alias.scope !12, !noalias !11
  br label %if.end

if.end:
  %21 = load i32, i32* %t.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %8 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %23
  %26 = load i32, i32* %25, align 4, !alias.scope !12, !noalias !11
  %27 = add nsw i32 %21, %26
  store i32 %27, i32* %t.addr, align 4
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %30 = load i32, i32* %t.addr, align 4
  ret i32 %30
}

define internal noundef i32 @walk$$Rec(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rs, %struct.Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !7
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !11, !noalias !12
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %8 = getelementptr inbounds %struct.Rec, %struct.Rec* %7, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !11, !noalias !12
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %6, %12
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = icmp ult i64 0, %3
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %17 = bitcast i8* %5 to %struct.Rec*
  %18 = getelementptr inbounds %struct.Rec, %struct.Rec* %17, i64 0
  %19 = bitcast %struct.Rec* %18 to i8*
  %20 = bitcast %struct.Rec* %x to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %19, i8* align 8 %20, i64 8, i1 false), !alias.scope !12, !noalias !11
  br label %if.end

if.end:
  %21 = load i32, i32* %t.addr, align 4
  %22 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %23 = getelementptr inbounds %struct.Rec, %struct.Rec* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !11, !noalias !12
  %29 = icmp ult i64 %26, %28
  br i1 %29, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %26, i64 %28)
  unreachable

bounds.ok.1:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !11, !noalias !12
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %26
  %34 = load i32, i32* %33, align 4, !alias.scope !12, !noalias !11
  %35 = add nsw i32 %21, %34
  store i32 %35, i32* %t.addr, align 4
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %38 = load i32, i32* %t.addr, align 4
  ret i32 %38
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
