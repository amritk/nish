%struct.P = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
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

define internal noundef i32 @readX(%struct.P* noundef nonnull readonly align 4 dereferenceable(4) nocapture %p) #0 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define internal noundef nonnull align 4 dereferenceable(4) %struct.P* @clone(%struct.P* noundef nonnull readonly align 4 dereferenceable(4) nocapture %p) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.P*
  %2 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.P, %struct.P* %1, i32 0, i32 0
  store i32 %3, i32* %4, align 4
  ret %struct.P* %1
}

define noundef i32 @nish_main() #2 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %P.obj = alloca %struct.P, align 8
  %c.addr = alloca %struct.P*, align 8
  %P.obj.1 = alloca %struct.P, align 8
  %i.addr.1 = alloca i32, align 4
  %P.obj.2 = alloca %struct.P, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 4
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %6 = getelementptr inbounds %struct.P, %struct.P* %P.obj, i32 0, i32 0
  store i32 1, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 4)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.P*
  %15 = getelementptr inbounds %struct.P, %struct.P* %14, i64 %8
  %16 = bitcast %struct.P* %15 to i8*
  %17 = bitcast %struct.P* %P.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %16, i8* align 4 %17, i64 4, i1 false), !alias.scope !4, !noalias !3
  %18 = add i64 %8, 1
  store i64 %18, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to %struct.P*
  %29 = getelementptr inbounds %struct.P, %struct.P* %28, i64 0
  %30 = call %struct.P* @clone(%struct.P* %29)
  store %struct.P* %30, %struct.P** %c.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %32 = getelementptr inbounds %struct.P, %struct.P* %P.obj.1, i32 0, i32 0
  store i32 9, i32* %32, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to %struct.P*
  %36 = getelementptr inbounds %struct.P, %struct.P* %35, i64 0
  %37 = bitcast %struct.P* %36 to i8*
  %38 = bitcast %struct.P* %P.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %37, i8* align 4 %38, i64 4, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %39 = load i32, i32* %i.addr.1, align 4
  %40 = icmp slt i32 %39, 1000
  br i1 %40, label %for.body.1, label %for.end.1

for.body.1:
  %41 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %42 = getelementptr inbounds %struct.P, %struct.P* %P.obj.2, i32 0, i32 0
  store i32 5, i32* %42, align 4
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 1
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = icmp eq i64 %44, %46
  br i1 %47, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %41, i64 4)
  br label %push.store.1

push.store.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to %struct.P*
  %51 = getelementptr inbounds %struct.P, %struct.P* %50, i64 %44
  %52 = bitcast %struct.P* %51 to i8*
  %53 = bitcast %struct.P* %P.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %52, i8* align 4 %53, i64 4, i1 false), !alias.scope !4, !noalias !3
  %54 = add i64 %44, 1
  store i64 %54, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  br label %for.inc.1

for.inc.1:
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %58 = load %struct.P*, %struct.P** %c.addr, align 8
  %59 = call i32 @readX(%struct.P* %58)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
