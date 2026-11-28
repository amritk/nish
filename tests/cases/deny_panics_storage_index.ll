%struct.nish_array = type { i64, i64, i8* }

@nish_storage_0_BOX.data = global [4 x i32] zeroinitializer, align 16
@nish_storage_0_BOX = internal global %struct.nish_array { i64 4, i64 4, i8* bitcast ([4 x i32]* @nish_storage_0_BOX.data to i8*) }, align 8
@nish_storage_0_MARKS.data = global [3 x i8] zeroinitializer, align 16
@nish_storage_0_MARKS = internal global %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i8]* @nish_storage_0_MARKS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2

define internal noundef i32 @at(i32 noundef %i) #0 {
entry:
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %i, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = sext i32 %i to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %11

if.end:
  ret i32 -1
}

define void @nish_main() #1 {
entry:
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  store i32 10, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 13, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_MARKS, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 2
  store i8 7, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %12, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %18
  store i32 %19, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %26 = load i32, i32* %i.addr.1, align 4
  %27 = icmp slt i32 %26, 4
  br i1 %27, label %for.body.1, label %for.end.1

for.body.1:
  %28 = load i32, i32* %i.addr.1, align 4
  %29 = sext i32 %28 to i64
  %30 = load i32, i32* %i.addr.1, align 4
  %31 = sub nsw i32 4, %30
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %29
  store i32 %31, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc.1

for.inc.1:
  %36 = load i32, i32* %i.addr.1, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %38 = load i32, i32* %i.addr.2, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_MARKS, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = trunc i64 %40 to i32
  %42 = icmp slt i32 %38, %41
  br i1 %42, label %for.body.2, label %for.end.2

for.body.2:
  %43 = load i32, i32* %i.addr.2, align 4
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_MARKS, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 %44
  store i8 1, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  br label %for.inc.2

for.inc.2:
  %49 = load i32, i32* %i.addr.2, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 0
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 3
  %62 = load i32, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %57, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %66 = call i32 @at(i32 1)
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %65, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %70 = call i32 @at(i32 4)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %69, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_MARKS, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = bitcast i8* %75 to i8*
  %77 = getelementptr inbounds i8, i8* %76, i64 2
  %78 = load i8, i8* %77, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  %79 = zext i8 %78 to i64
  %80 = call i8* @nish_str_from_u64(i64 %79)
  %81 = call i8* @nish_str_concat(i8* %73, i8* %80)
  call void @nish_print(i8* %81)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
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

!llvm.module.flags = !{!16, !17, !18, !19, !20}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i8", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
