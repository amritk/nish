%struct.Counter = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %start, i32 noundef %step) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %start, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i32 %step, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Counter.bump(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %times) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %3, i32 %times)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %5)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %10 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %8, i32* %10, align 4, !tbaa !4
  %11 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  ret i32 %12

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @Counter.addAll(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %8, i32* %x.addr, align 4
  %9 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !4
  %11 = load i32, i32* %x.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %13, i32* %15, align 4, !tbaa !4
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %d.addr = alloca %struct.Counter*, align 8
  %Counter.obj.1 = alloca %struct.Counter, align 8
  %e.addr = alloca %struct.Counter*, align 8
  %Counter.obj.2 = alloca %struct.Counter, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 0, i32 1)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %0 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %1 = call i32 @Counter.bump(%struct.Counter* %0, i32 1)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %4 = call i32 @Counter.bump(%struct.Counter* %3, i32 3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %10 = call i32 @Counter.addAll(%struct.Counter* %6, %struct.nish_array* %arr.hdr)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %15 = bitcast [2 x i32]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 1, i32* %18, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 2, i32* %19, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %20 = call i32 @Counter.addAll(%struct.Counter* %12, %struct.nish_array* %arr.hdr.1)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  call void @Counter.constructor(%struct.Counter* %Counter.obj.1, i32 5, i32 2)
  store %struct.Counter* %Counter.obj.1, %struct.Counter** %d.addr, align 8
  %22 = load %struct.Counter*, %struct.Counter** %d.addr, align 8
  %23 = call i32 @Counter.bump(%struct.Counter* %22, i32 1)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  call void @Counter.constructor(%struct.Counter* %Counter.obj.2, i32 10, i32 1)
  store %struct.Counter* %Counter.obj.2, %struct.Counter** %e.addr, align 8
  %25 = load %struct.Counter*, %struct.Counter** %e.addr, align 8
  %26 = call i32 @Counter.bump(%struct.Counter* %25, i32 2)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
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

!llvm.module.flags = !{!19, !20, !21, !22, !23}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
