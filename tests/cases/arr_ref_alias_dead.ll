%struct.P = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @readX(%struct.P* noundef nonnull readonly align 4 dereferenceable(4) nocapture %p) #0 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %P.obj = alloca %struct.P, align 8
  %p.addr = alloca %struct.P*, align 8
  %q.addr = alloca %struct.P*, align 8
  %i.addr.1 = alloca i32, align 4
  %P.obj.1 = alloca %struct.P, align 8
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
  store %struct.P* %29, %struct.P** %p.addr, align 8
  %30 = load %struct.P*, %struct.P** %p.addr, align 8
  store %struct.P* %30, %struct.P** %q.addr, align 8
  %31 = load %struct.P*, %struct.P** %q.addr, align 8
  %32 = call i32 @readX(%struct.P* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %34 = load i32, i32* %i.addr.1, align 4
  %35 = icmp slt i32 %34, 1000
  br i1 %35, label %for.body.1, label %for.end.1

for.body.1:
  %36 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %37 = getelementptr inbounds %struct.P, %struct.P* %P.obj.1, i32 0, i32 0
  store i32 5, i32* %37, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = icmp eq i64 %39, %41
  br i1 %42, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store.1

push.store.1:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to %struct.P*
  %46 = getelementptr inbounds %struct.P, %struct.P* %45, i64 %39
  %47 = bitcast %struct.P* %46 to i8*
  %48 = bitcast %struct.P* %P.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %47, i8* align 4 %48, i64 4, i1 false), !alias.scope !4, !noalias !3
  %49 = add i64 %39, 1
  store i64 %49, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  br label %for.inc.1

for.inc.1:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = icmp ult i64 0, %55
  br i1 %56, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %55)
  unreachable

bounds.ok.1:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to %struct.P*
  %60 = getelementptr inbounds %struct.P, %struct.P* %59, i64 0
  %61 = getelementptr inbounds %struct.P, %struct.P* %60, i32 0, i32 0
  store i32 42, i32* %61, align 4
  %62 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to %struct.P*
  %66 = getelementptr inbounds %struct.P, %struct.P* %65, i64 0
  %67 = call i32 @readX(%struct.P* %66)
  %68 = call i8* @nish_str_from_i32(i32 %67)
  call void @nish_print(i8* %68)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{i32 8, !"cf-protection-branch", i32 1}
!14 = !{i32 8, !"cf-protection-return", i32 1}
!15 = !{i32 8, !"branch-target-enforcement", i32 1}
!16 = !{i32 8, !"sign-return-address", i32 1}
!17 = !{i32 4, !"probe-stack", !"inline-asm"}
