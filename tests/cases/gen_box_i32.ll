%struct.Box$i32 = type { i32 }

define noundef i32 @test() #0 {
entry:
  %b.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 7)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %b.addr, align 8
  %0 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %1 = call i32 @Box$i32.get(%struct.Box$i32* %0)
  ret i32 %1
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

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
