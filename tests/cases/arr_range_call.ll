%struct.Permute = type { i32, { %struct.nish_array, [6 x i32] } }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Permute.constructor(%struct.Permute* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  ret void
}

define internal noundef i32 @Permute.benchmark(%struct.Permute* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 1, i64 0
  %3 = bitcast i32* %2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 24, i1 false), !alias.scope !9, !noalias !8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 6, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  call void @Permute.permute(%struct.Permute* %this, i32 6)
  %5 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  ret i32 %6
}

define internal void @Permute.permute(%struct.Permute* noundef nonnull align 8 dereferenceable(56) nocapture %this, i32 noundef %n) #0 {
entry:
  %n1.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = icmp ne i32 %n, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = sub nsw i32 %n, 1
  store i32 %4, i32* %n1.addr, align 4
  %5 = load i32, i32* %n1.addr, align 4
  call void @Permute.permute(%struct.Permute* %this, i32 %5)
  %6 = load i32, i32* %n1.addr, align 4
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %n1.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  call void @Permute.swap(%struct.Permute* %this, i32 %9, i32 %10)
  %11 = load i32, i32* %n1.addr, align 4
  call void @Permute.permute(%struct.Permute* %this, i32 %11)
  %12 = load i32, i32* %n1.addr, align 4
  %13 = load i32, i32* %i.addr, align 4
  call void @Permute.swap(%struct.Permute* %this, i32 %12, i32 %13)
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sub nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  br label %if.end

if.end:
  ret void
}

define internal void @Permute.swap(%struct.Permute* noundef nonnull align 8 dereferenceable(56) nocapture %this, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 1, i64 0
  %3 = bitcast i32* %2 to i8*
  %4 = bitcast i8* %3 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 %1
  %6 = load i32, i32* %5, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  store i32 %6, i32* %tmp.addr, align 4
  %7 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %8 = sext i32 %i to i64
  %9 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %10 = sext i32 %j to i64
  %11 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 1, i64 0
  %12 = bitcast i32* %11 to i8*
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  %16 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 1, i64 0
  %17 = bitcast i32* %16 to i8*
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %8
  store i32 %15, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  %20 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 0
  %21 = sext i32 %j to i64
  %22 = load i32, i32* %tmp.addr, align 4
  %23 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1, i32 1, i64 0
  %24 = bitcast i32* %23 to i8*
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %21
  store i32 %22, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %p.addr = alloca %struct.Permute*, align 8
  %Permute.obj = alloca %struct.Permute, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %Permute.obj, i32 0, i32 1, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 6, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %3 = getelementptr inbounds %struct.Permute, %struct.Permute* %Permute.obj, i32 0, i32 1, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  call void @Permute.constructor(%struct.Permute* %Permute.obj)
  store %struct.Permute* %Permute.obj, %struct.Permute** %p.addr, align 8
  %6 = load %struct.Permute*, %struct.Permute** %p.addr, align 8
  %7 = call i32 @Permute.benchmark(%struct.Permute* %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Permute", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!"element i32", !1, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!12, !10, i64 8}
!17 = !{!12, !11, i64 16}
