%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [70 x i8] } { i64 69, [70 x i8] c"`write`: argument 3 (n) counts more bytes than argument 2 (buf) holds\00" }, align 8

declare i64 @read(i32, i8*, i64)
declare i64 @write(i32, i8*, i64)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef i64 @echo(i32 noundef %fd) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %n.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = call i64 @read(i32 %fd, i8* %11, i64 %9)
  store i64 %12, i64* %n.addr, align 8
  %13 = load i64, i64* %n.addr, align 8
  %14 = icmp sgt i64 %13, 0
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %16 = load i64, i64* %n.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ule i64 %16, %18
  br i1 %19, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = call i64 @write(i32 1, i8* %21, i64 %16)
  br label %if.end

if.end:
  %23 = load i64, i64* %n.addr, align 8
  ret i64 %23
}

define noundef i32 @run(i32 noundef %fd) #0 {
entry:
  %0 = call i64 @echo(i32 %fd)
  %1 = trunc i64 %0 to i32
  ret i32 %1
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
