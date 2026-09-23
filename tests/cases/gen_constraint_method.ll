%struct.Counter = type { i32 }

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %start) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %start, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Counter.bump(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %2, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  ret i32 %5
}

define noundef i32 @test() #0 {
entry:
  %Counter.obj = alloca %struct.Counter, align 8
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 40)
  %0 = call i32 @twice$$Counter(%struct.Counter* %Counter.obj)
  ret i32 %0
}

define internal noundef i32 @twice$$Counter(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %c) #0 {
entry:
  %0 = call i32 @Counter.bump(%struct.Counter* %c)
  %1 = call i32 @Counter.bump(%struct.Counter* %c)
  ret i32 %1
}

attributes #0 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0}
!4 = !{!3, !2, i64 0}
