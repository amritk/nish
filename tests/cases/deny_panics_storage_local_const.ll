%struct.nish_array = type { i64, i64, i8* }

@nish_storage_0_BOX.data = global [4 x i32] zeroinitializer, align 16
@nish_storage_0_BOX = internal global %struct.nish_array { i64 4, i64 4, i8* bitcast ([4 x i32]* @nish_storage_0_BOX.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"2\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"3\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3

define internal noundef i32 @next(i32 noundef %i) #0 {
entry:
  %top.addr = alloca i32, align 4
  store i32 4, i32* %top.addr, align 4
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %i, 100
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = add nsw i32 %i, 1
  %4 = load i32, i32* %top.addr, align 4
  %5 = icmp slt i32 %3, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %land.end.1 ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = add nsw i32 %i, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %8
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %13

if.end:
  ret i32 -1
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BOX, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 3
  store i32 7, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %4 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  %6 = call i32 @next(i32 %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i32 2)
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  %11 = call i32 @next(i32 %10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %8, i8* %12)
  call void @nish_print(i8* %13)
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
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{i32 8, !"cf-protection-branch", i32 1}
!14 = !{i32 8, !"cf-protection-return", i32 1}
!15 = !{i32 8, !"branch-target-enforcement", i32 1}
!16 = !{i32 8, !"sign-return-address", i32 1}
!17 = !{i32 4, !"probe-stack", !"inline-asm"}
