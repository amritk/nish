%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #1

define internal noundef i32 @sendAt(i32 noundef %off, i32 noundef %len) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %to.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 4, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 5, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 6, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %4, i64 6
  store i8 7, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %4, i64 7
  store i8 8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %15, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %to.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %18 = sext i32 %off to i64
  %19 = sext i32 %len to i64
  %20 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %21 = add i64 %18, %19
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %23 = load i64, i64* %22, align 8
  %24 = icmp ule i64 %18, %21
  %25 = icmp ule i64 %21, %23
  %26 = and i1 %24, %25
  br i1 %26, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %18, i64 %21, i64 %23)
  unreachable

net.ok:
  %27 = call i32 @nish_udp_send_to(i32 -1, %struct.nish_array* %17, i64 %18, i64 %19, %struct.nish_array* %20, i32 0, i32 0)
  ret i32 %27
}

define internal noundef i32 @receiveAt(i32 noundef %off, i32 noundef %len) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast [2 x i32]* %arr.data.2 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 0, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 0, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %16 = sext i32 %off to i64
  %17 = sext i32 %len to i64
  %18 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %20 = add i64 %16, %17
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %22 = load i64, i64* %21, align 8
  %23 = icmp ule i64 %16, %20
  %24 = icmp ule i64 %20, %22
  %25 = and i1 %23, %24
  br i1 %25, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %16, i64 %20, i64 %22)
  unreachable

net.ok:
  %26 = call i32 @nish_udp_recv_from(i32 -1, %struct.nish_array* %15, i64 %16, i64 %17, %struct.nish_array* %18, %struct.nish_array* %19)
  ret i32 %26
}

define noundef i32 @pastEnd() #0 {
entry:
  %0 = tail call i32 @sendAt(i32 6, i32 3)
  ret i32 %0
}

define noundef i32 @negativeOffset() #0 {
entry:
  %0 = tail call i32 @receiveAt(i32 -2, i32 4)
  ret i32 %0
}

define noundef i32 @negativeLength() #0 {
entry:
  %0 = tail call i32 @sendAt(i32 3, i32 -1)
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sendAt(i32 0, i32 8)
  %1 = call i32 @receiveAt(i32 8, i32 0)
  %2 = add nsw i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
