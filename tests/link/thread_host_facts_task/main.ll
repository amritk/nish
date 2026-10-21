%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.5.cores(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.memory(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.parallelMapInto$i32$i32$fn.5.cores(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
declare noundef i64 @nish_cpu_online() #0
declare noundef i64 @nish_total_memory() #0

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

define hidden noundef i32 @cores$(i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_cpu_online()
  %1 = trunc i64 %0 to i32
  %2 = icmp sge i32 %1, 1
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %n, %cond.true ], [ -1, %cond.false ]
  ret i32 %3
}

define hidden noundef i32 @memory$(i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_total_memory()
  %1 = sext i32 0 to i64
  %2 = icmp sgt i64 %0, %1
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %n, %cond.true ], [ -1, %cond.false ]
  ret i32 %3
}

define noundef i32 @nish_main() #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %par.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.cores(%struct.ThreadScope* %12, i32 1, %struct.nish_array* %13, i32 0)
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.memory(%struct.ThreadScope* %14, i32 2, %struct.nish_array* %15, i32 1)
  call void @nish_scope_join(i8* %11)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast [2 x i32]* %arr.data to i8*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %18 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  store i32 0, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i32, i32* %20, i64 1
  store i32 0, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %par.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast [2 x i32]* %arr.data.1 to i8*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %25 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 0
  store i32 3, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = getelementptr inbounds i32, i32* %27, i64 1
  store i32 4, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = load %struct.nish_array*, %struct.nish_array** %par.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.5.cores(%struct.nish_array* %arr.hdr.1, %struct.nish_array* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = icmp ult i64 0, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 1, %44
  br i1 %45, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %44)
  unreachable

bounds.ok.1:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 1
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %41, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %54 = load %struct.nish_array*, %struct.nish_array** %par.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 0, %56
  br i1 %57, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %56)
  unreachable

bounds.ok.2:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 0
  %62 = load i32, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %53, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %66 = load %struct.nish_array*, %struct.nish_array** %par.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = icmp ult i64 1, %68
  br i1 %69, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %68)
  unreachable

bounds.ok.3:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 1
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %65, i8* %75)
  call void @nish_print(i8* %76)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
