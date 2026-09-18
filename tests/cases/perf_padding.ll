%struct.Mixed = type { i1, double, i32 }
%struct.Row = type { i1, double, i32 }

define noundef i32 @test() #0 {
entry:
  %m.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %r.addr = alloca %struct.Row*, align 8
  %Row.obj = alloca %struct.Row, align 8
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !6
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %1, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !8
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %m.addr, align 8
  %3 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %3, i32 0, i32 2
  store i32 7, i32* %4, align 4, !tbaa !8
  %5 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 0
  store i1 true, i1* %5, align 1
  %6 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 1
  store double 0x4008000000000000, double* %6, align 8
  %7 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 2
  store i32 2, i32* %7, align 4
  store %struct.Row* %Row.obj, %struct.Row** %r.addr, align 8
  %8 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %9 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %8, i32 0, i32 2
  %10 = load i32, i32* %9, align 4, !tbaa !8
  %11 = load %struct.Row*, %struct.Row** %r.addr, align 8
  %12 = getelementptr inbounds %struct.Row, %struct.Row* %11, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = add nsw i32 %10, %13
  %15 = load %struct.Row*, %struct.Row** %r.addr, align 8
  %16 = getelementptr inbounds %struct.Row, %struct.Row* %15, i32 0, i32 0
  %17 = load i1, i1* %16, align 1
  br i1 %17, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %18 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %19 = add nsw i32 %14, %18
  ret i32 %19
}

attributes #0 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"double", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Mixed", !2, i64 0, !3, i64 8, !4, i64 16}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 8}
!8 = !{!5, !4, i64 16}
