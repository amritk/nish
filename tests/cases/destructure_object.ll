%struct.Point = type { i32, i32 }
%struct.Size = type { i32, i32 }
%struct.Box = type { i32, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"box\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %w, i32 noundef %h, i8* noundef nonnull noalias readonly align 8 %label) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %w, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 1
  store i32 %h, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 2
  store i8* %label, i8** %2, align 8
  ret void
}

define internal noundef i32 @area(%struct.Size* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %w.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Size, %struct.Size* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  store i32 %1, i32* %w.addr, align 4
  %2 = getelementptr inbounds %struct.Size, %struct.Size* %s, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  store i32 %3, i32* %h.addr, align 4
  %4 = load i32, i32* %w.addr, align 4
  %5 = load i32, i32* %h.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %x.addr = alloca i32, align 4
  %py.addr = alloca i32, align 4
  %pattern.679.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %label.addr = alloca i8*, align 8
  %w.addr = alloca i32, align 4
  %Box.obj.1 = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  store i32 %2, i32* %x.addr, align 4
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  store i32 %5, i32* %py.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = load i32, i32* %py.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %11)
  call void @Box.constructor(%struct.Box* %Box.obj, i32 2, i32 5, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  store %struct.Box* %Box.obj, %struct.Box** %pattern.679.addr, align 8
  %12 = load %struct.Box*, %struct.Box** %pattern.679.addr, align 8
  %13 = getelementptr inbounds %struct.Box, %struct.Box* %12, i32 0, i32 2
  %14 = load i8*, i8** %13, align 8
  store i8* %14, i8** %label.addr, align 8
  %15 = load %struct.Box*, %struct.Box** %pattern.679.addr, align 8
  %16 = getelementptr inbounds %struct.Box, %struct.Box* %15, i32 0, i32 0
  %17 = load i32, i32* %16, align 4
  store i32 %17, i32* %w.addr, align 4
  %18 = load i32, i32* %w.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 1)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %20, i32* %w.addr, align 4
  %22 = load i8*, i8** %label.addr, align 8
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %24 = load i32, i32* %w.addr, align 4
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %23, i8* %25)
  call void @nish_print(i8* %26)
  call void @Box.constructor(%struct.Box* %Box.obj.1, i32 6, i32 7, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %27 = bitcast %struct.Box* %Box.obj.1 to %struct.Size*
  %28 = call i32 @area(%struct.Size* %27)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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

!llvm.module.flags = !{!6, !7, !8, !9, !10}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{i32 8, !"cf-protection-branch", i32 1}
!7 = !{i32 8, !"cf-protection-return", i32 1}
!8 = !{i32 8, !"branch-target-enforcement", i32 1}
!9 = !{i32 8, !"sign-return-address", i32 1}
!10 = !{i32 4, !"probe-stack", !"inline-asm"}
