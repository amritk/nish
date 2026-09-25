%struct.Rec = type { %struct.nish_array* }
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

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Rec* noundef nonnull align 8 dereferenceable(8) %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store %struct.Rec* %r, %struct.Rec** %0, align 8, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %ints.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %H.obj = alloca %struct.H, align 8
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %short.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %h.addr = alloca %struct.H*, align 8
  %H.obj.1 = alloca %struct.H, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !8, !noalias !9
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !8, !noalias !9
  %2 = bitcast [1 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ints.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %ints.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Rec*
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 3, i64* %11, align 8, !alias.scope !8, !noalias !9
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 3, i64* %12, align 8, !alias.scope !8, !noalias !9
  %13 = call i8* @nish_alloc_struct(i64 12)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !8, !noalias !9
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 4, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 5, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %18 = getelementptr inbounds i32, i32* %15, i64 2
  store i32 6, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %19 = getelementptr inbounds %struct.Rec, %struct.Rec* %8, i32 0, i32 0
  store %struct.nish_array* %10, %struct.nish_array** %19, align 8
  call void @H.constructor(%struct.H* %H.obj, %struct.Rec* %8)
  %20 = call i32 @walk$i32(%struct.nish_array* %6, i32 5, %struct.H* %H.obj)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = call i8* @nish_alloc_struct(i64 24)
  %23 = bitcast i8* %22 to %struct.nish_array*
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  store i64 3, i64* %24, align 8, !alias.scope !8, !noalias !9
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  store i64 3, i64* %25, align 8, !alias.scope !8, !noalias !9
  %26 = call i8* @nish_alloc_struct(i64 12)
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !8, !noalias !9
  %28 = bitcast i8* %26 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  store i32 1, i32* %29, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %30 = getelementptr inbounds i32, i32* %28, i64 1
  store i32 2, i32* %30, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %31 = getelementptr inbounds i32, i32* %28, i64 2
  store i32 3, i32* %31, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %32 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %23, %struct.nish_array** %32, align 8
  %33 = call i8* @nish_alloc_struct(i64 24)
  %34 = bitcast i8* %33 to %struct.nish_array*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  store i64 1, i64* %35, align 8, !alias.scope !8, !noalias !9
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  store i64 1, i64* %36, align 8, !alias.scope !8, !noalias !9
  %37 = call i8* @nish_alloc_struct(i64 8)
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !8, !noalias !9
  %39 = bitcast i8* %37 to %struct.Rec*
  %40 = getelementptr inbounds %struct.Rec, %struct.Rec* %39, i64 0
  %41 = bitcast %struct.Rec* %40 to i8*
  %42 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %41, i8* align 8 %42, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %34, %struct.nish_array** %rs.addr, align 8
  %43 = call i8* @nish_alloc_struct(i64 24)
  %44 = bitcast i8* %43 to %struct.nish_array*
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  store i64 1, i64* %45, align 8, !alias.scope !8, !noalias !9
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  store i64 1, i64* %46, align 8, !alias.scope !8, !noalias !9
  %47 = call i8* @nish_alloc_struct(i64 4)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  store i8* %47, i8** %48, align 8, !alias.scope !8, !noalias !9
  %49 = bitcast i8* %47 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 0
  store i32 7, i32* %50, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %51 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %44, %struct.nish_array** %51, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !8, !noalias !9
  %55 = bitcast i8* %54 to %struct.Rec*
  %56 = getelementptr inbounds %struct.Rec, %struct.Rec* %55, i64 0
  call void @H.constructor(%struct.H* %H.obj.1, %struct.Rec* %56)
  store %struct.H* %H.obj.1, %struct.H** %h.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %58 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %59 = load %struct.H*, %struct.H** %h.addr, align 8
  %60 = call i32 @walk$$Rec(%struct.nish_array* %57, %struct.Rec* %58, %struct.H* %59)
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  ret i32 0
}

define internal noundef i32 @walk$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rs, i32 noundef %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !4
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %3 = getelementptr inbounds %struct.Rec, %struct.Rec* %2, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9
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
  %19 = bitcast i8* %12 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 %x, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  br label %if.end

if.end:
  %21 = load i32, i32* %t.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %8 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %23
  %26 = load i32, i32* %25, align 4, !alias.scope !9, !noalias !8, !tbaa !11
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
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !4
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %8 = getelementptr inbounds %struct.Rec, %struct.Rec* %7, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9
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
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %19, i8* align 8 %20, i64 8, i1 false), !alias.scope !9, !noalias !8
  br label %if.end

if.end:
  %21 = load i32, i32* %t.addr, align 4
  %22 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %23 = getelementptr inbounds %struct.Rec, %struct.Rec* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !8, !noalias !9
  %29 = icmp ult i64 %26, %28
  br i1 %29, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %26, i64 %28)
  unreachable

bounds.ok.1:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !8, !noalias !9
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %26
  %34 = load i32, i32* %33, align 4, !alias.scope !9, !noalias !8, !tbaa !11
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
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
