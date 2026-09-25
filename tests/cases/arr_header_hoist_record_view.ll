%struct.Rec = type { %struct.nish_array* }
%struct.C = type { %struct.Rec* }
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

define internal void @C.constructor(%struct.C* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Rec* noundef nonnull align 8 dereferenceable(8) %rec) #0 {
entry:
  %0 = getelementptr inbounds %struct.C, %struct.C* %this, i32 0, i32 0
  store %struct.Rec* %rec, %struct.Rec** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @sum(%struct.C* noundef nonnull readonly align 8 dereferenceable(8) nocapture %c, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rs, %struct.Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %short) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !8, !noalias !9
  br label %while.cond

while.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.C, %struct.C* %c, i32 0, i32 0
  %4 = load %struct.Rec*, %struct.Rec** %3, align 8, !tbaa !4
  %5 = getelementptr inbounds %struct.Rec, %struct.Rec* %4, i32 0, i32 0
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %2, %9
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = icmp eq i32 %11, 1
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = bitcast i8* %1 to %struct.Rec*
  %14 = getelementptr inbounds %struct.Rec, %struct.Rec* %13, i64 0
  %15 = bitcast %struct.Rec* %14 to i8*
  %16 = bitcast %struct.Rec* %short to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %15, i8* align 8 %16, i64 8, i1 false), !alias.scope !9, !noalias !8
  br label %if.end

if.end:
  %17 = load i32, i32* %t.addr, align 4
  %18 = getelementptr inbounds %struct.C, %struct.C* %c, i32 0, i32 0
  %19 = load %struct.Rec*, %struct.Rec** %18, align 8, !tbaa !4
  %20 = getelementptr inbounds %struct.Rec, %struct.Rec* %19, i32 0, i32 0
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  %31 = load i32, i32* %30, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %32 = add nsw i32 %17, %31
  store i32 %32, i32* %t.addr, align 4
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %35 = load i32, i32* %t.addr, align 4
  ret i32 %35
}

define noundef i32 @nish_main() #1 {
entry:
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Rec], align 8
  %c.addr = alloca %struct.C*, align 8
  %C.obj = alloca %struct.C, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %10 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %10, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !8, !noalias !9
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !8, !noalias !9
  %13 = bitcast [1 x %struct.Rec]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !8, !noalias !9
  %15 = bitcast i8* %13 to %struct.Rec*
  %16 = getelementptr inbounds %struct.Rec, %struct.Rec* %15, i64 0
  %17 = bitcast %struct.Rec* %16 to i8*
  %18 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %17, i8* align 8 %18, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !8, !noalias !9
  %22 = bitcast i8* %21 to %struct.Rec*
  %23 = getelementptr inbounds %struct.Rec, %struct.Rec* %22, i64 0
  call void @C.constructor(%struct.C* %C.obj, %struct.Rec* %23)
  store %struct.C* %C.obj, %struct.C** %c.addr, align 8
  %24 = load %struct.C*, %struct.C** %c.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 1, i64* %28, align 8, !alias.scope !8, !noalias !9
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 1, i64* %29, align 8, !alias.scope !8, !noalias !9
  %30 = call i8* @nish_alloc_struct(i64 4)
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !8, !noalias !9
  %32 = bitcast i8* %30 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  store i32 7, i32* %33, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %34 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %27, %struct.nish_array** %34, align 8
  %35 = call i32 @sum(%struct.C* %24, %struct.nish_array* %25, %struct.Rec* %Rec.obj.1)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
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
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"C", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
