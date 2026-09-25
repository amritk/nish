%struct.Tally = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare i32 @abs(i32)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
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

define internal void @Tally.constructor(%struct.Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = mul i64 4, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %7, align 8, !tbaa !15
  ret void
}

define noundef nonnull align 8 dereferenceable(8) %struct.Tally* @makeTally() #1 {
entry:
  %t.addr = alloca %struct.Tally*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Tally*
  call void @Tally.constructor(%struct.Tally* %1)
  store %struct.Tally* %1, %struct.Tally** %t.addr, align 8
  %2 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %3 = getelementptr inbounds %struct.Tally, %struct.Tally* %2, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 2, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 5, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %12 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  ret %struct.Tally* %12
}

define noundef i32 @tallyAt(%struct.Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %t, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret i32 %10
}

define noundef i32 @test() #1 {
entry:
  %t.addr = alloca %struct.Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Tally* @makeTally()
  store %struct.Tally* %0, %struct.Tally** %t.addr, align 8
  %1 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 1, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 1
  store i32 3, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %11 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %12 = call i32 @tallyAt(%struct.Tally* %11, i32 1)
  %13 = sub nsw i32 0, %12
  %14 = call i32 @abs(i32 %13)
  %15 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %16 = call i32 @tallyAt(%struct.Tally* %15, i32 2)
  %17 = add nsw i32 %14, %16
  %18 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %19 = getelementptr inbounds %struct.Tally, %struct.Tally* %18, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !15
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = add nsw i32 %17, %23
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Tally", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
