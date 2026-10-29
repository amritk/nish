%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"run \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"printf captured-output; printf oops >&2\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"filled \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" / \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_spawn_piped(%struct.nish_array* noundef nonnull align 8, %struct.nish_array* noundef nonnull align 8 nocapture readonly, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef i32 @capture(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %argv, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %stdin, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %err) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %argv, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %argv, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %7)
  store i8* %8, i8** %label.addr, align 8
  %9 = load i8*, i8** %label.addr, align 8
  call void @nish_print(i8* %9)
  %10 = call i32 @nish_spawn_piped(%struct.nish_array* %argv, %struct.nish_array* %stdin, %struct.nish_array* %out, %struct.nish_array* %err)
  ret i32 %10
}

define noundef i32 @nish_main() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %err.addr = alloca %struct.nish_array*, align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %status.addr = alloca i32, align 4
  %filler.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %6, %struct.nish_array** %err.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %11, %struct.nish_array** %none.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 3, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %19 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = getelementptr inbounds i8*, i8** %21, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = getelementptr inbounds i8*, i8** %21, i64 2
  store i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*), i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %28 = call i32 @capture(%struct.nish_array* %16, %struct.nish_array* %25, %struct.nish_array* %26, %struct.nish_array* %27)
  store i32 %28, i32* %status.addr, align 4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %filler.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %32 = load i32, i32* %i.addr, align 4
  %33 = icmp slt i32 %32, 4096
  br i1 %33, label %for.body, label %for.end

for.body:
  %34 = load %struct.nish_array*, %struct.nish_array** %filler.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %34, i64 1)
  br label %push.store

push.store:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %36
  store i8 90, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  br label %for.inc

for.inc:
  %46 = load i32, i32* %i.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %48 = load %struct.nish_array*, %struct.nish_array** %filler.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %52)
  call void @nish_print(i8* %53)
  %54 = load i32, i32* %status.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = trunc i64 %60 to i32
  %62 = sext i32 %61 to i64
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ule i64 0, %62
  %66 = icmp ule i64 %62, %64
  %67 = and i1 %65, %66
  br i1 %67, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %62, i64 %64)
  unreachable

bytes.ok:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = getelementptr inbounds i8, i8* %69, i64 0
  %71 = sub i64 %62, 0
  %72 = call i8* @nish_str_new(i8* %70, i64 %71)
  %73 = call i8* @nish_str_concat(i8* %56, i8* %72)
  %74 = call i8* @nish_str_concat(i8* %73, i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*))
  %75 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %76 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = trunc i64 %78 to i32
  %80 = sext i32 %79 to i64
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ule i64 0, %80
  %84 = icmp ule i64 %80, %82
  %85 = and i1 %83, %84
  br i1 %85, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 0, i64 %80, i64 %82)
  unreachable

bytes.ok.1:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %88 = getelementptr inbounds i8, i8* %87, i64 0
  %89 = sub i64 %80, 0
  %90 = call i8* @nish_str_new(i8* %88, i64 %89)
  %91 = call i8* @nish_str_concat(i8* %74, i8* %90)
  call void @nish_print(i8* %91)
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
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
