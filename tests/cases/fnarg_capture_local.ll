%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @offset(i32 noundef %step, i32 noundef %x) #0 {
entry:
  %0 = call i32 @apply$fn.13.offset$arrow0(i32 %x, i32 %step)
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %step.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %step.addr, align 4
  %0 = load i32, i32* %step.addr, align 4
  %1 = call i32 @apply$fn.16.nish_main$arrow0(i32 2, i32 %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call i32 @offset(i32 10, i32 1)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %6 = call i32 @offset(i32 20, i32 1)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %5, i8* %7)
  call void @nish_print(i8* %8)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [2 x i32]* %arr.data to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 2, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 5, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %forof.body, label %forof.end

forof.body:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %24, i32* %k.addr, align 4
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %26 = load i8*, i8** %25, align 8
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %28 = load i64, i64* %27, align 8
  %29 = load i32, i32* %k.addr, align 4
  %30 = load i32, i32* %step.addr, align 4
  %31 = call i32 @twice$fn.16.nish_main$arrow1(i32 1, i32 %29, i32 %30)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %34 = load i8*, i8** %33, align 8
  %35 = icmp eq i8* %34, %26
  br i1 %35, label %pass.rewind, label %pass.free

pass.rewind:
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %28, i64* %36, align 8
  br label %pass.done

pass.free:
  %37 = ptrtoint i8* %26 to i64
  %38 = add i64 %37, %28
  call void @nish_arena_release(i64 %38)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @offset$arrow0(i32 noundef %v, i32 noundef %step) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %v, i32 %step)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %x, i32 noundef %step) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %step)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish_main$arrow1(i32 noundef %x, i32 noundef %k, i32 noundef %step) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %step)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @apply$fn.13.offset$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @offset$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @twice$fn.16.nish_main$arrow1(i32 noundef %x, i32 noundef %cap.0, i32 noundef %cap.1) #0 {
entry:
  %0 = call i32 @apply$fn.16.nish_main$arrow1(i32 %x, i32 %cap.0, i32 %cap.1)
  %1 = call i32 @apply$fn.16.nish_main$arrow1(i32 %0, i32 %cap.0, i32 %cap.1)
  ret i32 %1
}

define internal noundef i32 @apply$fn.16.nish_main$arrow1(i32 noundef %x, i32 noundef %cap.0, i32 noundef %cap.1) #0 {
entry:
  %0 = call i32 @nish_main$arrow1(i32 %x, i32 %cap.0, i32 %cap.1)
  ret i32 %0
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
