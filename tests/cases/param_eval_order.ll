%struct.Clock = type { i32 }
%struct.Cell = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal void @Clock.constructor(%struct.Clock* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Clock.next(%struct.Clock* noundef nonnull align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !4
  %6 = getelementptr inbounds %struct.Clock, %struct.Clock* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @area(i32 noundef %w, i32 noundef %h) #1 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %w, i32 %h)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 10)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %15, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %17 = load i64, i64* %forof.idx, align 8
  %18 = add i64 %17, 1
  store i64 %18, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %19 = load i32, i32* %sum.addr, align 4
  ret i32 %19

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !18
  ret void
}

define internal void @bumpAll(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %cs) #1 {
entry:
  %c.addr = alloca %struct.Cell*, align 8
  %forof.idx = alloca i64, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %cs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %cs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %5 to %struct.Cell**
  %7 = getelementptr inbounds %struct.Cell*, %struct.Cell** %6, i64 %0
  %8 = load %struct.Cell*, %struct.Cell** %7, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  store %struct.Cell* %8, %struct.Cell** %c.addr, align 8
  %9 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %10 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %11 = getelementptr inbounds %struct.Cell, %struct.Cell* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !18
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 100)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = getelementptr inbounds %struct.Cell, %struct.Cell* %9, i32 0, i32 0
  store i32 %14, i32* %16, align 4, !tbaa !18
  br label %forof.inc

forof.inc:
  %17 = load i64, i64* %forof.idx, align 8
  %18 = add i64 %17, 1
  store i64 %18, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Clock*, align 8
  %Clock.obj = alloca %struct.Clock, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %p.addr = alloca %struct.Cell*, align 8
  %q.addr = alloca %struct.Cell*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %struct.Cell*], align 8
  call void @Clock.constructor(%struct.Clock* %Clock.obj)
  store %struct.Clock* %Clock.obj, %struct.Clock** %c.addr, align 8
  %0 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %1 = call i32 @Clock.next(%struct.Clock* %0)
  %2 = call i32 @area(i32 %1, i32 2)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %5 = getelementptr inbounds %struct.Clock, %struct.Clock* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %9 = call i32 @Clock.next(%struct.Clock* %8)
  %10 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %11 = call i32 @Clock.next(%struct.Clock* %10)
  %12 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %13 = call i32 @Clock.next(%struct.Clock* %12)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !21
  %16 = bitcast [3 x i32]* %arr.data to i8*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 %9, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 %11, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %21 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 %13, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %22 = call i32 @total(%struct.nish_array* %arr.hdr)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.Clock*, %struct.Clock** %c.addr, align 8
  %25 = getelementptr inbounds %struct.Clock, %struct.Clock* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4, !tbaa !4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = call i8* @nish_alloc_struct(i64 4)
  %29 = bitcast i8* %28 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %29, i32 1)
  store %struct.Cell* %29, %struct.Cell** %p.addr, align 8
  %30 = call i8* @nish_alloc_struct(i64 4)
  %31 = bitcast i8* %30 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %31, i32 2)
  store %struct.Cell* %31, %struct.Cell** %q.addr, align 8
  %32 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %33 = load %struct.Cell*, %struct.Cell** %q.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !21
  %36 = bitcast [2 x %struct.Cell*]* %arr.data.1 to i8*
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %36, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %38 = bitcast i8* %36 to %struct.Cell**
  %39 = getelementptr inbounds %struct.Cell*, %struct.Cell** %38, i64 0
  store %struct.Cell* %32, %struct.Cell** %39, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %40 = getelementptr inbounds %struct.Cell*, %struct.Cell** %38, i64 1
  store %struct.Cell* %33, %struct.Cell** %40, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  call void @bumpAll(%struct.nish_array* %arr.hdr.1)
  %41 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %42 = getelementptr inbounds %struct.Cell, %struct.Cell* %41, i32 0, i32 0
  %43 = load i32, i32* %42, align 4, !tbaa !18
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  %45 = load %struct.Cell*, %struct.Cell** %q.addr, align 8
  %46 = getelementptr inbounds %struct.Cell, %struct.Cell* %45, i32 0, i32 0
  %47 = load i32, i32* %46, align 4, !tbaa !18
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Clock", !2, i64 0}
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
!17 = !{!"Cell", !2, i64 0}
!18 = !{!17, !2, i64 0}
!19 = !{!"element ptr", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!12, !10, i64 8}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
