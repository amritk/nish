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
  %25 = call i32 @nish_file_read_at(i32 %22, %struct.nish_array* %23, i64 0, i64 4, i64 %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.2 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  %28 = sext i32 1 to i64
  %29 = shl i64 %28, 63
  %30 = xor i64 %29, -1
  %31 = sext i32 2 to i64
  %32 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %30, i64 %31)
  %33 = extractvalue { i64, i1 } %32, 0
  %34 = extractvalue { i64, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %33, i64* %top.addr, align 8
  %35 = load i32, i32* %fd.addr, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %37 = load i64, i64* %top.addr, align 8
  %38 = add i64 0, 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %40 = load i64, i64* %39, align 8
  %41 = icmp ule i64 0, %38
  %42 = icmp ule i64 %38, %40
  %43 = and i1 %41, %42
  br i1 %43, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %38, i64 %40)
  unreachable

net.ok:
  %44 = call i32 @nish_file_read_at(i32 %35, %struct.nish_array* %36, i64 0, i64 4, i64 %37)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i8* %45)
  call void @nish_print(i8* %46)
  store i64 0, i64* %start.addr, align 8
  %47 = load i32, i32* %fd.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %49 = load i64, i64* %start.addr, align 8
  %50 = add i64 0, 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %52 = load i64, i64* %51, align 8
  %53 = icmp ule i64 0, %50
  %54 = icmp ule i64 %50, %52
  %55 = and i1 %53, %54
  br i1 %55, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %50, i64 %52)
  unreachable

net.ok.1:
  %56 = call i32 @nish_file_read_at(i32 %47, %struct.nish_array* %48, i64 0, i64 4, i64 %49)
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i8* %57)
  call void @nish_print(i8* %58)
  %59 = load i32, i32* %fd.addr, align 4
  %60 = call i32 @nish_file_close(i32 %59)
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %61)
  call void @nish_print(i8* %62)
  %63 = load i32, i32* %fd.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %65 = load i64, i64* %start.addr, align 8
  %66 = add i64 0, 4
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %68 = load i64, i64* %67, align 8
  %69 = icmp ule i64 0, %66
  %70 = icmp ule i64 %66, %68
  %71 = and i1 %69, %70
  br i1 %71, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %66, i64 %68)
  unreachable

net.ok.2:
  %72 = call i32 @nish_file_read_at(i32 %63, %struct.nish_array* %64, i64 0, i64 4, i64 %65)
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.6 to i8*), i8* %73)
  call void @nish_print(i8* %74)
  %75 = load i32, i32* %fd.addr, align 4
  %76 = call i64 @nish_file_size(i32 %75)
  %77 = call i8* @nish_str_from_i64(i64 %76)
  %78 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.7 to i8*), i8* %77)
  call void @nish_print(i8* %78)
  %79 = load i32, i32* %fd.addr, align 4
  %80 = call i32 @nish_file_close(i32 %79)
  %81 = call i8* @nish_str_from_i32(i32 %80)
  %82 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.8 to i8*), i8* %81)
  call void @nish_print(i8* %82)
  store i32 -1, i32* %bad.addr, align 4
  %83 = load i32, i32* %bad.addr, align 4
  %84 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %85 = load i64, i64* %start.addr, align 8
  %86 = add i64 0, 4
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %88 = load i64, i64* %87, align 8
  %89 = icmp ule i64 0, %86
  %90 = icmp ule i64 %86, %88
  %91 = and i1 %89, %90
  br i1 %91, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %86, i64 %88)
  unreachable

net.ok.3:
  %92 = call i32 @nish_file_read_at(i32 %83, %struct.nish_array* %84, i64 0, i64 4, i64 %85)
  %93 = call i8* @nish_str_from_i32(i32 %92)
  %94 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.9 to i8*), i8* %93)
  call void @nish_print(i8* %94)
  %95 = load i32, i32* %bad.addr, align 4
  %96 = call i64 @nish_file_size(i32 %95)
  %97 = call i8* @nish_str_from_i64(i64 %96)
  %98 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %97)
  call void @nish_print(i8* %98)
  %99 = load i32, i32* %bad.addr, align 4
  %100 = call i32 @nish_file_close(i32 %99)
  %101 = call i8* @nish_str_from_i32(i32 %100)
  %102 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.11 to i8*), i8* %101)
  call void @nish_print(i8* %102)
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
