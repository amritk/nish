target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box$un2.$Circle.$Square = type { %union.tagged* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal noundef i32 @area(%union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = bitcast %union.tagged* %s to %struct.Circle*
  %10 = getelementptr inbounds %struct.Circle, %struct.Circle* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !4
  %12 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  %15 = bitcast %union.tagged* %s to %struct.Square*
  %16 = getelementptr inbounds %struct.Square, %struct.Square* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4, !tbaa !6
  %18 = bitcast %union.tagged* %s to %struct.Square*
  %19 = getelementptr inbounds %struct.Square, %struct.Square* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !6
  %21 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %17, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  br label %cond.end

cond.end:
  %24 = phi i32 [ %13, %ovf.ok.1 ], [ %22, %ovf.ok.2 ]
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define void @nish_main() #0 {
entry:
  %b.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %Box$un2.$Circle.$Square.obj = alloca %struct.Box$un2.$Circle.$Square, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !7
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 1
  store i32 2, i32* %3, align 4, !tbaa !4
  %4 = bitcast %struct.Circle* %1 to %union.tagged*
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %union.tagged* %4)
  store %struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %5 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %6 = call %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* %5)
  %7 = call i32 @area(%union.tagged* %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Square*
  %12 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 0
  store i32 1, i32* %12, align 4, !tbaa !8
  %13 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 1
  store i32 3, i32* %13, align 4, !tbaa !6
  %14 = bitcast %struct.Square* %11 to %union.tagged*
  call void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* %9, %union.tagged* %14)
  %15 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %16 = call %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* %15)
  %17 = call i32 @area(%union.tagged* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  ret void
}

define internal void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !11
  ret void
}

define internal noundef %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %union.tagged*, %union.tagged** %0, align 8, !tbaa !11
  ret %union.tagged* %1
}

define internal void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !11
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 4}
!5 = !{!"Square", !2, i64 0, !2, i64 4}
!6 = !{!5, !2, i64 4}
!7 = !{!3, !2, i64 0}
!8 = !{!5, !2, i64 0}
!9 = !{!"ptr", !1, i64 0}
!10 = !{!"Box$un2.$Circle.$Square", !9, i64 0}
!11 = !{!10, !9, i64 0}
