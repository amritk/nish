%struct.Box$i32 = type { i32 }
%struct.Box$$Box$i32 = type { %struct.Box$i32* }
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

define noundef i32 @test() #0 {
entry:
  %inner.addr = alloca %struct.Box$i32*, align 8
  %outer.addr = alloca %struct.Box$$Box$i32*, align 8
  %Box$$Box$i32.obj = alloca %struct.Box$$Box$i32, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Box$i32*
  call void @Box$i32.constructor(%struct.Box$i32* %1, i32 21)
  store %struct.Box$i32* %1, %struct.Box$i32** %inner.addr, align 8
  %2 = load %struct.Box$i32*, %struct.Box$i32** %inner.addr, align 8
  call void @Box$$Box$i32.constructor(%struct.Box$$Box$i32* %Box$$Box$i32.obj, %struct.Box$i32* %2)
  store %struct.Box$$Box$i32* %Box$$Box$i32.obj, %struct.Box$$Box$i32** %outer.addr, align 8
  %3 = load %struct.Box$$Box$i32*, %struct.Box$$Box$i32** %outer.addr, align 8
  %4 = call %struct.Box$i32* @Box$$Box$i32.get(%struct.Box$$Box$i32* %3)
  %5 = call i32 @Box$i32.get(%struct.Box$i32* %4)
  %6 = mul nsw i32 %5, 2
  ret i32 %6
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  ret i32 %1
}

define internal void @Box$$Box$i32.constructor(%struct.Box$$Box$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Box$i32* noundef nonnull align 8 dereferenceable(4) %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Box$i32, %struct.Box$$Box$i32* %this, i32 0, i32 0
  store %struct.Box$i32* %v, %struct.Box$i32** %0, align 8, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box$i32* @Box$$Box$i32.get(%struct.Box$$Box$i32* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Box$i32, %struct.Box$$Box$i32* %this, i32 0, i32 0
  %1 = load %struct.Box$i32*, %struct.Box$i32** %0, align 8, !tbaa !7
  ret %struct.Box$i32* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Box$$Box$i32", !5, i64 0}
!7 = !{!6, !5, i64 0}
