%struct.Sample = type { i32, i8* }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"sample\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"negative\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal noundef i32 @widen(i8 noundef %b) #0 {
entry:
  %0 = zext i8 %b to i32
  ret i32 %0
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %data) #1 {
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
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %data, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3
  store i8 %8, i8* %b.addr, align 1
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i8, i8* %b.addr, align 1
  %11 = call i32 @widen(i8 %10)
  %12 = add nsw i32 %9, %11
  store i32 %12, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = add i64 %13, 1
  store i64 %14, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %15 = load i32, i32* %total.addr, align 4
  ret i32 %15
}

define internal noundef i32 @first(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %view) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %view, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %view, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %view, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %12 = phi i32 [ %11, %bounds.ok ], [ 0, %cond.false ]
  ret i32 %12
}

define internal noundef nonnull align 8 i8* @labelOf(%struct.Sample* noundef readonly align 8 nocapture %r) #3 {
entry:
  %0 = icmp eq %struct.Sample* %r, null
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)

if.end:
  %1 = getelementptr inbounds %struct.Sample, %struct.Sample* %r, i32 0, i32 1
  %2 = load i8*, i8** %1, align 8, !tbaa !10
  ret i8* %2
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Sample* @reading(i32 noundef %value) #4 {
entry:
  %s.addr = alloca %struct.Sample*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Sample*
  %2 = getelementptr inbounds %struct.Sample, %struct.Sample* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !11
  %3 = getelementptr inbounds %struct.Sample, %struct.Sample* %1, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %3, align 8, !tbaa !10
  store %struct.Sample* %1, %struct.Sample** %s.addr, align 8
  %4 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %5 = getelementptr inbounds %struct.Sample, %struct.Sample* %4, i32 0, i32 0
  store i32 %value, i32* %5, align 4, !tbaa !11
  %6 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Sample, %struct.Sample* %6, i32 0, i32 1
  store i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8** %7, align 8, !tbaa !10
  %8 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  ret %struct.Sample* %8
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parsed(i32 noundef %n) #4 {
entry:
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.nish_result.i32.str*
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*), i8** %4, align 8
  ret %struct.nish_result.i32.str* %2

if.end:
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.nish_result.i32.str*
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  store i1 true, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 1
  store i32 %n, i32* %8, align 4
  ret %struct.nish_result.i32.str* %6
}

define noundef i32 @test() #2 {
entry:
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %view.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %r.addr = alloca %struct.Sample*, align 8
  %p.addr = alloca %struct.nish_result.i32.str*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = trunc i32 1 to i8
  %1 = trunc i32 2 to i8
  %2 = trunc i32 3 to i8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = bitcast [3 x i8]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %5 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  store i8 %0, i8* %8, align 1, !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds i8, i8* %7, i64 1
  store i8 %1, i8* %9, align 1, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds i8, i8* %7, i64 2
  store i8 %2, i8* %10, align 1, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %data.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast [2 x i32]* %arr.data.1 to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 10, i32* %16, align 4, !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 20, i32* %17, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %view.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %19 = call i32 @sum(%struct.nish_array* %18)
  %20 = call %struct.Sample* @reading(i32 %19)
  store %struct.Sample* %20, %struct.Sample** %r.addr, align 8
  %21 = load %struct.Sample*, %struct.Sample** %r.addr, align 8
  %22 = call i8* @labelOf(%struct.Sample* %21)
  call void @nish_print(i8* %22)
  %23 = call i8* @labelOf(%struct.Sample* null)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %view.addr, align 8
  %25 = call i32 @first(%struct.nish_array* %24)
  %26 = call %struct.nish_result.i32.str* @parsed(i32 %25)
  store %struct.nish_result.i32.str* %26, %struct.nish_result.i32.str** %p.addr, align 8
  %27 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %p.addr, align 8
  %28 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %27, i32 0, i32 0
  %29 = load i1, i1* %28, align 1
  br i1 %29, label %cond.true, label %cond.false

cond.true:
  %30 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %p.addr, align 8
  %31 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %30, i32 0, i32 1
  %32 = load i32, i32* %31, align 4
  %33 = load %struct.Sample*, %struct.Sample** %r.addr, align 8
  %34 = getelementptr inbounds %struct.Sample, %struct.Sample* %33, i32 0, i32 0
  %35 = load i32, i32* %34, align 4, !tbaa !11
  %36 = add nsw i32 %32, %35
  br label %cond.end

cond.false:
  %37 = sub nsw i32 0, 1
  br label %cond.end

cond.end:
  %38 = phi i32 [ %36, %cond.true ], [ %37, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"i32", !6, i64 0}
!8 = !{!"ptr", !6, i64 0}
!9 = !{!"Sample", !7, i64 0, !8, i64 8}
!10 = !{!9, !8, i64 8}
!11 = !{!9, !7, i64 0}
