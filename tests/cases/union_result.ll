%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.nish_result.un2.$Circle.$Square.str = type { i1, %union.tagged*, i8* }
%struct.nish_result.i32.un2.$Circle.$Square = type { i1, i32, %union.tagged* }
%struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square = type { i1, %union.tagged*, %union.tagged* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"zero\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast %union.tagged* %s to %struct.Circle*
  %9 = getelementptr inbounds %struct.Circle, %struct.Circle* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Square*
  %15 = getelementptr inbounds %struct.Square, %struct.Square* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = bitcast %union.tagged* %s to %struct.Square*
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !8
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %21

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef %union.tagged* @pick(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %2, i32 %n)
  %3 = bitcast %struct.Circle* %2 to %union.tagged*
  br label %cond.end

cond.false:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Square*
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Square.constructor(%struct.Square* %5, i32 %7)
  %9 = bitcast %struct.Square* %5 to %union.tagged*
  br label %cond.end

cond.end:
  %10 = phi %union.tagged* [ %3, %cond.true ], [ %9, %ovf.ok ]
  ret %union.tagged* %10

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.un2.$Circle.$Square.str* @measure(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_result.un2.$Circle.$Square.str*
  %3 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %4, align 8
  ret %struct.nish_result.un2.$Circle.$Square.str* %2

if.end:
  %5 = icmp sgt i32 %n, 0
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %7, i32 %n)
  %8 = bitcast %struct.Circle* %7 to %union.tagged*
  br label %cond.end

cond.false:
  %9 = call i8* @nish_alloc_struct(i64 8)
  %10 = bitcast i8* %9 to %struct.Square*
  %11 = sub nsw i32 0, %n
  call void @Square.constructor(%struct.Square* %10, i32 %11)
  %12 = bitcast %struct.Square* %10 to %union.tagged*
  br label %cond.end

cond.end:
  %13 = phi %union.tagged* [ %8, %cond.true ], [ %12, %cond.false ]
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_result.un2.$Circle.$Square.str*
  %16 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %15, i32 0, i32 0
  store i1 true, i1* %16, align 1
  %17 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %15, i32 0, i32 1
  store %union.tagged* %13, %union.tagged** %17, align 8
  ret %struct.nish_result.un2.$Circle.$Square.str* %15
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.un2.$Circle.$Square* @check(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.un2.$Circle.$Square*
  %3 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %2, i32 0, i32 0
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %2, i32 0, i32 1
  store i32 %n, i32* %4, align 4
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Square*
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Square.constructor(%struct.Square* %6, i32 %8)
  %10 = bitcast %struct.Square* %6 to %union.tagged*
  %11 = call i8* @nish_alloc_struct(i64 16)
  %12 = bitcast i8* %11 to %struct.nish_result.i32.un2.$Circle.$Square*
  %13 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %12, i32 0, i32 0
  store i1 false, i1* %13, align 1
  %14 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %12, i32 0, i32 2
  store %union.tagged* %10, %union.tagged** %14, align 8
  br label %cond.end

cond.end:
  %15 = phi %struct.nish_result.i32.un2.$Circle.$Square* [ %2, %cond.true ], [ %12, %ovf.ok ]
  ret %struct.nish_result.i32.un2.$Circle.$Square* %15

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* @pass(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %2, i32 %n)
  %3 = bitcast %struct.Circle* %2 to %union.tagged*
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*
  %6 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %5, i32 0, i32 0
  store i1 true, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %5, i32 0, i32 1
  store %union.tagged* %3, %union.tagged** %7, align 8
  br label %cond.end

cond.false:
  %8 = call %union.tagged* @pick(i32 %n)
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*
  %11 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %10, i32 0, i32 0
  store i1 false, i1* %11, align 1
  %12 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %10, i32 0, i32 2
  store %union.tagged* %8, %union.tagged** %12, align 8
  br label %cond.end

cond.end:
  %13 = phi %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* [ %5, %cond.true ], [ %10, %cond.false ]
  ret %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %13
}

define void @nish_main() #1 {
entry:
  %r.addr = alloca %struct.nish_result.un2.$Circle.$Square.str*, align 8
  %shape.addr = alloca %union.tagged*, align 8
  %z.addr = alloca %struct.nish_result.un2.$Circle.$Square.str*, align 8
  %e.addr = alloca %struct.nish_result.i32.un2.$Circle.$Square*, align 8
  %p.addr = alloca %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.un2.$Circle.$Square.str* @measure(i32 3)
  store %struct.nish_result.un2.$Circle.$Square.str* %0, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %1 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %4, i32 0, i32 1
  %6 = load %union.tagged*, %union.tagged** %5, align 8
  store %union.tagged* %6, %union.tagged** %shape.addr, align 8
  %7 = load %union.tagged*, %union.tagged** %shape.addr, align 8
  %8 = getelementptr inbounds %union.tagged, %union.tagged* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  switch i32 %9, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %10 = load %union.tagged*, %union.tagged** %shape.addr, align 8
  %11 = bitcast %union.tagged* %10 to %struct.Circle*
  %12 = getelementptr inbounds %struct.Circle, %struct.Circle* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4, !tbaa !5
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  br label %sw.end

sw.case.1:
  %15 = load %union.tagged*, %union.tagged** %shape.addr, align 8
  %16 = bitcast %union.tagged* %15 to %struct.Square*
  %17 = getelementptr inbounds %struct.Square, %struct.Square* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !8
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  br label %sw.end

sw.unreachable:
  unreachable

sw.end:
  br label %if.end

if.end:
  %20 = call %struct.nish_result.un2.$Circle.$Square.str* @measure(i32 0)
  store %struct.nish_result.un2.$Circle.$Square.str* %20, %struct.nish_result.un2.$Circle.$Square.str** %z.addr, align 8
  %21 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %z.addr, align 8
  %22 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %21, i32 0, i32 0
  %23 = load i1, i1* %22, align 1
  %24 = xor i1 %23, true
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %z.addr, align 8
  %26 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %25, i32 0, i32 2
  %27 = load i8*, i8** %26, align 8
  call void @nish_print(i8* %27)
  br label %if.end.1

if.end.1:
  %28 = call %struct.nish_result.i32.un2.$Circle.$Square* @check(i32 -6)
  store %struct.nish_result.i32.un2.$Circle.$Square* %28, %struct.nish_result.i32.un2.$Circle.$Square** %e.addr, align 8
  %29 = load %struct.nish_result.i32.un2.$Circle.$Square*, %struct.nish_result.i32.un2.$Circle.$Square** %e.addr, align 8
  %30 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %29, i32 0, i32 0
  %31 = load i1, i1* %30, align 1
  %32 = xor i1 %31, true
  br i1 %32, label %if.then.2, label %if.end.2

if.then.2:
  %33 = load %struct.nish_result.i32.un2.$Circle.$Square*, %struct.nish_result.i32.un2.$Circle.$Square** %e.addr, align 8
  %34 = getelementptr inbounds %struct.nish_result.i32.un2.$Circle.$Square, %struct.nish_result.i32.un2.$Circle.$Square* %33, i32 0, i32 2
  %35 = load %union.tagged*, %union.tagged** %34, align 8
  %36 = call i32 @area(%union.tagged* %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  br label %if.end.2

if.end.2:
  %38 = call %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* @pass(i32 -2)
  store %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %38, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square** %p.addr, align 8
  %39 = load %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square** %p.addr, align 8
  %40 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %39, i32 0, i32 0
  %41 = load i1, i1* %40, align 1
  br i1 %41, label %cond.true, label %cond.false

cond.true:
  %42 = load %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square** %p.addr, align 8
  %43 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %42, i32 0, i32 1
  %44 = load %union.tagged*, %union.tagged** %43, align 8
  %45 = call i32 @area(%union.tagged* %44)
  br label %cond.end

cond.false:
  %46 = load %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square*, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square** %p.addr, align 8
  %47 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square, %struct.nish_result.un2.$Circle.$Square.un2.$Circle.$Square* %46, i32 0, i32 2
  %48 = load %union.tagged*, %union.tagged** %47, align 8
  %49 = call i32 @area(%union.tagged* %48)
  %50 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %53 = phi i32 [ %45, %cond.true ], [ %51, %ovf.ok ]
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 3)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!9, !10, !11, !12, !13}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{i32 8, !"cf-protection-branch", i32 1}
!10 = !{i32 8, !"cf-protection-return", i32 1}
!11 = !{i32 8, !"branch-target-enforcement", i32 1}
!12 = !{i32 8, !"sign-return-address", i32 1}
!13 = !{i32 4, !"probe-stack", !"inline-asm"}
