%struct.nish_array = type { i64, i64, i8* }

declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0

define noundef i32 @echoOnce(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = call i32 @nish_net_read(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3)
  store i32 %4, i32* %n.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %n.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = call i32 @nish_net_write(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %8)
  br label %cond.end

cond.false:
  %10 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %11 = phi i32 [ %9, %cond.true ], [ %10, %cond.false ]
  ret i32 %11
}

attributes #0 = { nounwind }

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
