%struct.Counter = type { i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %start) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %start, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Counter.bump(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !4
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %Counter.obj = alloca %struct.Counter, align 8
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 40)
  %0 = call i32 @twice$$Counter(%struct.Counter* %Counter.obj)
  ret i32 %0
}

define internal noundef i32 @twice$$Counter(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %c) #1 {
entry:
  %0 = call i32 @Counter.bump(%struct.Counter* %c)
  %1 = call i32 @Counter.bump(%struct.Counter* %c)
  ret i32 %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0}
!4 = !{!3, !2, i64 0}
