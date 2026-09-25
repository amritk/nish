%struct.Disk = type { i32, %struct.Disk* }
%struct.Towers = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [39 x i8] } { i64 38, [39 x i8] c"Cannot put a big disk on a smaller one\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [47 x i8] } { i64 46, [47 x i8] c"Attempting to remove a disk from an empty pile\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Disk.constructor(%struct.Disk* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %size) #0 {
entry:
  %0 = getelementptr inbounds %struct.Disk, %struct.Disk* %this, i32 0, i32 1
  store %struct.Disk* null, %struct.Disk** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Disk, %struct.Disk* %this, i32 0, i32 0
  store i32 %size, i32* %1, align 4, !tbaa !6
  ret void
}

define void @Towers.constructor(%struct.Towers* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %5 = mul i64 3, 8
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !13, !noalias !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %8 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %8, align 8, !tbaa !20
  ret void
}

define void @Towers.pushDisk(%struct.Towers* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, %struct.Disk* noundef nonnull align 8 dereferenceable(16) %disk, i32 noundef %pile) #1 {
entry:
  %top.addr = alloca %struct.Disk*, align 8
  %0 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  %2 = sext i32 %pile to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %8 = bitcast i8* %7 to %struct.Disk**
  %9 = getelementptr inbounds %struct.Disk*, %struct.Disk** %8, i64 %2
  %10 = load %struct.Disk*, %struct.Disk** %9, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.Disk* %10, %struct.Disk** %top.addr, align 8
  %11 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %12 = icmp ne %struct.Disk* %11, null
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = getelementptr inbounds %struct.Disk, %struct.Disk* %disk, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !6
  %15 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %16 = getelementptr inbounds %struct.Disk, %struct.Disk* %15, i32 0, i32 0
  %17 = load i32, i32* %16, align 4, !tbaa !6
  %18 = icmp sge i32 %14, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %bounds.ok ], [ %18, %land.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [39 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %20 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %21 = getelementptr inbounds %struct.Disk, %struct.Disk* %disk, i32 0, i32 1
  store %struct.Disk* %20, %struct.Disk** %21, align 8, !tbaa !5
  %22 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 0
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !20
  %24 = sext i32 %pile to i64
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %30 = bitcast i8* %29 to %struct.Disk**
  %31 = getelementptr inbounds %struct.Disk*, %struct.Disk** %30, i64 %24
  store %struct.Disk* %disk, %struct.Disk** %31, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  ret void
}

define noundef nonnull align 8 dereferenceable(16) %struct.Disk* @Towers.popDiskFrom(%struct.Towers* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %pile) #1 {
entry:
  %top.addr = alloca %struct.Disk*, align 8
  %0 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  %2 = sext i32 %pile to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %8 = bitcast i8* %7 to %struct.Disk**
  %9 = getelementptr inbounds %struct.Disk*, %struct.Disk** %8, i64 %2
  %10 = load %struct.Disk*, %struct.Disk** %9, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.Disk* %10, %struct.Disk** %top.addr, align 8
  %11 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %12 = icmp eq %struct.Disk* %11, null
  br i1 %12, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [47 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %13 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !20
  %15 = sext i32 %pile to i64
  %16 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %17 = getelementptr inbounds %struct.Disk, %struct.Disk* %16, i32 0, i32 1
  %18 = load %struct.Disk*, %struct.Disk** %17, align 8, !tbaa !5
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %21 = icmp ult i64 %15, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %24 = bitcast i8* %23 to %struct.Disk**
  %25 = getelementptr inbounds %struct.Disk*, %struct.Disk** %24, i64 %15
  store %struct.Disk* %18, %struct.Disk** %25, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %26 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %27 = getelementptr inbounds %struct.Disk, %struct.Disk* %26, i32 0, i32 1
  store %struct.Disk* null, %struct.Disk** %27, align 8, !tbaa !5
  %28 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  ret %struct.Disk* %28
}

define void @Towers.moveTopDisk(%struct.Towers* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %fromPile, i32 noundef %toPile) #1 {
entry:
  %0 = call %struct.Disk* @Towers.popDiskFrom(%struct.Towers* %this, i32 %fromPile)
  call void @Towers.pushDisk(%struct.Towers* %this, %struct.Disk* %0, i32 %toPile)
  %1 = getelementptr inbounds %struct.Towers, %struct.Towers* %this, i32 0, i32 1
  %2 = load i32, i32* %1, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %1, align 4
  ret void
}

define noundef i32 @test() #1 {
entry:
  %t.addr = alloca %struct.Towers*, align 8
  %Towers.obj = alloca %struct.Towers, align 8
  %top.addr = alloca %struct.Disk*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Towers.constructor(%struct.Towers* %Towers.obj)
  store %struct.Towers* %Towers.obj, %struct.Towers** %t.addr, align 8
  %0 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.Disk*
  call void @Disk.constructor(%struct.Disk* %2, i32 2)
  call void @Towers.pushDisk(%struct.Towers* %0, %struct.Disk* %2, i32 0)
  %3 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.Disk*
  call void @Disk.constructor(%struct.Disk* %5, i32 1)
  call void @Towers.pushDisk(%struct.Towers* %3, %struct.Disk* %5, i32 0)
  %6 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  call void @Towers.moveTopDisk(%struct.Towers* %6, i32 0, i32 1)
  %7 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  call void @Towers.moveTopDisk(%struct.Towers* %7, i32 0, i32 2)
  %8 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  call void @Towers.moveTopDisk(%struct.Towers* %8, i32 1, i32 2)
  %9 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  %10 = getelementptr inbounds %struct.Towers, %struct.Towers* %9, i32 0, i32 0
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !20
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %14 = icmp ult i64 2, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %17 = bitcast i8* %16 to %struct.Disk**
  %18 = getelementptr inbounds %struct.Disk*, %struct.Disk** %17, i64 2
  %19 = load %struct.Disk*, %struct.Disk** %18, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.Disk* %19, %struct.Disk** %top.addr, align 8
  %20 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %21 = icmp eq %struct.Disk* %20, null
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = sub nsw i32 0, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22

if.end:
  %23 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  %24 = getelementptr inbounds %struct.Towers, %struct.Towers* %23, i32 0, i32 1
  %25 = load i32, i32* %24, align 4, !tbaa !8
  %26 = mul nsw i32 %25, 100
  %27 = load %struct.Disk*, %struct.Disk** %top.addr, align 8
  %28 = getelementptr inbounds %struct.Disk, %struct.Disk* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4, !tbaa !6
  %30 = mul nsw i32 %29, 10
  %31 = add nsw i32 %26, %30
  %32 = load %struct.Towers*, %struct.Towers** %t.addr, align 8
  %33 = getelementptr inbounds %struct.Towers, %struct.Towers* %32, i32 0, i32 0
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !20
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %37 = trunc i64 %36 to i32
  %38 = add nsw i32 %31, %37
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Disk", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"Towers", !3, i64 0, !2, i64 8}
!8 = !{!7, !2, i64 8}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!7, !3, i64 0}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
