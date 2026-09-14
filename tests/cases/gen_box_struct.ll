%struct.Point = type { i32, i32 }
%struct.Box$$Point = type { %struct.Point* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2

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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define noundef i32 @test() #0 {
entry:
  %b.addr = alloca %struct.Box$$Point*, align 8
  %Box$$Point.obj = alloca %struct.Box$$Point, align 8
  %p.addr = alloca %struct.Point*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 3, i32 4)
  call void @Box$$Point.constructor(%struct.Box$$Point* %Box$$Point.obj, %struct.Point* %1)
  store %struct.Box$$Point* %Box$$Point.obj, %struct.Box$$Point** %b.addr, align 8
  %2 = load %struct.Box$$Point*, %struct.Box$$Point** %b.addr, align 8
  %3 = call %struct.Point* @Box$$Point.get(%struct.Box$$Point* %2)
  store %struct.Point* %3, %struct.Point** %p.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %8 = getelementptr inbounds %struct.Point, %struct.Point* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !5
  %10 = add nsw i32 %6, %9
  ret i32 %10
}

define internal void @Box$$Point.constructor(%struct.Box$$Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Point* noundef nonnull align 8 dereferenceable(8) %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Point, %struct.Box$$Point* %this, i32 0, i32 0
  store %struct.Point* %v, %struct.Point** %0, align 8, !tbaa !8
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Point* @Box$$Point.get(%struct.Box$$Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Point, %struct.Box$$Point* %this, i32 0, i32 0
  %1 = load %struct.Point*, %struct.Point** %0, align 8, !tbaa !8
  ret %struct.Point* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"ptr", !1, i64 0}
!7 = !{!"Box$$Point", !6, i64 0}
!8 = !{!7, !6, i64 0}
