%struct.Ledger = type { double }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

define internal void @Ledger.constructor(%struct.Ledger* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !4
  ret void
}

define internal noundef double @scale(i32 noundef %n) #1 {
entry:
  %0 = sitofp i32 %n to double
  %1 = fmul double %0, 0x3FF8000000000000
  ret double %1
}

define noundef i32 @nish_main() #0 {
entry:
  %ledger.addr = alloca %struct.Ledger*, align 8
  %Ledger.obj = alloca %struct.Ledger, align 8
  %step.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Ledger.constructor(%struct.Ledger* %Ledger.obj)
  store %struct.Ledger* %Ledger.obj, %struct.Ledger** %ledger.addr, align 8
  store i32 2, i32* %step.addr, align 4
  %0 = load i32, i32* %step.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %3 = bitcast [2 x i32]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %3 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  store i32 %0, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %7 = getelementptr inbounds i32, i32* %5, i64 1
  store i32 1000, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %16, i32* %s.addr, align 4
  %17 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %18 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %19 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %18, i32 0, i32 0
  %20 = load double, double* %19, align 8, !tbaa !4
  %21 = load i32, i32* %s.addr, align 4
  %22 = call double @scale(i32 %21)
  %23 = fadd double %20, %22
  %24 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %17, i32 0, i32 0
  store double %23, double* %24, align 8, !tbaa !4
  br label %forof.inc

forof.inc:
  %25 = load i64, i64* %forof.idx, align 8
  %26 = add i64 %25, 1
  store i64 %26, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %27 = load %struct.Ledger*, %struct.Ledger** %ledger.addr, align 8
  %28 = getelementptr inbounds %struct.Ledger, %struct.Ledger* %27, i32 0, i32 0
  %29 = load double, double* %28, align 8, !tbaa !4
  %30 = call i8* @nish_str_from_f64(double %29)
  call void @nish_print(i8* %30)
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
!2 = !{!"double", !1, i64 0}
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
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
