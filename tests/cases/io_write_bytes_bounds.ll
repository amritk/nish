%struct.nish_array = type { i64, i64, i8* }

declare noundef i32 @nish_write_bytes(%struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @writeAt(i32 noundef %off, i32 noundef %len) #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 65, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 66, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 67, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 10, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %10 = sext i32 %off to i64
  %11 = sext i32 %len to i64
  %12 = add i64 %10, %11
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ule i64 %10, %12
  %16 = icmp ule i64 %12, %14
  %17 = and i1 %15, %16
  br i1 %17, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %10, i64 %12, i64 %14)
  unreachable

net.ok:
  %18 = call i32 @nish_write_bytes(%struct.nish_array* %9, i64 %10, i64 %11)
  ret i32 %18
}

define noundef i32 @pastEnd() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 2, i32 3)
  ret i32 %0
}

define noundef i32 @negativeOffset() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 -1, i32 2)
  ret i32 %0
}

define noundef i32 @negativeLength() #0 {
entry:
  %0 = tail call i32 @writeAt(i32 2, i32 -1)
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @writeAt(i32 1, i32 3)
  %1 = call i32 @writeAt(i32 4, i32 0)
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
