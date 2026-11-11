%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noundef i32 @inc(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @half(i32 noundef %x) #1 {
entry:
  %0 = sdiv i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @at(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #2 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %5
}

define internal noundef i32 @first(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %i)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %steps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %v.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %gets.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %g.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %steps.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 3, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %18 = trunc i64 %17 to i32
  store i32 3, i32* %v.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %forof.body, label %forof.end

forof.body:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %28, i32* %step.addr, align 4
  %29 = load i32, i32* %step.addr, align 4
  %30 = load i32, i32* %v.addr, align 4
  %31 = call i32 @$ref.0.fr1.i32.i32.0(i32 %29, i32 %30)
  store i32 %31, i32* %v.addr, align 4
  br label %forof.inc

forof.inc:
  %32 = load i64, i64* %forof.idx, align 8
  %33 = add i64 %32, 1
  store i64 %33, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %36 = bitcast [2 x i32]* %arr.data.1 to i8*
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %36, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = bitcast i8* %36 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 0
  store i32 1, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %40 = getelementptr inbounds i32, i32* %38, i64 1
  store i32 2, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %gets.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %43 = bitcast [3 x i32]* %arr.data.2 to i8*
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = bitcast i8* %43 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  store i32 5, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %47 = getelementptr inbounds i32, i32* %45, i64 1
  store i32 6, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %48 = getelementptr inbounds i32, i32* %45, i64 2
  store i32 7, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %g.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %gets.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %52 = load i32, i32* %k.addr, align 4
  %53 = icmp slt i32 %52, 2
  br i1 %53, label %for.body, label %for.end

for.body:
  %54 = load i32, i32* %g.addr, align 4
  %55 = load i32, i32* %k.addr, align 4
  %56 = sext i32 %55 to i64
  %57 = bitcast i8* %51 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %56
  %59 = load i32, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %60 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %61 = call i32 @$ref.0.fr2.arr.i32.i32.i32.1(i32 %59, %struct.nish_array* %60, i32 1)
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %54, i32 %61)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %63, i32* %g.addr, align 4
  br label %for.inc

for.inc:
  %65 = load i32, i32* %k.addr, align 4
  %66 = add nsw i32 %65, 1
  store i32 %66, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %67 = load i32, i32* %v.addr, align 4
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %73 = trunc i64 %72 to i32
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %69, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %80 = icmp ult i64 1, %79
  br i1 %80, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %79)
  unreachable

bounds.ok:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = bitcast i8* %82 to i32*
  %84 = getelementptr inbounds i32, i32* %83, i64 1
  %85 = load i32, i32* %84, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %86 = call i32 @$ref.0.fr1.i32.i32.0(i32 %85, i32 7)
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %76, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %90 = load i32, i32* %g.addr, align 4
  %91 = call i8* @nish_str_from_i32(i32 %90)
  %92 = call i8* @nish_str_concat(i8* %89, i8* %91)
  call void @nish_print(i8* %92)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  %0 = tail call i32 @inc(i32 %$a0)
  ret i32 %0

sw.case.1:
  %1 = tail call i32 @square(i32 %$a0)
  ret i32 %1

sw.default:
  %2 = tail call i32 @half(i32 %$a0)
  ret i32 %2
}

define internal noundef i32 @$ref.0.fr2.arr.i32.i32.i32.1(i32 noundef %$t, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %$a0, i32 noundef %$a1) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = call i32 @at(%struct.nish_array* %$a0, i32 %$a1)
  ret i32 %0

sw.default:
  %1 = call i32 @first(%struct.nish_array* %$a0, i32 %$a1)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
