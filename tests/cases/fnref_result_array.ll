%struct.nish_result.arr.fr1.i32.i32.str = type { i1, %struct.nish_array*, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @plus1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @minus1(i32 noundef %x) #0 {
entry:
  %0 = sub nsw i32 %x, 1
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.arr.fr1.i32.i32.str* @make(i1 noundef zeroext %up) #1 {
entry:
  br i1 %up, label %if.then, label %if.end

if.then:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_result.arr.fr1.i32.i32.str*
  %10 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %9, i32 0, i32 0
  store i1 true, i1* %10, align 1
  %11 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %9, i32 0, i32 1
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8
  ret %struct.nish_result.arr.fr1.i32.i32.str* %9

if.end:
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 1, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = call i8* @nish_alloc_struct(i64 4)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 2, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_result.arr.fr1.i32.i32.str*
  %22 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %21, i32 0, i32 0
  store i1 true, i1* %22, align 1
  %23 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %21, i32 0, i32 1
  store %struct.nish_array* %13, %struct.nish_array** %23, align 8
  ret %struct.nish_result.arr.fr1.i32.i32.str* %21
}

define void @nish_main() #2 {
entry:
  %r.addr = alloca %struct.nish_result.arr.fr1.i32.i32.str*, align 8
  %f.addr = alloca i32, align 4
  %s.addr = alloca %struct.nish_result.arr.fr1.i32.i32.str*, align 8
  %g.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.arr.fr1.i32.i32.str* @make(i1 true)
  store %struct.nish_result.arr.fr1.i32.i32.str* %0, %struct.nish_result.arr.fr1.i32.i32.str** %r.addr, align 8
  %1 = load %struct.nish_result.arr.fr1.i32.i32.str*, %struct.nish_result.arr.fr1.i32.i32.str** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load %struct.nish_result.arr.fr1.i32.i32.str*, %struct.nish_result.arr.fr1.i32.i32.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %4, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 0, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %14, i32* %f.addr, align 4
  %15 = load i32, i32* %f.addr, align 4
  %16 = call i32 @$ref.0.fr1.i32.i32.0(i32 %15, i32 10)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  br label %if.end

if.end:
  %18 = call %struct.nish_result.arr.fr1.i32.i32.str* @make(i1 false)
  store %struct.nish_result.arr.fr1.i32.i32.str* %18, %struct.nish_result.arr.fr1.i32.i32.str** %s.addr, align 8
  %19 = load %struct.nish_result.arr.fr1.i32.i32.str*, %struct.nish_result.arr.fr1.i32.i32.str** %s.addr, align 8
  %20 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %19, i32 0, i32 0
  %21 = load i1, i1* %20, align 1
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = load %struct.nish_result.arr.fr1.i32.i32.str*, %struct.nish_result.arr.fr1.i32.i32.str** %s.addr, align 8
  %23 = getelementptr inbounds %struct.nish_result.arr.fr1.i32.i32.str, %struct.nish_result.arr.fr1.i32.i32.str* %22, i32 0, i32 1
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %32, i32* %g.addr, align 4
  %33 = load i32, i32* %g.addr, align 4
  %34 = call i32 @$ref.0.fr1.i32.i32.0(i32 %33, i32 10)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @plus1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @minus1(i32 %$a0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
