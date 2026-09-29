%struct.Rec = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %q.addr = alloca %struct.Rec*, align 8
  %Rec.obj.2 = alloca %struct.Rec, align 8
  %r.addr = alloca %struct.Rec*, align 8
  %Rec.obj.3 = alloca %struct.Rec, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %4 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store i32 1, i32* %4, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to %struct.Rec*
  %13 = getelementptr inbounds %struct.Rec, %struct.Rec* %12, i64 %6
  %14 = bitcast %struct.Rec* %13 to i8*
  %15 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %14, i8* align 4 %15, i64 4, i1 false), !alias.scope !4, !noalias !3
  %16 = add i64 %6, 1
  store i64 %16, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %19 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store i32 2, i32* %19, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to %struct.Rec*
  %28 = getelementptr inbounds %struct.Rec, %struct.Rec* %27, i64 %21
  %29 = bitcast %struct.Rec* %28 to i8*
  %30 = bitcast %struct.Rec* %Rec.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %29, i8* align 4 %30, i64 4, i1 false), !alias.scope !4, !noalias !3
  %31 = add i64 %21, 1
  store i64 %31, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.2, i32 0, i32 0
  store i32 2, i32* %33, align 4
  store %struct.Rec* %Rec.obj.2, %struct.Rec** %q.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp eq i64 %36, 0
  br i1 %37, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %38 = sub i64 %36, 1
  store i64 %38, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to %struct.Rec*
  %42 = getelementptr inbounds %struct.Rec, %struct.Rec* %41, i64 %38
  store %struct.Rec* %42, %struct.Rec** %r.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %44 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.3, i32 0, i32 0
  store i32 7, i32* %44, align 4
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to %struct.Rec*
  %51 = getelementptr inbounds %struct.Rec, %struct.Rec* %50, i64 0
  %52 = bitcast %struct.Rec* %51 to i8*
  %53 = bitcast %struct.Rec* %Rec.obj.3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %52, i8* align 4 %53, i64 4, i1 false), !alias.scope !4, !noalias !3
  %54 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %55 = load %struct.Rec*, %struct.Rec** %q.addr, align 8
  %56 = icmp eq %struct.Rec* %54, %55
  br i1 %56, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %57 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to %struct.Rec*
  %63 = getelementptr inbounds %struct.Rec, %struct.Rec* %62, i64 0
  %64 = getelementptr inbounds %struct.Rec, %struct.Rec* %63, i32 0, i32 0
  %65 = load i32, i32* %64, align 4
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
