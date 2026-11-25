%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.parallelMapInto$i32$i32$fn.8.scramble(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
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

define hidden noundef i32 @scramble$(i32 noundef %x) #0 {
entry:
  %h.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 %x, i32* %h.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, 8
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %h.addr, align 4
  %3 = load i32, i32* %h.addr, align 4
  %4 = shl i32 %3, 5
  %5 = xor i32 %2, %4
  store i32 %5, i32* %h.addr, align 4
  %6 = load i32, i32* %h.addr, align 4
  %7 = load i32, i32* %h.addr, align 4
  %8 = ashr i32 %7, 3
  %9 = xor i32 %6, %8
  store i32 %9, i32* %h.addr, align 4
  %10 = load i32, i32* %h.addr, align 4
  %11 = load i32, i32* %k.addr, align 4
  %12 = xor i32 %10, %11
  store i32 %12, i32* %h.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %k.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %h.addr, align 4
  ret i32 %15
}

define noundef i32 @nish_main() #1 {
entry:
  %n.addr = alloca i32, align 4
  %src.addr = alloca %struct.nish_array*, align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 16384, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %1, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %src.addr, align 8
  %9 = load i32, i32* %n.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 %10, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 %10, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = mul i64 %10, 4
  %16 = call i8* @nish_alloc_struct(i64 %15)
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %15, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %12, %struct.nish_array** %dst.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %20 to i32
  %25 = icmp slt i32 %23, %24
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = load i32, i32* %i.addr, align 4
  %29 = bitcast i8* %22 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %27
  store i32 %28, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.8.scramble(%struct.nish_array* %33, %struct.nish_array* %34)
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %40 = load i32, i32* %i.addr.1, align 4
  %41 = trunc i64 %37 to i32
  %42 = icmp slt i32 %40, %41
  br i1 %42, label %for.body.1, label %for.end.1

for.body.1:
  %43 = load i32, i32* %sum.addr, align 4
  %44 = shl i32 %43, 1
  %45 = load i32, i32* %i.addr.1, align 4
  %46 = sext i32 %45 to i64
  %47 = bitcast i8* %39 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %46
  %49 = load i32, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = xor i32 %44, %49
  store i32 %50, i32* %sum.addr, align 4
  br label %for.inc.1

for.inc.1:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %53 = load i32, i32* %sum.addr, align 4
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %56 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp ult i64 0, %58
  br i1 %59, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %58)
  unreachable

bounds.ok:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 0
  %64 = load i32, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %55, i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %68 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %69 = load i32, i32* %n.addr, align 4
  %70 = sub nsw i32 %69, 1
  %71 = sext i32 %70 to i64
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 %71, %73
  br i1 %74, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %71, i64 %73)
  unreachable

bounds.ok.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 %71
  %79 = load i32, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %67, i8* %80)
  call void @nish_print(i8* %81)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
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
