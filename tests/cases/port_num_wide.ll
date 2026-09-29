%struct.Ledger = type { i64 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Ledger.constructor(%struct.Ledger* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %this, i32 0, i32 0
  store i64 0, i64* %0, align 8, !tbaa !4
  ret void
}

define internal noundef i64 @scale(i64 noundef %n) #1 {
entry:
  %0 = mul nsw i64 %n, 3
  ret i64 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %ledger.addr = alloca %struct.Ledger*, align 8
  %Ledger.obj = alloca %struct.Ledger, align 8
  %step.addr = alloca i64, align 8
  %counted.addr = alloca i64, align 8
  %steps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i64], align 8
  %s.addr = alloca i64, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Ledger.constructor(%struct.Ledger* %Ledger.obj)
  store %struct.Ledger* %Ledger.obj, %struct.Ledger** %ledger.addr, align 8
  store i64 2, i64* %step.addr, align 8
  %0 = sext i32 5 to i64
  store i64 %0, i64* %counted.addr, align 8
  %1 = load i64, i64* %step.addr, align 8
  %2 = load i64, i64* %counted.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %5 = bitcast [3 x i64]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %7 = bitcast i8* %5 to i64*
  %8 = getelementptr inbounds i64, i64* %7, i64 0
  store i64 %1, i64* %8, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds i64, i64* %7, i64 1
  store i64 %2, i64* %9, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %10 = getelementptr inbounds i64, i64* %7, i64 2
  store i64 1000, i64* %10, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %steps.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = bitcast i8* %17 to i64*
  %19 = getelementptr inbounds i64, i64* %18, i64 %12
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i64 %20, i64* %s.addr, align 8
  %21 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %22 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %23 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %22, i32 0, i32 0
  %24 = load i64, i64* %23, align 8, !tbaa !4
  %25 = load i64, i64* %s.addr, align 8
  %26 = add nsw i64 %24, %25
  %27 = sext i32 1 to i64
  %28 = call i64 @scale(i64 %27)
  %29 = add nsw i64 %26, %28
  %30 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %21, i32 0, i32 0
  store i64 %29, i64* %30, align 8, !tbaa !4
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %33 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %34 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %33, i32 0, i32 0
  %35 = load i64, i64* %34, align 8, !tbaa !4
  %36 = trunc i64 %35 to i32
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = load i64, i64* %step.addr, align 8
  %39 = load i64, i64* %counted.addr, align 8
  %40 = add nsw i64 %38, %39
  %41 = trunc i64 %40 to i32
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i64", !1, i64 0}
!3 = !{!"Ledger", !2, i64 0}
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
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i64", !1, i64 0}
!17 = !{!16, !16, i64 0}
