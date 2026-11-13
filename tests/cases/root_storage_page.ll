target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

%struct.Node = type { i32, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }
%nish.trace = type { i32, i32, i32, i32*, i8** }
%nish.root = type { i8*, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_storage_0_head.data = internal global [1 x %struct.Node*] zeroinitializer, align 16
@nish.trace.0.at = internal constant [1 x i32] [i32 ptrtoint (%struct.Node** getelementptr (%struct.Node, %struct.Node* null, i32 0, i32 1) to i32)]
@nish.trace.0.to = internal constant [1 x i8*] [i8* bitcast (%nish.trace* @nish.trace.0 to i8*)]
@nish.trace.0 = internal constant %nish.trace { i32 0, i32 ptrtoint (%struct.Node* getelementptr (%struct.Node, %struct.Node* null, i32 1) to i32), i32 1, i32* getelementptr inbounds ([1 x i32], [1 x i32]* @nish.trace.0.at, i32 0, i32 0), i8** getelementptr inbounds ([1 x i8*], [1 x i8*]* @nish.trace.0.to, i32 0, i32 0) }
@nish_storage_0_head.root = constant %nish.root { i8* bitcast ([1 x %struct.Node*]* @nish_storage_0_head.data to i8*), i32 1, i8* bitcast (%nish.trace* @nish.trace.0 to i8*) }
@nish.roots = internal constant [1 x %nish.root*] [%nish.root* @nish_storage_0_head.root]
@nish_storage_0_head = internal global %struct.nish_array { i64 1, i64 1, i8* bitcast ([1 x %struct.Node*]* @nish_storage_0_head.data to i8*) }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_runtime_root_keep(i64 noundef, i8* noundef, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define void @nish_root_keep(i64 %mark) {
  call void @nish_runtime_root_keep(i64 %mark, i8* bitcast ([1 x %nish.root*]* @nish.roots to i8*), i32 1)
  ret void
}

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4, !tbaa !6
  ret void
}

define void @push(i32 noundef %value) #1 {
entry:
  %n.addr = alloca %struct.Node*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 %value)
  store %struct.Node* %1, %struct.Node** %n.addr, align 8
  %2 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = icmp ult i64 0, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %4), !nish.site !{i32 0}
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = bitcast i8* %7 to %struct.Node**
  %9 = getelementptr inbounds %struct.Node*, %struct.Node** %8, i64 0
  %10 = load %struct.Node*, %struct.Node** %9, align 8, !alias.scope !11, !noalias !10, !tbaa !18
  %11 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 1
  store %struct.Node* %10, %struct.Node** %11, align 8, !tbaa !5
  %12 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %15 = icmp ult i64 0, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %14), !nish.site !{i32 1}
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = bitcast i8* %17 to %struct.Node**
  %19 = getelementptr inbounds %struct.Node*, %struct.Node** %18, i64 0
  store %struct.Node* %12, %struct.Node** %19, align 8, !alias.scope !11, !noalias !10, !tbaa !18
  ret void
}

define noundef i32 @total() #1 {
entry:
  %sum.addr = alloca i32, align 4
  %n.addr = alloca %struct.Node*, align 8
  store i32 0, i32* %sum.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1), !nish.site !{i32 2}
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_head, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %5 = bitcast i8* %4 to %struct.Node**
  %6 = getelementptr inbounds %struct.Node*, %struct.Node** %5, i64 0
  %7 = load %struct.Node*, %struct.Node** %6, align 8, !alias.scope !11, !noalias !10, !tbaa !18
  store %struct.Node* %7, %struct.Node** %n.addr, align 8
  br label %while.cond

while.cond:
  %8 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %9 = icmp ne %struct.Node* %8, null
  br i1 %9, label %while.body, label %while.end

while.body:
  %10 = load i32, i32* %sum.addr, align 4
  %11 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %12 = getelementptr inbounds %struct.Node, %struct.Node* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !6
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %sum.addr, align 4
  %17 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %18 = getelementptr inbounds %struct.Node, %struct.Node* %17, i32 0, i32 1
  %19 = load %struct.Node*, %struct.Node** %18, align 8, !tbaa !5
  store %struct.Node* %19, %struct.Node** %n.addr, align 8
  br label %while.cond

while.end:
  %20 = load i32, i32* %sum.addr, align 4
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0), !nish.site !{i32 3}
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Node", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}
