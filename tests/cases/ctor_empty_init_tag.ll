%struct.A = type { i32, i32 }
%struct.B = type { i32, i32 }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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

define internal void @A.constructor(%struct.A* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.A, %struct.A* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.A, %struct.A* %this, i32 0, i32 1
  store i32 1, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef %union.tagged* @pick(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.A*
  call void @A.constructor(%struct.A* %2)
  %3 = bitcast %struct.A* %2 to %union.tagged*
  ret %union.tagged* %3

if.end:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.B*
  %6 = getelementptr inbounds %struct.B, %struct.B* %5, i32 0, i32 0
  store i32 1, i32* %6, align 4, !tbaa !7
  %7 = getelementptr inbounds %struct.B, %struct.B* %5, i32 0, i32 1
  store i32 2, i32* %7, align 4, !tbaa !8
  %8 = bitcast %struct.B* %5 to %union.tagged*
  ret %union.tagged* %8
}

define internal noundef i32 @score(%union.tagged* noundef %u) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %u, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 10

sw.case.1:
  ret i32 20

sw.default:
  ret i32 99
}

define noundef i32 @nish_main() #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %s.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = srem i32 %7, 2
  %9 = call %union.tagged* @pick(i32 %8)
  %10 = call i32 @score(%union.tagged* %9)
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %s.addr, align 4
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %15 = load i8*, i8** %14, align 8
  %16 = icmp eq i8* %15, %3
  br i1 %16, label %pass.rewind, label %pass.free

pass.rewind:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %17, align 8
  br label %pass.done

pass.free:
  %18 = ptrtoint i8* %3 to i64
  %19 = add i64 %18, %5
  call void @nish_arena_release(i64 %19)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %s.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"A", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"B", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
