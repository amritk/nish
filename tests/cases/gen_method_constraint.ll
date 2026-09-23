%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }
%struct.Square = type { i32 }
%struct.Scale = type { i32 }
%struct.Tally$$Square = type { %struct.Square* }
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %radius) #0 {
entry:
  %0 = mul nsw i32 3, %radius
  %1 = mul nsw i32 %0, %radius
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %1, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %radius, i32* %3, align 4
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = mul nsw i32 %side, %side
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %0, i32* %1, align 4
  ret void
}

define noundef i32 @test() #0 {
entry:
  %scale.addr = alloca %struct.Scale*, align 8
  %Scale.obj = alloca %struct.Scale, align 8
  %tally.addr = alloca %struct.Tally$$Square*, align 8
  %Tally$$Square.obj = alloca %struct.Tally$$Square, align 8
  %Circle.obj = alloca %struct.Circle, align 8
  %Square.obj = alloca %struct.Square, align 8
  %Circle.obj.1 = alloca %struct.Circle, align 8
  %0 = getelementptr inbounds %struct.Scale, %struct.Scale* %Scale.obj, i32 0, i32 0
  store i32 2, i32* %0, align 4, !tbaa !4
  store %struct.Scale* %Scale.obj, %struct.Scale** %scale.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Square*
  call void @Square.constructor(%struct.Square* %2, i32 1)
  call void @Tally$$Square.constructor(%struct.Tally$$Square* %Tally$$Square.obj, %struct.Square* %2)
  store %struct.Tally$$Square* %Tally$$Square.obj, %struct.Tally$$Square** %tally.addr, align 8
  %3 = load %struct.Scale*, %struct.Scale** %scale.addr, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 1)
  %4 = call i32 @Scale.apply$$Circle(%struct.Scale* %3, %struct.Circle* %Circle.obj)
  %5 = load %struct.Scale*, %struct.Scale** %scale.addr, align 8
  call void @Square.constructor(%struct.Square* %Square.obj, i32 2)
  %6 = call i32 @Scale.apply$$Square(%struct.Scale* %5, %struct.Square* %Square.obj)
  %7 = add nsw i32 %4, %6
  %8 = load %struct.Tally$$Square*, %struct.Tally$$Square** %tally.addr, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj.1, i32 2)
  %9 = call i32 @Tally$$Square.plus$$Circle(%struct.Tally$$Square* %8, %struct.Circle* %Circle.obj.1)
  %10 = add nsw i32 %7, %9
  ret i32 %10
}

define internal void @Tally$$Square.constructor(%struct.Tally$$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Square* noundef nonnull align 8 dereferenceable(4) %base) #0 {
entry:
  %0 = getelementptr inbounds %struct.Tally$$Square, %struct.Tally$$Square* %this, i32 0, i32 0
  store %struct.Square* %base, %struct.Square** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @Scale.apply$$Circle(%struct.Scale* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, %struct.Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %u) #1 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %u, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Scale, %struct.Scale* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = mul nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @Scale.apply$$Square(%struct.Scale* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, %struct.Square* noundef nonnull readonly align 8 dereferenceable(4) nocapture %u) #1 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %u, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Scale, %struct.Scale* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = mul nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @Tally$$Square.plus$$Circle(%struct.Tally$$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %u) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tally$$Square, %struct.Tally$$Square* %this, i32 0, i32 0
  %1 = load %struct.Square*, %struct.Square** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %u, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = add nsw i32 %3, %5
  ret i32 %6
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Scale", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Tally$$Square", !5, i64 0}
!7 = !{!6, !5, i64 0}
