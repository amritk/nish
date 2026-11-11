%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"build/test/file_read_at_eof.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"fileOpen \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"at the end: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"past the end: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"across the end: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", bytes \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"len 0: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"closed: \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_file_close(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i8], align 8
  %fd.addr = alloca i32, align 4
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i8], align 8
  %end.addr = alloca i64, align 8
  %near.addr = alloca i64, align 8
  %tail.addr = alloca i32, align 4
  %start.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [32 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [5 x i8]* %arr.data to i8*
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %10 = load i8*, i8** %path.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %12 = call i32 @nish_write_file_bytes(i8* %10, %struct.nish_array* %11)
  %13 = load i8*, i8** %path.addr, align 8
  %14 = call i32 @nish_file_open(i8* %13)
  store i32 %14, i32* %fd.addr, align 4
  %15 = load i32, i32* %fd.addr, align 4
  %16 = icmp slt i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %fd.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast [8 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %buf.addr, align 8
  store i64 5, i64* %end.addr, align 8
  %24 = load i32, i32* %fd.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %26 = load i64, i64* %end.addr, align 8
  %27 = add i64 0, 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %29 = load i64, i64* %28, align 8
  %30 = icmp ule i64 0, %27
  %31 = icmp ule i64 %27, %29
  %32 = and i1 %30, %31
  br i1 %32, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %27, i64 %29)
  unreachable

net.ok:
  %33 = call i32 @nish_file_read_at(i32 %24, %struct.nish_array* %25, i64 0, i64 8, i64 %26)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.2 to i8*), i8* %34)
  call void @nish_print(i8* %35)
  %36 = load i32, i32* %fd.addr, align 4
  %37 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %38 = load i64, i64* %end.addr, align 8
  %39 = sext i32 1000 to i64
  %40 = add nsw i64 %38, %39
  %41 = add i64 0, 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %43 = load i64, i64* %42, align 8
  %44 = icmp ule i64 0, %41
  %45 = icmp ule i64 %41, %43
  %46 = and i1 %44, %45
  br i1 %46, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %41, i64 %43)
  unreachable

net.ok.1:
  %47 = call i32 @nish_file_read_at(i32 %36, %struct.nish_array* %37, i64 0, i64 8, i64 %40)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.3 to i8*), i8* %48)
  call void @nish_print(i8* %49)
  store i64 3, i64* %near.addr, align 8
  %50 = load i32, i32* %fd.addr, align 4
  %51 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %52 = load i64, i64* %near.addr, align 8
  %53 = add i64 2, 6
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %55 = load i64, i64* %54, align 8
  %56 = icmp ule i64 2, %53
  %57 = icmp ule i64 %53, %55
  %58 = and i1 %56, %57
  br i1 %58, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 2, i64 %53, i64 %55)
  unreachable

net.ok.2:
  %59 = call i32 @nish_file_read_at(i32 %50, %struct.nish_array* %51, i64 2, i64 6, i64 %52)
  store i32 %59, i32* %tail.addr, align 4
  %60 = load i32, i32* %tail.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.4 to i8*), i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = icmp ult i64 2, %66
  br i1 %67, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %66)
  unreachable

bounds.ok:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i8*
  %71 = getelementptr inbounds i8, i8* %70, i64 2
  %72 = load i8, i8* %71, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = zext i8 %72 to i64
  %74 = call i8* @nish_str_from_u64(i64 %73)
  %75 = call i8* @nish_str_concat(i8* %63, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp ult i64 3, %79
  br i1 %80, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %79)
  unreachable

bounds.ok.1:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i8*
  %84 = getelementptr inbounds i8, i8* %83, i64 3
  %85 = load i8, i8* %84, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = zext i8 %85 to i64
  %87 = call i8* @nish_str_from_u64(i64 %86)
  %88 = call i8* @nish_str_concat(i8* %76, i8* %87)
  call void @nish_print(i8* %88)
  store i64 0, i64* %start.addr, align 8
  %89 = load i32, i32* %fd.addr, align 4
  %90 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %91 = load i64, i64* %start.addr, align 8
  %92 = add i64 0, 0
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %94 = load i64, i64* %93, align 8
  %95 = icmp ule i64 0, %92
  %96 = icmp ule i64 %92, %94
  %97 = and i1 %95, %96
  br i1 %97, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %92, i64 %94)
  unreachable

net.ok.3:
  %98 = call i32 @nish_file_read_at(i32 %89, %struct.nish_array* %90, i64 0, i64 0, i64 %91)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8* %99)
  call void @nish_print(i8* %100)
  %101 = load i32, i32* %fd.addr, align 4
  %102 = call i32 @nish_file_close(i32 %101)
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.8 to i8*), i8* %103)
  call void @nish_print(i8* %104)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
