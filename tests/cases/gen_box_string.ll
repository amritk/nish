%struct.Box$str = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  %b.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %b.addr, align 8
  %0 = load %struct.Box$str*, %struct.Box$str** %b.addr, align 8
  %1 = call i8* @Box$str.get(%struct.Box$str* %0)
  call void @nish_print(i8* %1)
  ret i32 0
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @Box$str.get(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !4
  ret i8* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box$str", !2, i64 0}
!4 = !{!3, !2, i64 0}
