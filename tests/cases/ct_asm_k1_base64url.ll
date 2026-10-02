%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @base64urlRangeMask(i32 noundef %c, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = sub nsw i32 %lo, 1
  %1 = sub nsw i32 %0, %c
  %2 = sub nsw i32 %c, %hi
  %3 = sub nsw i32 %2, 1
  %4 = and i32 %1, %3
  %5 = ashr i32 %4, 31
  ret i32 %5
}

define noundef i32 @base64urlCharOf(i32 noundef %v) #0 {
entry:
  %0 = add nsw i32 65, %v
  %1 = call i32 @base64urlRangeMask(i32 %v, i32 26, i32 63)
  %2 = and i32 %1, 6
  %3 = add nsw i32 %0, %2
  %4 = call i32 @base64urlRangeMask(i32 %v, i32 52, i32 63)
  %5 = and i32 %4, 75
  %6 = sub nsw i32 %3, %5
  %7 = call i32 @base64urlRangeMask(i32 %v, i32 62, i32 63)
  %8 = and i32 %7, 13
  %9 = sub nsw i32 %6, %8
  %10 = call i32 @base64urlRangeMask(i32 %v, i32 63, i32 63)
  %11 = and i32 %10, 49
  %12 = add nsw i32 %9, %11
  ret i32 %12
}

define noundef i32 @base64urlSextetOf(i32 noundef %c) #0 {
entry:
  %upper.addr = alloca i32, align 4
  %lower.addr = alloca i32, align 4
  %digit.addr = alloca i32, align 4
  %dash.addr = alloca i32, align 4
  %underscore.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  %0 = call i32 @base64urlRangeMask(i32 %c, i32 65, i32 90)
  store i32 %0, i32* %upper.addr, align 4
  %1 = call i32 @base64urlRangeMask(i32 %c, i32 97, i32 122)
  store i32 %1, i32* %lower.addr, align 4
  %2 = call i32 @base64urlRangeMask(i32 %c, i32 48, i32 57)
  store i32 %2, i32* %digit.addr, align 4
  %3 = call i32 @base64urlRangeMask(i32 %c, i32 45, i32 45)
  store i32 %3, i32* %dash.addr, align 4
  %4 = call i32 @base64urlRangeMask(i32 %c, i32 95, i32 95)
  store i32 %4, i32* %underscore.addr, align 4
  %5 = load i32, i32* %upper.addr, align 4
  %6 = sub nsw i32 %c, 65
  %7 = and i32 %5, %6
  %8 = load i32, i32* %lower.addr, align 4
  %9 = sub nsw i32 %c, 71
  %10 = and i32 %8, %9
  %11 = or i32 %7, %10
  %12 = load i32, i32* %digit.addr, align 4
  %13 = add nsw i32 %c, 4
  %14 = and i32 %12, %13
  %15 = or i32 %11, %14
  %16 = load i32, i32* %dash.addr, align 4
  %17 = and i32 %16, 62
  %18 = or i32 %15, %17
  %19 = load i32, i32* %underscore.addr, align 4
  %20 = and i32 %19, 63
  %21 = or i32 %18, %20
  store i32 %21, i32* %value.addr, align 4
  %22 = load i32, i32* %value.addr, align 4
  %23 = load i32, i32* %upper.addr, align 4
  %24 = load i32, i32* %lower.addr, align 4
  %25 = or i32 %23, %24
  %26 = load i32, i32* %digit.addr, align 4
  %27 = or i32 %25, %26
  %28 = load i32, i32* %dash.addr, align 4
  %29 = or i32 %27, %28
  %30 = load i32, i32* %underscore.addr, align 4
  %31 = or i32 %29, %30
  %32 = xor i32 %31, -1
  %33 = or i32 %22, %32
  ret i32 %33
}

define void @base64urlEncodeGroup(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %data, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #1 {
entry:
  %acc.addr = alloca i32, align 4
  %bits.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %acc.addr, align 4
  store i32 0, i32* %bits.addr, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %data, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, 3
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %acc.addr, align 4
  %7 = shl i32 %6, 8
  %8 = load i32, i32* %k.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %1 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = zext i8 %12 to i32
  %14 = or i32 %7, %13
  %15 = and i32 %14, 4095
  store i32 %15, i32* %acc.addr, align 4
  %16 = load i32, i32* %bits.addr, align 4
  %17 = add nsw i32 %16, 8
  store i32 %17, i32* %bits.addr, align 4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %20 = load i32, i32* %bits.addr, align 4
  %21 = icmp sge i32 %20, 6
  br i1 %21, label %while.body, label %while.end

while.body:
  %22 = load i32, i32* %bits.addr, align 4
  %23 = sub nsw i32 %22, 6
  store i32 %23, i32* %bits.addr, align 4
  %24 = load i32, i32* %j.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = load i32, i32* %acc.addr, align 4
  %27 = load i32, i32* %bits.addr, align 4
  %28 = and i32 %27, 31
  %29 = ashr i32 %26, %28
  %30 = and i32 %29, 63
  %31 = call i32 @base64urlCharOf(i32 %30)
  %32 = trunc i32 %31 to i8
  %33 = bitcast i8* %19 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %25
  store i8 %32, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %35 = load i32, i32* %j.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %j.addr, align 4
  br label %while.cond

while.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @base64urlDecodeGroup(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %text, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #2 {
entry:
  %bad.addr = alloca i32, align 4
  %acc.addr = alloca i32, align 4
  %v0.addr = alloca i32, align 4
  %v1.addr = alloca i32, align 4
  %v2.addr = alloca i32, align 4
  %v3.addr = alloca i32, align 4
  store i32 0, i32* %bad.addr, align 4
  store i32 0, i32* %acc.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %text, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i8*
  %3 = getelementptr inbounds i8, i8* %2, i64 0
  %4 = load i8, i8* %3, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = zext i8 %4 to i32
  %6 = call i32 @base64urlSextetOf(i32 %5)
  store i32 %6, i32* %v0.addr, align 4
  %7 = load i32, i32* %bad.addr, align 4
  %8 = load i32, i32* %v0.addr, align 4
  %9 = ashr i32 %8, 31
  %10 = or i32 %7, %9
  store i32 %10, i32* %bad.addr, align 4
  %11 = load i32, i32* %acc.addr, align 4
  %12 = shl i32 %11, 6
  %13 = load i32, i32* %v0.addr, align 4
  %14 = and i32 %13, 63
  %15 = or i32 %12, %14
  %16 = and i32 %15, 4095
  store i32 %16, i32* %acc.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %text, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 1
  %21 = load i8, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %22 = zext i8 %21 to i32
  %23 = call i32 @base64urlSextetOf(i32 %22)
  store i32 %23, i32* %v1.addr, align 4
  %24 = load i32, i32* %bad.addr, align 4
  %25 = load i32, i32* %v1.addr, align 4
  %26 = ashr i32 %25, 31
  %27 = or i32 %24, %26
  store i32 %27, i32* %bad.addr, align 4
  %28 = load i32, i32* %acc.addr, align 4
  %29 = shl i32 %28, 6
  %30 = load i32, i32* %v1.addr, align 4
  %31 = and i32 %30, 63
  %32 = or i32 %29, %31
  %33 = and i32 %32, 4095
  store i32 %33, i32* %acc.addr, align 4
  %34 = load i32, i32* %acc.addr, align 4
  %35 = ashr i32 %34, 4
  %36 = and i32 %35, 255
  %37 = trunc i32 %36 to i8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = bitcast i8* %39 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 0
  store i8 %37, i8* %41, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %text, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = bitcast i8* %43 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 2
  %46 = load i8, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %47 = zext i8 %46 to i32
  %48 = call i32 @base64urlSextetOf(i32 %47)
  store i32 %48, i32* %v2.addr, align 4
  %49 = load i32, i32* %bad.addr, align 4
  %50 = load i32, i32* %v2.addr, align 4
  %51 = ashr i32 %50, 31
  %52 = or i32 %49, %51
  store i32 %52, i32* %bad.addr, align 4
  %53 = load i32, i32* %acc.addr, align 4
  %54 = shl i32 %53, 6
  %55 = load i32, i32* %v2.addr, align 4
  %56 = and i32 %55, 63
  %57 = or i32 %54, %56
  %58 = and i32 %57, 4095
  store i32 %58, i32* %acc.addr, align 4
  %59 = load i32, i32* %acc.addr, align 4
  %60 = ashr i32 %59, 2
  %61 = and i32 %60, 255
  %62 = trunc i32 %61 to i8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = bitcast i8* %64 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 1
  store i8 %62, i8* %66, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %text, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = bitcast i8* %68 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 3
  %71 = load i8, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %72 = zext i8 %71 to i32
  %73 = call i32 @base64urlSextetOf(i32 %72)
  store i32 %73, i32* %v3.addr, align 4
  %74 = load i32, i32* %bad.addr, align 4
  %75 = load i32, i32* %v3.addr, align 4
  %76 = ashr i32 %75, 31
  %77 = or i32 %74, %76
  store i32 %77, i32* %bad.addr, align 4
  %78 = load i32, i32* %acc.addr, align 4
  %79 = shl i32 %78, 6
  %80 = load i32, i32* %v3.addr, align 4
  %81 = and i32 %80, 63
  %82 = or i32 %79, %81
  %83 = and i32 %82, 4095
  store i32 %83, i32* %acc.addr, align 4
  %84 = load i32, i32* %acc.addr, align 4
  %85 = and i32 %84, 255
  %86 = trunc i32 %85 to i8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = bitcast i8* %88 to i8*
  %90 = getelementptr inbounds i8, i8* %89, i64 2
  store i8 %86, i8* %90, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %91 = load i32, i32* %bad.addr, align 4
  ret i32 %91
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

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
