%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"build/test/file_read_at_pos.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"fileOpen \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"negative pos: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"pos + len past 2^63 - 1: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"in range: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"closed: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"read after close: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"size after close: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"closed again: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"read on -1: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"size of -1: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"close -1: \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare noundef i64 @nish_file_size(i32 noundef) #0
declare noundef i32 @nish_file_close(i32 noundef) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %fd.addr = alloca i32, align 4
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i8], align 8
  %negative.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %start.addr = alloca i64, align 8
  %bad.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [32 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 9, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 8, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 7, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %8 = load i8*, i8** %path.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %10 = call i32 @nish_write_file_bytes(i8* %8, %struct.nish_array* %9)
  %11 = load i8*, i8** %path.addr, align 8
  %12 = call i32 @nish_file_open(i8* %11)
  store i32 %12, i32* %fd.addr, align 4
  %13 = load i32, i32* %fd.addr, align 4
  %14 = icmp slt i32 %13, 0
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %fd.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %16)
  call void @nish_print(i8* %17)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast [4 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %buf.addr, align 8
  store i64 -1, i64* %negative.addr, align 8
  %22 = load i32, i32* %fd.addr, align 4
  %23 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %24 = load i64, i64* %negative.addr, align 8
  %25 = add i64 0, 4
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %27 = load i64, i64* %26, align 8
  %28 = icmp ule i64 0, %25
  %29 = icmp ule i64 %25, %27
  %30 = and i1 %28, %29
  br i1 %30, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %25, i64 %27)
  unreachable

net.ok:
  %31 = call i32 @nish_file_read_at(i32 %22, %struct.nish_array* %23, i64 0, i64 4, i64 %24)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.2 to i8*), i8* %32)
  call void @nish_print(i8* %33)
  %34 = sext i32 1 to i64
  %35 = shl i64 %34, 63
  %36 = xor i64 %35, -1
  %37 = sext i32 2 to i64
  %38 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %36, i64 %37)
  %39 = extractvalue { i64, i1 } %38, 0
  %40 = extractvalue { i64, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %39, i64* %top.addr, align 8
  %41 = load i32, i32* %fd.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %43 = load i64, i64* %top.addr, align 8
  %44 = add i64 0, 4
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = icmp ule i64 0, %44
  %48 = icmp ule i64 %44, %46
  %49 = and i1 %47, %48
  br i1 %49, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %44, i64 %46)
  unreachable

net.ok.1:
  %50 = call i32 @nish_file_read_at(i32 %41, %struct.nish_array* %42, i64 0, i64 4, i64 %43)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i8* %51)
  call void @nish_print(i8* %52)
  store i64 0, i64* %start.addr, align 8
  %53 = load i32, i32* %fd.addr, align 4
  %54 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %55 = load i64, i64* %start.addr, align 8
  %56 = add i64 0, 4
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %58 = load i64, i64* %57, align 8
  %59 = icmp ule i64 0, %56
  %60 = icmp ule i64 %56, %58
  %61 = and i1 %59, %60
  br i1 %61, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %56, i64 %58)
  unreachable

net.ok.2:
  %62 = call i32 @nish_file_read_at(i32 %53, %struct.nish_array* %54, i64 0, i64 4, i64 %55)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i8* %63)
  call void @nish_print(i8* %64)
  %65 = load i32, i32* %fd.addr, align 4
  %66 = call i32 @nish_file_close(i32 %65)
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %67)
  call void @nish_print(i8* %68)
  %69 = load i32, i32* %fd.addr, align 4
  %70 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %71 = load i64, i64* %start.addr, align 8
  %72 = add i64 0, 4
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %74 = load i64, i64* %73, align 8
  %75 = icmp ule i64 0, %72
  %76 = icmp ule i64 %72, %74
  %77 = and i1 %75, %76
  br i1 %77, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %72, i64 %74)
  unreachable

net.ok.3:
  %78 = call i32 @nish_file_read_at(i32 %69, %struct.nish_array* %70, i64 0, i64 4, i64 %71)
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.6 to i8*), i8* %79)
  call void @nish_print(i8* %80)
  %81 = load i32, i32* %fd.addr, align 4
  %82 = call i64 @nish_file_size(i32 %81)
  %83 = call i8* @nish_str_from_i64(i64 %82)
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.7 to i8*), i8* %83)
  call void @nish_print(i8* %84)
  %85 = load i32, i32* %fd.addr, align 4
  %86 = call i32 @nish_file_close(i32 %85)
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.8 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  store i32 -1, i32* %bad.addr, align 4
  %89 = load i32, i32* %bad.addr, align 4
  %90 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %91 = load i64, i64* %start.addr, align 8
  %92 = add i64 0, 4
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %94 = load i64, i64* %93, align 8
  %95 = icmp ule i64 0, %92
  %96 = icmp ule i64 %92, %94
  %97 = and i1 %95, %96
  br i1 %97, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %92, i64 %94)
  unreachable

net.ok.4:
  %98 = call i32 @nish_file_read_at(i32 %89, %struct.nish_array* %90, i64 0, i64 4, i64 %91)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.9 to i8*), i8* %99)
  call void @nish_print(i8* %100)
  %101 = load i32, i32* %bad.addr, align 4
  %102 = call i64 @nish_file_size(i32 %101)
  %103 = call i8* @nish_str_from_i64(i64 %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %103)
  call void @nish_print(i8* %104)
  %105 = load i32, i32* %bad.addr, align 4
  %106 = call i32 @nish_file_close(i32 %105)
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.11 to i8*), i8* %107)
  call void @nish_print(i8* %108)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
