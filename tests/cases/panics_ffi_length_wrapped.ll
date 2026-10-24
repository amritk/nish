%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [69 x i8] } { i64 68, [69 x i8] c"`read`: argument 3 (n) counts more bytes than argument 2 (buf) holds\00" }, align 8

declare i64 @read(i32, i8*, i64)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @wrapped() #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = sext i32 0 to i64
  %6 = sext i32 1 to i64
  %7 = sub i64 %5, %6
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ule i64 %7, %9
  br i1 %10, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [69 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = call i64 @read(i32 0, i8* %12, i64 %7)
  %14 = trunc i64 %13 to i32
  ret i32 %14
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
