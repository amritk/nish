%struct.Cell = type { i32 }
%struct.Cache = type { %struct.Cell* }
%struct.Box = type { %struct.Cell* }
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

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Cache.remember(%struct.Cache* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 %n)
  %2 = getelementptr inbounds %struct.Cache, %struct.Cache* %this, i32 0, i32 0
  store %struct.Cell* %1, %struct.Cell** %2, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @Cache.run(%struct.Cache* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #0 {
entry:
  call void @Cache.remember(%struct.Cache* %this, i32 %n)
  ret i32 %n
}

define internal void @fill(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %box, i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 %n)
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %box, i32 0, i32 0
  store %struct.Cell* %1, %struct.Cell** %2, align 8, !tbaa !9
  ret void
}

define internal noundef i32 @outer(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %box, i32 noundef %n) #0 {
entry:
  call void @fill(%struct.Box* %box, i32 %n)
  ret i32 %n
}

define noundef i32 @nish_main() #0 {
entry:
  %cache.addr = alloca %struct.Cache*, align 8
  %Cache.obj = alloca %struct.Cache, align 8
  %box.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %junk.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %last.addr = alloca %struct.Cell*, align 8
  %cell.addr = alloca %struct.Cell*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Cache, %struct.Cache* %Cache.obj, i32 0, i32 0
  store %struct.Cell* null, %struct.Cell** %0, align 8, !tbaa !7
  store %struct.Cache* %Cache.obj, %struct.Cache** %cache.addr, align 8
  %1 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %2 = call i32 @Cache.run(%struct.Cache* %1, i32 41)
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0
  store %struct.Cell* null, %struct.Cell** %3, align 8, !tbaa !9
  store %struct.Box* %Box.obj, %struct.Box** %box.addr, align 8
  %4 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %5 = call i32 @outer(%struct.Box* %4, i32 42)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %junk.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 64
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = bitcast i8* %12 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %13, i32 -1)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %17 = load i64, i64* %16, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %18 = icmp eq i64 %15, %17
  br i1 %18, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %21 = bitcast i8* %20 to %struct.Cell**
  %22 = getelementptr inbounds %struct.Cell*, %struct.Cell** %21, i64 %15
  store %struct.Cell* %13, %struct.Cell** %22, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %23 = add i64 %15, 1
  store i64 %23, i64* %14, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %24 = trunc i64 %23 to i32
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %28 = getelementptr inbounds %struct.Cache, %struct.Cache* %27, i32 0, i32 0
  %29 = load %struct.Cell*, %struct.Cell** %28, align 8, !tbaa !7
  store %struct.Cell* %29, %struct.Cell** %last.addr, align 8
  %30 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %31 = getelementptr inbounds %struct.Box, %struct.Box* %30, i32 0, i32 0
  %32 = load %struct.Cell*, %struct.Cell** %31, align 8, !tbaa !9
  store %struct.Cell* %32, %struct.Cell** %cell.addr, align 8
  %33 = load %struct.Cell*, %struct.Cell** %last.addr, align 8
  %34 = icmp ne %struct.Cell* %33, null
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %36 = icmp ne %struct.Cell* %35, null
  br label %land.end

land.end:
  %37 = phi i1 [ false, %for.end ], [ %36, %land.rhs ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load %struct.Cell*, %struct.Cell** %last.addr, align 8
  %39 = getelementptr inbounds %struct.Cell, %struct.Cell* %38, i32 0, i32 0
  %40 = load i32, i32* %39, align 4, !tbaa !4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  call void @nish_print(i8* %41)
  %42 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %43 = getelementptr inbounds %struct.Cell, %struct.Cell* %42, i32 0, i32 0
  %44 = load i32, i32* %43, align 4, !tbaa !4
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  br label %if.end

if.end:
  %46 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %49 = trunc i64 %48 to i32
  %50 = sub nsw i32 %49, 64
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %50
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cell", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Cache", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Box", !5, i64 0}
!9 = !{!8, !5, i64 0}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
