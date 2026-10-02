%struct.nish_array = type { i64, i64, i8* }

define noundef zeroext i1 @timingSafeEqual32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %diff.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %diff.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 32
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %diff.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %1 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %3 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %17 = xor i8 %11, %16
  %18 = zext i8 %17 to i32
  %19 = or i32 %6, %18
  store i32 %19, i32* %diff.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %diff.addr, align 4
  %23 = icmp eq i32 %22, 0
  ret i1 %23
}

define noundef zeroext i1 @timingSafeEqual48(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %diff.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %diff.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 48
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %diff.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %1 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %3 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %17 = xor i8 %11, %16
  %18 = zext i8 %17 to i32
  %19 = or i32 %6, %18
  store i32 %19, i32* %diff.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %diff.addr, align 4
  %23 = icmp eq i32 %22, 0
  ret i1 %23
}

define noundef zeroext i1 @timingSafeEqualAt16(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %aOff, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %bOff) #0 {
entry:
  %diff.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %diff.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, 16
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %diff.addr, align 4
  %7 = load i32, i32* %k.addr, align 4
  %8 = add nsw i32 %aOff, %7
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %1 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = load i32, i32* %k.addr, align 4
  %14 = add nsw i32 %bOff, %13
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = xor i8 %12, %18
  %20 = zext i8 %19 to i32
  %21 = or i32 %6, %20
  store i32 %21, i32* %diff.addr, align 4
  br label %for.inc

for.inc:
  %22 = load i32, i32* %k.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %diff.addr, align 4
  %25 = icmp eq i32 %24, 0
  ret i1 %25
}

attributes #0 = { nounwind willreturn readonly }

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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i8", !6, i64 0}
!12 = !{!11, !11, i64 0}
