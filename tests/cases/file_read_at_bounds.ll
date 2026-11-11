%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @readAt(i32 noundef %off, i32 noundef %len) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %pos.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  store i64 0, i64* %pos.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = sext i32 %off to i64
  %6 = sext i32 %len to i64
  %7 = load i64, i64* %pos.addr, align 8
  %8 = add i64 %5, %6
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = icmp ule i64 %5, %8
  %12 = icmp ule i64 %8, %10
  %13 = and i1 %11, %12
  br i1 %13, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %5, i64 %8, i64 %10)
  unreachable

net.ok:
  %14 = call i32 @nish_file_read_at(i32 -1, %struct.nish_array* %4, i64 %5, i64 %6, i64 %7)
  ret i32 %14
}

define noundef i32 @pastEnd() #0 {
entry:
  %0 = tail call i32 @readAt(i32 4, i32 5)
  ret i32 %0
}

define noundef i32 @negativeOffset() #0 {
entry:
  %0 = tail call i32 @readAt(i32 -1, i32 2)
  ret i32 %0
}

define noundef i32 @negativeLength() #0 {
entry:
  %0 = tail call i32 @readAt(i32 2, i32 -1)
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @readAt(i32 0, i32 8)
  %1 = sub nsw i32 1, 1
  %2 = call i32 @readAt(i32 8, i32 %1)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!13, !14, !15, !16, !17}
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
!13 = !{i32 8, !"cf-protection-branch", i32 1}
!14 = !{i32 8, !"cf-protection-return", i32 1}
!15 = !{i32 8, !"branch-target-enforcement", i32 1}
!16 = !{i32 8, !"sign-return-address", i32 1}
!17 = !{i32 4, !"probe-stack", !"inline-asm"}
