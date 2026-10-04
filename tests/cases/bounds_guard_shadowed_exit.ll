%struct.Proc = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal void @Proc.exit(%struct.Proc* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %code) #0 {
entry:
  %0 = getelementptr inbounds %struct.Proc, %struct.Proc* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %code)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Proc, %struct.Proc* %this, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @pick(%struct.Proc* noundef nonnull align 8 dereferenceable(4) nocapture %process, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = icmp slt i32 %i, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %i, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @Proc.exit(%struct.Proc* %process, i32 3)
  br label %if.end

if.end:
  %6 = sext i32 %i to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  ret i32 %14
}

define noundef i32 @test() #0 {
entry:
  %Proc.obj = alloca %struct.Proc, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %0 = getelementptr inbounds %struct.Proc, %struct.Proc* %Proc.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %3 = bitcast [3 x i32]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %5 = bitcast i8* %3 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  store i32 10, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %5, i64 1
  store i32 20, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %5, i64 2
  store i32 30, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %9 = call i32 @pick(%struct.Proc* %Proc.obj, %struct.nish_array* %arr.hdr, i32 2)
  ret i32 %9
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Proc", !2, i64 0}
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
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
