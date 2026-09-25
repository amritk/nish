%struct.Acc = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal void @Acc.constructor(%struct.Acc* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Acc, %struct.Acc* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #1 {
entry:
  %0 = mul i32 %x, %x
  %1 = mul i32 3, %y
  %2 = sub i32 %0, %1
  %3 = sub i32 0, %x
  %4 = add i32 %2, %3
  ret i32 %4
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.Acc* noundef nonnull align 8 dereferenceable(4) nocapture %acc) #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %s.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = icmp ult i64 %9, %1
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %9, i64 %1)
  unreachable

bounds.ok:
  %11 = bitcast i8* %3 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %9
  %13 = load i32, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %14 = add i32 %7, %13
  store i32 %14, i32* %s.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %3 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %16
  %19 = load i32, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %20 = mul i32 %19, 2
  store i32 %20, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %21 = getelementptr inbounds %struct.Acc, %struct.Acc* %acc, i32 0, i32 0
  %22 = load i32, i32* %21, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %28 = icmp eq i32 2, 0
  %29 = icmp eq i32 %27, -2147483648
  %30 = icmp eq i32 2, -1
  %31 = and i1 %29, %30
  %32 = or i1 %28, %31
  br i1 %32, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %28)
  unreachable

div.ok:
  %33 = sdiv i32 %27, 2
  %34 = sub i32 %22, %33
  store i32 %34, i32* %21, align 4
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = load i32, i32* %s.addr, align 4
  %38 = icmp eq i32 1000, 0
  %39 = icmp eq i32 %37, -2147483648
  %40 = icmp eq i32 1000, -1
  %41 = and i1 %39, %40
  %42 = or i1 %38, %41
  br i1 %42, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %38)
  unreachable

div.ok.1:
  %43 = srem i32 %37, 1000
  ret i32 %43
}

define internal noundef i32 @mix(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %m.addr = alloca i32, align 4
  %0 = mul i32 %a, %b
  store i32 %0, i32* %m.addr, align 4
  %1 = load i32, i32* %m.addr, align 4
  %2 = sub i32 %a, %b
  %3 = add i32 %1, %2
  store i32 %3, i32* %m.addr, align 4
  %4 = load i32, i32* %m.addr, align 4
  %5 = sub i32 %4, 1
  store i32 %5, i32* %m.addr, align 4
  %6 = load i32, i32* %m.addr, align 4
  ret i32 %6
}

define noundef i32 @test() #2 {
entry:
  %acc.addr = alloca %struct.Acc*, align 8
  %Acc.obj = alloca %struct.Acc, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %n.addr = alloca i32, align 4
  call void @Acc.constructor(%struct.Acc* %Acc.obj)
  store %struct.Acc* %Acc.obj, %struct.Acc** %acc.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = call i32 @poly(i32 5, i32 2)
  store i32 %9, i32* %n.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = add i32 %10, 1
  store i32 %11, i32* %n.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = sub i32 %12, 1
  store i32 %13, i32* %n.addr, align 4
  %14 = load i32, i32* %n.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %17 = call i32 @sum(%struct.nish_array* %15, %struct.Acc* %16)
  %18 = add i32 %14, %17
  %19 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %20 = getelementptr inbounds %struct.Acc, %struct.Acc* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !4
  %22 = add i32 %18, %21
  %23 = call i32 @mix(i32 3, i32 2)
  %24 = add i32 %22, %23
  ret i32 %24
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Acc", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
