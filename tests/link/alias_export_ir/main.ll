%struct.Sample = type { i32 }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"negative\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.Sample* @reading(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %data) #0 {
entry:
  %total.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %data, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %data, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store i8 %8, i8* %b.addr, align 1
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i8, i8* %b.addr, align 1
  %11 = zext i8 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @valueOf(%struct.Sample* noundef readonly align 8 nocapture %r) #1 {
entry:
  %0 = icmp eq %struct.Sample* %r, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = getelementptr inbounds %struct.Sample, %struct.Sample* %r, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !16
  br label %cond.end

cond.end:
  %3 = phi i32 [ 0, %cond.true ], [ %2, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parsed(i32 noundef %n) #2 {
entry:
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.str*
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8** %4, align 8
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.nish_result.i32.str*
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  store i1 true, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 1
  store i32 %n, i32* %8, align 4
  br label %cond.end

cond.end:
  %9 = phi %struct.nish_result.i32.str* [ %2, %cond.true ], [ %6, %cond.false ]
  ret %struct.nish_result.i32.str* %9
}

define noundef i32 @nish_main() #0 {
entry:
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %r.addr = alloca %struct.Sample*, align 8
  %p.addr = alloca %struct.nish_result.i32.str*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = trunc i32 1 to i8
  %1 = trunc i32 2 to i8
  %2 = trunc i32 3 to i8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %5 = bitcast [3 x i8]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %5 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  store i8 %0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i8, i8* %7, i64 1
  store i8 %1, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i8, i8* %7, i64 2
  store i8 %2, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %data.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %12 = call i32 @sum(%struct.nish_array* %11)
  %13 = call %struct.Sample* @reading(i32 %12)
  store %struct.Sample* %13, %struct.Sample** %r.addr, align 8
  %14 = load %struct.Sample*, %struct.Sample** %r.addr, align 8
  %15 = call i32 @valueOf(%struct.Sample* %14)
  %16 = call i32 @valueOf(%struct.Sample* null)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = call %struct.nish_result.i32.str* @parsed(i32 %18)
  store %struct.nish_result.i32.str* %20, %struct.nish_result.i32.str** %p.addr, align 8
  %21 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %p.addr, align 8
  %22 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %21, i32 0, i32 0
  %23 = load i1, i1* %22, align 1
  br i1 %23, label %cond.true, label %cond.false

cond.true:
  %24 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %p.addr, align 8
  %25 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %27 = phi i32 [ %26, %cond.true ], [ -1, %cond.false ]
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %p.addr, align 8
  %30 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %29, i32 0, i32 0
  %31 = load i1, i1* %30, align 1
  br i1 %31, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %32 = phi i32 [ 0, %cond.true.1 ], [ 1, %cond.false.1 ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %32

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"i32", !6, i64 0}
!15 = !{!"Sample", !14, i64 0}
!16 = !{!15, !14, i64 0}
!17 = !{!9, !7, i64 8}
