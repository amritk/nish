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
  store i64 0, i64* %6, align 8, !alias.scope !13, !noalias !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !13, !noalias !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !13, !noalias !14
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
  %14 = sub nsw i32 0, 1
  call void @Cell.constructor(%struct.Cell* %13, i32 %14)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !13, !noalias !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !13, !noalias !14
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !13, !noalias !14
  %22 = bitcast i8* %21 to %struct.Cell**
  %23 = getelementptr inbounds %struct.Cell*, %struct.Cell** %22, i64 %16
  store %struct.Cell* %13, %struct.Cell** %23, align 8, !alias.scope !14, !noalias !13
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !13, !noalias !14
  %25 = trunc i64 %24 to i32
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load %struct.Cache*, %struct.Cache** %cache.addr, align 8
  %29 = getelementptr inbounds %struct.Cache, %struct.Cache* %28, i32 0, i32 0
  %30 = load %struct.Cell*, %struct.Cell** %29, align 8, !tbaa !7
  store %struct.Cell* %30, %struct.Cell** %last.addr, align 8
  %31 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %32 = getelementptr inbounds %struct.Box, %struct.Box* %31, i32 0, i32 0
  %33 = load %struct.Cell*, %struct.Cell** %32, align 8, !tbaa !9
  store %struct.Cell* %33, %struct.Cell** %cell.addr, align 8
  %34 = load %struct.Cell*, %struct.Cell** %last.addr, align 8
  %35 = icmp ne %struct.Cell* %34, null
  br i1 %35, label %land.rhs, label %land.end

land.rhs:
  %36 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %37 = icmp ne %struct.Cell* %36, null
  br label %land.end

land.end:
  %38 = phi i1 [ false, %for.end ], [ %37, %land.rhs ]
  br i1 %38, label %if.then, label %if.end

if.then:
  %39 = load %struct.Cell*, %struct.Cell** %last.addr, align 8
  %40 = getelementptr inbounds %struct.Cell, %struct.Cell* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !4
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %44 = getelementptr inbounds %struct.Cell, %struct.Cell* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4, !tbaa !4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  call void @nish_print(i8* %46)
  br label %if.end

if.end:
  %47 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !13, !noalias !14
  %50 = trunc i64 %49 to i32
  %51 = sub nsw i32 %50, 64
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %51
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
