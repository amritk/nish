%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c".tmp\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"build/test/caps_fs_replace.txt\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_rename(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_write_bytes(%struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef i32 @replace(i8* noundef nonnull noalias readonly align 8 nocapture %path, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes) #0 {
entry:
  %temp.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %path, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %temp.addr, align 8
  %1 = load i8*, i8** %temp.addr, align 8
  %2 = call i32 @nish_unlink(i8* %1)
  %3 = load i8*, i8** %temp.addr, align 8
  %4 = call i32 @nish_write_file_bytes(i8* %3, %struct.nish_array* %bytes)
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end:
  %6 = load i8*, i8** %temp.addr, align 8
  %7 = call i32 @nish_rename(i8* %6, i8* %path)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %done.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 111, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 107, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 10, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %9 = call i32 @replace(i8* bitcast ({ i64, [31 x i8] }* @.str.1 to i8*), %struct.nish_array* %8)
  store i32 %9, i32* %done.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %11 = add i64 0, 3
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8
  %14 = icmp ule i64 0, %11
  %15 = icmp ule i64 %11, %13
  %16 = and i1 %14, %15
  br i1 %16, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %11, i64 %13)
  unreachable

net.ok:
  %17 = call i32 @nish_write_bytes(%struct.nish_array* %10, i64 0, i64 3)
  %18 = load i32, i32* %done.addr, align 4
  ret i32 %18
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
