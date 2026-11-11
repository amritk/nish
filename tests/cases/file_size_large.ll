%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"build/test/file_size_large.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"fileOpen \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"size: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"last window: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c", first byte \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c", untouched \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"at the end: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"closed: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare noundef i64 @nish_file_size(i32 noundef) #0
declare noundef i32 @nish_file_close(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3

define noundef i32 @nish_main() #0 {
entry:
  %fd.addr = alloca i32, align 4
  %size.addr = alloca i64, align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_file_open(i8* bitcast ({ i64, [31 x i8] }* @.str.0 to i8*))
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %6 = load i32, i32* %fd.addr, align 4
  %7 = call i64 @nish_file_size(i32 %6)
  store i64 %7, i64* %size.addr, align 8
  %8 = load i64, i64* %size.addr, align 8
  %9 = call i8* @nish_str_from_i64(i64 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8* %9)
  call void @nish_print(i8* %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast [8 x i8]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  store i8 7, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i8, i8* %15, i64 1
  store i8 7, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i8, i8* %15, i64 2
  store i8 7, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i8, i8* %15, i64 3
  store i8 7, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i8, i8* %15, i64 4
  store i8 7, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i8, i8* %15, i64 5
  store i8 7, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i8, i8* %15, i64 6
  store i8 7, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = getelementptr inbounds i8, i8* %15, i64 7
  store i8 7, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %24 = load i32, i32* %fd.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %26 = load i64, i64* %size.addr, align 8
  %27 = sext i32 4 to i64
  %28 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %26, i64 %27)
  %29 = extractvalue { i64, i1 } %28, 0
  %30 = extractvalue { i64, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  %31 = add i64 0, 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %33 = load i64, i64* %32, align 8
  %34 = icmp ule i64 0, %31
  %35 = icmp ule i64 %31, %33
  %36 = and i1 %34, %35
  br i1 %36, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %31, i64 %33)
  unreachable

net.ok:
  %37 = call i32 @nish_file_read_at(i32 %24, %struct.nish_array* %25, i64 0, i64 8, i64 %29)
  store i32 %37, i32* %n.addr, align 4
  %38 = load i32, i32* %n.addr, align 4
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*), i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [14 x i8] }* @.str.4 to i8*))
  %42 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 0, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 0
  %50 = load i8, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = zext i8 %50 to i64
  %52 = call i8* @nish_str_from_u64(i64 %51)
  %53 = call i8* @nish_str_concat(i8* %41, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [13 x i8] }* @.str.5 to i8*))
  %55 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = icmp ult i64 4, %57
  br i1 %58, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 4, i64 %57)
  unreachable

bounds.ok.1:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to i8*
  %62 = getelementptr inbounds i8, i8* %61, i64 4
  %63 = load i8, i8* %62, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = zext i8 %63 to i64
  %65 = call i8* @nish_str_from_u64(i64 %64)
  %66 = call i8* @nish_str_concat(i8* %54, i8* %65)
  call void @nish_print(i8* %66)
  %67 = load i32, i32* %fd.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %69 = load i64, i64* %size.addr, align 8
  %70 = add i64 0, 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %72 = load i64, i64* %71, align 8
  %73 = icmp ule i64 0, %70
  %74 = icmp ule i64 %70, %72
  %75 = and i1 %73, %74
  br i1 %75, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %70, i64 %72)
  unreachable

net.ok.1:
  %76 = call i32 @nish_file_read_at(i32 %67, %struct.nish_array* %68, i64 0, i64 8, i64 %69)
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.6 to i8*), i8* %77)
  call void @nish_print(i8* %78)
  %79 = load i32, i32* %fd.addr, align 4
  %80 = call i32 @nish_file_close(i32 %79)
  %81 = call i8* @nish_str_from_i32(i32 %80)
  %82 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*), i8* %81)
  call void @nish_print(i8* %82)
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
