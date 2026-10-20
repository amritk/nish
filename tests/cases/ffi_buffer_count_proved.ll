%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [70 x i8] } { i64 69, [70 x i8] c"`write`: argument 3 (n) counts more bytes than argument 2 (buf) holds\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i64 @write(i32, i8*, i64)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %buf) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %buf, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i64 @constLocal() #1 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 97, i8* %5, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 10, i8* %6, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %b.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = trunc i64 %10 to i32
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %15 = call i64 @write(i32 1, i8* %14, i64 %12)
  ret i64 %15
}

define internal noundef i64 @param(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = call i64 @write(i32 1, i8* %5, i64 %3)
  ret i64 %6
}

define internal noundef i64 @field(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = trunc i64 %5 to i32
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = icmp ule i64 %7, %9
  br i1 %10, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %13 = call i64 @write(i32 1, i8* %12, i64 %7)
  ret i64 %13
}

define internal noundef i64 @alias(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %b) #1 {
entry:
  %other.addr = alloca %struct.nish_array*, align 8
  store %struct.nish_array* %b, %struct.nish_array** %other.addr, align 8
  %0 = load %struct.nish_array*, %struct.nish_array** %other.addr, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = icmp ule i64 %4, %6
  br i1 %7, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %10 = call i64 @write(i32 1, i8* %9, i64 %4)
  ret i64 %10
}

define internal noundef i64 @another(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %c) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %c, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = icmp ule i64 %3, %5
  br i1 %6, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = call i64 @write(i32 1, i8* %8, i64 %3)
  ret i64 %9
}

define noundef i32 @nish_main() #1 {
entry:
  %p.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i8], align 8
  %0 = call i64 @constLocal()
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %3 = bitcast [2 x i8]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %3 to i8*
  %6 = getelementptr inbounds i8, i8* %5, i64 0
  store i8 98, i8* %6, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %7 = getelementptr inbounds i8, i8* %5, i64 1
  store i8 10, i8* %7, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %p.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %p.addr, align 8
  %9 = call i64 @param(%struct.nish_array* %8)
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 2, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = call i8* @nish_alloc_struct(i64 2)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %16 = bitcast i8* %14 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 0
  store i8 99, i8* %17, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %18 = getelementptr inbounds i8, i8* %16, i64 1
  store i8 10, i8* %18, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %11)
  %19 = call i64 @field(%struct.Holder* %Holder.obj)
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 2, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 2, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %24 = call i8* @nish_alloc_struct(i64 2)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %26 = bitcast i8* %24 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 0
  store i8 100, i8* %27, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %28 = getelementptr inbounds i8, i8* %26, i64 1
  store i8 10, i8* %28, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %29 = call i64 @alias(%struct.nish_array* %21)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %31, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %32 = bitcast [2 x i8]* %arr.data.1 to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %34 = bitcast i8* %32 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 0
  store i8 101, i8* %35, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %36 = getelementptr inbounds i8, i8* %34, i64 1
  store i8 10, i8* %36, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %39 = bitcast [2 x i8]* %arr.data.2 to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %41 = bitcast i8* %39 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 0
  store i8 0, i8* %42, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %43 = getelementptr inbounds i8, i8* %41, i64 1
  store i8 0, i8* %43, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %44 = call i64 @another(%struct.nish_array* %arr.hdr.1, %struct.nish_array* %arr.hdr.2)
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
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i8", !1, i64 0}
!17 = !{!16, !16, i64 0}
