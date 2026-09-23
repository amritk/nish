%struct.Chooser = type { i1 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"left\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  %c.addr = alloca %struct.Chooser*, align 8
  %Chooser.obj = alloca %struct.Chooser, align 8
  %first.addr = alloca i32, align 4
  %word.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %Chooser.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !4
  store %struct.Chooser* %Chooser.obj, %struct.Chooser** %c.addr, align 8
  %1 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %2 = call i32 @Chooser.pick$i32(%struct.Chooser* %1, i32 1, i32 2)
  store i32 %2, i32* %first.addr, align 4
  %3 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %4 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %3, i32 0, i32 0
  store i1 true, i1* %4, align 1, !tbaa !4
  %5 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %6 = call i8* @Chooser.pick$str(%struct.Chooser* %5, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store i8* %6, i8** %word.addr, align 8
  %7 = load i8*, i8** %word.addr, align 8
  call void @nish_print(i8* %7)
  %8 = load i32, i32* %first.addr, align 4
  %9 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %10 = call i32 @Chooser.pick$i32(%struct.Chooser* %9, i32 10, i32 20)
  %11 = add nsw i32 %8, %10
  ret i32 %11
}

define internal noundef i32 @Chooser.pick$i32(%struct.Chooser* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !4
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %b, %cond.true ], [ %a, %cond.false ]
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @Chooser.pick$str(%struct.Chooser* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !4
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %b, %cond.true ], [ %a, %cond.false ]
  ret i8* %2
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"Chooser", !2, i64 0}
!4 = !{!3, !2, i64 0}
