%struct.nish_array = type { i64, i64, i8* }

define noundef i32 @macEqual(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
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
  %23 = xor i32 %22, 0
  %24 = sub i32 0, %23
  %25 = or i32 %23, %24
  %26 = lshr i32 %25, 31
  %27 = sub i32 %26, 1
  %28 = call i32 asm "", "=r,0"(i32 %27) readnone nounwind
  ret i32 %28
}

define noundef i32 @tableLookup(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %secret) #0 {
entry:
  %found.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %found.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, 8
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %found.addr, align 4
  %5 = load i32, i32* %i.addr, align 4
  %6 = xor i32 %5, %secret
  %7 = sub i32 0, %6
  %8 = or i32 %6, %7
  %9 = lshr i32 %8, 31
  %10 = sub i32 %9, 1
  %11 = call i32 asm "", "=r,0"(i32 %10) readnone nounwind
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %1 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = call i32 asm "", "=r,0"(i32 %11) readnone nounwind
  %18 = and i32 %16, %17
  %19 = xor i32 %17, -1
  %20 = and i32 0, %19
  %21 = or i32 %18, %20
  %22 = or i32 %4, %21
  store i32 %22, i32* %found.addr, align 4
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %found.addr, align 4
  ret i32 %25
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
