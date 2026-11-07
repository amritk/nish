%struct.Box = type { i32 }
%struct.Sum = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Sum.constructor(%struct.Sum* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Sum, %struct.Sum* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #1 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %s.addr = alloca %struct.Sum*, align 8
  %Sum.obj = alloca %struct.Sum, align 8
  call void @Box.constructor(%struct.Box* %Box.obj, i32 %n)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  call void @Sum.constructor(%struct.Sum* %Sum.obj)
  store %struct.Sum* %Sum.obj, %struct.Sum** %s.addr, align 8
  %0 = load %struct.Sum*, %struct.Sum** %s.addr, align 8
  %1 = load %struct.Box*, %struct.Box** %b.addr, align 8
  call void @each$fn.12.total$arrow0(%struct.nish_array* %xs, %struct.Sum* %0, %struct.Box* %1)
  %2 = load %struct.Sum*, %struct.Sum** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Sum, %struct.Sum* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !6
  ret i32 %4
}

define void @nish_main() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %8 = call i32 @total(%struct.nish_array* %arr.hdr, i32 5)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @total$arrow0(i32 noundef %x, %struct.Sum* noundef nonnull align 8 dereferenceable(4) nocapture %s, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Sum, %struct.Sum* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !6
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %3, i32 %x)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %5)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %10 = getelementptr inbounds %struct.Sum, %struct.Sum* %s, i32 0, i32 0
  store i32 %8, i32* %10, align 4, !tbaa !6
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @each$fn.12.total$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.Sum* noundef nonnull align 8 dereferenceable(4) nocapture %cap.0, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %cap.1) #1 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  call void @total$arrow0(i32 %9, %struct.Sum* %cap.0, %struct.Box* %cap.1)
  br label %forof.inc

forof.inc:
  %10 = load i64, i64* %forof.idx, align 8
  %11 = add i64 %10, 1
  store i64 %11, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!20, !21, !22, !23, !24}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Sum", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}
