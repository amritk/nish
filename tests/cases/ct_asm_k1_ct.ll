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

define noundef zeroext i1 @timingSafeEqualAt16(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i16 noundef %aOff, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i16 noundef %bOff) #0 {
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
  %7 = zext i16 %aOff to i32
  %8 = load i32, i32* %k.addr, align 4
  %9 = add nsw i32 %7, %8
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %1 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %10
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = zext i16 %bOff to i32
  %15 = load i32, i32* %k.addr, align 4
  %16 = add nsw i32 %14, %15
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %3 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %17
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %21 = xor i8 %13, %20
  %22 = zext i8 %21 to i32
  %23 = or i32 %6, %22
  store i32 %23, i32* %diff.addr, align 4
  br label %for.inc

for.inc:
  %24 = load i32, i32* %k.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %diff.addr, align 4
  %27 = icmp eq i32 %26, 0
  ret i1 %27
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
