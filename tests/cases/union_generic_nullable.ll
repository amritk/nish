%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box$opt.un2.$Circle.$Square = type { %union.tagged* }
%struct.nish_result.opt.un2.$Circle.$Square.str = type { i1, %union.tagged*, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"negative\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"area \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.opt.un2.$Circle.$Square.str* @find(i32 noundef %n) #1 {
entry:
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_result.opt.un2.$Circle.$Square.str*
  %3 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8** %4, align 8
  ret %struct.nish_result.opt.un2.$Circle.$Square.str* %2

if.end:
  %5 = icmp eq i32 %n, 0
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_result.opt.un2.$Circle.$Square.str*
  %8 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %7, i32 0, i32 0
  store i1 true, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %7, i32 0, i32 1
  store %union.tagged* null, %union.tagged** %9, align 8
  ret %struct.nish_result.opt.un2.$Circle.$Square.str* %7

if.end.1:
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Square*
  %12 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 0
  store i32 1, i32* %12, align 4, !tbaa !7
  %13 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 1
  store i32 3, i32* %13, align 4, !tbaa !6
  %14 = bitcast %struct.Square* %11 to %union.tagged*
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_result.opt.un2.$Circle.$Square.str*
  %17 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %16, i32 0, i32 0
  store i1 true, i1* %17, align 1
  %18 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %16, i32 0, i32 1
  store %union.tagged* %14, %union.tagged** %18, align 8
  ret %struct.nish_result.opt.un2.$Circle.$Square.str* %16
}

define internal noundef nonnull align 8 i8* @describe(%struct.nish_result.opt.un2.$Circle.$Square.str* noundef nonnull align 8 dereferenceable(24) readonly nocapture %r) #0 {
entry:
  %s.addr = alloca %union.tagged*, align 8
  %0 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %r, i32 0, i32 0
  %1 = load i1, i1* %0, align 1
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %r, i32 0, i32 2
  %4 = load i8*, i8** %3, align 8
  ret i8* %4

if.end:
  %5 = getelementptr inbounds %struct.nish_result.opt.un2.$Circle.$Square.str, %struct.nish_result.opt.un2.$Circle.$Square.str* %r, i32 0, i32 1
  %6 = load %union.tagged*, %union.tagged** %5, align 8
  store %union.tagged* %6, %union.tagged** %s.addr, align 8
  %7 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %8 = icmp eq %union.tagged* %7, null
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %9 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %10 = call i32 @area(%union.tagged* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %11)
  br label %cond.end

cond.end:
  %13 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true ], [ %12, %cond.false ]
  ret i8* %13
}

define internal void @Box$opt.un2.$Circle.$Square.constructor(%struct.Box$opt.un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef align 8 %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$opt.un2.$Circle.$Square, %struct.Box$opt.un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !10
  ret void
}

define internal noundef i32 @open$(%struct.Box$opt.un2.$Circle.$Square* noundef readonly align 8 nocapture %box) #0 {
entry:
  %Circle.obj = alloca %struct.Circle, align 8
  %0 = icmp eq %struct.Box$opt.un2.$Circle.$Square* %box, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Box$opt.un2.$Circle.$Square, %struct.Box$opt.un2.$Circle.$Square* %box, i32 0, i32 0
  %2 = load %union.tagged*, %union.tagged** %1, align 8, !tbaa !10
  %3 = icmp ne %union.tagged* %2, null
  br i1 %3, label %nullish.end, label %nullish.default

nullish.default:
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %Circle.obj, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !11
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %Circle.obj, i32 0, i32 1
  store i32 2, i32* %5, align 4, !tbaa !4
  %6 = bitcast %struct.Circle* %Circle.obj to %union.tagged*
  br label %nullish.end

nullish.end:
  %7 = phi %union.tagged* [ %2, %chain.next ], [ %6, %nullish.default ]
  %8 = call i32 @area(%union.tagged* %7)
  ret i32 %8
}

define void @nish_main() #0 {
entry:
  %Box$opt.un2.$Circle.$Square.obj = alloca %struct.Box$opt.un2.$Circle.$Square, align 8
  %Box$opt.un2.$Circle.$Square.obj.1 = alloca %struct.Box$opt.un2.$Circle.$Square, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.opt.un2.$Circle.$Square.str* @find(i32 -1)
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @describe(%struct.nish_result.opt.un2.$Circle.$Square.str* %0)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  call void @nish_print(i8* %3)
  %4 = call %struct.nish_result.opt.un2.$Circle.$Square.str* @find(i32 0)
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @describe(%struct.nish_result.opt.un2.$Circle.$Square.str* %4)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  call void @nish_print(i8* %7)
  %8 = call %struct.nish_result.opt.un2.$Circle.$Square.str* @find(i32 1)
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @describe(%struct.nish_result.opt.un2.$Circle.$Square.str* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  call void @nish_print(i8* %11)
  %12 = call i32 @open$(%struct.Box$opt.un2.$Circle.$Square* null)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  call void @Box$opt.un2.$Circle.$Square.constructor(%struct.Box$opt.un2.$Circle.$Square* %Box$opt.un2.$Circle.$Square.obj, %union.tagged* null)
  %14 = call i32 @open$(%struct.Box$opt.un2.$Circle.$Square* %Box$opt.un2.$Circle.$Square.obj)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Square*
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 0
  store i32 1, i32* %18, align 4, !tbaa !7
  %19 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 1
  store i32 3, i32* %19, align 4, !tbaa !6
  %20 = bitcast %struct.Square* %17 to %union.tagged*
  call void @Box$opt.un2.$Circle.$Square.constructor(%struct.Box$opt.un2.$Circle.$Square* %Box$opt.un2.$Circle.$Square.obj.1, %union.tagged* %20)
  %21 = call i32 @open$(%struct.Box$opt.un2.$Circle.$Square* %Box$opt.un2.$Circle.$Square.obj.1)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!12, !13, !14, !15, !16}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 4}
!5 = !{!"Square", !2, i64 0, !2, i64 4}
!6 = !{!5, !2, i64 4}
!7 = !{!5, !2, i64 0}
!8 = !{!"ptr", !1, i64 0}
!9 = !{!"Box$opt.un2.$Circle.$Square", !8, i64 0}
!10 = !{!9, !8, i64 0}
!11 = !{!3, !2, i64 0}
!12 = !{i32 8, !"cf-protection-branch", i32 1}
!13 = !{i32 8, !"cf-protection-return", i32 1}
!14 = !{i32 8, !"branch-target-enforcement", i32 1}
!15 = !{i32 8, !"sign-return-address", i32 1}
!16 = !{i32 4, !"probe-stack", !"inline-asm"}
