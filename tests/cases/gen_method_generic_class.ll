%struct.Box$i32 = type { i32 }
%struct.Box$str = type { i8* }
%struct.Pair$i32$i32 = type { i32, i32 }
%struct.Pair$i32$str = type { i32, i8* }
%struct.Pair$str$i32 = type { i8*, i32 }
%struct.Pair$str$str = type { i8*, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"seven\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"one\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"two\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
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

define noundef i32 @test() #0 {
entry:
  %n.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %s.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  %a.addr = alloca %struct.Pair$i32$i32*, align 8
  %b.addr = alloca %struct.Pair$i32$str*, align 8
  %c.addr = alloca %struct.Pair$str$i32*, align 8
  %d.addr = alloca %struct.Pair$str$str*, align 8
  %again.addr = alloca %struct.Pair$i32$i32*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 7)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %n.addr, align 8
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %s.addr, align 8
  %0 = load %struct.Box$i32*, %struct.Box$i32** %n.addr, align 8
  %1 = call %struct.Pair$i32$i32* @Box$i32.pair$i32(%struct.Box$i32* %0, i32 1)
  store %struct.Pair$i32$i32* %1, %struct.Pair$i32$i32** %a.addr, align 8
  %2 = load %struct.Box$i32*, %struct.Box$i32** %n.addr, align 8
  %3 = call %struct.Pair$i32$str* @Box$i32.pair$str(%struct.Box$i32* %2, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  store %struct.Pair$i32$str* %3, %struct.Pair$i32$str** %b.addr, align 8
  %4 = load %struct.Box$str*, %struct.Box$str** %s.addr, align 8
  %5 = call %struct.Pair$str$i32* @Box$str.pair$i32(%struct.Box$str* %4, i32 2)
  store %struct.Pair$str$i32* %5, %struct.Pair$str$i32** %c.addr, align 8
  %6 = load %struct.Box$str*, %struct.Box$str** %s.addr, align 8
  %7 = call %struct.Pair$str$str* @Box$str.pair$str(%struct.Box$str* %6, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  store %struct.Pair$str$str* %7, %struct.Pair$str$str** %d.addr, align 8
  %8 = load %struct.Box$i32*, %struct.Box$i32** %n.addr, align 8
  %9 = call %struct.Pair$i32$i32* @Box$i32.pair$i32(%struct.Box$i32* %8, i32 3)
  store %struct.Pair$i32$i32* %9, %struct.Pair$i32$i32** %again.addr, align 8
  %10 = load %struct.Pair$i32$str*, %struct.Pair$i32$str** %b.addr, align 8
  %11 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %10, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8, !tbaa !5
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %14 = load %struct.Pair$str$i32*, %struct.Pair$str$i32** %c.addr, align 8
  %15 = getelementptr inbounds %struct.Pair$str$i32, %struct.Pair$str$i32* %14, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !7
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %19 = load %struct.Pair$str$str*, %struct.Pair$str$str** %d.addr, align 8
  %20 = getelementptr inbounds %struct.Pair$str$str, %struct.Pair$str$str* %19, i32 0, i32 0
  %21 = load i8*, i8** %20, align 8, !tbaa !9
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  %23 = load %struct.Pair$str$str*, %struct.Pair$str$str** %d.addr, align 8
  %24 = getelementptr inbounds %struct.Pair$str$str, %struct.Pair$str$str* %23, i32 0, i32 1
  %25 = load i8*, i8** %24, align 8, !tbaa !10
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  call void @nish_print(i8* %26)
  %27 = load %struct.Pair$i32$i32*, %struct.Pair$i32$i32** %a.addr, align 8
  %28 = getelementptr inbounds %struct.Pair$i32$i32, %struct.Pair$i32$i32* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4, !tbaa !12
  %30 = load %struct.Pair$i32$i32*, %struct.Pair$i32$i32** %a.addr, align 8
  %31 = getelementptr inbounds %struct.Pair$i32$i32, %struct.Pair$i32$i32* %30, i32 0, i32 1
  %32 = load i32, i32* %31, align 4, !tbaa !13
  %33 = add nsw i32 %29, %32
  %34 = load %struct.Pair$str$i32*, %struct.Pair$str$i32** %c.addr, align 8
  %35 = getelementptr inbounds %struct.Pair$str$i32, %struct.Pair$str$i32* %34, i32 0, i32 1
  %36 = load i32, i32* %35, align 4, !tbaa !14
  %37 = add nsw i32 %33, %36
  %38 = load %struct.Pair$i32$i32*, %struct.Pair$i32$i32** %again.addr, align 8
  %39 = getelementptr inbounds %struct.Pair$i32$i32, %struct.Pair$i32$i32* %38, i32 0, i32 1
  %40 = load i32, i32* %39, align 4, !tbaa !13
  %41 = add nsw i32 %37, %40
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %41
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !16
  ret void
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %value, i8** %0, align 8, !tbaa !18
  ret void
}

define internal void @Pair$i32$i32.constructor(%struct.Pair$i32$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %first, i32 noundef %second) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair$i32$i32, %struct.Pair$i32$i32* %this, i32 0, i32 0
  store i32 %first, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.Pair$i32$i32, %struct.Pair$i32$i32* %this, i32 0, i32 1
  store i32 %second, i32* %1, align 4, !tbaa !13
  ret void
}

define internal void @Pair$i32$str.constructor(%struct.Pair$i32$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %first, i8* noundef nonnull noalias readonly align 8 %second) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %this, i32 0, i32 0
  store i32 %first, i32* %0, align 4, !tbaa !19
  %1 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %this, i32 0, i32 1
  store i8* %second, i8** %1, align 8, !tbaa !5
  ret void
}

define internal void @Pair$str$i32.constructor(%struct.Pair$str$i32* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %first, i32 noundef %second) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair$str$i32, %struct.Pair$str$i32* %this, i32 0, i32 0
  store i8* %first, i8** %0, align 8, !tbaa !7
  %1 = getelementptr inbounds %struct.Pair$str$i32, %struct.Pair$str$i32* %this, i32 0, i32 1
  store i32 %second, i32* %1, align 4, !tbaa !14
  ret void
}

define internal void @Pair$str$str.constructor(%struct.Pair$str$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %first, i8* noundef nonnull noalias readonly align 8 %second) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair$str$str, %struct.Pair$str$str* %this, i32 0, i32 0
  store i8* %first, i8** %0, align 8, !tbaa !9
  %1 = getelementptr inbounds %struct.Pair$str$str, %struct.Pair$str$str* %this, i32 0, i32 1
  store i8* %second, i8** %1, align 8, !tbaa !10
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Pair$i32$i32* @Box$i32.pair$i32(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %other) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair$i32$i32*
  %2 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !16
  call void @Pair$i32$i32.constructor(%struct.Pair$i32$i32* %1, i32 %3, i32 %other)
  ret %struct.Pair$i32$i32* %1
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Pair$i32$str* @Box$i32.pair$str(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i8* noundef nonnull noalias readonly align 8 %other) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Pair$i32$str*
  %2 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !16
  call void @Pair$i32$str.constructor(%struct.Pair$i32$str* %1, i32 %3, i8* %other)
  ret %struct.Pair$i32$str* %1
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Pair$str$i32* @Box$str.pair$i32(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %other) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Pair$str$i32*
  %2 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !18
  call void @Pair$str$i32.constructor(%struct.Pair$str$i32* %1, i8* %3, i32 %other)
  ret %struct.Pair$str$i32* %1
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Pair$str$str* @Box$str.pair$str(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %other) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Pair$str$str*
  %2 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !18
  call void @Pair$str$str.constructor(%struct.Pair$str$str* %1, i8* %3, i8* %other)
  ret %struct.Pair$str$str* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Pair$i32$str", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!"Pair$str$i32", !3, i64 0, !2, i64 8}
!7 = !{!6, !3, i64 0}
!8 = !{!"Pair$str$str", !3, i64 0, !3, i64 8}
!9 = !{!8, !3, i64 0}
!10 = !{!8, !3, i64 8}
!11 = !{!"Pair$i32$i32", !2, i64 0, !2, i64 4}
!12 = !{!11, !2, i64 0}
!13 = !{!11, !2, i64 4}
!14 = !{!6, !2, i64 8}
!15 = !{!"Box$i32", !2, i64 0}
!16 = !{!15, !2, i64 0}
!17 = !{!"Box$str", !3, i64 0}
!18 = !{!17, !3, i64 0}
!19 = !{!4, !2, i64 0}
