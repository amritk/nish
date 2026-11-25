%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [74 x i8] } { i64 73, [74 x i8] c"`sum_u16`: argument 2 (n) counts more elements than argument 1 (xs) holds\00" }, align 8

declare i32 @sum_u16(i8*, i64)
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @run(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i16], align 8
  %0 = trunc i32 1 to i16
  %1 = trunc i32 300 to i16
  %2 = trunc i32 65535 to i16
  %3 = trunc i32 7 to i16
  %4 = trunc i32 9 to i16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast [5 x i16]* %arr.data to i8*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %7 to i16*
  %10 = getelementptr inbounds i16, i16* %9, i64 0
  store i16 %0, i16* %10, align 2, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i16, i16* %9, i64 1
  store i16 %1, i16* %11, align 2, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i16, i16* %9, i64 2
  store i16 %2, i16* %12, align 2, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i16, i16* %9, i64 3
  store i16 %3, i16* %13, align 2, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i16, i16* %9, i64 4
  store i16 %4, i16* %14, align 2, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = sext i32 %n to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ule i64 %16, %18
  br i1 %19, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [74 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = call i32 @sum_u16(i8* %21, i64 %16)
  ret i32 %22
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!13 = !{!"element i16", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
