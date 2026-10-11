%struct.Shrinker = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Shrinker.constructor(%struct.Shrinker* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %3
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds %struct.Shrinker, %struct.Shrinker* %this, i32 0, i32 0
  store i32 0, i32* %9, align 4, !tbaa !16
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %Shrinker.obj = alloca %struct.Shrinker, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %r.addr, align 4
  %6 = icmp slt i32 %5, 16
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = load i32, i32* %r.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @Shrinker.constructor(%struct.Shrinker* %Shrinker.obj, %struct.nish_array* %10)
  %11 = getelementptr inbounds %struct.Shrinker, %struct.Shrinker* %Shrinker.obj, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !16
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = sext i32 %14 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %26, i32* %total.addr, align 4
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %30
  store i32 0, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  br label %for.inc

for.inc:
  %40 = load i32, i32* %r.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %42 = load i32, i32* %total.addr, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"i32", !6, i64 0}
!15 = !{!"Shrinker", !14, i64 0}
!16 = !{!15, !14, i64 0}
!17 = !{!9, !7, i64 8}
