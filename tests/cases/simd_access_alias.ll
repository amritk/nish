%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [32 x i8], align 8
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %v.addr = alloca <16 x i8>, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %seen.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 32, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 32, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [32 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %9 = load i32, i32* %k.addr, align 4
  %10 = icmp slt i32 %9, 16
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %k.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = load i32, i32* %k.addr, align 4
  %14 = add nsw i32 %13, 1
  %15 = trunc i32 %14 to i8
  %16 = bitcast i8* %8 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %12
  store i8 %15, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = bitcast i8* %8 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  %20 = bitcast i8* %19 to <16 x i8>*
  %21 = load <16 x i8>, <16 x i8>* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store <16 x i8> %21, <16 x i8>* %v.addr, align 8
  %22 = load i32, i32* %total.addr, align 4
  %23 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %24 = extractelement <16 x i8> %23, i32 0
  %25 = zext i8 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %30 = extractelement <16 x i8> %29, i32 7
  %31 = zext i8 %30 to i32
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %36 = extractelement <16 x i8> %35, i32 15
  %37 = zext i8 %36 to i32
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %39, i32* %total.addr, align 4
  %41 = load i32, i32* %k.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %43 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  store %struct.nish_array* %43, %struct.nish_array** %a.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  store %struct.nish_array* %44, %struct.nish_array** %b.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  store i32 0, i32* %j.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %55 = load i32, i32* %j.addr, align 4
  %56 = icmp slt i32 %55, 16
  br i1 %56, label %land.rhs, label %land.end

land.rhs:
  %57 = load i32, i32* %j.addr, align 4
  %58 = trunc i64 %47 to i32
  %59 = icmp slt i32 %57, %58
  br label %land.end

land.end:
  %60 = phi i1 [ false, %while.cond.1 ], [ %59, %land.rhs ]
  br i1 %60, label %while.body.1, label %while.end.1

while.body.1:
  %61 = load i32, i32* %seen.addr, align 4
  %62 = load i32, i32* %j.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %49 to i8*
  %65 = getelementptr inbounds i8, i8* %64, i64 %63
  %66 = load i8, i8* %65, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = zext i8 %66 to i32
  %68 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %67)
  %69 = extractvalue { i32, i1 } %68, 0
  %70 = extractvalue { i32, i1 } %68, 1
  br i1 %70, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %69, i32* %seen.addr, align 4
  %71 = load i32, i32* %j.addr, align 4
  %72 = trunc i32 %71 to i8
  %73 = insertelement <16 x i8> undef, i8 %72, i32 0
  %74 = shufflevector <16 x i8> %73, <16 x i8> undef, <16 x i32> zeroinitializer
  %75 = add i64 0, 16
  %76 = icmp ult i64 0, %52
  %77 = icmp ule i64 %75, %52
  %78 = and i1 %76, %77
  br i1 %78, label %bounds.ok, label %bounds.fail

bounds.fail:
  %79 = add i64 0, 15
  %80 = select i1 %76, i64 %79, i64 0
  call void @nish_panic_index(i64 %80, i64 %52)
  unreachable

bounds.ok:
  %81 = bitcast i8* %54 to i8*
  %82 = getelementptr inbounds i8, i8* %81, i64 0
  %83 = bitcast i8* %82 to <16 x i8>*
  store <16 x i8> %74, <16 x i8>* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %84 = load i32, i32* %seen.addr, align 4
  %85 = load i32, i32* %j.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = bitcast i8* %49 to i8*
  %88 = getelementptr inbounds i8, i8* %87, i64 %86
  %89 = load i8, i8* %88, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = zext i8 %89 to i32
  %91 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %84, i32 %90)
  %92 = extractvalue { i32, i1 } %91, 0
  %93 = extractvalue { i32, i1 } %91, 1
  br i1 %93, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %92, i32* %seen.addr, align 4
  %94 = load i32, i32* %j.addr, align 4
  %95 = add nsw i32 %94, 1
  store i32 %95, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %96 = load i32, i32* %total.addr, align 4
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %99 = load i32, i32* %seen.addr, align 4
  %100 = call i8* @nish_str_from_i32(i32 %99)
  %101 = call i8* @nish_str_concat(i8* %98, i8* %100)
  call void @nish_print(i8* %101)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
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
