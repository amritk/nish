%struct.nish_array = type { i64, i64, i8* }

@nish_const_0_CLASS.data = private unnamed_addr constant [256 x i8] c"\00\00\00\00\00\00\00\00\00\03\03\00\00\03\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\03\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\01\00\00\00\00\00\00\00\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\00\00\00\00\00\00\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00", align 16
@nish_const_0_CLASS = internal constant %struct.nish_array { i64 256, i64 256, i8* bitcast ([256 x i8]* @nish_const_0_CLASS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"Nish 0.40, tables!\0A\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noundef i8 @classOf(i8 noundef %c) #0 {
entry:
  %0 = zext i8 %c to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_CLASS, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  ret i8 %5
}

define void @nish_main() #1 {
entry:
  %text.addr = alloca i8*, align 8
  %counts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %i.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %v.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [20 x i8] }* @.str.0 to i8*), i8** %text.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 0, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %counts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = load i8*, i8** %text.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = icmp slt i32 %12, %16
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i8*, i8** %text.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = getelementptr inbounds i8, i8* %18, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 %20
  %23 = load i8, i8* %22, align 1
  %24 = zext i8 %23 to i32
  %25 = trunc i32 %24 to i8
  %26 = call i8 @classOf(i8 %25)
  %27 = zext i8 %26 to i32
  %28 = and i32 %27, 3
  store i32 %28, i32* %k.addr, align 4
  %29 = load i32, i32* %k.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %11 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %30
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 1)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %35, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_CLASS, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %42 = icmp ult i64 %39, %41
  br i1 %42, label %forof.body, label %forof.end

forof.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_CLASS, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = bitcast i8* %44 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 %39
  %47 = load i8, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  store i8 %47, i8* %v.addr, align 1
  %48 = load i32, i32* %sum.addr, align 4
  %49 = load i8, i8* %v.addr, align 1
  %50 = zext i8 %49 to i32
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %52, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %54 = load i64, i64* %forof.idx, align 8
  %55 = add i64 %54, 1
  store i64 %55, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_CLASS, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %58 = trunc i64 %57 to i32
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %61 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = bitcast i8* %63 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 0
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %60, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = bitcast i8* %72 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 1
  %75 = load i32, i32* %74, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %69, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %79 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 2
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %78, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %88 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 3
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %87, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %97 = load i32, i32* %sum.addr, align 4
  %98 = call i8* @nish_str_from_i32(i32 %97)
  %99 = call i8* @nish_str_concat(i8* %96, i8* %98)
  call void @nish_print(i8* %99)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i8", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
