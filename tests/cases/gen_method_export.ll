%struct.Holder = type { i1 }
%struct.Box$i32 = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

define noundef i32 @run(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(1) nocapture %h) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %b.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %0 = call i8* @Holder.pick$str(%struct.Holder* %h, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %0, i8** %s.addr, align 8
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 %4)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %b.addr, align 8
  %5 = call i32 @Holder.pick$i32(%struct.Holder* %h, i32 1, i32 2)
  %6 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %7 = call i32 @Box$i32.with$bool(%struct.Box$i32* %6, i1 true)
  %8 = add nsw i32 %5, %7
  ret i32 %8
}

define void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef nonnull align 8 i8* @Holder.pick$str(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !7
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %b, %cond.true ], [ %a, %cond.false ]
  ret i8* %2
}

define noundef i32 @Holder.pick$i32(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !7
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %b, %cond.true ], [ %a, %cond.false ]
  ret i32 %2
}

define noundef i32 @Box$i32.with$bool(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i1 noundef zeroext %other) #1 {
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
!5 = !{!"i1", !1, i64 0}
!6 = !{!"Holder", !5, i64 0}
!7 = !{!6, !5, i64 0}
