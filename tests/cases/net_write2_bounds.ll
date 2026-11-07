%struct.nish_array = type { i64, i64, i8* }

declare noundef i32 @nish_net_write2(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @send$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %aOff, i32 noundef %aLen, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %bOff, i32 noundef %bLen) #0 {
entry:
  %0 = sext i32 %aOff to i64
  %1 = sext i32 %aLen to i64
  %2 = sext i32 %bOff to i64
  %3 = sext i32 %bLen to i64
  %4 = add i64 %0, %1
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 %0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = add i64 %2, %3
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = icmp ule i64 %2, %10
  %14 = icmp ule i64 %10, %12
  %15 = and i1 %13, %14
  br i1 %15, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 %2, i64 %10, i64 %12)
  unreachable

net.ok.1:
  %16 = call i32 @nish_net_write2(i32 -1, %struct.nish_array* %a, i64 %0, i64 %1, %struct.nish_array* %b, i64 %2, i64 %3)
  ret i32 %16
}

define internal noundef i32 @writeAt(i32 noundef %aOff, i32 noundef %aLen, i32 noundef %bOff, i32 noundef %bLen) #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [6 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [6 x i8]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  store i8 5, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i8, i8* %13, i64 1
  store i8 6, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i8, i8* %13, i64 2
  store i8 7, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i8, i8* %13, i64 3
  store i8 8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i8, i8* %13, i64 4
  store i8 9, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i8, i8* %13, i64 5
  store i8 10, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %22 = call i32 @send$(%struct.nish_array* %20, i32 %aOff, i32 %aLen, %struct.nish_array* %21, i32 %bOff, i32 %bLen)
  ret i32 %22
}

define noundef i32 @firstPastEnd() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 2, i32 3, i32 0, i32 6)
  ret i32 %0
}

define noundef i32 @secondPastEnd() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 0, i32 4, i32 5, i32 2)
  ret i32 %0
}

define noundef i32 @secondNegative() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 0, i32 4, i32 -1, i32 1)
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @writeAt(i32 0, i32 4, i32 0, i32 6)
  %1 = call i32 @writeAt(i32 4, i32 0, i32 6, i32 0)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
