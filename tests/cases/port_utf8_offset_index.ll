%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"l\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %scores.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i32], align 8
  %last.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [7 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 10, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 40, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 50, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 60, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 70, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %scores.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %scores.addr, align 8
  %13 = load i8*, i8** %word.addr, align 8
  %14 = call i64 @nish_str_index_of(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = trunc i64 %14 to i32
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load i8*, i8** %word.addr, align 8
  %27 = call i64 @nish_str_index_of(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %28 = trunc i64 %27 to i32
  store i32 %28, i32* %last.addr, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %scores.addr, align 8
  %30 = load i32, i32* %last.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = icmp ult i64 %31, %33
  br i1 %34, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %31, i64 %33)
  unreachable

bounds.ok.1:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %31
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = call i8* @nish_str_from_i32(i32 %39)
  call void @nish_print(i8* %40)
  %41 = load i8*, i8** %word.addr, align 8
  %42 = load i8*, i8** %word.addr, align 8
  %43 = call i64 @nish_str_index_of(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %44 = trunc i64 %43 to i32
  %45 = sext i32 %44 to i64
  %46 = bitcast i8* %41 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = icmp ult i64 %45, %47
  br i1 %48, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %45, i64 %47)
  unreachable

bounds.ok.2:
  %49 = getelementptr inbounds i8, i8* %41, i64 8
  %50 = getelementptr inbounds i8, i8* %49, i64 %45
  %51 = load i8, i8* %50, align 1
  %52 = zext i8 %51 to i32
  %53 = icmp eq i32 %52, 108
  br i1 %53, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br label %if.end

if.end:
  %54 = load %struct.nish_array*, %struct.nish_array** %scores.addr, align 8
  %55 = load i8*, i8** %word.addr, align 8
  %56 = bitcast i8* %55 to i64*
  %57 = load i64, i64* %56, align 8
  %58 = icmp ult i64 0, %57
  br i1 %58, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %57)
  unreachable

bounds.ok.3:
  %59 = getelementptr inbounds i8, i8* %55, i64 8
  %60 = getelementptr inbounds i8, i8* %59, i64 0
  %61 = load i8, i8* %60, align 1
  %62 = zext i8 %61 to i32
  %63 = load %struct.nish_array*, %struct.nish_array** %scores.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  %67 = icmp eq i32 %66, 0
  %68 = icmp eq i32 %62, -2147483648
  %69 = icmp eq i32 %66, -1
  %70 = and i1 %68, %69
  %71 = or i1 %67, %70
  br i1 %71, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %67)
  unreachable

div.ok:
  %72 = srem i32 %62, %66
  %73 = sext i32 %72 to i64
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = icmp ult i64 %73, %75
  br i1 %76, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %73, i64 %75)
  unreachable

bounds.ok.4:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 %73
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %82 = call i8* @nish_str_from_i32(i32 %81)
  call void @nish_print(i8* %82)
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
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
