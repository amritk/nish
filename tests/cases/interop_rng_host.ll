%struct.Slot = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<1, 7>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"value out of range: expected integer<-128, 127>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_exit(i32 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define noundef i8 @getByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %i) #0 {
entry:
  %0 = icmp ult i32 %i, 256
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 %1
  %9 = load i8, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8 %9
}

define noundef i32 @pick(i32 noundef %base, i32 noundef %day) #0 {
entry:
  %0 = sub i32 %day, 1
  %1 = icmp ult i32 %0, 7
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = mul nsw i32 %base, 10
  %3 = add nsw i32 %2, %day
  ret i32 %3
}

define noundef i32 @low(i32 noundef %x) #0 {
entry:
  %0 = sub i32 %x, -128
  %1 = icmp ult i32 %0, 256
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [48 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = add nsw i32 %x, 128
  ret i32 %2
}

define noundef i32 @labelLength(i8* noundef nonnull noalias readonly align 8 nocapture %name, i32 noundef %day) #0 {
entry:
  %0 = sub i32 %day, 1
  %1 = icmp ult i32 %0, 7
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = bitcast i8* %name to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = add nsw i32 %4, %day
  ret i32 %5
}

define noundef i32 @lastDigit(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 10
  %1 = add nsw i32 %0, 10
  %2 = srem i32 %1, 10
  %3 = icmp ult i32 %2, 10
  br i1 %3, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  ret i32 %2
}

define noundef i32 @count(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define void @Slot.constructor(%struct.Slot* noundef nonnull noalias readonly align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !16
  ret void
}

define noundef i32 @slotDay(%struct.Slot* noundef nonnull readonly align 8 dereferenceable(4) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !16
  ret i32 %1
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"i32", !6, i64 0}
!15 = !{!"Slot", !14, i64 0}
!16 = !{!15, !14, i64 0}
