%struct.Rec = type { %struct.nish_array* }
%struct.H = type { %struct.Rec* }
%struct.Cell$str = type { %struct.nish_array* }
%struct.Cell$$Rec = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
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
  %words.addr = alloca %struct.Cell$str*, align 8
  %Cell$str.obj = alloca %struct.Cell$str, align 8
  %H.obj = alloca %struct.H, align 8
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %recs.addr = alloca %struct.Cell$$Rec*, align 8
  %Cell$$Rec.obj = alloca %struct.Cell$$Rec, align 8
  %short.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %h.addr = alloca %struct.H*, align 8
  %H.obj.1 = alloca %struct.H, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds %struct.Cell$str, %struct.Cell$str* %Cell$str.obj, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8
  store %struct.Cell$str* %Cell$str.obj, %struct.Cell$str** %words.addr, align 8
  %9 = load %struct.Cell$str*, %struct.Cell$str** %words.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Rec*
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 3, i64* %14, align 8, !alias.scope !8, !noalias !9
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 3, i64* %15, align 8, !alias.scope !8, !noalias !9
  %16 = call i8* @nish_alloc_struct(i64 12)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !8, !noalias !9
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 4, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 5, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %21 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 6, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %22 = getelementptr inbounds %struct.Rec, %struct.Rec* %11, i32 0, i32 0
  store %struct.nish_array* %13, %struct.nish_array** %22, align 8
  call void @H.constructor(%struct.H* %H.obj, %struct.Rec* %11)
  %23 = call i32 @walk$str(%struct.Cell$str* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %struct.H* %H.obj)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 3, i64* %27, align 8, !alias.scope !8, !noalias !9
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 3, i64* %28, align 8, !alias.scope !8, !noalias !9
  %29 = call i8* @nish_alloc_struct(i64 12)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !8, !noalias !9
  %31 = bitcast i8* %29 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  store i32 1, i32* %32, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %33 = getelementptr inbounds i32, i32* %31, i64 1
  store i32 2, i32* %33, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %34 = getelementptr inbounds i32, i32* %31, i64 2
  store i32 3, i32* %34, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %35 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %26, %struct.nish_array** %35, align 8
  %36 = call i8* @nish_alloc_struct(i64 24)
  %37 = bitcast i8* %36 to %struct.nish_array*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  store i64 1, i64* %38, align 8, !alias.scope !8, !noalias !9
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  store i64 1, i64* %39, align 8, !alias.scope !8, !noalias !9
  %40 = call i8* @nish_alloc_struct(i64 8)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !8, !noalias !9
  %42 = bitcast i8* %40 to %struct.Rec*
  %43 = getelementptr inbounds %struct.Rec, %struct.Rec* %42, i64 0
  %44 = bitcast %struct.Rec* %43 to i8*
  %45 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %44, i8* align 8 %45, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %37, %struct.nish_array** %rs.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %47 = getelementptr inbounds %struct.Cell$$Rec, %struct.Cell$$Rec* %Cell$$Rec.obj, i32 0, i32 0
  store %struct.nish_array* %46, %struct.nish_array** %47, align 8
  store %struct.Cell$$Rec* %Cell$$Rec.obj, %struct.Cell$$Rec** %recs.addr, align 8
  %48 = call i8* @nish_alloc_struct(i64 24)
  %49 = bitcast i8* %48 to %struct.nish_array*
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  store i64 1, i64* %50, align 8, !alias.scope !8, !noalias !9
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  store i64 1, i64* %51, align 8, !alias.scope !8, !noalias !9
  %52 = call i8* @nish_alloc_struct(i64 4)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  store i8* %52, i8** %53, align 8, !alias.scope !8, !noalias !9
  %54 = bitcast i8* %52 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 0
  store i32 7, i32* %55, align 4, !alias.scope !9, !noalias !8, !tbaa !13
  %56 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %49, %struct.nish_array** %56, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !8, !noalias !9
  %60 = bitcast i8* %59 to %struct.Rec*
  %61 = getelementptr inbounds %struct.Rec, %struct.Rec* %60, i64 0
  call void @H.constructor(%struct.H* %H.obj.1, %struct.Rec* %61)
  store %struct.H* %H.obj.1, %struct.H** %h.addr, align 8
  %62 = load %struct.Cell$$Rec*, %struct.Cell$$Rec** %recs.addr, align 8
  %63 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %64 = load %struct.H*, %struct.H** %h.addr, align 8
  %65 = call i32 @walk$$Rec(%struct.Cell$$Rec* %62, %struct.Rec* %63, %struct.H* %64)
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  ret i32 0
}

define internal noundef i32 @walk$str(%struct.Cell$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %c, i8* noundef nonnull noalias readonly align 8 %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
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
  %9 = getelementptr inbounds %struct.Cell$str, %struct.Cell$str* %c, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9
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
  %21 = bitcast i8* %14 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 0
  store i8* %x, i8** %22, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  br label %if.end

if.end:
  %23 = load i32, i32* %t.addr, align 4
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %8 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %25
  %28 = load i32, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !13
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

define internal noundef i32 @walk$$Rec(%struct.Cell$$Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %c, %struct.Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %x, %struct.H* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !4
  store %struct.Rec* %1, %struct.Rec** %r.addr, align 8
  %2 = getelementptr inbounds %struct.Cell$$Rec, %struct.Cell$$Rec* %c, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %10 = getelementptr inbounds %struct.Rec, %struct.Rec* %9, i32 0, i32 0
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !8, !noalias !9
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
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %21, i8* align 8 %22, i64 8, i1 false), !alias.scope !9, !noalias !8
  br label %if.end

if.end:
  %23 = load i32, i32* %t.addr, align 4
  %24 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %25 = getelementptr inbounds %struct.Rec, %struct.Rec* %24, i32 0, i32 0
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !8, !noalias !9
  %31 = icmp ult i64 %28, %30
  br i1 %31, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %28, i64 %30)
  unreachable

bounds.ok.1:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !8, !noalias !9
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %28
  %36 = load i32, i32* %35, align 4, !alias.scope !9, !noalias !8, !tbaa !13
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
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element ptr", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"element i32", !1, i64 0}
!13 = !{!12, !12, i64 0}
