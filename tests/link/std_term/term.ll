%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.KeyEvent = type { i32, i32 }
%struct.TermEvent = type { i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i8*, i32, i32, i32, i32, %struct.nish_array*, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.KeyState = type { double, double, double, %struct.nish_array*, %struct.nish_array*, i1, i1, i1 }
%struct.TermHeldKey = type { double, i32, i32, i32, i1 }
%struct.FixedStep = type { double, double, double, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\E2\96\80\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?1049h\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?1049l\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"\1B[?25l\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"\1B[?25h\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"\1B[H\1B[2J\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\1B[0m\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\1B[\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"H\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?2026h\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?2026l\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.round.init, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare double @floor(double)
declare double @ceil(double)
declare double @trunc(double)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare double @nish_floor(double) #1
declare void @nish_round_init(double (double)*, double (double)*, double (double)*) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare double @llvm.fabs.f64(double) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define internal void @nish.round.init() nounwind {
entry:
  call void @nish_round_init(double (double)* @floor, double (double)* @ceil, double (double)* @trunc)
  ret void
}

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

define internal noundef zeroext i1 @nish.termNativeStrings() #0 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 3
  ret i1 %3
}

define internal noundef i32 @nish.termSide(i32 noundef %v) #1 {
entry:
  %0 = icmp sle i32 %v, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp sge i32 %v, 4096
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 4096

if.end.1:
  ret i32 %v
}

define internal noundef i32 @nish.termFitRows(i32 noundef %w, i32 noundef %h) #1 {
entry:
  %most.addr = alloca i32, align 4
  %0 = icmp sle i32 %w, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %h

if.end:
  %1 = sdiv i32 1048576, %w
  %2 = or i32 %1, 0
  store i32 %2, i32* %most.addr, align 4
  %3 = load i32, i32* %most.addr, align 4
  %4 = icmp sle i32 %h, %3
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 %h

if.end.1:
  %5 = load i32, i32* %most.addr, align 4
  %6 = tail call i32 @nish.termSide(i32 %5)
  ret i32 %6
}

define internal noundef i32 @nish.termCellCount(i32 noundef %w, i32 noundef %h) #1 {
entry:
  %cells.addr = alloca i32, align 4
  %0 = mul nsw i32 %w, %h
  store i32 %0, i32* %cells.addr, align 4
  %1 = load i32, i32* %cells.addr, align 4
  %2 = icmp sle i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = load i32, i32* %cells.addr, align 4
  %4 = icmp sge i32 %3, 1048576
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1048576

if.end.1:
  %5 = load i32, i32* %cells.addr, align 4
  ret i32 %5
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.termCells(i32 noundef %n, i32 noundef %value) #2 {
entry:
  %cells.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %cells.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 %value, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  ret %struct.nish_array* %21
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.termFlushRoom(i32 noundef %cells) #3 {
entry:
  %room.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %room.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sle i32 %5, %cells
  br i1 %6, label %for.body, label %for.end

for.body:
  store i32 0, i32* %k.addr, align 4
  br label %for.cond.1

for.cond.1:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp slt i32 %7, 64
  br i1 %8, label %for.body.1, label %for.end.1

for.body.1:
  %9 = load %struct.nish_array*, %struct.nish_array** %room.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 1)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %11
  store i8 0, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  br label %for.inc.1

for.inc.1:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %room.addr, align 8
  ret %struct.nish_array* %25
}

define internal noundef i32 @nish.termCellLimit(i32 noundef %n) #1 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp sge i32 %n, 1048576
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1048576

if.end.1:
  ret i32 %n
}

define internal noundef i32 @nish.termGridAt(i32 noundef %x, i32 noundef %y, i32 noundef %w, i32 noundef %h, i32 noundef %len) #1 {
entry:
  %at.addr = alloca i64, align 8
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = icmp sge i32 %x, %w
  br label %lor.end.1

lor.end.1:
  %4 = phi i1 [ true, %lor.end.2 ], [ %3, %lor.rhs.1 ]
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = icmp sge i32 %y, %h
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %lor.end.1 ], [ %5, %lor.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %7 = sext i32 %y to i64
  %8 = sext i32 %w to i64
  %9 = mul nsw i64 %7, %8
  %10 = sext i32 %x to i64
  %11 = add nsw i64 %9, %10
  store i64 %11, i64* %at.addr, align 8
  %12 = load i64, i64* %at.addr, align 8
  %13 = sext i32 %len to i64
  %14 = icmp sge i64 %12, %13
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -1

if.end.1:
  %15 = load i64, i64* %at.addr, align 8
  %16 = trunc i64 %15 to i32
  ret i32 %16
}

define internal noundef i32 @nish.termShortest(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %c, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %d) #0 {
entry:
  %ab.addr = alloca i32, align 4
  %cd.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %2, %5
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  br label %cond.end

cond.false:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  br label %cond.end

cond.end:
  %13 = phi i32 [ %9, %cond.true ], [ %12, %cond.false ]
  store i32 %13, i32* %ab.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %c, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %d, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = icmp slt i32 %16, %19
  br i1 %20, label %cond.true.1, label %cond.false.1

cond.true.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %c, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %cond.end.1

cond.false.1:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %d, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  br label %cond.end.1

cond.end.1:
  %27 = phi i32 [ %23, %cond.true.1 ], [ %26, %cond.false.1 ]
  store i32 %27, i32* %cd.addr, align 4
  %28 = load i32, i32* %ab.addr, align 4
  %29 = load i32, i32* %cd.addr, align 4
  %30 = icmp slt i32 %28, %29
  br i1 %30, label %cond.true.2, label %cond.false.2

cond.true.2:
  %31 = load i32, i32* %ab.addr, align 4
  br label %cond.end.2

cond.false.2:
  %32 = load i32, i32* %cd.addr, align 4
  br label %cond.end.2

cond.end.2:
  %33 = phi i32 [ %31, %cond.true.2 ], [ %32, %cond.false.2 ]
  ret i32 %33
}

define internal noundef i32 @nish.termClamp(i32 noundef %v, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %0 = icmp slt i32 %v, %lo
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %lo

if.end:
  %1 = icmp sgt i32 %v, %hi
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %hi, %cond.true ], [ %v, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @nish.termLeadWidth(i32 noundef %c) #1 {
entry:
  %0 = icmp sge i32 %c, 240
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 4

if.end:
  %1 = icmp sge i32 %c, 224
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 3

if.end.1:
  %2 = icmp sge i32 %c, 192
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ 2, %cond.true ], [ 1, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @nish.termLeadBits(i32 noundef %c, i32 noundef %width) #1 {
entry:
  %0 = icmp eq i32 %width, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = and i32 %c, 31
  ret i32 %1

if.end:
  %2 = icmp eq i32 %width, 3
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = and i32 %c, 15
  br label %cond.end

cond.false:
  %4 = and i32 %c, 7
  br label %cond.end

cond.end:
  %5 = phi i32 [ %3, %cond.true ], [ %4, %cond.false ]
  ret i32 %5
}

define noundef i32 @nish.rgb(i32 noundef %r, i32 noundef %g, i32 noundef %b) #1 {
entry:
  %0 = call i32 @nish.termClamp(i32 %r, i32 0, i32 255)
  %1 = shl i32 %0, 16
  %2 = call i32 @nish.termClamp(i32 %g, i32 0, i32 255)
  %3 = shl i32 %2, 8
  %4 = or i32 %1, %3
  %5 = call i32 @nish.termClamp(i32 %b, i32 0, i32 255)
  %6 = or i32 %4, %5
  ret i32 %6
}

define internal noundef i32 @nish.termCubeLevel(i32 noundef %v) #1 {
entry:
  %0 = icmp slt i32 %v, 48
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp slt i32 %v, 115
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1

if.end.1:
  %2 = icmp slt i32 %v, 155
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 2

if.end.2:
  %3 = icmp slt i32 %v, 195
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 3

if.end.3:
  %4 = icmp slt i32 %v, 235
  br i1 %4, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 4

if.end.4:
  ret i32 5
}

define internal noundef double @nish.termCubeValue(i32 noundef %q) #1 {
entry:
  %0 = icmp eq i32 %q, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sitofp i32 %q to double
  %2 = fmul double %1, 0x4044000000000000
  %3 = fadd double %2, 0x404B800000000000
  br label %cond.end

cond.end:
  %4 = phi double [ 0x0000000000000000, %cond.true ], [ %3, %cond.false ]
  ret double %4
}

define internal noundef i32 @nish.termGreyIndex(i32 noundef %average) #1 {
entry:
  %step.addr = alloca i32, align 4
  store i32 0, i32* %step.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %step.addr, align 4
  %1 = icmp slt i32 %0, 23
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %step.addr, align 4
  %3 = mul nsw i32 %2, 10
  %4 = add nsw i32 %3, 13
  %5 = icmp slt i32 %average, %4
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %step.addr, align 4
  %7 = add nsw i32 %6, 232
  ret i32 %7

if.end:
  br label %for.inc

for.inc:
  %8 = load i32, i32* %step.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %step.addr, align 4
  br label %for.cond

for.end:
  ret i32 255
}

define noundef i32 @nish.paletteIndex(i32 noundef %colour) #1 {
entry:
  %r.addr = alloca i32, align 4
  %g.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %qr.addr = alloca i32, align 4
  %qg.addr = alloca i32, align 4
  %qb.addr = alloca i32, align 4
  %cube.addr = alloca i32, align 4
  %dr.addr = alloca double, align 8
  %dg.addr = alloca double, align 8
  %db.addr = alloca double, align 8
  %cubeDistance.addr = alloca double, align 8
  %greyIndex.addr = alloca i32, align 4
  %grey.addr = alloca double, align 8
  %gr.addr = alloca double, align 8
  %gg.addr = alloca double, align 8
  %gb.addr = alloca double, align 8
  %greyDistance.addr = alloca double, align 8
  %0 = icmp slt i32 %colour, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = ashr i32 %colour, 16
  %2 = and i32 %1, 255
  store i32 %2, i32* %r.addr, align 4
  %3 = ashr i32 %colour, 8
  %4 = and i32 %3, 255
  store i32 %4, i32* %g.addr, align 4
  %5 = and i32 %colour, 255
  store i32 %5, i32* %b.addr, align 4
  %6 = load i32, i32* %r.addr, align 4
  %7 = call i32 @nish.termCubeLevel(i32 %6)
  store i32 %7, i32* %qr.addr, align 4
  %8 = load i32, i32* %g.addr, align 4
  %9 = call i32 @nish.termCubeLevel(i32 %8)
  store i32 %9, i32* %qg.addr, align 4
  %10 = load i32, i32* %b.addr, align 4
  %11 = call i32 @nish.termCubeLevel(i32 %10)
  store i32 %11, i32* %qb.addr, align 4
  %12 = load i32, i32* %qr.addr, align 4
  %13 = mul nsw i32 %12, 36
  %14 = load i32, i32* %qg.addr, align 4
  %15 = mul nsw i32 %14, 6
  %16 = add nsw i32 %13, %15
  %17 = load i32, i32* %qb.addr, align 4
  %18 = add nsw i32 %16, %17
  %19 = add nsw i32 %18, 16
  store i32 %19, i32* %cube.addr, align 4
  %20 = load i32, i32* %r.addr, align 4
  %21 = sitofp i32 %20 to double
  %22 = load i32, i32* %qr.addr, align 4
  %23 = call double @nish.termCubeValue(i32 %22)
  %24 = fsub double %21, %23
  store double %24, double* %dr.addr, align 8
  %25 = load i32, i32* %g.addr, align 4
  %26 = sitofp i32 %25 to double
  %27 = load i32, i32* %qg.addr, align 4
  %28 = call double @nish.termCubeValue(i32 %27)
  %29 = fsub double %26, %28
  store double %29, double* %dg.addr, align 8
  %30 = load i32, i32* %b.addr, align 4
  %31 = sitofp i32 %30 to double
  %32 = load i32, i32* %qb.addr, align 4
  %33 = call double @nish.termCubeValue(i32 %32)
  %34 = fsub double %31, %33
  store double %34, double* %db.addr, align 8
  %35 = load double, double* %dr.addr, align 8
  %36 = load double, double* %dr.addr, align 8
  %37 = fmul double %35, %36
  %38 = load double, double* %dg.addr, align 8
  %39 = load double, double* %dg.addr, align 8
  %40 = fmul double %38, %39
  %41 = fadd double %37, %40
  %42 = load double, double* %db.addr, align 8
  %43 = load double, double* %db.addr, align 8
  %44 = fmul double %42, %43
  %45 = fadd double %41, %44
  store double %45, double* %cubeDistance.addr, align 8
  %46 = load i32, i32* %r.addr, align 4
  %47 = load i32, i32* %g.addr, align 4
  %48 = add nsw i32 %46, %47
  %49 = load i32, i32* %b.addr, align 4
  %50 = add nsw i32 %48, %49
  %51 = sdiv i32 %50, 3
  %52 = or i32 %51, 0
  %53 = call i32 @nish.termGreyIndex(i32 %52)
  store i32 %53, i32* %greyIndex.addr, align 4
  %54 = load i32, i32* %greyIndex.addr, align 4
  %55 = sitofp i32 %54 to double
  %56 = fsub double %55, 0x406D000000000000
  %57 = fmul double %56, 0x4024000000000000
  %58 = fadd double %57, 0x4020000000000000
  store double %58, double* %grey.addr, align 8
  %59 = load i32, i32* %r.addr, align 4
  %60 = sitofp i32 %59 to double
  %61 = load double, double* %grey.addr, align 8
  %62 = fsub double %60, %61
  store double %62, double* %gr.addr, align 8
  %63 = load i32, i32* %g.addr, align 4
  %64 = sitofp i32 %63 to double
  %65 = load double, double* %grey.addr, align 8
  %66 = fsub double %64, %65
  store double %66, double* %gg.addr, align 8
  %67 = load i32, i32* %b.addr, align 4
  %68 = sitofp i32 %67 to double
  %69 = load double, double* %grey.addr, align 8
  %70 = fsub double %68, %69
  store double %70, double* %gb.addr, align 8
  %71 = load double, double* %gr.addr, align 8
  %72 = load double, double* %gr.addr, align 8
  %73 = fmul double %71, %72
  %74 = load double, double* %gg.addr, align 8
  %75 = load double, double* %gg.addr, align 8
  %76 = fmul double %74, %75
  %77 = fadd double %73, %76
  %78 = load double, double* %gb.addr, align 8
  %79 = load double, double* %gb.addr, align 8
  %80 = fmul double %78, %79
  %81 = fadd double %77, %80
  store double %81, double* %greyDistance.addr, align 8
  %82 = load double, double* %greyDistance.addr, align 8
  %83 = load double, double* %cubeDistance.addr, align 8
  %84 = fcmp olt double %82, %83
  br i1 %84, label %cond.true, label %cond.false

cond.true:
  %85 = load i32, i32* %greyIndex.addr, align 4
  br label %cond.end

cond.false:
  %86 = load i32, i32* %cube.addr, align 4
  br label %cond.end

cond.end:
  %87 = phi i32 [ %85, %cond.true ], [ %86, %cond.false ]
  ret i32 %87
}

define noundef nonnull align 8 i8* @nish.enterAltScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.1 to i8*)
}

define noundef nonnull align 8 i8* @nish.leaveAltScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*)
}

define noundef nonnull align 8 i8* @nish.hideCursor() #1 {
entry:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*)
}

define noundef nonnull align 8 i8* @nish.showCursor() #1 {
entry:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*)
}

define noundef nonnull align 8 i8* @nish.clearScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*)
}

define noundef nonnull align 8 i8* @nish.resetStyle() #1 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*)
}

define noundef nonnull align 8 i8* @nish.moveCursor(i32 noundef %x, i32 noundef %y) #3 {
entry:
  %0 = sext i32 %y to i64
  %1 = sext i32 1 to i64
  %2 = add nsw i64 %0, %1
  %3 = call i8* @nish_str_from_i64(i64 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.7 to i8*), i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %6 = sext i32 %x to i64
  %7 = sext i32 1 to i64
  %8 = add nsw i64 %6, %7
  %9 = call i8* @nish_str_from_i64(i64 %8)
  %10 = call i8* @nish_str_concat(i8* %5, i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  ret i8* %11
}

define noundef nonnull align 8 i8* @nish.beginSync() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.10 to i8*)
}

define noundef nonnull align 8 i8* @nish.endSync() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.11 to i8*)
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.termCodePoints(i8* noundef nonnull noalias readonly align 8 nocapture %s) #3 {
entry:
  %points.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %native.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %read.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %points.addr, align 8
  %5 = bitcast i8* %s to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  %8 = call i1 @nish.termNativeStrings()
  store i1 %8, i1* %native.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %9, %10
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds i8, i8* %s, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1
  %17 = zext i8 %16 to i32
  store i32 %17, i32* %c.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  %20 = load i1, i1* %native.addr, align 1
  %21 = xor i1 %20, true
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %c.addr, align 4
  %23 = icmp sge i32 %22, 55296
  br i1 %23, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp slt i32 %24, 56320
  br label %land.end.1

land.end.1:
  %26 = phi i1 [ false, %if.then ], [ %25, %land.rhs.1 ]
  br i1 %26, label %land.rhs, label %land.end

land.rhs:
  %27 = load i32, i32* %i.addr, align 4
  %28 = load i32, i32* %n.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %land.end.1 ], [ %29, %land.rhs ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  %31 = load i32, i32* %i.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = getelementptr inbounds i8, i8* %s, i64 8
  %34 = getelementptr inbounds i8, i8* %33, i64 %32
  %35 = load i8, i8* %34, align 1
  %36 = zext i8 %35 to i32
  store i32 %36, i32* %lo.addr, align 4
  %37 = load i32, i32* %lo.addr, align 4
  %38 = icmp sge i32 %37, 56320
  br i1 %38, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %39 = load i32, i32* %lo.addr, align 4
  %40 = icmp slt i32 %39, 57344
  br label %land.end.2

land.end.2:
  %41 = phi i1 [ false, %if.then.1 ], [ %40, %land.rhs.2 ]
  br i1 %41, label %if.then.2, label %if.end.2

if.then.2:
  %42 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %43 = load i32, i32* %c.addr, align 4
  %44 = and i32 %43, 1023
  %45 = mul nsw i32 %44, 1024
  %46 = load i32, i32* %lo.addr, align 4
  %47 = and i32 %46, 1023
  %48 = add nsw i32 %45, %47
  %49 = add nsw i32 %48, 65536
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %42, i64 4)
  br label %push.store

push.store:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  store i32 %49, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  %61 = load i32, i32* %i.addr, align 4
  %62 = add nsw i32 %61, 1
  store i32 %62, i32* %i.addr, align 4
  br label %while.cond

if.end.2:
  br label %if.end.1

if.end.1:
  %63 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %64 = load i32, i32* %c.addr, align 4
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %63, i64 4)
  br label %push.store.1

push.store.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 %66
  store i32 %64, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  br label %while.cond

if.end:
  %76 = load i32, i32* %c.addr, align 4
  %77 = icmp slt i32 %76, 128
  br i1 %77, label %if.then.3, label %if.end.3

if.then.3:
  %78 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %79 = load i32, i32* %c.addr, align 4
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 1
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %84 = icmp eq i64 %81, %83
  br i1 %84, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %78, i64 4)
  br label %push.store.2

push.store.2:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 %81
  store i32 %79, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %89 = add i64 %81, 1
  store i64 %89, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = trunc i64 %89 to i32
  br label %while.cond

if.end.3:
  %91 = load i32, i32* %c.addr, align 4
  %92 = icmp sge i32 %91, 248
  br i1 %92, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %93 = load i32, i32* %c.addr, align 4
  %94 = call i32 @nish.termLeadWidth(i32 %93)
  br label %cond.end

cond.end:
  %95 = phi i32 [ 1, %cond.true ], [ %94, %cond.false ]
  store i32 %95, i32* %width.addr, align 4
  %96 = load i32, i32* %c.addr, align 4
  %97 = load i32, i32* %width.addr, align 4
  %98 = call i32 @nish.termLeadBits(i32 %96, i32 %97)
  store i32 %98, i32* %cp.addr, align 4
  store i32 1, i32* %read.addr, align 4
  br label %while.cond.1

while.cond.1:
  %99 = load i32, i32* %read.addr, align 4
  %100 = load i32, i32* %width.addr, align 4
  %101 = icmp slt i32 %99, %100
  br i1 %101, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %102 = load i32, i32* %i.addr, align 4
  %103 = load i32, i32* %n.addr, align 4
  %104 = icmp slt i32 %102, %103
  br label %land.end.3

land.end.3:
  %105 = phi i1 [ false, %while.cond.1 ], [ %104, %land.rhs.3 ]
  br i1 %105, label %while.body.1, label %while.end.1

while.body.1:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sext i32 %106 to i64
  %108 = getelementptr inbounds i8, i8* %s, i64 8
  %109 = getelementptr inbounds i8, i8* %108, i64 %107
  %110 = load i8, i8* %109, align 1
  %111 = zext i8 %110 to i32
  store i32 %111, i32* %next.addr, align 4
  %112 = load i32, i32* %next.addr, align 4
  %113 = icmp slt i32 %112, 128
  br i1 %113, label %lor.end, label %lor.rhs

lor.rhs:
  %114 = load i32, i32* %next.addr, align 4
  %115 = icmp sge i32 %114, 192
  br label %lor.end

lor.end:
  %116 = phi i1 [ true, %while.body.1 ], [ %115, %lor.rhs ]
  br i1 %116, label %if.then.4, label %if.end.4

if.then.4:
  br label %while.end.1

if.end.4:
  %117 = load i32, i32* %cp.addr, align 4
  %118 = shl i32 %117, 6
  %119 = load i32, i32* %next.addr, align 4
  %120 = and i32 %119, 63
  %121 = or i32 %118, %120
  store i32 %121, i32* %cp.addr, align 4
  %122 = load i32, i32* %read.addr, align 4
  %123 = add nsw i32 %122, 1
  store i32 %123, i32* %read.addr, align 4
  %124 = load i32, i32* %i.addr, align 4
  %125 = add nsw i32 %124, 1
  store i32 %125, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %126 = load i32, i32* %width.addr, align 4
  %127 = icmp sgt i32 %126, 1
  br i1 %127, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %128 = load i32, i32* %read.addr, align 4
  %129 = load i32, i32* %width.addr, align 4
  %130 = icmp eq i32 %128, %129
  br label %land.end.4

land.end.4:
  %131 = phi i1 [ false, %while.end.1 ], [ %130, %land.rhs.4 ]
  br i1 %131, label %if.then.5, label %if.end.5

if.then.5:
  %132 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %133 = load i32, i32* %cp.addr, align 4
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 1
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = icmp eq i64 %135, %137
  br i1 %138, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %132, i64 4)
  br label %push.store.3

push.store.3:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to i32*
  %142 = getelementptr inbounds i32, i32* %141, i64 %135
  store i32 %133, i32* %142, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = add i64 %135, 1
  store i64 %143, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = trunc i64 %143 to i32
  br label %while.cond

if.end.5:
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %145 = load i32, i32* %k.addr, align 4
  %146 = load i32, i32* %read.addr, align 4
  %147 = icmp slt i32 %145, %146
  br i1 %147, label %for.body, label %for.end

for.body:
  %148 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 0
  %150 = load i64, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 1
  %152 = load i64, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %153 = icmp eq i64 %150, %152
  br i1 %153, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %148, i64 4)
  br label %push.store.4

push.store.4:
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %156 = bitcast i8* %155 to i32*
  %157 = getelementptr inbounds i32, i32* %156, i64 %150
  store i32 65533, i32* %157, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %158 = add i64 %150, 1
  store i64 %158, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %159 = trunc i64 %158 to i32
  br label %for.inc

for.inc:
  %160 = load i32, i32* %k.addr, align 4
  %161 = add nsw i32 %160, 1
  store i32 %161, i32* %k.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.end:
  %162 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  ret %struct.nish_array* %162
}

define internal noundef nonnull align 8 i8* @nish.termBytesText(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %n) #3 {
entry:
  %held.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %pieces.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %left.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %chr.1 = alloca i8, align 1
  %chr.2 = alloca i8, align 1
  %chr.3 = alloca i8, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %held.addr, align 4
  store i32 %n, i32* %end.addr, align 4
  %3 = load i32, i32* %end.addr, align 4
  %4 = load i32, i32* %held.addr, align 4
  %5 = icmp sgt i32 %3, %4
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %held.addr, align 4
  store i32 %6, i32* %end.addr, align 4
  br label %if.end

if.end:
  %7 = load i32, i32* %end.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  store i32 0, i32* %end.addr, align 4
  br label %if.end.1

if.end.1:
  %9 = call i1 @nish.termNativeStrings()
  br i1 %9, label %if.then.2, label %if.end.2

if.then.2:
  %10 = load i32, i32* %end.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ule i64 0, %11
  %15 = icmp ule i64 %11, %13
  %16 = and i1 %14, %15
  br i1 %16, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %11, i64 %13)
  unreachable

bytes.ok:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  %20 = sub i64 %11, 0
  %21 = call i8* @nish_str_new(i8* %19, i64 %20)
  ret i8* %21

if.end.2:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pieces.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %25 = load i32, i32* %i.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %27 = load i32, i32* %i.addr, align 4
  %28 = load i32, i32* %end.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.1

land.end.1:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs.1 ]
  br i1 %30, label %land.rhs, label %land.end

land.rhs:
  %31 = load i32, i32* %i.addr, align 4
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  %35 = icmp slt i32 %31, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %land.end.1 ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %i.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %38
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = zext i8 %43 to i32
  store i32 %44, i32* %c.addr, align 4
  %45 = load i32, i32* %i.addr, align 4
  %46 = add nsw i32 %45, 1
  store i32 %46, i32* %i.addr, align 4
  %47 = load i32, i32* %c.addr, align 4
  %48 = icmp slt i32 %47, 128
  br i1 %48, label %if.then.3, label %if.end.3

if.then.3:
  %49 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %50 = load i32, i32* %c.addr, align 4
  %51 = sext i32 %50 to i64
  %52 = trunc i64 %51 to i8
  store i8 %52, i8* %chr, align 1
  %53 = call i8* @nish_str_new(i8* %chr, i64 1)
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = icmp eq i64 %55, %57
  br i1 %58, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %49, i64 8)
  br label %push.store

push.store:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to i8**
  %62 = getelementptr inbounds i8*, i8** %61, i64 %55
  store i8* %53, i8** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %63 = add i64 %55, 1
  store i64 %63, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = trunc i64 %63 to i32
  br label %while.cond

if.end.3:
  %65 = load i32, i32* %c.addr, align 4
  %66 = call i32 @nish.termLeadWidth(i32 %65)
  store i32 %66, i32* %width.addr, align 4
  %67 = load i32, i32* %width.addr, align 4
  %68 = icmp eq i32 %67, 1
  br i1 %68, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %69 = load i32, i32* %c.addr, align 4
  %70 = load i32, i32* %width.addr, align 4
  %71 = call i32 @nish.termLeadBits(i32 %69, i32 %70)
  br label %cond.end

cond.end:
  %72 = phi i32 [ 65533, %cond.true ], [ %71, %cond.false ]
  store i32 %72, i32* %cp.addr, align 4
  store i32 0, i32* %left.addr, align 4
  %73 = load i32, i32* %width.addr, align 4
  %74 = icmp sgt i32 %73, 1
  br i1 %74, label %if.then.4, label %if.end.4

if.then.4:
  %75 = load i32, i32* %width.addr, align 4
  %76 = sub nsw i32 %75, 1
  store i32 %76, i32* %left.addr, align 4
  br label %if.end.4

if.end.4:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %81 = load i32, i32* %left.addr, align 4
  %82 = icmp sgt i32 %81, 0
  br i1 %82, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %83 = load i32, i32* %i.addr, align 4
  %84 = icmp sge i32 %83, 0
  br label %land.end.4

land.end.4:
  %85 = phi i1 [ false, %while.cond.1 ], [ %84, %land.rhs.4 ]
  br i1 %85, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %86 = load i32, i32* %i.addr, align 4
  %87 = load i32, i32* %end.addr, align 4
  %88 = icmp slt i32 %86, %87
  br label %land.end.3

land.end.3:
  %89 = phi i1 [ false, %land.end.4 ], [ %88, %land.rhs.3 ]
  br i1 %89, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %90 = load i32, i32* %i.addr, align 4
  %91 = trunc i64 %78 to i32
  %92 = icmp slt i32 %90, %91
  br label %land.end.2

land.end.2:
  %93 = phi i1 [ false, %land.end.3 ], [ %92, %land.rhs.2 ]
  br i1 %93, label %while.body.1, label %while.end.1

while.body.1:
  %94 = load i32, i32* %cp.addr, align 4
  %95 = shl i32 %94, 6
  %96 = load i32, i32* %i.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %80 to i8*
  %99 = getelementptr inbounds i8, i8* %98, i64 %97
  %100 = load i8, i8* %99, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %101 = zext i8 %100 to i32
  %102 = and i32 %101, 63
  %103 = or i32 %95, %102
  store i32 %103, i32* %cp.addr, align 4
  %104 = load i32, i32* %i.addr, align 4
  %105 = add nsw i32 %104, 1
  store i32 %105, i32* %i.addr, align 4
  %106 = load i32, i32* %left.addr, align 4
  %107 = sub nsw i32 %106, 1
  store i32 %107, i32* %left.addr, align 4
  br label %while.cond.1

while.end.1:
  %108 = load i32, i32* %cp.addr, align 4
  %109 = icmp sge i32 %108, 65536
  br i1 %109, label %if.then.5, label %if.else

if.then.5:
  %110 = load i32, i32* %cp.addr, align 4
  %111 = sub nsw i32 %110, 65536
  store i32 %111, i32* %v.addr, align 4
  %112 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %113 = load i32, i32* %v.addr, align 4
  %114 = ashr i32 %113, 10
  %115 = add nsw i32 %114, 55296
  %116 = sext i32 %115 to i64
  %117 = trunc i64 %116 to i8
  store i8 %117, i8* %chr.1, align 1
  %118 = call i8* @nish_str_new(i8* %chr.1, i64 1)
  %119 = load i32, i32* %v.addr, align 4
  %120 = and i32 %119, 1023
  %121 = add nsw i32 %120, 56320
  %122 = sext i32 %121 to i64
  %123 = trunc i64 %122 to i8
  store i8 %123, i8* %chr.2, align 1
  %124 = call i8* @nish_str_new(i8* %chr.2, i64 1)
  %125 = call i8* @nish_str_concat(i8* %118, i8* %124)
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 1
  %129 = load i64, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %130 = icmp eq i64 %127, %129
  br i1 %130, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %112, i64 8)
  br label %push.store.1

push.store.1:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %133 = bitcast i8* %132 to i8**
  %134 = getelementptr inbounds i8*, i8** %133, i64 %127
  store i8* %125, i8** %134, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %135 = add i64 %127, 1
  store i64 %135, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = trunc i64 %135 to i32
  br label %if.end.5

if.else:
  %137 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %138 = load i32, i32* %cp.addr, align 4
  %139 = sext i32 %138 to i64
  %140 = trunc i64 %139 to i8
  store i8 %140, i8* %chr.3, align 1
  %141 = call i8* @nish_str_new(i8* %chr.3, i64 1)
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 1
  %145 = load i64, i64* %144, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %146 = icmp eq i64 %143, %145
  br i1 %146, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %137, i64 8)
  br label %push.store.2

push.store.2:
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %149 = bitcast i8* %148 to i8**
  %150 = getelementptr inbounds i8*, i8** %149, i64 %143
  store i8* %141, i8** %150, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %151 = add i64 %143, 1
  store i64 %151, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %152 = trunc i64 %151 to i32
  br label %if.end.5

if.end.5:
  br label %while.cond

while.end:
  %153 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.12 to i8*) to i64*
  %157 = load i64, i64* %156, align 8
  %158 = sub i64 %155, 1
  %159 = mul i64 %157, %158
  %160 = icmp eq i64 %155, 0
  %161 = select i1 %160, i64 0, i64 %159
  store i64 %161, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %162 = load i64, i64* %join.at, align 8
  %163 = icmp ult i64 %162, %155
  br i1 %163, label %join.sum.body, label %join.copy

join.sum.body:
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 2
  %165 = load i8*, i8** %164, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %166 = bitcast i8* %165 to i8**
  %167 = getelementptr inbounds i8*, i8** %166, i64 %162
  %168 = load i8*, i8** %167, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %169 = load i64, i64* %join.total, align 8
  %170 = bitcast i8* %168 to i64*
  %171 = load i64, i64* %170, align 8
  %172 = add i64 %169, %171
  store i64 %172, i64* %join.total, align 8
  %173 = add i64 %162, 1
  store i64 %173, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %174 = load i64, i64* %join.total, align 8
  %175 = icmp ugt i64 %174, 2147483647
  %176 = add i64 %174, 9
  %177 = select i1 %175, i64 4611686018427387904, i64 %176
  %178 = call i8* @nish_alloc_struct(i64 %177)
  %179 = bitcast i8* %178 to i64*
  store i64 %174, i64* %179, align 8
  %180 = getelementptr inbounds i8, i8* %178, i64 8
  store i8* %180, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %181 = load i64, i64* %join.at, align 8
  %182 = icmp ult i64 %181, %155
  br i1 %182, label %join.part, label %join.end

join.part:
  %183 = load i8*, i8** %join.p, align 8
  %184 = icmp eq i64 %181, 0
  %185 = select i1 %184, i64 0, i64 %157
  %186 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.12 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %183, i8* %186, i64 %185, i1 false)
  %187 = getelementptr inbounds i8, i8* %183, i64 %185
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %153, i64 0, i32 2
  %189 = load i8*, i8** %188, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %190 = bitcast i8* %189 to i8**
  %191 = getelementptr inbounds i8*, i8** %190, i64 %181
  %192 = load i8*, i8** %191, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %193 = bitcast i8* %192 to i64*
  %194 = load i64, i64* %193, align 8
  %195 = getelementptr inbounds i8, i8* %192, i64 8
  %196 = icmp eq i64 %194, 1
  br i1 %196, label %join.byte, label %join.bulk

join.byte:
  %197 = load i8, i8* %195, align 1
  store i8 %197, i8* %187, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %187, i8* %195, i64 %194, i1 false)
  br label %join.next

join.next:
  %198 = getelementptr inbounds i8, i8* %187, i64 %194
  store i8* %198, i8** %join.p, align 8
  %199 = add i64 %181, 1
  store i64 %199, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %200 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %200, align 1
  ret i8* %178
}

define void @nish.Screen.constructor(%struct.Screen* noundef nonnull noalias align 8 dereferenceable(88) nocapture %this, i32 noundef %width, i32 noundef %height, i1 noundef zeroext %palette256) #3 {
entry:
  %0 = icmp slt i32 %width, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ %width, %cond.false ]
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  store i32 %1, i32* %2, align 4, !tbaa !23
  %3 = icmp slt i32 %height, 0
  br i1 %3, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 0, %cond.true.1 ], [ %height, %cond.false.1 ]
  %5 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  store i32 %4, i32* %5, align 4, !tbaa !24
  %6 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  store i1 %palette256, i1* %6, align 1, !tbaa !25
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  store i1 false, i1* %7, align 1, !tbaa !26
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %13, align 8, !tbaa !27
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !28
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !29
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !30
  %32 = call i8* @nish_alloc_struct(i64 24)
  %33 = bitcast i8* %32 to %struct.nish_array*
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  store i64 0, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  store i64 0, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  store i8* null, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  store %struct.nish_array* %33, %struct.nish_array** %37, align 8, !tbaa !31
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 0, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 0, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* null, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  store %struct.nish_array* %39, %struct.nish_array** %43, align 8, !tbaa !32
  %44 = call i8* @nish_alloc_struct(i64 24)
  %45 = bitcast i8* %44 to %struct.nish_array*
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  store i64 0, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  store i64 0, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  store i8* null, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  store %struct.nish_array* %45, %struct.nish_array** %49, align 8, !tbaa !33
  %50 = call i8* @nish_alloc_struct(i64 24)
  %51 = bitcast i8* %50 to %struct.nish_array*
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  store i64 0, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  store i64 0, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  store i8* null, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  store %struct.nish_array* %51, %struct.nish_array** %55, align 8, !tbaa !34
  %56 = call i8* @nish_alloc_struct(i64 24)
  %57 = bitcast i8* %56 to %struct.nish_array*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  store i64 0, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 1
  store i64 0, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  store i8* null, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  store %struct.nish_array* %57, %struct.nish_array** %61, align 8, !tbaa !35
  %62 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %62, align 4, !tbaa !36
  %63 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %64 = load i32, i32* %63, align 4, !tbaa !23
  %65 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %66 = load i32, i32* %65, align 4, !tbaa !24
  call void @nish.Screen.resize(%struct.Screen* %this, i32 %64, i32 %66)
  ret void
}

define void @nish.Screen.resize(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %width, i32 noundef %height) #3 {
entry:
  %w.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %cells.addr = alloca i32, align 4
  %0 = call i32 @nish.termSide(i32 %width)
  store i32 %0, i32* %w.addr, align 4
  %1 = load i32, i32* %w.addr, align 4
  %2 = call i32 @nish.termSide(i32 %height)
  %3 = call i32 @nish.termFitRows(i32 %1, i32 %2)
  store i32 %3, i32* %h.addr, align 4
  %4 = load i32, i32* %w.addr, align 4
  %5 = load i32, i32* %h.addr, align 4
  %6 = call i32 @nish.termCellCount(i32 %4, i32 %5)
  store i32 %6, i32* %cells.addr, align 4
  %7 = load i32, i32* %w.addr, align 4
  %8 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  store i32 %7, i32* %8, align 4, !tbaa !23
  %9 = load i32, i32* %h.addr, align 4
  %10 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  store i32 %9, i32* %10, align 4, !tbaa !24
  %11 = load i32, i32* %cells.addr, align 4
  %12 = call %struct.nish_array* @nish.termCells(i32 %11, i32 32)
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  store %struct.nish_array* %12, %struct.nish_array** %13, align 8, !tbaa !27
  %14 = load i32, i32* %cells.addr, align 4
  %15 = call %struct.nish_array* @nish.termCells(i32 %14, i32 -1)
  %16 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  store %struct.nish_array* %15, %struct.nish_array** %16, align 8, !tbaa !28
  %17 = load i32, i32* %cells.addr, align 4
  %18 = call %struct.nish_array* @nish.termCells(i32 %17, i32 -1)
  %19 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  store %struct.nish_array* %18, %struct.nish_array** %19, align 8, !tbaa !29
  %20 = load i32, i32* %cells.addr, align 4
  %21 = call %struct.nish_array* @nish.termCells(i32 %20, i32 0)
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  store %struct.nish_array* %21, %struct.nish_array** %22, align 8, !tbaa !30
  %23 = load i32, i32* %cells.addr, align 4
  %24 = call %struct.nish_array* @nish.termCells(i32 %23, i32 -1)
  %25 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  store %struct.nish_array* %24, %struct.nish_array** %25, align 8, !tbaa !31
  %26 = load i32, i32* %cells.addr, align 4
  %27 = call %struct.nish_array* @nish.termCells(i32 %26, i32 -1)
  %28 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  store %struct.nish_array* %27, %struct.nish_array** %28, align 8, !tbaa !32
  %29 = load i32, i32* %cells.addr, align 4
  %30 = call %struct.nish_array* @nish.termCells(i32 %29, i32 -1)
  %31 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !33
  %32 = load i32, i32* %cells.addr, align 4
  %33 = call %struct.nish_array* @nish.termCells(i32 %32, i32 0)
  %34 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  store %struct.nish_array* %33, %struct.nish_array** %34, align 8, !tbaa !34
  %35 = load i32, i32* %cells.addr, align 4
  %36 = call %struct.nish_array* @nish.termFlushRoom(i32 %35)
  %37 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  store %struct.nish_array* %36, %struct.nish_array** %37, align 8, !tbaa !35
  ret void
}

define void @nish.Screen.clear(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %background) #2 {
entry:
  %fill.at = alloca i64, align 8
  %fill.at.1 = alloca i64, align 8
  %fill.at.2 = alloca i64, align 8
  %fill.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !28
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %15 = load i64, i64* %fill.at.1, align 8
  %16 = icmp slt i64 %15, %14
  br i1 %16, label %fill.body.1, label %fill.end.1

fill.body.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %15
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !29
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.cond.2:
  %26 = load i64, i64* %fill.at.2, align 8
  %27 = icmp slt i64 %26, %25
  br i1 %27, label %fill.body.2, label %fill.end.2

fill.body.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %26
  store i32 %background, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !30
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.cond.3:
  %37 = load i64, i64* %fill.at.3, align 8
  %38 = icmp slt i64 %37, %36
  br i1 %38, label %fill.body.3, label %fill.end.3

fill.body.3:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %37
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %37, 1
  store i64 %43, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.end.3:
  ret void
}

define void @nish.Screen.invalidate(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this) #2 {
entry:
  %fill.at = alloca i64, align 8
  %fill.at.1 = alloca i64, align 8
  %fill.at.2 = alloca i64, align 8
  %fill.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !31
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 -1, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !32
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %15 = load i64, i64* %fill.at.1, align 8
  %16 = icmp slt i64 %15, %14
  br i1 %16, label %fill.body.1, label %fill.end.1

fill.body.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %15
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !33
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.cond.2:
  %26 = load i64, i64* %fill.at.2, align 8
  %27 = icmp slt i64 %26, %25
  br i1 %27, label %fill.body.2, label %fill.end.2

fill.body.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %26
  store i32 -1, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !34
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.cond.3:
  %37 = load i64, i64* %fill.at.3, align 8
  %38 = icmp slt i64 %37, %36
  br i1 %38, label %fill.body.3, label %fill.end.3

fill.body.3:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %37
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %37, 1
  store i64 %43, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.end.3:
  ret void
}

define void @nish.Screen.set(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %glyph, i32 noundef %fg, i32 noundef %bg, i32 noundef %attrs) #2 {
entry:
  %glyphs.addr = alloca %struct.nish_array*, align 8
  %fgs.addr = alloca %struct.nish_array*, align 8
  %bgs.addr = alloca %struct.nish_array*, align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  store %struct.nish_array* %1, %struct.nish_array** %glyphs.addr, align 8
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !28
  store %struct.nish_array* %3, %struct.nish_array** %fgs.addr, align 8
  %4 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !29
  store %struct.nish_array* %5, %struct.nish_array** %bgs.addr, align 8
  %6 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !30
  store %struct.nish_array* %7, %struct.nish_array** %kept.addr, align 8
  %8 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %9 = load i32, i32* %8, align 4, !tbaa !23
  %10 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %11 = load i32, i32* %10, align 4, !tbaa !24
  %12 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %16 = call i32 @nish.termShortest(%struct.nish_array* %12, %struct.nish_array* %13, %struct.nish_array* %14, %struct.nish_array* %15)
  %17 = call i32 @nish.termGridAt(i32 %x, i32 %y, i32 %9, i32 %11, i32 %16)
  store i32 %17, i32* %i.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %20 = load i32, i32* %i.addr, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = trunc i64 %23 to i32
  %25 = icmp slt i32 %20, %24
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %entry ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %i.addr, align 4
  %28 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = icmp slt i32 %27, %31
  br label %land.end.2

land.end.2:
  %33 = phi i1 [ false, %land.end.3 ], [ %32, %land.rhs.2 ]
  br i1 %33, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %34 = load i32, i32* %i.addr, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = icmp slt i32 %34, %38
  br label %land.end.1

land.end.1:
  %40 = phi i1 [ false, %land.end.2 ], [ %39, %land.rhs.1 ]
  br i1 %40, label %land.rhs, label %land.end

land.rhs:
  %41 = load i32, i32* %i.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = icmp slt i32 %41, %45
  br label %land.end

land.end:
  %47 = phi i1 [ false, %land.end.1 ], [ %46, %land.rhs ]
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %49 = load i32, i32* %i.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 %50
  store i32 %glyph, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %56 = load i32, i32* %i.addr, align 4
  %57 = sext i32 %56 to i64
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %57
  store i32 %fg, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %63 = load i32, i32* %i.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %64
  store i32 %bg, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %70 = load i32, i32* %i.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = or i32 1, 2
  %73 = and i32 %attrs, %72
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 %71
  store i32 %73, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish.Screen.text(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y, i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %fg, i32 noundef %bg, i32 noundef %attrs) #3 {
entry:
  %column.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 %x, i32* %column.addr, align 4
  %0 = call %struct.nish_array* @nish.termCodePoints(i8* %s)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %1 = load i64, i64* %forof.idx, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %forof.body, label %forof.end

forof.body:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %9, i32* %cp.addr, align 4
  %10 = load i32, i32* %column.addr, align 4
  %11 = load i32, i32* %cp.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %this, i32 %10, i32 %y, i32 %11, i32 %fg, i32 %bg, i32 %attrs)
  %12 = load i32, i32* %column.addr, align 4
  %13 = icmp slt i32 %12, 2147483647
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = load i32, i32* %column.addr, align 4
  %15 = add nsw i32 %14, 1
  br label %cond.end

cond.false:
  %16 = load i32, i32* %column.addr, align 4
  br label %cond.end

cond.end:
  %17 = phi i32 [ %15, %cond.true ], [ %16, %cond.false ]
  store i32 %17, i32* %column.addr, align 4
  br label %forof.inc

forof.inc:
  %18 = load i64, i64* %forof.idx, align 8
  %19 = add i64 %18, 1
  store i64 %19, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %20 = load i32, i32* %column.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %20
}

define noundef i32 @nish.Screen.glyphAt(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %glyphs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  store %struct.nish_array* %1, %struct.nish_array** %glyphs.addr, align 8
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %3 = load i32, i32* %2, align 4, !tbaa !23
  %4 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %5 = load i32, i32* %4, align 4, !tbaa !24
  %6 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = call i32 @nish.termGridAt(i32 %x, i32 %y, i32 %3, i32 %5, i32 %9)
  store i32 %10, i32* %i.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = icmp sge i32 %11, 0
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = icmp slt i32 %13, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %entry ], [ %18, %land.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %22
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %27

if.end:
  ret i32 -1
}

define void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %b) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %at.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %3 = load i32, i32* %2, align 4, !tbaa !36
  store i32 %3, i32* %at.addr, align 4
  %4 = load i32, i32* %at.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %at.addr, align 4
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %6, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %entry ], [ %11, %land.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %14 = load i32, i32* %at.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = trunc i32 %b to i8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %15
  store i8 %16, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %21 = load i32, i32* %at.addr, align 4
  %22 = add nsw i32 %21, 1
  %23 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 %22, i32* %23, align 4, !tbaa !36
  br label %if.end

if.end:
  ret void
}

define void @nish.Screen.putDecimal(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %v) #3 {
entry:
  %0 = icmp slt i32 %v, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %1 = icmp sge i32 %v, 10
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  %2 = sdiv i32 %v, 10
  %3 = or i32 %2, 0
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %3)
  br label %if.end.1

if.end.1:
  %4 = srem i32 %v, 10
  %5 = add nsw i32 %4, 48
  call void @nish.Screen.put(%struct.Screen* %this, i32 %5)
  ret void
}

define void @nish.Screen.putSyncMode(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %final) #3 {
entry:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  call void @nish.Screen.put(%struct.Screen* %this, i32 63)
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 2026)
  call void @nish.Screen.put(%struct.Screen* %this, i32 %final)
  ret void
}

define void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %cp) #2 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp sge i32 %cp, 32
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %cp, 127
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.else

if.then:
  call void @nish.Screen.put(%struct.Screen* %this, i32 %cp)
  br label %if.end

if.else:
  %3 = icmp sge i32 %cp, 160
  br i1 %3, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %4 = icmp slt i32 %cp, 2048
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %if.else ], [ %4, %land.rhs.1 ]
  br i1 %5, label %if.then.1, label %if.else.1

if.then.1:
  %6 = ashr i32 %cp, 6
  %7 = or i32 %6, 192
  call void @nish.Screen.put(%struct.Screen* %this, i32 %7)
  %8 = and i32 %cp, 63
  %9 = or i32 %8, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %9)
  br label %if.end.1

if.else.1:
  %10 = icmp sge i32 %cp, 65536
  br i1 %10, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %11 = icmp slt i32 %cp, 1114112
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %if.else.1 ], [ %11, %land.rhs.2 ]
  br i1 %12, label %if.then.2, label %if.else.2

if.then.2:
  %13 = ashr i32 %cp, 18
  %14 = or i32 %13, 240
  call void @nish.Screen.put(%struct.Screen* %this, i32 %14)
  %15 = ashr i32 %cp, 12
  %16 = and i32 %15, 63
  %17 = or i32 %16, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %17)
  %18 = ashr i32 %cp, 6
  %19 = and i32 %18, 63
  %20 = or i32 %19, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %20)
  %21 = and i32 %cp, 63
  %22 = or i32 %21, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %22)
  br label %if.end.2

if.else.2:
  %23 = icmp sge i32 %cp, 2048
  br i1 %23, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %24 = icmp slt i32 %cp, 65536
  br label %land.end.4

land.end.4:
  %25 = phi i1 [ false, %if.else.2 ], [ %24, %land.rhs.4 ]
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = icmp sge i32 %cp, 55296
  br i1 %26, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %27 = icmp slt i32 %cp, 57344
  br label %land.end.5

land.end.5:
  %28 = phi i1 [ false, %land.rhs.3 ], [ %27, %land.rhs.5 ]
  %29 = xor i1 %28, true
  br label %land.end.3

land.end.3:
  %30 = phi i1 [ false, %land.end.4 ], [ %29, %land.end.5 ]
  br i1 %30, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %31 = phi i32 [ %cp, %cond.true ], [ 65533, %cond.false ]
  store i32 %31, i32* %c.addr, align 4
  %32 = load i32, i32* %c.addr, align 4
  %33 = ashr i32 %32, 12
  %34 = or i32 %33, 224
  call void @nish.Screen.put(%struct.Screen* %this, i32 %34)
  %35 = load i32, i32* %c.addr, align 4
  %36 = ashr i32 %35, 6
  %37 = and i32 %36, 63
  %38 = or i32 %37, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %38)
  %39 = load i32, i32* %c.addr, align 4
  %40 = and i32 %39, 63
  %41 = or i32 %40, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %41)
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void
}

define void @nish.Screen.putDecimalAfter(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %v) #3 {
entry:
  %rest.addr = alloca i32, align 4
  %digit.addr = alloca i32, align 4
  %0 = icmp slt i32 %v, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %1 = sdiv i32 %v, 10
  %2 = or i32 %1, 0
  store i32 %2, i32* %rest.addr, align 4
  %3 = srem i32 %v, 10
  store i32 %3, i32* %digit.addr, align 4
  %4 = load i32, i32* %digit.addr, align 4
  %5 = icmp eq i32 %4, 9
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  %6 = load i32, i32* %rest.addr, align 4
  call void @nish.Screen.putDecimalAfter(%struct.Screen* %this, i32 %6)
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  ret void

if.end.1:
  %7 = load i32, i32* %rest.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = load i32, i32* %rest.addr, align 4
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %9)
  br label %if.end.2

if.end.2:
  %10 = load i32, i32* %digit.addr, align 4
  %11 = add nsw i32 48, %10
  %12 = add nsw i32 %11, 1
  call void @nish.Screen.put(%struct.Screen* %this, i32 %12)
  ret void
}

define void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %tens, i32 noundef %key) #3 {
entry:
  %0 = icmp eq i32 %tens, 30
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = add nsw i32 48, 3
  br label %cond.end

cond.false:
  %2 = add nsw i32 48, 4
  br label %cond.end

cond.end:
  %3 = phi i32 [ %1, %cond.true ], [ %2, %cond.false ]
  call void @nish.Screen.put(%struct.Screen* %this, i32 %3)
  %4 = icmp slt i32 %key, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = add nsw i32 48, 9
  call void @nish.Screen.put(%struct.Screen* %this, i32 %5)
  ret void

if.end:
  %6 = add nsw i32 48, 8
  call void @nish.Screen.put(%struct.Screen* %this, i32 %6)
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  %8 = load i1, i1* %7, align 1, !tbaa !25
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %9 = add nsw i32 48, 5
  call void @nish.Screen.put(%struct.Screen* %this, i32 %9)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %key)
  ret void

if.end.1:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %10 = add nsw i32 48, 2
  call void @nish.Screen.put(%struct.Screen* %this, i32 %10)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %11 = ashr i32 %key, 16
  %12 = and i32 %11, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %12)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %13 = ashr i32 %key, 8
  %14 = and i32 %13, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %14)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %15 = and i32 %key, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %15)
  ret void
}

define noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %colour) #0 {
entry:
  %0 = icmp slt i32 %colour, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  %2 = load i1, i1* %1, align 1, !tbaa !25
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = call i32 @nish.paletteIndex(i32 %colour)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ %3, %cond.true ], [ %colour, %cond.false ]
  ret i32 %4
}

define noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this) #3 {
entry:
  %w.addr = alloca i32, align 4
  %glyphs.addr = alloca %struct.nish_array*, align 8
  %fgs.addr = alloca %struct.nish_array*, align 8
  %bgs.addr = alloca %struct.nish_array*, align 8
  %attrs.addr = alloca %struct.nish_array*, align 8
  %sentGlyphs.addr = alloca %struct.nish_array*, align 8
  %sentFgs.addr = alloca %struct.nish_array*, align 8
  %sentBgs.addr = alloca %struct.nish_array*, align 8
  %sentAttrs.addr = alloca %struct.nish_array*, align 8
  %drawn.addr = alloca i32, align 4
  %sent.addr = alloca i32, align 4
  %room.addr = alloca i32, align 4
  %held.addr = alloca i32, align 4
  %cells.addr = alloca i32, align 4
  %opened.addr = alloca i32, align 4
  %styleFg.addr = alloca i32, align 4
  %styleBg.addr = alloca i32, align 4
  %styleAttrs.addr = alloca i32, align 4
  %cursor.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %glyph.addr = alloca i32, align 4
  %fg.addr = alloca i32, align 4
  %bg.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %fgKey.addr = alloca i32, align 4
  %bgKey.addr = alloca i32, align 4
  %gap.addr = alloca i32, align 4
  %bridged.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %first.addr = alloca i1, align 1
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %1 = load i32, i32* %0, align 4, !tbaa !23
  store i32 %1, i32* %w.addr, align 4
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %2, align 4, !tbaa !36
  %3 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !27
  store %struct.nish_array* %4, %struct.nish_array** %glyphs.addr, align 8
  %5 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !28
  store %struct.nish_array* %6, %struct.nish_array** %fgs.addr, align 8
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !29
  store %struct.nish_array* %8, %struct.nish_array** %bgs.addr, align 8
  %9 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !30
  store %struct.nish_array* %10, %struct.nish_array** %attrs.addr, align 8
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !31
  store %struct.nish_array* %12, %struct.nish_array** %sentGlyphs.addr, align 8
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !32
  store %struct.nish_array* %14, %struct.nish_array** %sentFgs.addr, align 8
  %15 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !33
  store %struct.nish_array* %16, %struct.nish_array** %sentBgs.addr, align 8
  %17 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !34
  store %struct.nish_array* %18, %struct.nish_array** %sentAttrs.addr, align 8
  %19 = load i32, i32* %w.addr, align 4
  %20 = icmp sle i32 %19, 0
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.12 to i8*)

if.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %25 = call i32 @nish.termShortest(%struct.nish_array* %21, %struct.nish_array* %22, %struct.nish_array* %23, %struct.nish_array* %24)
  store i32 %25, i32* %drawn.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %sentGlyphs.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %sentFgs.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %sentBgs.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %sentAttrs.addr, align 8
  %30 = call i32 @nish.termShortest(%struct.nish_array* %26, %struct.nish_array* %27, %struct.nish_array* %28, %struct.nish_array* %29)
  store i32 %30, i32* %sent.addr, align 4
  %31 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !35
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = sdiv i32 %35, 64
  %37 = or i32 %36, 0
  %38 = call i32 @nish.termCellLimit(i32 %37)
  %39 = sub nsw i32 %38, 1
  store i32 %39, i32* %room.addr, align 4
  %40 = load i32, i32* %sent.addr, align 4
  %41 = load i32, i32* %drawn.addr, align 4
  %42 = icmp slt i32 %40, %41
  br i1 %42, label %cond.true, label %cond.false

cond.true:
  %43 = load i32, i32* %sent.addr, align 4
  br label %cond.end

cond.false:
  %44 = load i32, i32* %drawn.addr, align 4
  br label %cond.end

cond.end:
  %45 = phi i32 [ %43, %cond.true ], [ %44, %cond.false ]
  store i32 %45, i32* %held.addr, align 4
  %46 = load i32, i32* %room.addr, align 4
  %47 = load i32, i32* %held.addr, align 4
  %48 = icmp slt i32 %46, %47
  br i1 %48, label %cond.true.1, label %cond.false.1

cond.true.1:
  %49 = load i32, i32* %room.addr, align 4
  br label %cond.end.1

cond.false.1:
  %50 = load i32, i32* %held.addr, align 4
  br label %cond.end.1

cond.end.1:
  %51 = phi i32 [ %49, %cond.true.1 ], [ %50, %cond.false.1 ]
  %52 = call i32 @nish.termCellLimit(i32 %51)
  store i32 %52, i32* %cells.addr, align 4
  %53 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  %54 = load i1, i1* %53, align 1, !tbaa !26
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Screen.putSyncMode(%struct.Screen* %this, i32 104)
  br label %if.end.1

if.end.1:
  %55 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %56 = load i32, i32* %55, align 4, !tbaa !36
  store i32 %56, i32* %opened.addr, align 4
  store i32 -2, i32* %styleFg.addr, align 4
  store i32 -2, i32* %styleBg.addr, align 4
  store i32 -2, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %cursor.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %57 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = load %struct.nish_array*, %struct.nish_array** %sentGlyphs.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = load %struct.nish_array*, %struct.nish_array** %sentFgs.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = load %struct.nish_array*, %struct.nish_array** %sentBgs.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %92 = load %struct.nish_array*, %struct.nish_array** %sentAttrs.addr, align 8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %97 = load i32, i32* %i.addr, align 4
  %98 = load i32, i32* %cells.addr, align 4
  %99 = icmp slt i32 %97, %98
  br i1 %99, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %100 = load i32, i32* %i.addr, align 4
  %101 = trunc i64 %59 to i32
  %102 = icmp slt i32 %100, %101
  br label %land.end.7

land.end.7:
  %103 = phi i1 [ false, %for.cond ], [ %102, %land.rhs.7 ]
  br i1 %103, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %104 = load i32, i32* %i.addr, align 4
  %105 = trunc i64 %64 to i32
  %106 = icmp slt i32 %104, %105
  br label %land.end.6

land.end.6:
  %107 = phi i1 [ false, %land.end.7 ], [ %106, %land.rhs.6 ]
  br i1 %107, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %108 = load i32, i32* %i.addr, align 4
  %109 = trunc i64 %69 to i32
  %110 = icmp slt i32 %108, %109
  br label %land.end.5

land.end.5:
  %111 = phi i1 [ false, %land.end.6 ], [ %110, %land.rhs.5 ]
  br i1 %111, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %112 = load i32, i32* %i.addr, align 4
  %113 = trunc i64 %74 to i32
  %114 = icmp slt i32 %112, %113
  br label %land.end.4

land.end.4:
  %115 = phi i1 [ false, %land.end.5 ], [ %114, %land.rhs.4 ]
  br i1 %115, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %116 = load i32, i32* %i.addr, align 4
  %117 = trunc i64 %79 to i32
  %118 = icmp slt i32 %116, %117
  br label %land.end.3

land.end.3:
  %119 = phi i1 [ false, %land.end.4 ], [ %118, %land.rhs.3 ]
  br i1 %119, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %120 = load i32, i32* %i.addr, align 4
  %121 = trunc i64 %84 to i32
  %122 = icmp slt i32 %120, %121
  br label %land.end.2

land.end.2:
  %123 = phi i1 [ false, %land.end.3 ], [ %122, %land.rhs.2 ]
  br i1 %123, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %124 = load i32, i32* %i.addr, align 4
  %125 = trunc i64 %89 to i32
  %126 = icmp slt i32 %124, %125
  br label %land.end.1

land.end.1:
  %127 = phi i1 [ false, %land.end.2 ], [ %126, %land.rhs.1 ]
  br i1 %127, label %land.rhs, label %land.end

land.rhs:
  %128 = load i32, i32* %i.addr, align 4
  %129 = trunc i64 %94 to i32
  %130 = icmp slt i32 %128, %129
  br label %land.end

land.end:
  %131 = phi i1 [ false, %land.end.1 ], [ %130, %land.rhs ]
  br i1 %131, label %for.body, label %for.end

for.body:
  %132 = load i32, i32* %i.addr, align 4
  %133 = sext i32 %132 to i64
  %134 = bitcast i8* %61 to i32*
  %135 = getelementptr inbounds i32, i32* %134, i64 %133
  %136 = load i32, i32* %135, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %136, i32* %glyph.addr, align 4
  %137 = load i32, i32* %i.addr, align 4
  %138 = sext i32 %137 to i64
  %139 = bitcast i8* %66 to i32*
  %140 = getelementptr inbounds i32, i32* %139, i64 %138
  %141 = load i32, i32* %140, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %141, i32* %fg.addr, align 4
  %142 = load i32, i32* %i.addr, align 4
  %143 = sext i32 %142 to i64
  %144 = bitcast i8* %71 to i32*
  %145 = getelementptr inbounds i32, i32* %144, i64 %143
  %146 = load i32, i32* %145, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %146, i32* %bg.addr, align 4
  %147 = load i32, i32* %i.addr, align 4
  %148 = sext i32 %147 to i64
  %149 = bitcast i8* %76 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 %148
  %151 = load i32, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %151, i32* %at.addr, align 4
  %152 = load i32, i32* %glyph.addr, align 4
  %153 = load i32, i32* %i.addr, align 4
  %154 = sext i32 %153 to i64
  %155 = bitcast i8* %81 to i32*
  %156 = getelementptr inbounds i32, i32* %155, i64 %154
  %157 = load i32, i32* %156, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %158 = icmp eq i32 %152, %157
  br i1 %158, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %159 = load i32, i32* %fg.addr, align 4
  %160 = load i32, i32* %i.addr, align 4
  %161 = sext i32 %160 to i64
  %162 = bitcast i8* %86 to i32*
  %163 = getelementptr inbounds i32, i32* %162, i64 %161
  %164 = load i32, i32* %163, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %165 = icmp eq i32 %159, %164
  br label %land.end.10

land.end.10:
  %166 = phi i1 [ false, %for.body ], [ %165, %land.rhs.10 ]
  br i1 %166, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %167 = load i32, i32* %bg.addr, align 4
  %168 = load i32, i32* %i.addr, align 4
  %169 = sext i32 %168 to i64
  %170 = bitcast i8* %91 to i32*
  %171 = getelementptr inbounds i32, i32* %170, i64 %169
  %172 = load i32, i32* %171, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %173 = icmp eq i32 %167, %172
  br label %land.end.9

land.end.9:
  %174 = phi i1 [ false, %land.end.10 ], [ %173, %land.rhs.9 ]
  br i1 %174, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %175 = load i32, i32* %at.addr, align 4
  %176 = load i32, i32* %i.addr, align 4
  %177 = sext i32 %176 to i64
  %178 = bitcast i8* %96 to i32*
  %179 = getelementptr inbounds i32, i32* %178, i64 %177
  %180 = load i32, i32* %179, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %181 = icmp eq i32 %175, %180
  br label %land.end.8

land.end.8:
  %182 = phi i1 [ false, %land.end.9 ], [ %181, %land.rhs.8 ]
  br i1 %182, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.inc

if.end.2:
  %183 = load i32, i32* %i.addr, align 4
  %184 = load i32, i32* %w.addr, align 4
  %185 = sdiv i32 %183, %184
  %186 = or i32 %185, 0
  store i32 %186, i32* %row.addr, align 4
  %187 = load i32, i32* %i.addr, align 4
  %188 = load i32, i32* %w.addr, align 4
  %189 = srem i32 %187, %188
  store i32 %189, i32* %col.addr, align 4
  %190 = load i32, i32* %fg.addr, align 4
  %191 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %190)
  store i32 %191, i32* %fgKey.addr, align 4
  %192 = load i32, i32* %bg.addr, align 4
  %193 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %192)
  store i32 %193, i32* %bgKey.addr, align 4
  %194 = load i32, i32* %cursor.addr, align 4
  %195 = load i32, i32* %i.addr, align 4
  %196 = icmp ne i32 %194, %195
  br i1 %196, label %if.then.3, label %if.end.3

if.then.3:
  store i32 0, i32* %gap.addr, align 4
  %197 = load i32, i32* %cursor.addr, align 4
  %198 = icmp sge i32 %197, 0
  br i1 %198, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %199 = load i32, i32* %cursor.addr, align 4
  %200 = load i32, i32* %i.addr, align 4
  %201 = icmp slt i32 %199, %200
  br label %land.end.12

land.end.12:
  %202 = phi i1 [ false, %if.then.3 ], [ %201, %land.rhs.12 ]
  br i1 %202, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %203 = load i32, i32* %cursor.addr, align 4
  %204 = load i32, i32* %w.addr, align 4
  %205 = sdiv i32 %203, %204
  %206 = or i32 %205, 0
  %207 = load i32, i32* %row.addr, align 4
  %208 = icmp eq i32 %206, %207
  br label %land.end.11

land.end.11:
  %209 = phi i1 [ false, %land.end.12 ], [ %208, %land.rhs.11 ]
  br i1 %209, label %if.then.4, label %if.end.4

if.then.4:
  %210 = load i32, i32* %i.addr, align 4
  %211 = load i32, i32* %cursor.addr, align 4
  %212 = sub nsw i32 %210, %211
  store i32 %212, i32* %gap.addr, align 4
  br label %if.end.4

if.end.4:
  store i1 false, i1* %bridged.addr, align 1
  %213 = load i32, i32* %gap.addr, align 4
  %214 = icmp sgt i32 %213, 0
  br i1 %214, label %land.rhs.13, label %land.end.13

land.rhs.13:
  %215 = load i32, i32* %gap.addr, align 4
  %216 = icmp sle i32 %215, 3
  br label %land.end.13

land.end.13:
  %217 = phi i1 [ false, %if.end.4 ], [ %216, %land.rhs.13 ]
  br i1 %217, label %if.then.5, label %if.end.5

if.then.5:
  store i1 true, i1* %bridged.addr, align 1
  %218 = load i32, i32* %i.addr, align 4
  %219 = load i32, i32* %gap.addr, align 4
  %220 = sub nsw i32 %218, %219
  store i32 %220, i32* %k.addr, align 4
  %221 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %221, i64 0, i32 2
  %223 = load i8*, i8** %222, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %224 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 2
  %226 = load i8*, i8** %225, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %227 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 2
  %229 = load i8*, i8** %228, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %230 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 2
  %232 = load i8*, i8** %231, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %233 = load i32, i32* %k.addr, align 4
  %234 = load i32, i32* %i.addr, align 4
  %235 = icmp slt i32 %233, %234
  br i1 %235, label %for.body.1, label %for.end.1

for.body.1:
  %236 = load i32, i32* %k.addr, align 4
  %237 = icmp sge i32 %236, 0
  %238 = xor i1 %237, true
  br i1 %238, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %239 = load i32, i32* %k.addr, align 4
  %240 = sext i32 %239 to i64
  %241 = bitcast i8* %223 to i32*
  %242 = getelementptr inbounds i32, i32* %241, i64 %240
  %243 = load i32, i32* %242, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %244 = icmp slt i32 %243, 32
  br label %lor.end.4

lor.end.4:
  %245 = phi i1 [ true, %for.body.1 ], [ %244, %lor.rhs.4 ]
  br i1 %245, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %246 = load i32, i32* %k.addr, align 4
  %247 = sext i32 %246 to i64
  %248 = bitcast i8* %223 to i32*
  %249 = getelementptr inbounds i32, i32* %248, i64 %247
  %250 = load i32, i32* %249, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %251 = icmp sge i32 %250, 127
  br label %lor.end.3

lor.end.3:
  %252 = phi i1 [ true, %lor.end.4 ], [ %251, %lor.rhs.3 ]
  br i1 %252, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %253 = load i32, i32* %k.addr, align 4
  %254 = sext i32 %253 to i64
  %255 = bitcast i8* %226 to i32*
  %256 = getelementptr inbounds i32, i32* %255, i64 %254
  %257 = load i32, i32* %256, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %258 = load i32, i32* %styleAttrs.addr, align 4
  %259 = icmp ne i32 %257, %258
  br label %lor.end.2

lor.end.2:
  %260 = phi i1 [ true, %lor.end.3 ], [ %259, %lor.rhs.2 ]
  br i1 %260, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %261 = load i32, i32* %k.addr, align 4
  %262 = sext i32 %261 to i64
  %263 = bitcast i8* %229 to i32*
  %264 = getelementptr inbounds i32, i32* %263, i64 %262
  %265 = load i32, i32* %264, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %266 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %265)
  %267 = load i32, i32* %styleFg.addr, align 4
  %268 = icmp ne i32 %266, %267
  br label %lor.end.1

lor.end.1:
  %269 = phi i1 [ true, %lor.end.2 ], [ %268, %lor.rhs.1 ]
  br i1 %269, label %lor.end, label %lor.rhs

lor.rhs:
  %270 = load i32, i32* %k.addr, align 4
  %271 = sext i32 %270 to i64
  %272 = bitcast i8* %232 to i32*
  %273 = getelementptr inbounds i32, i32* %272, i64 %271
  %274 = load i32, i32* %273, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %275 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %274)
  %276 = load i32, i32* %styleBg.addr, align 4
  %277 = icmp ne i32 %275, %276
  br label %lor.end

lor.end:
  %278 = phi i1 [ true, %lor.end.1 ], [ %277, %lor.rhs ]
  br i1 %278, label %if.then.6, label %if.end.6

if.then.6:
  store i1 false, i1* %bridged.addr, align 1
  br label %if.end.6

if.end.6:
  br label %for.inc.1

for.inc.1:
  %279 = load i32, i32* %k.addr, align 4
  %280 = add nsw i32 %279, 1
  store i32 %280, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %281 = load i1, i1* %bridged.addr, align 1
  br i1 %281, label %if.then.7, label %if.end.7

if.then.7:
  %282 = load i32, i32* %i.addr, align 4
  %283 = load i32, i32* %gap.addr, align 4
  %284 = sub nsw i32 %282, %283
  store i32 %284, i32* %k.addr.1, align 4
  %285 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %285, i64 0, i32 2
  %287 = load i8*, i8** %286, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %288 = load i32, i32* %k.addr.1, align 4
  %289 = load i32, i32* %i.addr, align 4
  %290 = icmp slt i32 %288, %289
  br i1 %290, label %for.body.2, label %for.end.2

for.body.2:
  %291 = load i32, i32* %k.addr.1, align 4
  %292 = icmp sge i32 %291, 0
  br i1 %292, label %if.then.8, label %if.end.8

if.then.8:
  %293 = load i32, i32* %k.addr.1, align 4
  %294 = sext i32 %293 to i64
  %295 = bitcast i8* %287 to i32*
  %296 = getelementptr inbounds i32, i32* %295, i64 %294
  %297 = load i32, i32* %296, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish.Screen.put(%struct.Screen* %this, i32 %297)
  br label %if.end.8

if.end.8:
  br label %for.inc.2

for.inc.2:
  %298 = load i32, i32* %k.addr.1, align 4
  %299 = add nsw i32 %298, 1
  store i32 %299, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.7

if.end.7:
  br label %if.end.5

if.end.5:
  %300 = load i1, i1* %bridged.addr, align 1
  %301 = xor i1 %300, true
  br i1 %301, label %if.then.9, label %if.end.9

if.then.9:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  %302 = load i32, i32* %gap.addr, align 4
  %303 = icmp sgt i32 %302, 0
  br i1 %303, label %if.then.10, label %if.else

if.then.10:
  %304 = load i32, i32* %gap.addr, align 4
  %305 = icmp sgt i32 %304, 1
  br i1 %305, label %if.then.11, label %if.end.11

if.then.11:
  %306 = load i32, i32* %gap.addr, align 4
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %306)
  br label %if.end.11

if.end.11:
  call void @nish.Screen.put(%struct.Screen* %this, i32 67)
  br label %if.end.10

if.else:
  %307 = load i32, i32* %row.addr, align 4
  %308 = icmp eq i32 %307, 0
  br i1 %308, label %land.rhs.14, label %land.end.14

land.rhs.14:
  %309 = load i32, i32* %col.addr, align 4
  %310 = icmp eq i32 %309, 0
  br label %land.end.14

land.end.14:
  %311 = phi i1 [ false, %if.else ], [ %310, %land.rhs.14 ]
  br i1 %311, label %if.then.12, label %if.else.1

if.then.12:
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.12

if.else.1:
  %312 = load i32, i32* %row.addr, align 4
  call void @nish.Screen.putDecimalAfter(%struct.Screen* %this, i32 %312)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %313 = load i32, i32* %col.addr, align 4
  call void @nish.Screen.putDecimalAfter(%struct.Screen* %this, i32 %313)
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.12

if.end.12:
  br label %if.end.10

if.end.10:
  br label %if.end.9

if.end.9:
  br label %if.end.3

if.end.3:
  %314 = load i32, i32* %fgKey.addr, align 4
  %315 = load i32, i32* %styleFg.addr, align 4
  %316 = icmp ne i32 %314, %315
  br i1 %316, label %lor.end.6, label %lor.rhs.6

lor.rhs.6:
  %317 = load i32, i32* %bgKey.addr, align 4
  %318 = load i32, i32* %styleBg.addr, align 4
  %319 = icmp ne i32 %317, %318
  br label %lor.end.6

lor.end.6:
  %320 = phi i1 [ true, %if.end.3 ], [ %319, %lor.rhs.6 ]
  br i1 %320, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %321 = load i32, i32* %at.addr, align 4
  %322 = load i32, i32* %styleAttrs.addr, align 4
  %323 = icmp ne i32 %321, %322
  br label %lor.end.5

lor.end.5:
  %324 = phi i1 [ true, %lor.end.6 ], [ %323, %lor.rhs.5 ]
  br i1 %324, label %if.then.13, label %if.end.13

if.then.13:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  store i1 true, i1* %first.addr, align 1
  %325 = load i32, i32* %styleAttrs.addr, align 4
  %326 = icmp eq i32 %325, -2
  br i1 %326, label %lor.end.7, label %lor.rhs.7

lor.rhs.7:
  %327 = load i32, i32* %styleAttrs.addr, align 4
  %328 = load i32, i32* %at.addr, align 4
  %329 = xor i32 %328, -1
  %330 = and i32 %327, %329
  %331 = icmp ne i32 %330, 0
  br label %lor.end.7

lor.end.7:
  %332 = phi i1 [ true, %if.then.13 ], [ %331, %lor.rhs.7 ]
  br i1 %332, label %if.then.14, label %if.end.14

if.then.14:
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  store i1 false, i1* %first.addr, align 1
  store i32 0, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %styleFg.addr, align 4
  store i32 -1, i32* %styleBg.addr, align 4
  br label %if.end.14

if.end.14:
  %333 = load i32, i32* %at.addr, align 4
  %334 = and i32 %333, 1
  %335 = icmp ne i32 %334, 0
  br i1 %335, label %land.rhs.15, label %land.end.15

land.rhs.15:
  %336 = load i32, i32* %styleAttrs.addr, align 4
  %337 = and i32 %336, 1
  %338 = icmp eq i32 %337, 0
  br label %land.end.15

land.end.15:
  %339 = phi i1 [ false, %if.end.14 ], [ %338, %land.rhs.15 ]
  br i1 %339, label %if.then.15, label %if.end.15

if.then.15:
  %340 = load i1, i1* %first.addr, align 1
  %341 = xor i1 %340, true
  br i1 %341, label %if.then.16, label %if.end.16

if.then.16:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.16

if.end.16:
  %342 = add nsw i32 48, 1
  call void @nish.Screen.put(%struct.Screen* %this, i32 %342)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.15

if.end.15:
  %343 = load i32, i32* %at.addr, align 4
  %344 = and i32 %343, 2
  %345 = icmp ne i32 %344, 0
  br i1 %345, label %land.rhs.16, label %land.end.16

land.rhs.16:
  %346 = load i32, i32* %styleAttrs.addr, align 4
  %347 = and i32 %346, 2
  %348 = icmp eq i32 %347, 0
  br label %land.end.16

land.end.16:
  %349 = phi i1 [ false, %if.end.15 ], [ %348, %land.rhs.16 ]
  br i1 %349, label %if.then.17, label %if.end.17

if.then.17:
  %350 = load i1, i1* %first.addr, align 1
  %351 = xor i1 %350, true
  br i1 %351, label %if.then.18, label %if.end.18

if.then.18:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.18

if.end.18:
  %352 = add nsw i32 48, 7
  call void @nish.Screen.put(%struct.Screen* %this, i32 %352)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.17

if.end.17:
  %353 = load i32, i32* %fgKey.addr, align 4
  %354 = load i32, i32* %styleFg.addr, align 4
  %355 = icmp ne i32 %353, %354
  br i1 %355, label %if.then.19, label %if.end.19

if.then.19:
  %356 = load i1, i1* %first.addr, align 1
  %357 = xor i1 %356, true
  br i1 %357, label %if.then.20, label %if.end.20

if.then.20:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.20

if.end.20:
  %358 = load i32, i32* %fgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 30, i32 %358)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.19

if.end.19:
  %359 = load i32, i32* %bgKey.addr, align 4
  %360 = load i32, i32* %styleBg.addr, align 4
  %361 = icmp ne i32 %359, %360
  br i1 %361, label %if.then.21, label %if.end.21

if.then.21:
  %362 = load i1, i1* %first.addr, align 1
  %363 = xor i1 %362, true
  br i1 %363, label %if.then.22, label %if.end.22

if.then.22:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.22

if.end.22:
  %364 = load i32, i32* %bgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 40, i32 %364)
  br label %if.end.21

if.end.21:
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  %365 = load i32, i32* %fgKey.addr, align 4
  store i32 %365, i32* %styleFg.addr, align 4
  %366 = load i32, i32* %bgKey.addr, align 4
  store i32 %366, i32* %styleBg.addr, align 4
  %367 = load i32, i32* %at.addr, align 4
  store i32 %367, i32* %styleAttrs.addr, align 4
  br label %if.end.13

if.end.13:
  %368 = load i32, i32* %glyph.addr, align 4
  call void @nish.Screen.putGlyph(%struct.Screen* %this, i32 %368)
  %369 = load i32, i32* %i.addr, align 4
  %370 = sext i32 %369 to i64
  %371 = load i32, i32* %glyph.addr, align 4
  %372 = bitcast i8* %81 to i32*
  %373 = getelementptr inbounds i32, i32* %372, i64 %370
  store i32 %371, i32* %373, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %374 = load i32, i32* %i.addr, align 4
  %375 = sext i32 %374 to i64
  %376 = load i32, i32* %fg.addr, align 4
  %377 = bitcast i8* %86 to i32*
  %378 = getelementptr inbounds i32, i32* %377, i64 %375
  store i32 %376, i32* %378, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %379 = load i32, i32* %i.addr, align 4
  %380 = sext i32 %379 to i64
  %381 = load i32, i32* %bg.addr, align 4
  %382 = bitcast i8* %91 to i32*
  %383 = getelementptr inbounds i32, i32* %382, i64 %380
  store i32 %381, i32* %383, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %384 = load i32, i32* %i.addr, align 4
  %385 = sext i32 %384 to i64
  %386 = load i32, i32* %at.addr, align 4
  %387 = bitcast i8* %96 to i32*
  %388 = getelementptr inbounds i32, i32* %387, i64 %385
  store i32 %386, i32* %388, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %389 = load i32, i32* %col.addr, align 4
  %390 = load i32, i32* %w.addr, align 4
  %391 = sub nsw i32 %390, 1
  %392 = icmp slt i32 %389, %391
  br i1 %392, label %cond.true.2, label %cond.false.2

cond.true.2:
  %393 = load i32, i32* %i.addr, align 4
  %394 = add nsw i32 %393, 1
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %395 = phi i32 [ %394, %cond.true.2 ], [ -1, %cond.false.2 ]
  store i32 %395, i32* %cursor.addr, align 4
  br label %for.inc

for.inc:
  %396 = load i32, i32* %i.addr, align 4
  %397 = add nsw i32 %396, 1
  store i32 %397, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %398 = load i32, i32* %styleAttrs.addr, align 4
  %399 = icmp ne i32 %398, -2
  br i1 %399, label %land.rhs.17, label %land.end.17

land.rhs.17:
  %400 = load i32, i32* %styleAttrs.addr, align 4
  %401 = icmp ne i32 %400, 0
  br i1 %401, label %lor.end.9, label %lor.rhs.9

lor.rhs.9:
  %402 = load i32, i32* %styleFg.addr, align 4
  %403 = icmp ne i32 %402, -1
  br label %lor.end.9

lor.end.9:
  %404 = phi i1 [ true, %land.rhs.17 ], [ %403, %lor.rhs.9 ]
  br i1 %404, label %lor.end.8, label %lor.rhs.8

lor.rhs.8:
  %405 = load i32, i32* %styleBg.addr, align 4
  %406 = icmp ne i32 %405, -1
  br label %lor.end.8

lor.end.8:
  %407 = phi i1 [ true, %lor.end.9 ], [ %406, %lor.rhs.8 ]
  br label %land.end.17

land.end.17:
  %408 = phi i1 [ false, %for.end ], [ %407, %lor.end.8 ]
  br i1 %408, label %if.then.23, label %if.end.23

if.then.23:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  br label %if.end.23

if.end.23:
  %409 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %410 = load i32, i32* %409, align 4, !tbaa !36
  %411 = load i32, i32* %opened.addr, align 4
  %412 = icmp eq i32 %410, %411
  br i1 %412, label %if.then.24, label %if.else.2

if.then.24:
  %413 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %413, align 4, !tbaa !36
  br label %if.end.24

if.else.2:
  %414 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  %415 = load i1, i1* %414, align 1, !tbaa !26
  br i1 %415, label %if.then.25, label %if.end.25

if.then.25:
  call void @nish.Screen.putSyncMode(%struct.Screen* %this, i32 108)
  br label %if.end.25

if.end.25:
  br label %if.end.24

if.end.24:
  %416 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %417 = load %struct.nish_array*, %struct.nish_array** %416, align 8, !tbaa !35
  %418 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %419 = load i32, i32* %418, align 4, !tbaa !36
  %420 = call i64 @nish_arena_mark()
  %421 = call i8* @nish.termBytesText(%struct.nish_array* %417, i32 %419)
  %422 = call i8* @nish_arena_keep(i64 %420, i8* %421)
  ret i8* %422
}

define void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.Screen* noundef nonnull align 8 dereferenceable(88) %screen) #2 {
entry:
  %w.addr = alloca i32, align 4
  %rows.addr = alloca i32, align 4
  %cells.addr = alloca i32, align 4
  %pixels.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 9
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = call i32 @nish.termSide(i32 %1)
  store i32 %2, i32* %w.addr, align 4
  %3 = load i32, i32* %w.addr, align 4
  %4 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 10
  %5 = load i32, i32* %4, align 4, !tbaa !24
  %6 = call i32 @nish.termSide(i32 %5)
  %7 = call i32 @nish.termFitRows(i32 %3, i32 %6)
  store i32 %7, i32* %rows.addr, align 4
  %8 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  store %struct.Screen* %screen, %struct.Screen** %8, align 8, !tbaa !38
  %9 = load i32, i32* %w.addr, align 4
  %10 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  store i32 %9, i32* %10, align 4, !tbaa !39
  %11 = load i32, i32* %rows.addr, align 4
  %12 = mul nsw i32 %11, 2
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  store i32 %12, i32* %13, align 4, !tbaa !40
  %14 = load i32, i32* %w.addr, align 4
  %15 = load i32, i32* %rows.addr, align 4
  %16 = call i32 @nish.termCellCount(i32 %14, i32 %15)
  store i32 %16, i32* %cells.addr, align 4
  %17 = load i32, i32* %cells.addr, align 4
  %18 = call %struct.nish_array* @nish.termCells(i32 %17, i32 -1)
  store %struct.nish_array* %18, %struct.nish_array** %pixels.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %19 = load i32, i32* %i.addr, align 4
  %20 = load i32, i32* %cells.addr, align 4
  %21 = icmp slt i32 %19, %20
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = icmp eq i64 %24, %26
  br i1 %27, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 4)
  br label %push.store

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %24
  store i32 -1, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = add i64 %24, 1
  store i64 %32, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %37 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  store %struct.nish_array* %36, %struct.nish_array** %37, align 8, !tbaa !41
  ret void
}

define void @nish.Canvas.clear(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %colour) #3 {
entry:
  %fill.at = alloca i64, align 8
  %rows.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !41
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 %colour, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %12 = load i32, i32* %11, align 4, !tbaa !40
  %13 = ashr i32 %12, 1
  store i32 %13, i32* %rows.addr, align 4
  store i32 0, i32* %row.addr, align 4
  br label %for.cond

for.cond:
  %14 = load i32, i32* %row.addr, align 4
  %15 = load i32, i32* %rows.addr, align 4
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  store i32 0, i32* %col.addr, align 4
  br label %for.cond.1

for.cond.1:
  %17 = load i32, i32* %col.addr, align 4
  %18 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !39
  %20 = icmp slt i32 %17, %19
  br i1 %20, label %for.body.1, label %for.end.1

for.body.1:
  %21 = load i32, i32* %col.addr, align 4
  %22 = load i32, i32* %row.addr, align 4
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %21, i32 %22)
  br label %for.inc.1

for.inc.1:
  %23 = load i32, i32* %col.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %col.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %row.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %row.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @nish.Canvas.pixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %pixels.addr = alloca %struct.nish_array*, align 8
  %at.addr = alloca i32, align 4
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !39
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !40
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !41
  store %struct.nish_array* %12, %struct.nish_array** %pixels.addr, align 8
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !39
  %15 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %16 = load i32, i32* %15, align 4, !tbaa !40
  %17 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = call i32 @nish.termGridAt(i32 %x, i32 %y, i32 %14, i32 %16, i32 %20)
  store i32 %21, i32* %at.addr, align 4
  %22 = load i32, i32* %at.addr, align 4
  %23 = icmp sge i32 %22, 0
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %at.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  %29 = icmp slt i32 %24, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %if.end ], [ %29, %land.rhs ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  %31 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %32 = load i32, i32* %at.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %33
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %38

if.end.1:
  ret i32 -1
}

define void @nish.Canvas.setPixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %colour) #2 {
entry:
  %pixels.addr = alloca %struct.nish_array*, align 8
  %at.addr = alloca i32, align 4
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !39
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !40
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !41
  store %struct.nish_array* %12, %struct.nish_array** %pixels.addr, align 8
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !39
  %15 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %16 = load i32, i32* %15, align 4, !tbaa !40
  %17 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = call i32 @nish.termGridAt(i32 %x, i32 %y, i32 %14, i32 %16, i32 %20)
  store i32 %21, i32* %at.addr, align 4
  %22 = load i32, i32* %at.addr, align 4
  %23 = icmp sge i32 %22, 0
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %at.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  %29 = icmp slt i32 %24, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %if.end ], [ %29, %land.rhs ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  %31 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %32 = load i32, i32* %at.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %33
  store i32 %colour, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.1

if.end.1:
  %38 = ashr i32 %y, 1
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %x, i32 %38)
  ret void
}

define void @nish.Canvas.fillRect(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %w, i32 noundef %h, i32 noundef %colour) #2 {
entry:
  %left.addr = alloca i32, align 4
  %top.addr = alloca i32, align 4
  %r.addr = alloca i64, align 8
  %b.addr = alloca i64, align 8
  %right.addr = alloca i32, align 4
  %bottom.addr = alloca i32, align 4
  %pixels.addr = alloca %struct.nish_array*, align 8
  %py.addr = alloca i32, align 4
  %px.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ %x, %cond.false ]
  store i32 %1, i32* %left.addr, align 4
  %2 = icmp slt i32 %y, 0
  br i1 %2, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %3 = phi i32 [ 0, %cond.true.1 ], [ %y, %cond.false.1 ]
  store i32 %3, i32* %top.addr, align 4
  %4 = sext i32 %x to i64
  %5 = sext i32 %w to i64
  %6 = add nsw i64 %4, %5
  store i64 %6, i64* %r.addr, align 8
  %7 = sext i32 %y to i64
  %8 = sext i32 %h to i64
  %9 = add nsw i64 %7, %8
  store i64 %9, i64* %b.addr, align 8
  store i32 0, i32* %right.addr, align 4
  %10 = load i64, i64* %r.addr, align 8
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !39
  %13 = sext i32 %12 to i64
  %14 = icmp sgt i64 %10, %13
  br i1 %14, label %if.then, label %if.else

if.then:
  %15 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !39
  store i32 %16, i32* %right.addr, align 4
  br label %if.end

if.else:
  %17 = load i64, i64* %r.addr, align 8
  %18 = sext i32 0 to i64
  %19 = icmp sgt i64 %17, %18
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load i64, i64* %r.addr, align 8
  %21 = trunc i64 %20 to i32
  store i32 %21, i32* %right.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  store i32 0, i32* %bottom.addr, align 4
  %22 = load i64, i64* %b.addr, align 8
  %23 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %24 = load i32, i32* %23, align 4, !tbaa !40
  %25 = sext i32 %24 to i64
  %26 = icmp sgt i64 %22, %25
  br i1 %26, label %if.then.2, label %if.else.1

if.then.2:
  %27 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %28 = load i32, i32* %27, align 4, !tbaa !40
  store i32 %28, i32* %bottom.addr, align 4
  br label %if.end.2

if.else.1:
  %29 = load i64, i64* %b.addr, align 8
  %30 = sext i32 0 to i64
  %31 = icmp sgt i64 %29, %30
  br i1 %31, label %if.then.3, label %if.end.3

if.then.3:
  %32 = load i64, i64* %b.addr, align 8
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %bottom.addr, align 4
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  %34 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !41
  store %struct.nish_array* %35, %struct.nish_array** %pixels.addr, align 8
  %36 = load i32, i32* %top.addr, align 4
  store i32 %36, i32* %py.addr, align 4
  %37 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %42 = load i32, i32* %py.addr, align 4
  %43 = load i32, i32* %bottom.addr, align 4
  %44 = icmp slt i32 %42, %43
  br i1 %44, label %for.body, label %for.end

for.body:
  %45 = load i32, i32* %left.addr, align 4
  store i32 %45, i32* %px.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %pixels.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %51 = load i32, i32* %px.addr, align 4
  %52 = load i32, i32* %right.addr, align 4
  %53 = icmp slt i32 %51, %52
  br i1 %53, label %for.body.1, label %for.end.1

for.body.1:
  %54 = load i32, i32* %px.addr, align 4
  %55 = load i32, i32* %py.addr, align 4
  %56 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %57 = load i32, i32* %56, align 4, !tbaa !39
  %58 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %59 = load i32, i32* %58, align 4, !tbaa !40
  %60 = trunc i64 %48 to i32
  %61 = call i32 @nish.termGridAt(i32 %54, i32 %55, i32 %57, i32 %59, i32 %60)
  store i32 %61, i32* %at.addr, align 4
  %62 = load i32, i32* %at.addr, align 4
  %63 = icmp sge i32 %62, 0
  br i1 %63, label %land.rhs, label %land.end

land.rhs:
  %64 = load i32, i32* %at.addr, align 4
  %65 = trunc i64 %48 to i32
  %66 = icmp slt i32 %64, %65
  br label %land.end

land.end:
  %67 = phi i1 [ false, %for.body.1 ], [ %66, %land.rhs ]
  br i1 %67, label %if.then.4, label %if.end.4

if.then.4:
  %68 = load i32, i32* %at.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = bitcast i8* %50 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %69
  store i32 %colour, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.4

if.end.4:
  br label %for.inc.1

for.inc.1:
  %72 = load i32, i32* %px.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %px.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %74 = load i32, i32* %py.addr, align 4
  %75 = add nsw i32 %74, 1
  store i32 %75, i32* %py.addr, align 4
  br label %for.cond

for.end:
  %76 = load i32, i32* %bottom.addr, align 4
  %77 = ashr i32 %76, 1
  %78 = load i32, i32* %bottom.addr, align 4
  %79 = and i32 %78, 1
  %80 = add nsw i32 %77, %79
  store i32 %80, i32* %end.addr, align 4
  %81 = load i32, i32* %top.addr, align 4
  %82 = ashr i32 %81, 1
  store i32 %82, i32* %row.addr, align 4
  br label %for.cond.2

for.cond.2:
  %83 = load i32, i32* %row.addr, align 4
  %84 = load i32, i32* %end.addr, align 4
  %85 = icmp slt i32 %83, %84
  br i1 %85, label %for.body.2, label %for.end.2

for.body.2:
  %86 = load i32, i32* %left.addr, align 4
  store i32 %86, i32* %col.addr, align 4
  br label %for.cond.3

for.cond.3:
  %87 = load i32, i32* %col.addr, align 4
  %88 = load i32, i32* %right.addr, align 4
  %89 = icmp slt i32 %87, %88
  br i1 %89, label %for.body.3, label %for.end.3

for.body.3:
  %90 = load i32, i32* %col.addr, align 4
  %91 = load i32, i32* %row.addr, align 4
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %90, i32 %91)
  br label %for.inc.3

for.inc.3:
  %92 = load i32, i32* %col.addr, align 4
  %93 = add nsw i32 %92, 1
  store i32 %93, i32* %col.addr, align 4
  br label %for.cond.3

for.end.3:
  br label %for.inc.2

for.inc.2:
  %94 = load i32, i32* %row.addr, align 4
  %95 = add nsw i32 %94, 1
  store i32 %95, i32* %row.addr, align 4
  br label %for.cond.2

for.end.2:
  ret void
}

define void @nish.Canvas.line(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x0, i32 noundef %y0, i32 noundef %x1, i32 noundef %y1, i32 noundef %colour) #3 {
entry:
  %dx.addr = alloca double, align 8
  %dy.addr = alloca double, align 8
  %sx.addr = alloca i32, align 4
  %sy.addr = alloca i32, align 4
  %err.addr = alloca double, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %twice.addr = alloca double, align 8
  %nx.addr = alloca i32, align 4
  %ny.addr = alloca i32, align 4
  %0 = sitofp i32 %x1 to double
  %1 = sitofp i32 %x0 to double
  %2 = fsub double %0, %1
  %3 = call double @llvm.fabs.f64(double %2)
  store double %3, double* %dx.addr, align 8
  %4 = sitofp i32 %y1 to double
  %5 = sitofp i32 %y0 to double
  %6 = fsub double %4, %5
  %7 = call double @llvm.fabs.f64(double %6)
  %8 = fneg double %7
  store double %8, double* %dy.addr, align 8
  %9 = icmp slt i32 %x0, %x1
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 1, %cond.true ], [ -1, %cond.false ]
  store i32 %10, i32* %sx.addr, align 4
  %11 = icmp slt i32 %y0, %y1
  br i1 %11, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %12 = phi i32 [ 1, %cond.true.1 ], [ -1, %cond.false.1 ]
  store i32 %12, i32* %sy.addr, align 4
  %13 = load double, double* %dx.addr, align 8
  %14 = load double, double* %dy.addr, align 8
  %15 = fadd double %13, %14
  store double %15, double* %err.addr, align 8
  store i32 %x0, i32* %x.addr, align 4
  store i32 %y0, i32* %y.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %x.addr, align 4
  %17 = load i32, i32* %y.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %this, i32 %16, i32 %17, i32 %colour)
  %18 = load i32, i32* %x.addr, align 4
  %19 = icmp eq i32 %18, %x1
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %y.addr, align 4
  %21 = icmp eq i32 %20, %y1
  br label %land.end

land.end:
  %22 = phi i1 [ false, %while.body ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %23 = load double, double* %err.addr, align 8
  %24 = fmul double 0x4000000000000000, %23
  store double %24, double* %twice.addr, align 8
  %25 = load double, double* %twice.addr, align 8
  %26 = load double, double* %dy.addr, align 8
  %27 = fcmp oge double %25, %26
  br i1 %27, label %if.then.1, label %if.end.1

if.then.1:
  %28 = load i32, i32* %x.addr, align 4
  %29 = icmp slt i32 %28, %x1
  br i1 %29, label %if.then.2, label %if.else

if.then.2:
  %30 = load double, double* %err.addr, align 8
  %31 = load double, double* %dy.addr, align 8
  %32 = fadd double %30, %31
  store double %32, double* %err.addr, align 8
  %33 = load i32, i32* %x.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %x.addr, align 4
  br label %if.end.2

if.else:
  %35 = load i32, i32* %x.addr, align 4
  %36 = xor i32 %35, -1
  store i32 %36, i32* %nx.addr, align 4
  %37 = load i32, i32* %nx.addr, align 4
  %38 = xor i32 %x1, -1
  %39 = icmp slt i32 %37, %38
  br i1 %39, label %if.then.3, label %if.end.3

if.then.3:
  %40 = load double, double* %err.addr, align 8
  %41 = load double, double* %dy.addr, align 8
  %42 = fadd double %40, %41
  store double %42, double* %err.addr, align 8
  %43 = load i32, i32* %nx.addr, align 4
  %44 = add nsw i32 %43, 1
  %45 = xor i32 %44, -1
  store i32 %45, i32* %x.addr, align 4
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  %46 = load double, double* %twice.addr, align 8
  %47 = load double, double* %dx.addr, align 8
  %48 = fcmp ole double %46, %47
  br i1 %48, label %if.then.4, label %if.end.4

if.then.4:
  %49 = load i32, i32* %y.addr, align 4
  %50 = icmp slt i32 %49, %y1
  br i1 %50, label %if.then.5, label %if.else.1

if.then.5:
  %51 = load double, double* %err.addr, align 8
  %52 = load double, double* %dx.addr, align 8
  %53 = fadd double %51, %52
  store double %53, double* %err.addr, align 8
  %54 = load i32, i32* %y.addr, align 4
  %55 = add nsw i32 %54, 1
  store i32 %55, i32* %y.addr, align 4
  br label %if.end.5

if.else.1:
  %56 = load i32, i32* %y.addr, align 4
  %57 = xor i32 %56, -1
  store i32 %57, i32* %ny.addr, align 4
  %58 = load i32, i32* %ny.addr, align 4
  %59 = xor i32 %y1, -1
  %60 = icmp slt i32 %58, %59
  br i1 %60, label %if.then.6, label %if.end.6

if.then.6:
  %61 = load double, double* %err.addr, align 8
  %62 = load double, double* %dx.addr, align 8
  %63 = fadd double %61, %62
  store double %63, double* %err.addr, align 8
  %64 = load i32, i32* %ny.addr, align 4
  %65 = add nsw i32 %64, 1
  %66 = xor i32 %65, -1
  store i32 %66, i32* %y.addr, align 4
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  br label %if.end.4

if.end.4:
  %67 = load i32, i32* %sx.addr, align 4
  %68 = icmp sgt i32 %67, 0
  br i1 %68, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %69 = load i32, i32* %x.addr, align 4
  %70 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %71 = load i32, i32* %70, align 4, !tbaa !39
  %72 = icmp sge i32 %69, %71
  br label %land.end.1

land.end.1:
  %73 = phi i1 [ false, %if.end.4 ], [ %72, %land.rhs.1 ]
  br i1 %73, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %74 = load i32, i32* %sx.addr, align 4
  %75 = icmp slt i32 %74, 0
  br i1 %75, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %76 = load i32, i32* %x.addr, align 4
  %77 = icmp slt i32 %76, 0
  br label %land.end.2

land.end.2:
  %78 = phi i1 [ false, %lor.rhs.2 ], [ %77, %land.rhs.2 ]
  br label %lor.end.2

lor.end.2:
  %79 = phi i1 [ true, %land.end.1 ], [ %78, %land.end.2 ]
  br i1 %79, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %80 = load i32, i32* %sy.addr, align 4
  %81 = icmp sgt i32 %80, 0
  br i1 %81, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %82 = load i32, i32* %y.addr, align 4
  %83 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %84 = load i32, i32* %83, align 4, !tbaa !40
  %85 = icmp sge i32 %82, %84
  br label %land.end.3

land.end.3:
  %86 = phi i1 [ false, %lor.rhs.1 ], [ %85, %land.rhs.3 ]
  br label %lor.end.1

lor.end.1:
  %87 = phi i1 [ true, %lor.end.2 ], [ %86, %land.end.3 ]
  br i1 %87, label %lor.end, label %lor.rhs

lor.rhs:
  %88 = load i32, i32* %sy.addr, align 4
  %89 = icmp slt i32 %88, 0
  br i1 %89, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %90 = load i32, i32* %y.addr, align 4
  %91 = icmp slt i32 %90, 0
  br label %land.end.4

land.end.4:
  %92 = phi i1 [ false, %lor.rhs ], [ %91, %land.rhs.4 ]
  br label %lor.end

lor.end:
  %93 = phi i1 [ true, %lor.end.1 ], [ %92, %land.end.4 ]
  br i1 %93, label %if.then.7, label %if.end.7

if.then.7:
  ret void

if.end.7:
  br label %while.cond

while.end:
  unreachable
}

define noundef i32 @nish.Canvas.text(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row, i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %fg) #3 {
entry:
  %column.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %top.addr = alloca i32, align 4
  %bg.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 %col, i32* %column.addr, align 4
  %0 = call %struct.nish_array* @nish.termCodePoints(i8* %s)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %1 = load i64, i64* %forof.idx, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %forof.body, label %forof.end

forof.body:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %9, i32* %cp.addr, align 4
  %10 = load i32, i32* %column.addr, align 4
  %11 = call i32 @nish.Canvas.upper(%struct.Canvas* %this, i32 %10, i32 %row)
  store i32 %11, i32* %top.addr, align 4
  %12 = load i32, i32* %top.addr, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = load i32, i32* %top.addr, align 4
  br label %cond.end

cond.false:
  %15 = load i32, i32* %column.addr, align 4
  %16 = call i32 @nish.Canvas.lower(%struct.Canvas* %this, i32 %15, i32 %row)
  br label %cond.end

cond.end:
  %17 = phi i32 [ %14, %cond.true ], [ %16, %cond.false ]
  store i32 %17, i32* %bg.addr, align 4
  %18 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %19 = load %struct.Screen*, %struct.Screen** %18, align 8, !tbaa !38
  %20 = load i32, i32* %column.addr, align 4
  %21 = load i32, i32* %cp.addr, align 4
  %22 = load i32, i32* %bg.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %19, i32 %20, i32 %row, i32 %21, i32 %fg, i32 %22, i32 0)
  %23 = load i32, i32* %column.addr, align 4
  %24 = icmp slt i32 %23, 2147483647
  br i1 %24, label %cond.true.1, label %cond.false.1

cond.true.1:
  %25 = load i32, i32* %column.addr, align 4
  %26 = add nsw i32 %25, 1
  br label %cond.end.1

cond.false.1:
  %27 = load i32, i32* %column.addr, align 4
  br label %cond.end.1

cond.end.1:
  %28 = phi i32 [ %26, %cond.true.1 ], [ %27, %cond.false.1 ]
  store i32 %28, i32* %column.addr, align 4
  br label %forof.inc

forof.inc:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = add i64 %29, 1
  store i64 %30, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %31 = load i32, i32* %column.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %31
}

define noundef i32 @nish.Canvas.upper(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row) #0 {
entry:
  %0 = icmp slt i32 %row, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sgt i32 %row, 1073741822
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %3 = mul nsw i32 %row, 2
  %4 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %col, i32 %3)
  ret i32 %4
}

define noundef i32 @nish.Canvas.lower(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row) #0 {
entry:
  %0 = icmp slt i32 %row, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sgt i32 %row, 1073741822
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %3 = mul nsw i32 %row, 2
  %4 = add nsw i32 %3, 1
  %5 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %col, i32 %4)
  ret i32 %5
}

define void @nish.Canvas.paintCell(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row) #2 {
entry:
  %top.addr = alloca i32, align 4
  %bottom.addr = alloca i32, align 4
  %0 = call i32 @nish.Canvas.upper(%struct.Canvas* %this, i32 %col, i32 %row)
  store i32 %0, i32* %top.addr, align 4
  %1 = call i32 @nish.Canvas.lower(%struct.Canvas* %this, i32 %col, i32 %row)
  store i32 %1, i32* %bottom.addr, align 4
  %2 = load i32, i32* %top.addr, align 4
  %3 = icmp slt i32 %2, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load i32, i32* %bottom.addr, align 4
  %5 = icmp slt i32 %4, 0
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %8 = load %struct.Screen*, %struct.Screen** %7, align 8, !tbaa !38
  call void @nish.Screen.set(%struct.Screen* %8, i32 %col, i32 %row, i32 32, i32 -1, i32 -1, i32 0)
  br label %if.end

if.else:
  %9 = load i32, i32* %top.addr, align 4
  %10 = icmp slt i32 %9, 0
  br i1 %10, label %if.then.1, label %if.else.1

if.then.1:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %12 = load %struct.Screen*, %struct.Screen** %11, align 8, !tbaa !38
  %13 = load i32, i32* %bottom.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %12, i32 %col, i32 %row, i32 9604, i32 %13, i32 -1, i32 0)
  br label %if.end.1

if.else.1:
  %14 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %15 = load %struct.Screen*, %struct.Screen** %14, align 8, !tbaa !38
  %16 = load i32, i32* %top.addr, align 4
  %17 = load i32, i32* %bottom.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %15, i32 %col, i32 %row, i32 9600, i32 %16, i32 %17, i32 0)
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void
}

define void @nish.KeyEvent.constructor(%struct.KeyEvent* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %kind, i32 noundef %code) #2 {
entry:
  %0 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %this, i32 0, i32 0
  store i32 %kind, i32* %0, align 4, !tbaa !43
  %1 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %this, i32 0, i32 1
  store i32 %code, i32* %1, align 4, !tbaa !44
  ret void
}

define void @nish.TermEvent.constructor(%struct.TermEvent* noundef nonnull noalias align 8 dereferenceable(80) nocapture %this, i32 noundef %type) #2 {
entry:
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 0
  store i32 %type, i32* %0, align 4, !tbaa !46
  %1 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !47
  %2 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !48
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 3
  store i32 0, i32* %3, align 4, !tbaa !49
  %4 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 4
  store i32 0, i32* %4, align 4, !tbaa !50
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 5
  store i32 0, i32* %5, align 4, !tbaa !51
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 6
  store i32 0, i32* %6, align 4, !tbaa !52
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 7
  store i32 0, i32* %7, align 4, !tbaa !53
  %8 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 8
  store i32 -1, i32* %8, align 4, !tbaa !54
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 9
  store i32 -1, i32* %9, align 4, !tbaa !55
  %10 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 10
  store i8* bitcast ({ i64, [1 x i8] }* @.str.12 to i8*), i8** %10, align 8, !tbaa !56
  %11 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 11
  store i32 0, i32* %11, align 4, !tbaa !57
  %12 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 12
  store i32 0, i32* %12, align 4, !tbaa !58
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 13
  store i32 0, i32* %13, align 4, !tbaa !59
  %14 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 14
  store i32 0, i32* %14, align 4, !tbaa !60
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 15
  store %struct.nish_array* %16, %struct.nish_array** %20, align 8, !tbaa !61
  %21 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 16
  store i1 false, i1* %21, align 1, !tbaa !62
  ret void
}

define void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, double noundef %escapeTimeoutMs) #2 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  store double %escapeTimeoutMs, double* %0, align 8, !tbaa !65
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %7, align 8, !tbaa !67
  %8 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 4
  store i32 0, i32* %8, align 4, !tbaa !68
  %9 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 7
  store i1 false, i1* %9, align 1, !tbaa !69
  %10 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 5
  store i32 0, i32* %10, align 4, !tbaa !70
  %11 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 6
  store i32 0, i32* %11, align 4, !tbaa !71
  %12 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 8
  store i1 false, i1* %12, align 1, !tbaa !72
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 3
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !73
  ret void
}

define noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !66
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 0
  ret i1 %5
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count, double noundef %nowMs) #3 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %used.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %this, double %nowMs)
  store %struct.nish_array* %0, %struct.nish_array** %events.addr, align 8
  %1 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !66
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %held.addr, align 4
  %6 = call %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* %this, %struct.nish_array* %bytes, i32 %count)
  store %struct.nish_array* %6, %struct.nish_array** %work.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %12

if.end:
  %13 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %15 = call i32 @nish.termDecodeKeys(%struct.nish_array* %13, i1 false, %struct.nish_array* %14)
  store i32 %15, i32* %used.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %17 = load i32, i32* %used.addr, align 4
  %18 = load i32, i32* %used.addr, align 4
  %19 = load i32, i32* %held.addr, align 4
  %20 = icmp sge i32 %18, %19
  call void @nish.KeyDecoder.keep(%struct.KeyDecoder* %this, %struct.nish_array* %16, i32 %17, i1 %20, double %nowMs)
  %21 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %21
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #3 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %events.addr, align 8
  %5 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %held.addr, align 4
  %10 = load i32, i32* %held.addr, align 4
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  %13 = load double, double* %12, align 8, !tbaa !67
  %14 = fsub double %nowMs, %13
  %15 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  %16 = load double, double* %15, align 8, !tbaa !65
  %17 = fcmp olt double %14, %16
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %entry ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %19

if.end:
  %20 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !66
  %22 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %23 = call i32 @nish.termDecodeKeys(%struct.nish_array* %21, i1 true, %struct.nish_array* %22)
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !66
  %30 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %30
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feedEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count, double noundef %nowMs) #3 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %used.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* %this, double %nowMs)
  store %struct.nish_array* %0, %struct.nish_array** %events.addr, align 8
  %1 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !66
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %held.addr, align 4
  %6 = call %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* %this, %struct.nish_array* %bytes, i32 %count)
  store %struct.nish_array* %6, %struct.nish_array** %work.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %12

if.end:
  %13 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %15 = call i32 @nish.termDecodeEvents(%struct.KeyDecoder* %this, %struct.nish_array* %13, i1 false, %struct.nish_array* %14)
  store i32 %15, i32* %used.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %17 = load i32, i32* %used.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = load i32, i32* %held.addr, align 4
  %23 = icmp sgt i32 %21, %22
  call void @nish.KeyDecoder.keep(%struct.KeyDecoder* %this, %struct.nish_array* %16, i32 %17, i1 %23, double %nowMs)
  %24 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %24
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #3 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %events.addr, align 8
  %5 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %held.addr, align 4
  %10 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 8
  %11 = load i1, i1* %10, align 1, !tbaa !72
  br i1 %11, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %12 = load i32, i32* %held.addr, align 4
  %13 = icmp eq i32 %12, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  %16 = load double, double* %15, align 8, !tbaa !67
  %17 = fsub double %nowMs, %16
  %18 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  %19 = load double, double* %18, align 8, !tbaa !65
  %20 = fcmp olt double %17, %19
  br label %lor.end

lor.end:
  %21 = phi i1 [ true, %lor.end.1 ], [ %20, %lor.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %22

if.end:
  %23 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !66
  %25 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %26 = call i32 @nish.termDecodeEvents(%struct.KeyDecoder* %this, %struct.nish_array* %24, i1 true, %struct.nish_array* %25)
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %28, %struct.nish_array** %32, align 8, !tbaa !66
  %33 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %33
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count) #3 {
entry:
  %work.addr = alloca %struct.nish_array*, align 8
  %pending.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %work.addr, align 8
  %5 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !66
  store %struct.nish_array* %6, %struct.nish_array** %pending.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %pending.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %7, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %pending.addr, align 8
  %15 = load i32, i32* %k.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %16
  %21 = load i8, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %13, i64 1)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %23
  store i8 %21, i8* %30, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  br label %for.inc

for.inc:
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %k.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %35 = load i32, i32* %k.addr.1, align 4
  %36 = icmp slt i32 %35, %count
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load i32, i32* %k.addr.1, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = icmp slt i32 %37, %40
  br label %land.end

land.end:
  %42 = phi i1 [ false, %for.cond.1 ], [ %41, %land.rhs ]
  br i1 %42, label %for.body.1, label %for.end.1

for.body.1:
  %43 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %44 = load i32, i32* %k.addr.1, align 4
  %45 = sext i32 %44 to i64
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 %45
  %50 = load i8, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %43, i64 1)
  br label %push.store.1

push.store.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 %52
  store i8 %50, i8* %59, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = trunc i64 %60 to i32
  br label %for.inc.1

for.inc.1:
  %62 = load i32, i32* %k.addr.1, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %64 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  ret %struct.nish_array* %64
}

define void @nish.KeyDecoder.keep(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %work, i32 noundef %used, i1 noundef zeroext %restart, double noundef %nowMs) #3 {
entry:
  %rest.addr = alloca %struct.nish_array*, align 8
  %from.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %rest.addr, align 8
  store i32 0, i32* %from.addr, align 4
  %5 = icmp sgt i32 %used, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  store i32 %used, i32* %from.addr, align 4
  br label %if.end

if.end:
  %6 = load i32, i32* %from.addr, align 4
  store i32 %6, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %work, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %7, %10
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %13 = load i32, i32* %k.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %work, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = load i8, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 1)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %21
  store i8 %19, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  br label %for.inc

for.inc:
  %31 = load i32, i32* %k.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  %37 = icmp sgt i32 %36, 0
  br i1 %37, label %land.rhs, label %land.end

land.rhs:
  br label %land.end

land.end:
  %38 = phi i1 [ false, %for.end ], [ %restart, %land.rhs ]
  br i1 %38, label %if.then.1, label %if.end.1

if.then.1:
  %39 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double %nowMs, double* %39, align 8, !tbaa !67
  br label %if.end.1

if.end.1:
  %40 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %41 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %40, %struct.nish_array** %41, align 8, !tbaa !66
  ret void
}

define void @nish.KeyState.constructor(%struct.KeyState* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  store i1 true, i1* %0, align 1, !tbaa !75
  %1 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 0
  store double 0x4059000000000000, double* %1, align 8, !tbaa !76
  %2 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 1
  store double 0x4085E00000000000, double* %2, align 8, !tbaa !77
  %3 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %3, align 8, !tbaa !78
  %4 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  store i1 false, i1* %4, align 1, !tbaa !79
  %5 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  store i1 true, i1* %5, align 1, !tbaa !80
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  store %struct.nish_array* %7, %struct.nish_array** %11, align 8, !tbaa !81
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !82
  ret void
}

define noundef zeroext i1 @nish.KeyState.isDown(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key, i32 noundef %code) #0 {
entry:
  %0 = call i32 @nish.termKeyId(i32 %key, i32 %code)
  %1 = call %struct.TermHeldKey* @nish.KeyState.find(%struct.KeyState* %this, i32 %0)
  %2 = icmp ne %struct.TermHeldKey* %1, null
  ret i1 %2
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.apply(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %events, double noundef %nowMs) #3 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %h.addr = alloca %struct.TermHeldKey*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* %this, double %nowMs, %struct.nish_array* %events)
  store %struct.nish_array* %0, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %k.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %1, %4
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %k.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to %struct.TermEvent**
  %11 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %10, i64 %7
  %12 = load %struct.TermEvent*, %struct.TermEvent** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermEvent* %12, %struct.TermEvent** %e.addr, align 8
  %13 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %14 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !46
  %16 = icmp eq i32 %15, 4
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %18 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %17, i32 0, i32 16
  %19 = load i1, i1* %18, align 1, !tbaa !62
  %20 = xor i1 %19, true
  br label %land.end

land.end:
  %21 = phi i1 [ false, %for.body ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.else

if.then:
  %22 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !82
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %24 = load i64, i64* %forof.idx, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %forof.body, label %forof.end

forof.body:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to %struct.TermHeldKey**
  %31 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %30, i64 %24
  %32 = load %struct.TermHeldKey*, %struct.TermHeldKey** %31, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermHeldKey* %32, %struct.TermHeldKey** %h.addr, align 8
  %33 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.KeyState.release(%struct.KeyState* %this, %struct.TermHeldKey* %33, %struct.nish_array* %34)
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %if.end

if.else:
  %37 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %38 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !46
  %40 = icmp eq i32 %39, 1
  br i1 %40, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %41 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %42 = load i1, i1* %41, align 1, !tbaa !80
  br label %land.end.2

land.end.2:
  %43 = phi i1 [ false, %if.else ], [ %42, %land.rhs.2 ]
  br i1 %43, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %44 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %45 = call i1 @nish.termIsCtrlC(%struct.TermEvent* %44)
  br label %land.end.1

land.end.1:
  %46 = phi i1 [ false, %land.end.2 ], [ %45, %land.rhs.1 ]
  br i1 %46, label %if.then.1, label %if.else.1

if.then.1:
  %47 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %48 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %47, i32 0, i32 4
  %49 = load i32, i32* %48, align 4, !tbaa !50
  %50 = icmp eq i32 %49, 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %52 = call i8* @nish_alloc_struct(i64 80)
  %53 = bitcast i8* %52 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %53, i32 7)
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = icmp eq i64 %55, %57
  br i1 %58, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %51, i64 8)
  br label %push.store

push.store:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to %struct.TermEvent**
  %62 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %61, i64 %55
  store %struct.TermEvent* %53, %struct.TermEvent** %62, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %63 = add i64 %55, 1
  store i64 %63, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = trunc i64 %63 to i32
  br label %if.end.2

if.end.2:
  br label %for.inc

if.else.1:
  %65 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %66 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %65, i32 0, i32 0
  %67 = load i32, i32* %66, align 4, !tbaa !46
  %68 = icmp eq i32 %67, 1
  br i1 %68, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %69 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %70 = call i1 @nish.KeyState.press(%struct.KeyState* %this, %struct.TermEvent* %69, double %nowMs)
  %71 = xor i1 %70, true
  br label %land.end.3

land.end.3:
  %72 = phi i1 [ false, %if.else.1 ], [ %71, %land.rhs.3 ]
  br i1 %72, label %if.then.3, label %if.end.3

if.then.3:
  br label %for.inc

if.end.3:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %73 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %74 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 1
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %79 = icmp eq i64 %76, %78
  br i1 %79, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %73, i64 8)
  br label %push.store.1

push.store.1:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = bitcast i8* %81 to %struct.TermEvent**
  %83 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %82, i64 %76
  store %struct.TermEvent* %74, %struct.TermEvent** %83, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %84 = add i64 %76, 1
  store i64 %84, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = trunc i64 %84 to i32
  br label %for.inc

for.inc:
  %86 = load i32, i32* %k.addr, align 4
  %87 = add nsw i32 %86, 1
  store i32 %87, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %88 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %88
}

define void @nish.KeyState.delivered(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %sentAtMs) #2 {
entry:
  %0 = call i1 @nish.termFinite(double %sentAtMs)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %3 = load i1, i1* %2, align 1, !tbaa !79
  %4 = xor i1 %3, true
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %6 = load double, double* %5, align 8, !tbaa !78
  %7 = fcmp ogt double %sentAtMs, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  store double %sentAtMs, double* %9, align 8, !tbaa !78
  br label %if.end.1

if.end.1:
  %10 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  store i1 true, i1* %10, align 1, !tbaa !79
  ret void
}

define noundef double @nish.KeyState.deliveredAgoMs(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #0 {
entry:
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %1 = load i1, i1* %0, align 1, !tbaa !79
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %3 = load double, double* %2, align 8, !tbaa !78
  %4 = fsub double %nowMs, %3
  br label %cond.end

cond.false:
  %5 = fneg double 0x3FF0000000000000
  br label %cond.end

cond.end:
  %6 = phi double [ %4, %cond.true ], [ %5, %cond.false ]
  ret double %6
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.tick(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #3 {
entry:
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %none.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %4 = call %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* %this, double %nowMs, %struct.nish_array* %3)
  ret %struct.nish_array* %4
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %batch) #3 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %clock.addr = alloca double, align 8
  %h.addr = alloca %struct.TermHeldKey*, align 8
  %forof.idx = alloca i64, align 8
  %gap.addr = alloca double, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %6 = load i1, i1* %5, align 1, !tbaa !75
  %7 = xor i1 %6, true
  br i1 %7, label %lor.end, label %lor.rhs

lor.rhs:
  %8 = call i1 @nish.termFinite(double %nowMs)
  %9 = xor i1 %8, true
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %entry ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %11

if.end:
  %12 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %13 = load i1, i1* %12, align 1, !tbaa !79
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %15 = load double, double* %14, align 8, !tbaa !78
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi double [ %15, %cond.true ], [ %nowMs, %cond.false ]
  store double %16, double* %clock.addr, align 8
  %17 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !82
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %19 = load i64, i64* %forof.idx, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %forof.body, label %forof.end

forof.body:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to %struct.TermHeldKey**
  %26 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %25, i64 %19
  %27 = load %struct.TermHeldKey*, %struct.TermHeldKey** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermHeldKey* %27, %struct.TermHeldKey** %h.addr, align 8
  %28 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %29 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %28, i32 0, i32 4
  %30 = load i1, i1* %29, align 1, !tbaa !84
  br i1 %30, label %cond.true.1, label %cond.false.1

cond.true.1:
  %31 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 0
  %32 = load double, double* %31, align 8, !tbaa !76
  br label %cond.end.1

cond.false.1:
  %33 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 1
  %34 = load double, double* %33, align 8, !tbaa !77
  br label %cond.end.1

cond.end.1:
  %35 = phi double [ %32, %cond.true.1 ], [ %34, %cond.false.1 ]
  store double %35, double* %gap.addr, align 8
  %36 = load double, double* %clock.addr, align 8
  %37 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %38 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %37, i32 0, i32 0
  %39 = load double, double* %38, align 8, !tbaa !85
  %40 = fsub double %36, %39
  %41 = load double, double* %gap.addr, align 8
  %42 = fcmp oge double %40, %41
  br i1 %42, label %land.rhs, label %land.end

land.rhs:
  %43 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %44 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %43, i32 0, i32 1
  %45 = load i32, i32* %44, align 4, !tbaa !86
  %46 = call i1 @nish.termNamesKey(%struct.nish_array* %batch, i32 %45)
  %47 = xor i1 %46, true
  br label %land.end

land.end:
  %48 = phi i1 [ false, %cond.end.1 ], [ %47, %land.rhs ]
  br i1 %48, label %if.then.1, label %if.end.1

if.then.1:
  %49 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.KeyState.release(%struct.KeyState* %this, %struct.TermHeldKey* %49, %struct.nish_array* %50)
  br label %if.end.1

if.end.1:
  br label %forof.inc

forof.inc:
  %51 = load i64, i64* %forof.idx, align 8
  %52 = add i64 %51, 1
  store i64 %52, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %53 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %53
}

define noundef zeroext i1 @nish.KeyState.press(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.TermEvent* noundef nonnull align 8 dereferenceable(80) nocapture %e, double noundef %nowMs) #3 {
entry:
  %id.addr = alloca i32, align 4
  %at.addr = alloca %struct.TermHeldKey*, align 8
  %known.addr = alloca i1, align 1
  %since.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !47
  %2 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !48
  %4 = call i32 @nish.termKeyId(i32 %1, i32 %3)
  store i32 %4, i32* %id.addr, align 4
  %5 = load i32, i32* %id.addr, align 4
  %6 = call %struct.TermHeldKey* @nish.KeyState.find(%struct.KeyState* %this, i32 %5)
  store %struct.TermHeldKey* %6, %struct.TermHeldKey** %at.addr, align 8
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !50
  %9 = icmp eq i32 %8, 3
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  store i1 false, i1* %10, align 1, !tbaa !75
  %11 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %12 = icmp eq %struct.TermHeldKey* %11, null
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  %13 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  call void @nish.KeyState.remove(%struct.KeyState* %this, %struct.TermHeldKey* %13)
  ret i1 true

if.end:
  %14 = call i1 @nish.termFinite(double %nowMs)
  store i1 %14, i1* %known.addr, align 1
  %15 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %16 = icmp eq %struct.TermHeldKey* %15, null
  br i1 %16, label %if.then.2, label %if.end.2

if.then.2:
  %17 = load i1, i1* %known.addr, align 1
  br i1 %17, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %18 = phi double [ %nowMs, %cond.true ], [ 0x0000000000000000, %cond.false ]
  store double %18, double* %since.addr, align 8
  %19 = load i1, i1* %known.addr, align 1
  %20 = xor i1 %19, true
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %22 = load i1, i1* %21, align 1, !tbaa !79
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.3, label %if.end.3

if.then.3:
  %24 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %25 = load double, double* %24, align 8, !tbaa !78
  store double %25, double* %since.addr, align 8
  br label %if.end.3

if.end.3:
  %26 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !82
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.TermHeldKey*
  %30 = load i32, i32* %id.addr, align 4
  %31 = load double, double* %since.addr, align 8
  %32 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %33 = load i32, i32* %32, align 4, !tbaa !48
  %34 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %35 = load i32, i32* %34, align 4, !tbaa !49
  call void @nish.TermHeldKey.constructor(%struct.TermHeldKey* %29, i32 %30, double %31, i32 %33, i32 %35)
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %27, i64 8)
  br label %push.store

push.store:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to %struct.TermHeldKey**
  %44 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %43, i64 %37
  store %struct.TermHeldKey* %29, %struct.TermHeldKey** %44, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = trunc i64 %45 to i32
  %47 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !81
  %49 = load i32, i32* %id.addr, align 4
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4)
  br label %push.store.1

push.store.1:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  store i32 %49, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  ret i1 true

if.end.2:
  %61 = load i1, i1* %known.addr, align 1
  br i1 %61, label %if.then.4, label %if.end.4

if.then.4:
  %62 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %63 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %62, i32 0, i32 0
  store double %nowMs, double* %63, align 8, !tbaa !85
  br label %if.end.4

if.end.4:
  %64 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %65 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %64, i32 0, i32 4
  store i1 true, i1* %65, align 1, !tbaa !84
  %66 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %67 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %68 = load i32, i32* %67, align 4, !tbaa !48
  %69 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %66, i32 0, i32 2
  store i32 %68, i32* %69, align 4, !tbaa !87
  %70 = load %struct.TermHeldKey*, %struct.TermHeldKey** %at.addr, align 8
  %71 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %72 = load i32, i32* %71, align 4, !tbaa !49
  %73 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %70, i32 0, i32 3
  store i32 %72, i32* %73, align 4, !tbaa !88
  %74 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %75 = load i1, i1* %74, align 1, !tbaa !75
  br i1 %75, label %if.then.5, label %if.end.5

if.then.5:
  %76 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 4
  store i32 2, i32* %76, align 4, !tbaa !50
  br label %if.end.5

if.end.5:
  ret i1 true
}

define void @nish.KeyState.release(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.TermHeldKey* noundef nonnull readonly align 8 dereferenceable(24) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #3 {
entry:
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = call i8* @nish_alloc_struct(i64 80)
  %1 = bitcast i8* %0 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %1, i32 1)
  store %struct.TermEvent* %1, %struct.TermEvent** %e.addr, align 8
  %2 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %3 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %h, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !86
  %5 = ashr i32 %4, 21
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %2, i32 0, i32 1
  store i32 %5, i32* %6, align 4, !tbaa !47
  %7 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %8 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %h, i32 0, i32 2
  %9 = load i32, i32* %8, align 4, !tbaa !87
  %10 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %7, i32 0, i32 2
  store i32 %9, i32* %10, align 4, !tbaa !48
  %11 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %12 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %h, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !88
  %14 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %11, i32 0, i32 3
  store i32 %13, i32* %14, align 4, !tbaa !49
  %15 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %16 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %15, i32 0, i32 4
  store i32 3, i32* %16, align 4, !tbaa !50
  %17 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 8)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to %struct.TermEvent**
  %26 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %25, i64 %19
  store %struct.TermEvent* %17, %struct.TermEvent** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  call void @nish.KeyState.remove(%struct.KeyState* %this, %struct.TermHeldKey* %h)
  ret void
}

define noundef align 8 %struct.TermHeldKey* @nish.KeyState.find(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %id) #0 {
entry:
  %h.addr = alloca %struct.TermHeldKey*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !82
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to %struct.TermHeldKey**
  %9 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %8, i64 %2
  %10 = load %struct.TermHeldKey*, %struct.TermHeldKey** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermHeldKey* %10, %struct.TermHeldKey** %h.addr, align 8
  %11 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %12 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4, !tbaa !86
  %14 = icmp eq i32 %13, %id
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  ret %struct.TermHeldKey* %15

if.end:
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret %struct.TermHeldKey* null
}

define void @nish.KeyState.remove(%struct.KeyState* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.TermHeldKey* noundef nonnull readonly align 8 dereferenceable(24) nocapture %gone) #3 {
entry:
  %held.addr = alloca %struct.nish_array*, align 8
  %ids.addr = alloca %struct.nish_array*, align 8
  %h.addr = alloca %struct.TermHeldKey*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %held.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %ids.addr, align 8
  %10 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !82
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.TermHeldKey**
  %19 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %18, i64 %12
  %20 = load %struct.TermHeldKey*, %struct.TermHeldKey** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermHeldKey* %20, %struct.TermHeldKey** %h.addr, align 8
  %21 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %22 = icmp ne %struct.TermHeldKey* %21, %gone
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %24 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to %struct.TermHeldKey**
  %33 = getelementptr inbounds %struct.TermHeldKey*, %struct.TermHeldKey** %32, i64 %26
  store %struct.TermHeldKey* %24, %struct.TermHeldKey** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = load %struct.nish_array*, %struct.nish_array** %ids.addr, align 8
  %37 = load %struct.TermHeldKey*, %struct.TermHeldKey** %h.addr, align 8
  %38 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %37, i32 0, i32 1
  %39 = load i32, i32* %38, align 4, !tbaa !86
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = icmp eq i64 %41, %43
  br i1 %44, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store.1

push.store.1:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %41
  store i32 %39, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = add i64 %41, 1
  store i64 %49, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %51 = load i64, i64* %forof.idx, align 8
  %52 = add i64 %51, 1
  store i64 %52, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %53 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %54 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  store %struct.nish_array* %53, %struct.nish_array** %54, align 8, !tbaa !82
  %55 = load %struct.nish_array*, %struct.nish_array** %ids.addr, align 8
  %56 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  store %struct.nish_array* %55, %struct.nish_array** %56, align 8, !tbaa !81
  ret void
}

define internal void @nish.TermHeldKey.constructor(%struct.TermHeldKey* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %id, double noundef %since, i32 noundef %code, i32 noundef %modifiers) #2 {
entry:
  %0 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %this, i32 0, i32 1
  store i32 %id, i32* %0, align 4, !tbaa !86
  %1 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %this, i32 0, i32 0
  store double %since, double* %1, align 8, !tbaa !85
  %2 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %this, i32 0, i32 4
  store i1 false, i1* %2, align 1, !tbaa !84
  %3 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %this, i32 0, i32 2
  store i32 %code, i32* %3, align 4, !tbaa !87
  %4 = getelementptr inbounds %struct.TermHeldKey, %struct.TermHeldKey* %this, i32 0, i32 3
  store i32 %modifiers, i32* %4, align 4, !tbaa !88
  ret void
}

define void @nish.FixedStep.constructor(%struct.FixedStep* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this, i32 noundef %stepsPerSecond, i32 noundef %maxSteps) #2 {
entry:
  %rate.addr = alloca i32, align 4
  %0 = icmp slt i32 %stepsPerSecond, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 1, %cond.true ], [ %stepsPerSecond, %cond.false ]
  store i32 %1, i32* %rate.addr, align 4
  %2 = load i32, i32* %rate.addr, align 4
  %3 = sitofp i32 %2 to double
  %4 = fdiv double 0x408F400000000000, %3
  %5 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  store double %4, double* %5, align 8, !tbaa !90
  %6 = icmp slt i32 %maxSteps, 1
  br i1 %6, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %7 = phi i32 [ 1, %cond.true.1 ], [ %maxSteps, %cond.false.1 ]
  %8 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 3
  store i32 %7, i32* %8, align 4, !tbaa !91
  %9 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double 0x0000000000000000, double* %9, align 8, !tbaa !92
  %10 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %10, align 8, !tbaa !93
  %11 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  store i1 false, i1* %11, align 1, !tbaa !94
  ret void
}

define noundef i32 @nish.FixedStep.advance(%struct.FixedStep* noundef nonnull align 8 dereferenceable(32) nocapture %this, double noundef %nowMs) #3 {
entry:
  %steps.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  %1 = load i1, i1* %0, align 1, !tbaa !94
  %2 = xor i1 %1, true
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  %4 = load double, double* %3, align 8, !tbaa !93
  %5 = fcmp oge double %nowMs, %4
  %6 = xor i1 %5, true
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  store i1 true, i1* %8, align 1, !tbaa !94
  %9 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double %nowMs, double* %9, align 8, !tbaa !93
  ret i32 0

if.end:
  %10 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %11 = load double, double* %10, align 8, !tbaa !92
  %12 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  %13 = load double, double* %12, align 8, !tbaa !93
  %14 = fsub double %nowMs, %13
  %15 = fadd double %11, %14
  %16 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %15, double* %16, align 8, !tbaa !92
  %17 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double %nowMs, double* %17, align 8, !tbaa !93
  store i32 0, i32* %steps.addr, align 4
  br label %while.cond

while.cond:
  %18 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %19 = load double, double* %18, align 8, !tbaa !92
  %20 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %21 = load double, double* %20, align 8, !tbaa !90
  %22 = fcmp oge double %19, %21
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load i32, i32* %steps.addr, align 4
  %24 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 3
  %25 = load i32, i32* %24, align 4, !tbaa !91
  %26 = icmp slt i32 %23, %25
  br label %land.end

land.end:
  %27 = phi i1 [ false, %while.cond ], [ %26, %land.rhs ]
  br i1 %27, label %while.body, label %while.end

while.body:
  %28 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %29 = load double, double* %28, align 8, !tbaa !92
  %30 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %31 = load double, double* %30, align 8, !tbaa !90
  %32 = fsub double %29, %31
  %33 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %32, double* %33, align 8, !tbaa !92
  %34 = load i32, i32* %steps.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %steps.addr, align 4
  br label %while.cond

while.end:
  %36 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %37 = load double, double* %36, align 8, !tbaa !92
  %38 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %39 = load double, double* %38, align 8, !tbaa !90
  %40 = fcmp oge double %37, %39
  br i1 %40, label %if.then.1, label %if.end.1

if.then.1:
  %41 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %42 = load double, double* %41, align 8, !tbaa !92
  %43 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %44 = load double, double* %43, align 8, !tbaa !90
  %45 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %46 = load double, double* %45, align 8, !tbaa !92
  %47 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %48 = load double, double* %47, align 8, !tbaa !90
  %49 = fdiv double %46, %48
  %50 = call double @nish_floor(double %49)
  %51 = fmul double %44, %50
  %52 = fsub double %42, %51
  %53 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %52, double* %53, align 8, !tbaa !92
  %54 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %55 = load double, double* %54, align 8, !tbaa !92
  %56 = fcmp oge double %55, 0x0000000000000000
  br i1 %56, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %57 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %58 = load double, double* %57, align 8, !tbaa !92
  %59 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %60 = load double, double* %59, align 8, !tbaa !90
  %61 = fcmp olt double %58, %60
  br label %land.end.1

land.end.1:
  %62 = phi i1 [ false, %if.then.1 ], [ %61, %land.rhs.1 ]
  %63 = xor i1 %62, true
  br i1 %63, label %if.then.2, label %if.end.2

if.then.2:
  %64 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double 0x0000000000000000, double* %64, align 8, !tbaa !92
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  %65 = load i32, i32* %steps.addr, align 4
  ret i32 %65
}

define noundef double @nish.FixedStep.alpha(%struct.FixedStep* noundef nonnull readonly align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %1 = load double, double* %0, align 8, !tbaa !92
  %2 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %3 = load double, double* %2, align 8, !tbaa !90
  %4 = fdiv double %1, %3
  ret double %4
}

define internal noundef i32 @nish.termArrowKind(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 65
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 2

if.end:
  %1 = icmp eq i32 %b, 66
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 3

if.end.1:
  %2 = icmp eq i32 %b, 67
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 4

if.end.2:
  %3 = icmp eq i32 %b, 68
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 5, %cond.true ], [ 13, %cond.false ]
  ret i32 %4
}

define internal noundef i32 @nish.termAsciiKind(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 3
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 9

if.end:
  %1 = icmp eq i32 %b, 13
  br i1 %1, label %lor.end, label %lor.rhs

lor.rhs:
  %2 = icmp eq i32 %b, 10
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %if.end ], [ %2, %lor.rhs ]
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 6

if.end.1:
  %4 = icmp eq i32 %b, 32
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 7

if.end.2:
  %5 = icmp eq i32 %b, 9
  br i1 %5, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 10

if.end.3:
  %6 = icmp eq i32 %b, 127
  br i1 %6, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %7 = icmp eq i32 %b, 8
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %if.end.3 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 11

if.end.4:
  %9 = icmp slt i32 %b, 32
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 12, %cond.true ], [ 1, %cond.false ]
  ret i32 %10
}

define internal noundef i32 @nish.termDecodeKeys(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %i.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %second.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %run.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %final.addr.1 = alloca i32, align 4
  %char.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %2, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %while.cond ], [ %6, %land.rhs ]
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %9
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %15 = zext i8 %14 to i32
  store i32 %15, i32* %b.addr, align 4
  %16 = load i32, i32* %b.addr, align 4
  %17 = icmp eq i32 %16, 27
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %second.addr, align 4
  %20 = load i32, i32* %second.addr, align 4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = icmp sge i32 %20, %23
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = xor i1 %last, true
  br i1 %25, label %if.then.2, label %if.end.2

if.then.2:
  %26 = load i32, i32* %i.addr, align 4
  ret i32 %26

if.end.2:
  %27 = call i8* @nish_alloc_struct(i64 8)
  %28 = bitcast i8* %27 to %struct.KeyEvent*
  %29 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %28, i32 8, i32 %29)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to %struct.KeyEvent**
  %38 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %37, i64 %31
  store %struct.KeyEvent* %28, %struct.KeyEvent** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = load i32, i32* %i.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %i.addr, align 4
  br label %while.cond

if.end.1:
  %43 = load i32, i32* %second.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 %44
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %50 = zext i8 %49 to i32
  store i32 %50, i32* %next.addr, align 4
  %51 = load i32, i32* %next.addr, align 4
  %52 = icmp eq i32 %51, 91
  br i1 %52, label %if.then.3, label %if.end.3

if.then.3:
  %53 = load i32, i32* %second.addr, align 4
  %54 = add nsw i32 %53, 1
  store i32 %54, i32* %j.addr, align 4
  store i32 0, i32* %run.addr, align 4
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %59 = load i32, i32* %run.addr, align 4
  %60 = icmp slt i32 %59, 33
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %while.cond.1 ], [ %62, %land.rhs.4 ]
  br i1 %63, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %64 = load i32, i32* %j.addr, align 4
  %65 = trunc i64 %56 to i32
  %66 = icmp slt i32 %64, %65
  br label %land.end.3

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ]
  br i1 %67, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %68 = load i32, i32* %j.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = bitcast i8* %58 to i8*
  %71 = getelementptr inbounds i8, i8* %70, i64 %69
  %72 = load i8, i8* %71, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %73 = zext i8 %72 to i32
  %74 = icmp sge i32 %73, 32
  br label %land.end.2

land.end.2:
  %75 = phi i1 [ false, %land.end.3 ], [ %74, %land.rhs.2 ]
  br i1 %75, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %76 = load i32, i32* %j.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = bitcast i8* %58 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 %77
  %80 = load i8, i8* %79, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %81 = zext i8 %80 to i32
  %82 = icmp slt i32 %81, 64
  br label %land.end.1

land.end.1:
  %83 = phi i1 [ false, %land.end.2 ], [ %82, %land.rhs.1 ]
  br i1 %83, label %while.body.1, label %while.end.1

while.body.1:
  %84 = load i32, i32* %j.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %j.addr, align 4
  %86 = load i32, i32* %run.addr, align 4
  %87 = add nsw i32 %86, 1
  store i32 %87, i32* %run.addr, align 4
  br label %while.cond.1

while.end.1:
  %88 = load i32, i32* %run.addr, align 4
  %89 = icmp sgt i32 %88, 32
  br i1 %89, label %if.then.4, label %if.end.4

if.then.4:
  %90 = call i8* @nish_alloc_struct(i64 8)
  %91 = bitcast i8* %90 to %struct.KeyEvent*
  %92 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %91, i32 8, i32 %92)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to %struct.KeyEvent**
  %101 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %100, i64 %94
  store %struct.KeyEvent* %91, %struct.KeyEvent** %101, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  %104 = load i32, i32* %i.addr, align 4
  %105 = add nsw i32 %104, 1
  store i32 %105, i32* %i.addr, align 4
  br label %while.cond

if.end.4:
  %106 = load i32, i32* %j.addr, align 4
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %108 = load i64, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = trunc i64 %108 to i32
  %110 = icmp sge i32 %106, %109
  br i1 %110, label %if.then.5, label %if.end.5

if.then.5:
  %111 = xor i1 %last, true
  br i1 %111, label %if.then.6, label %if.end.6

if.then.6:
  %112 = load i32, i32* %i.addr, align 4
  ret i32 %112

if.end.6:
  %113 = call i8* @nish_alloc_struct(i64 8)
  %114 = bitcast i8* %113 to %struct.KeyEvent*
  %115 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %114, i32 8, i32 %115)
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %120 = icmp eq i64 %117, %119
  br i1 %120, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %122 = load i8*, i8** %121, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %123 = bitcast i8* %122 to %struct.KeyEvent**
  %124 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %123, i64 %117
  store %struct.KeyEvent* %114, %struct.KeyEvent** %124, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %125 = add i64 %117, 1
  store i64 %125, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = trunc i64 %125 to i32
  %127 = load i32, i32* %i.addr, align 4
  %128 = add nsw i32 %127, 1
  store i32 %128, i32* %i.addr, align 4
  br label %while.cond

if.end.5:
  %129 = load i32, i32* %j.addr, align 4
  %130 = sext i32 %129 to i64
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %133 = bitcast i8* %132 to i8*
  %134 = getelementptr inbounds i8, i8* %133, i64 %130
  %135 = load i8, i8* %134, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %136 = zext i8 %135 to i32
  store i32 %136, i32* %final.addr, align 4
  %137 = load i32, i32* %final.addr, align 4
  %138 = icmp sge i32 %137, 64
  br i1 %138, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %139 = load i32, i32* %final.addr, align 4
  %140 = icmp slt i32 %139, 127
  br label %land.end.5

land.end.5:
  %141 = phi i1 [ false, %if.end.5 ], [ %140, %land.rhs.5 ]
  br i1 %141, label %if.then.7, label %if.else

if.then.7:
  %142 = call i8* @nish_alloc_struct(i64 8)
  %143 = bitcast i8* %142 to %struct.KeyEvent*
  %144 = load i32, i32* %final.addr, align 4
  %145 = call i32 @nish.termArrowKind(i32 %144)
  %146 = load i32, i32* %final.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %143, i32 %145, i32 %146)
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %148 = load i64, i64* %147, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %150 = load i64, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %151 = icmp eq i64 %148, %150
  br i1 %151, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %154 = bitcast i8* %153 to %struct.KeyEvent**
  %155 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %154, i64 %148
  store %struct.KeyEvent* %143, %struct.KeyEvent** %155, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %156 = add i64 %148, 1
  store i64 %156, i64* %147, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = trunc i64 %156 to i32
  %158 = load i32, i32* %j.addr, align 4
  %159 = add nsw i32 %158, 1
  store i32 %159, i32* %i.addr, align 4
  br label %if.end.7

if.else:
  %160 = call i8* @nish_alloc_struct(i64 8)
  %161 = bitcast i8* %160 to %struct.KeyEvent*
  %162 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %161, i32 8, i32 %162)
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %164 = load i64, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %166 = load i64, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %167 = icmp eq i64 %164, %166
  br i1 %167, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %170 = bitcast i8* %169 to %struct.KeyEvent**
  %171 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %170, i64 %164
  store %struct.KeyEvent* %161, %struct.KeyEvent** %171, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %172 = add i64 %164, 1
  store i64 %172, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = trunc i64 %172 to i32
  %174 = load i32, i32* %i.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %i.addr, align 4
  br label %if.end.7

if.end.7:
  br label %while.cond

if.end.3:
  %176 = load i32, i32* %next.addr, align 4
  %177 = icmp eq i32 %176, 79
  br i1 %177, label %if.then.8, label %if.end.8

if.then.8:
  %178 = load i32, i32* %second.addr, align 4
  %179 = add nsw i32 %178, 1
  store i32 %179, i32* %at.addr, align 4
  %180 = load i32, i32* %at.addr, align 4
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %182 = load i64, i64* %181, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %183 = trunc i64 %182 to i32
  %184 = icmp sge i32 %180, %183
  br i1 %184, label %if.then.9, label %if.end.9

if.then.9:
  %185 = xor i1 %last, true
  br i1 %185, label %if.then.10, label %if.end.10

if.then.10:
  %186 = load i32, i32* %i.addr, align 4
  ret i32 %186

if.end.10:
  %187 = call i8* @nish_alloc_struct(i64 8)
  %188 = bitcast i8* %187 to %struct.KeyEvent*
  %189 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %188, i32 8, i32 %189)
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %191 = load i64, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %194 = icmp eq i64 %191, %193
  br i1 %194, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %197 = bitcast i8* %196 to %struct.KeyEvent**
  %198 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %197, i64 %191
  store %struct.KeyEvent* %188, %struct.KeyEvent** %198, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %199 = add i64 %191, 1
  store i64 %199, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %200 = trunc i64 %199 to i32
  %201 = load i32, i32* %i.addr, align 4
  %202 = add nsw i32 %201, 1
  store i32 %202, i32* %i.addr, align 4
  br label %while.cond

if.end.9:
  %203 = load i32, i32* %at.addr, align 4
  %204 = sext i32 %203 to i64
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %207 = bitcast i8* %206 to i8*
  %208 = getelementptr inbounds i8, i8* %207, i64 %204
  %209 = load i8, i8* %208, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %210 = zext i8 %209 to i32
  store i32 %210, i32* %final.addr.1, align 4
  %211 = load i32, i32* %final.addr.1, align 4
  %212 = icmp sge i32 %211, 64
  br i1 %212, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %213 = load i32, i32* %final.addr.1, align 4
  %214 = icmp slt i32 %213, 127
  br label %land.end.6

land.end.6:
  %215 = phi i1 [ false, %if.end.9 ], [ %214, %land.rhs.6 ]
  br i1 %215, label %if.then.11, label %if.else.1

if.then.11:
  %216 = call i8* @nish_alloc_struct(i64 8)
  %217 = bitcast i8* %216 to %struct.KeyEvent*
  %218 = load i32, i32* %final.addr.1, align 4
  %219 = call i32 @nish.termArrowKind(i32 %218)
  %220 = load i32, i32* %final.addr.1, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %217, i32 %219, i32 %220)
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %222 = load i64, i64* %221, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %224 = load i64, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %225 = icmp eq i64 %222, %224
  br i1 %225, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.6

push.store.6:
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %227 = load i8*, i8** %226, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %228 = bitcast i8* %227 to %struct.KeyEvent**
  %229 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %228, i64 %222
  store %struct.KeyEvent* %217, %struct.KeyEvent** %229, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %230 = add i64 %222, 1
  store i64 %230, i64* %221, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %231 = trunc i64 %230 to i32
  %232 = load i32, i32* %at.addr, align 4
  %233 = add nsw i32 %232, 1
  store i32 %233, i32* %i.addr, align 4
  br label %if.end.11

if.else.1:
  %234 = call i8* @nish_alloc_struct(i64 8)
  %235 = bitcast i8* %234 to %struct.KeyEvent*
  %236 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %235, i32 8, i32 %236)
  %237 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %238 = load i64, i64* %237, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %239 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %240 = load i64, i64* %239, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %241 = icmp eq i64 %238, %240
  br i1 %241, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.7

push.store.7:
  %242 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %243 = load i8*, i8** %242, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %244 = bitcast i8* %243 to %struct.KeyEvent**
  %245 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %244, i64 %238
  store %struct.KeyEvent* %235, %struct.KeyEvent** %245, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %246 = add i64 %238, 1
  store i64 %246, i64* %237, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %247 = trunc i64 %246 to i32
  %248 = load i32, i32* %i.addr, align 4
  %249 = add nsw i32 %248, 1
  store i32 %249, i32* %i.addr, align 4
  br label %if.end.11

if.end.11:
  br label %while.cond

if.end.8:
  %250 = call i8* @nish_alloc_struct(i64 8)
  %251 = bitcast i8* %250 to %struct.KeyEvent*
  %252 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %251, i32 8, i32 %252)
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %254 = load i64, i64* %253, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %256 = load i64, i64* %255, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %257 = icmp eq i64 %254, %256
  br i1 %257, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.8

push.store.8:
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %260 = bitcast i8* %259 to %struct.KeyEvent**
  %261 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %260, i64 %254
  store %struct.KeyEvent* %251, %struct.KeyEvent** %261, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %262 = add i64 %254, 1
  store i64 %262, i64* %253, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = trunc i64 %262 to i32
  %264 = load i32, i32* %i.addr, align 4
  %265 = add nsw i32 %264, 1
  store i32 %265, i32* %i.addr, align 4
  br label %while.cond

if.end:
  %266 = load i32, i32* %b.addr, align 4
  %267 = icmp slt i32 %266, 128
  br i1 %267, label %if.then.12, label %if.end.12

if.then.12:
  %268 = call i8* @nish_alloc_struct(i64 8)
  %269 = bitcast i8* %268 to %struct.KeyEvent*
  %270 = load i32, i32* %b.addr, align 4
  %271 = call i32 @nish.termAsciiKind(i32 %270)
  %272 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %269, i32 %271, i32 %272)
  %273 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %274 = load i64, i64* %273, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %276 = load i64, i64* %275, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %277 = icmp eq i64 %274, %276
  br i1 %277, label %push.grow.9, label %push.store.9

push.grow.9:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.9

push.store.9:
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %279 = load i8*, i8** %278, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %280 = bitcast i8* %279 to %struct.KeyEvent**
  %281 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %280, i64 %274
  store %struct.KeyEvent* %269, %struct.KeyEvent** %281, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %282 = add i64 %274, 1
  store i64 %282, i64* %273, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %283 = trunc i64 %282 to i32
  %284 = load i32, i32* %i.addr, align 4
  %285 = add nsw i32 %284, 1
  store i32 %285, i32* %i.addr, align 4
  br label %while.cond

if.end.12:
  %286 = load i32, i32* %i.addr, align 4
  %287 = call i32 @nish.termUtf8At(%struct.nish_array* %bytes, i32 %286, i1 %last)
  store i32 %287, i32* %char.addr, align 4
  %288 = load i32, i32* %char.addr, align 4
  %289 = icmp slt i32 %288, 0
  br i1 %289, label %if.then.13, label %if.end.13

if.then.13:
  %290 = load i32, i32* %i.addr, align 4
  ret i32 %290

if.end.13:
  %291 = call i8* @nish_alloc_struct(i64 8)
  %292 = bitcast i8* %291 to %struct.KeyEvent*
  %293 = load i32, i32* %char.addr, align 4
  %294 = ashr i32 %293, 3
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %292, i32 1, i32 %294)
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %296 = load i64, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %297 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %298 = load i64, i64* %297, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %299 = icmp eq i64 %296, %298
  br i1 %299, label %push.grow.10, label %push.store.10

push.grow.10:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.10

push.store.10:
  %300 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %301 = load i8*, i8** %300, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %302 = bitcast i8* %301 to %struct.KeyEvent**
  %303 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %302, i64 %296
  store %struct.KeyEvent* %292, %struct.KeyEvent** %303, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %304 = add i64 %296, 1
  store i64 %304, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %305 = trunc i64 %304 to i32
  %306 = load i32, i32* %char.addr, align 4
  %307 = and i32 %306, 7
  store i32 %307, i32* %used.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %308 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %309 = load i64, i64* %308, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %310 = load i32, i32* %k.addr, align 4
  %311 = load i32, i32* %used.addr, align 4
  %312 = icmp slt i32 %310, %311
  br i1 %312, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %313 = load i32, i32* %i.addr, align 4
  %314 = trunc i64 %309 to i32
  %315 = icmp slt i32 %313, %314
  br label %land.end.7

land.end.7:
  %316 = phi i1 [ false, %for.cond ], [ %315, %land.rhs.7 ]
  br i1 %316, label %for.body, label %for.end

for.body:
  %317 = load i32, i32* %i.addr, align 4
  %318 = add nsw i32 %317, 1
  store i32 %318, i32* %i.addr, align 4
  br label %for.inc

for.inc:
  %319 = load i32, i32* %k.addr, align 4
  %320 = add nsw i32 %319, 1
  store i32 %320, i32* %k.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.end:
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %322 = load i64, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %323 = trunc i64 %322 to i32
  ret i32 %323
}

define internal noundef i32 @nish.termUtf8At(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last) #4 {
entry:
  %b.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %left.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %ended.addr = alloca i1, align 1
  %next.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %least.addr = alloca i32, align 4
  %scalar.addr = alloca i1, align 1
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = zext i8 %5 to i32
  store i32 %6, i32* %b.addr, align 4
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp slt i32 %7, 194
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = icmp sge i32 %9, 245
  br label %lor.end

lor.end:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs ]
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %12 = load i32, i32* %b.addr, align 4
  %13 = call i32 @nish.termLeadWidth(i32 %12)
  br label %cond.end

cond.end:
  %14 = phi i32 [ 1, %cond.true ], [ %13, %cond.false ]
  store i32 %14, i32* %width.addr, align 4
  %15 = load i32, i32* %width.addr, align 4
  %16 = icmp eq i32 %15, 1
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = shl i32 65533, 3
  %18 = or i32 %17, 1
  ret i32 %18

if.end:
  %19 = load i32, i32* %b.addr, align 4
  %20 = load i32, i32* %width.addr, align 4
  %21 = call i32 @nish.termLeadBits(i32 %19, i32 %20)
  store i32 %21, i32* %cp.addr, align 4
  store i32 0, i32* %left.addr, align 4
  %22 = load i32, i32* %width.addr, align 4
  %23 = icmp sgt i32 %22, 1
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load i32, i32* %width.addr, align 4
  %25 = sub nsw i32 %24, 1
  store i32 %25, i32* %left.addr, align 4
  br label %if.end.1

if.end.1:
  store i32 1, i32* %used.addr, align 4
  store i32 %i, i32* %at.addr, align 4
  store i1 false, i1* %ended.addr, align 1
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %30 = load i32, i32* %left.addr, align 4
  %31 = icmp sgt i32 %30, 0
  br i1 %31, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %32 = load i32, i32* %used.addr, align 4
  %33 = icmp slt i32 %32, 4
  br label %land.end.2

land.end.2:
  %34 = phi i1 [ false, %while.cond ], [ %33, %land.rhs.2 ]
  br i1 %34, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %35 = load i32, i32* %at.addr, align 4
  %36 = icmp sge i32 %35, 0
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %land.rhs, label %land.end

land.rhs:
  %38 = load i32, i32* %at.addr, align 4
  %39 = trunc i64 %27 to i32
  %40 = icmp slt i32 %38, %39
  br label %land.end

land.end:
  %41 = phi i1 [ false, %land.end.1 ], [ %40, %land.rhs ]
  br i1 %41, label %while.body, label %while.end

while.body:
  %42 = load i32, i32* %at.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %next.addr, align 4
  %44 = load i32, i32* %next.addr, align 4
  %45 = trunc i64 %27 to i32
  %46 = icmp sge i32 %44, %45
  br i1 %46, label %if.then.2, label %if.end.2

if.then.2:
  store i1 true, i1* %ended.addr, align 1
  br label %while.end

if.end.2:
  %47 = load i32, i32* %next.addr, align 4
  %48 = sext i32 %47 to i64
  %49 = bitcast i8* %29 to i8*
  %50 = getelementptr inbounds i8, i8* %49, i64 %48
  %51 = load i8, i8* %50, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %52 = zext i8 %51 to i32
  store i32 %52, i32* %c.addr, align 4
  %53 = load i32, i32* %c.addr, align 4
  %54 = icmp slt i32 %53, 128
  br i1 %54, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %55 = load i32, i32* %c.addr, align 4
  %56 = icmp sge i32 %55, 192
  br label %lor.end.1

lor.end.1:
  %57 = phi i1 [ true, %if.end.2 ], [ %56, %lor.rhs.1 ]
  br i1 %57, label %if.then.3, label %if.end.3

if.then.3:
  br label %while.end

if.end.3:
  %58 = load i32, i32* %cp.addr, align 4
  %59 = shl i32 %58, 6
  %60 = load i32, i32* %c.addr, align 4
  %61 = and i32 %60, 63
  %62 = or i32 %59, %61
  store i32 %62, i32* %cp.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = add nsw i32 %63, 1
  store i32 %64, i32* %used.addr, align 4
  %65 = load i32, i32* %left.addr, align 4
  %66 = sub nsw i32 %65, 1
  store i32 %66, i32* %left.addr, align 4
  %67 = load i32, i32* %next.addr, align 4
  store i32 %67, i32* %at.addr, align 4
  br label %while.cond

while.end:
  %68 = load i32, i32* %left.addr, align 4
  %69 = icmp sgt i32 %68, 0
  br i1 %69, label %if.then.4, label %if.end.4

if.then.4:
  %70 = xor i1 %last, true
  br i1 %70, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %71 = load i1, i1* %ended.addr, align 1
  br label %land.end.3

land.end.3:
  %72 = phi i1 [ false, %if.then.4 ], [ %71, %land.rhs.3 ]
  br i1 %72, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 -1

if.end.5:
  %73 = shl i32 65533, 3
  %74 = load i32, i32* %used.addr, align 4
  %75 = or i32 %73, %74
  ret i32 %75

if.end.4:
  store i32 65536, i32* %least.addr, align 4
  %76 = load i32, i32* %width.addr, align 4
  %77 = icmp eq i32 %76, 2
  br i1 %77, label %if.then.6, label %if.else

if.then.6:
  store i32 160, i32* %least.addr, align 4
  br label %if.end.6

if.else:
  %78 = load i32, i32* %width.addr, align 4
  %79 = icmp eq i32 %78, 3
  br i1 %79, label %if.then.7, label %if.end.7

if.then.7:
  store i32 2048, i32* %least.addr, align 4
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  %80 = load i32, i32* %cp.addr, align 4
  %81 = load i32, i32* %least.addr, align 4
  %82 = icmp sge i32 %80, %81
  br i1 %82, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %83 = load i32, i32* %cp.addr, align 4
  %84 = icmp slt i32 %83, 1114112
  br label %land.end.5

land.end.5:
  %85 = phi i1 [ false, %if.end.6 ], [ %84, %land.rhs.5 ]
  br i1 %85, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %86 = load i32, i32* %cp.addr, align 4
  %87 = icmp sge i32 %86, 55296
  br i1 %87, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %88 = load i32, i32* %cp.addr, align 4
  %89 = icmp slt i32 %88, 57344
  br label %land.end.6

land.end.6:
  %90 = phi i1 [ false, %land.rhs.4 ], [ %89, %land.rhs.6 ]
  %91 = xor i1 %90, true
  br label %land.end.4

land.end.4:
  %92 = phi i1 [ false, %land.end.5 ], [ %91, %land.end.6 ]
  store i1 %92, i1* %scalar.addr, align 1
  %93 = load i1, i1* %scalar.addr, align 1
  br i1 %93, label %cond.true.1, label %cond.false.1

cond.true.1:
  %94 = load i32, i32* %cp.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %95 = phi i32 [ %94, %cond.true.1 ], [ 65533, %cond.false.1 ]
  %96 = shl i32 %95, 3
  %97 = load i32, i32* %width.addr, align 4
  %98 = or i32 %96, %97
  ret i32 %98
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termKeyEvent(i32 noundef %key, i32 noundef %code, i32 noundef %mods, i32 noundef %action) #2 {
entry:
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = call i8* @nish_alloc_struct(i64 80)
  %1 = bitcast i8* %0 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %1, i32 1)
  store %struct.TermEvent* %1, %struct.TermEvent** %e.addr, align 8
  %2 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %2, i32 0, i32 1
  store i32 %key, i32* %3, align 4, !tbaa !47
  %4 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %4, i32 0, i32 2
  store i32 %code, i32* %5, align 4, !tbaa !48
  %6 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %6, i32 0, i32 3
  store i32 %mods, i32* %7, align 4, !tbaa !49
  %8 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %8, i32 0, i32 4
  store i32 %action, i32* %9, align 4, !tbaa !50
  %10 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %10
}

define internal noundef i32 @nish.termModifiers(i32 noundef %raw) #1 {
entry:
  %0 = icmp slt i32 %raw, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub nsw i32 %raw, 1
  %2 = and i32 %1, 63
  br label %cond.end

cond.end:
  %3 = phi i32 [ 0, %cond.true ], [ %2, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @nish.termAction(i32 noundef %raw) #1 {
entry:
  %0 = icmp eq i32 %raw, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 2

if.end:
  %1 = icmp eq i32 %raw, 3
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 3, %cond.true ], [ 1, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @nish.termCsiField(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %field, i32 noundef %sub) #4 {
entry:
  %f.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  %start.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 0, i32* %f.addr, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 -1, i32* %value.addr, align 4
  store i32 %from, i32* %start.addr, align 4
  %0 = load i32, i32* %start.addr, align 4
  %1 = icmp slt i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  store i32 0, i32* %start.addr, align 4
  br label %if.end

if.end:
  %2 = load i32, i32* %start.addr, align 4
  store i32 %2, i32* %k.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp slt i32 %7, %to
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %k.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %k.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = zext i8 %17 to i32
  store i32 %18, i32* %c.addr, align 4
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp eq i32 %19, 59
  br i1 %20, label %if.then.1, label %if.else

if.then.1:
  %21 = load i32, i32* %f.addr, align 4
  %22 = icmp sge i32 %21, %field
  br i1 %22, label %if.then.2, label %if.end.2

if.then.2:
  %23 = load i32, i32* %value.addr, align 4
  ret i32 %23

if.end.2:
  %24 = load i32, i32* %f.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %f.addr, align 4
  store i32 0, i32* %s.addr, align 4
  br label %if.end.1

if.else:
  %26 = load i32, i32* %c.addr, align 4
  %27 = icmp eq i32 %26, 58
  br i1 %27, label %if.then.3, label %if.else.1

if.then.3:
  %28 = load i32, i32* %s.addr, align 4
  %29 = icmp slt i32 %28, %sub
  br i1 %29, label %if.then.4, label %if.else.2

if.then.4:
  %30 = load i32, i32* %s.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %s.addr, align 4
  br label %if.end.4

if.else.2:
  %32 = load i32, i32* %f.addr, align 4
  %33 = icmp eq i32 %32, %field
  br i1 %33, label %if.then.5, label %if.end.5

if.then.5:
  %34 = load i32, i32* %value.addr, align 4
  ret i32 %34

if.end.5:
  br label %if.end.4

if.end.4:
  br label %if.end.3

if.else.1:
  %35 = load i32, i32* %c.addr, align 4
  %36 = icmp sge i32 %35, 48
  br i1 %36, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %37 = load i32, i32* %c.addr, align 4
  %38 = add nsw i32 48, 10
  %39 = icmp slt i32 %37, %38
  br label %land.end.3

land.end.3:
  %40 = phi i1 [ false, %if.else.1 ], [ %39, %land.rhs.3 ]
  br i1 %40, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %41 = load i32, i32* %f.addr, align 4
  %42 = icmp eq i32 %41, %field
  br label %land.end.2

land.end.2:
  %43 = phi i1 [ false, %land.end.3 ], [ %42, %land.rhs.2 ]
  br i1 %43, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %44 = load i32, i32* %s.addr, align 4
  %45 = icmp eq i32 %44, %sub
  br label %land.end.1

land.end.1:
  %46 = phi i1 [ false, %land.end.2 ], [ %45, %land.rhs.1 ]
  br i1 %46, label %if.then.6, label %if.end.6

if.then.6:
  %47 = load i32, i32* %value.addr, align 4
  %48 = icmp slt i32 %47, 0
  br i1 %48, label %if.then.7, label %if.else.3

if.then.7:
  %49 = load i32, i32* %c.addr, align 4
  %50 = sub nsw i32 %49, 48
  store i32 %50, i32* %value.addr, align 4
  br label %if.end.7

if.else.3:
  %51 = load i32, i32* %value.addr, align 4
  %52 = icmp slt i32 %51, 10000000
  br i1 %52, label %if.then.8, label %if.end.8

if.then.8:
  %53 = load i32, i32* %value.addr, align 4
  %54 = mul nsw i32 %53, 10
  %55 = load i32, i32* %c.addr, align 4
  %56 = sub nsw i32 %55, 48
  %57 = add nsw i32 %54, %56
  store i32 %57, i32* %value.addr, align 4
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  br label %if.end.3

if.end.3:
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %58 = load i32, i32* %k.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %60 = load i32, i32* %value.addr, align 4
  ret i32 %60
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.termCsiParams(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %params.addr = alloca %struct.nish_array*, align 8
  %value.addr = alloca i32, align 4
  %first.addr = alloca i1, align 1
  %start.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %params.addr, align 8
  %5 = icmp sge i32 %from, %to
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  ret %struct.nish_array* %6

if.end:
  store i32 -1, i32* %value.addr, align 4
  store i1 true, i1* %first.addr, align 1
  store i32 %from, i32* %start.addr, align 4
  %7 = load i32, i32* %start.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  store i32 0, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  %9 = load i32, i32* %start.addr, align 4
  store i32 %9, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %to
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %k.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %12, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %k.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 %19
  %24 = load i8, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = zext i8 %24 to i32
  store i32 %25, i32* %c.addr, align 4
  %26 = load i32, i32* %c.addr, align 4
  %27 = icmp eq i32 %26, 59
  br i1 %27, label %if.then.2, label %if.else

if.then.2:
  %28 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  %29 = load i32, i32* %value.addr, align 4
  %30 = icmp slt i32 %29, 0
  br i1 %30, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %31 = load i32, i32* %value.addr, align 4
  br label %cond.end

cond.end:
  %32 = phi i32 [ 0, %cond.true ], [ %31, %cond.false ]
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store

push.store:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %34
  store i32 %32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = trunc i64 %42 to i32
  store i32 -1, i32* %value.addr, align 4
  store i1 true, i1* %first.addr, align 1
  br label %if.end.2

if.else:
  %44 = load i32, i32* %c.addr, align 4
  %45 = icmp eq i32 %44, 58
  br i1 %45, label %if.then.3, label %if.else.1

if.then.3:
  store i1 false, i1* %first.addr, align 1
  br label %if.end.3

if.else.1:
  %46 = load i1, i1* %first.addr, align 1
  br i1 %46, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %47 = load i32, i32* %c.addr, align 4
  %48 = icmp sge i32 %47, 48
  br label %land.end.2

land.end.2:
  %49 = phi i1 [ false, %if.else.1 ], [ %48, %land.rhs.2 ]
  br i1 %49, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %50 = load i32, i32* %c.addr, align 4
  %51 = add nsw i32 48, 10
  %52 = icmp slt i32 %50, %51
  br label %land.end.1

land.end.1:
  %53 = phi i1 [ false, %land.end.2 ], [ %52, %land.rhs.1 ]
  br i1 %53, label %if.then.4, label %if.end.4

if.then.4:
  %54 = load i32, i32* %value.addr, align 4
  %55 = icmp slt i32 %54, 0
  br i1 %55, label %if.then.5, label %if.else.2

if.then.5:
  %56 = load i32, i32* %c.addr, align 4
  %57 = sub nsw i32 %56, 48
  store i32 %57, i32* %value.addr, align 4
  br label %if.end.5

if.else.2:
  %58 = load i32, i32* %value.addr, align 4
  %59 = icmp slt i32 %58, 10000000
  br i1 %59, label %if.then.6, label %if.end.6

if.then.6:
  %60 = load i32, i32* %value.addr, align 4
  %61 = mul nsw i32 %60, 10
  %62 = load i32, i32* %c.addr, align 4
  %63 = sub nsw i32 %62, 48
  %64 = add nsw i32 %61, %63
  store i32 %64, i32* %value.addr, align 4
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  br label %if.end.4

if.end.4:
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  br label %for.inc

for.inc:
  %65 = load i32, i32* %k.addr, align 4
  %66 = add nsw i32 %65, 1
  store i32 %66, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %67 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  %68 = load i32, i32* %value.addr, align 4
  %69 = icmp slt i32 %68, 0
  br i1 %69, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %70 = load i32, i32* %value.addr, align 4
  br label %cond.end.1

cond.end.1:
  %71 = phi i32 [ 0, %cond.true.1 ], [ %70, %cond.false.1 ]
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 1
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = icmp eq i64 %73, %75
  br i1 %76, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %67, i64 4)
  br label %push.store.1

push.store.1:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 %73
  store i32 %71, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = add i64 %73, 1
  store i64 %81, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = trunc i64 %81 to i32
  %83 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  ret %struct.nish_array* %83
}

define internal noundef nonnull align 8 i8* @nish.termKittyText(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %text.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %f.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  %stopped.addr = alloca i1, align 1
  %start.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %text.addr, align 8
  store i32 0, i32* %f.addr, align 4
  store i32 -1, i32* %value.addr, align 4
  store i1 false, i1* %stopped.addr, align 1
  store i32 %from, i32* %start.addr, align 4
  %3 = load i32, i32* %start.addr, align 4
  %4 = icmp slt i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  store i32 0, i32* %start.addr, align 4
  br label %if.end

if.end:
  %5 = load i32, i32* %start.addr, align 4
  store i32 %5, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %k.addr, align 4
  %7 = icmp slt i32 %6, %to
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %k.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %8, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %k.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %21 = zext i8 %20 to i32
  store i32 %21, i32* %c.addr, align 4
  %22 = load i32, i32* %c.addr, align 4
  %23 = icmp eq i32 %22, 59
  br i1 %23, label %if.then.1, label %if.else

if.then.1:
  %24 = load i32, i32* %f.addr, align 4
  %25 = icmp sge i32 %24, 2
  br i1 %25, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.end

if.end.2:
  %26 = load i32, i32* %f.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %f.addr, align 4
  br label %if.end.1

if.else:
  %28 = load i32, i32* %c.addr, align 4
  %29 = icmp eq i32 %28, 58
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %f.addr, align 4
  %31 = icmp eq i32 %30, 2
  br label %land.end.1

land.end.1:
  %32 = phi i1 [ false, %if.else ], [ %31, %land.rhs.1 ]
  br i1 %32, label %if.then.3, label %if.else.1

if.then.3:
  %33 = load i32, i32* %value.addr, align 4
  %34 = icmp slt i32 %33, 0
  br i1 %34, label %if.then.4, label %if.end.4

if.then.4:
  store i1 true, i1* %stopped.addr, align 1
  br label %for.end

if.end.4:
  %35 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %36 = load i32, i32* %value.addr, align 4
  call void @nish.termPushUtf8(%struct.nish_array* %35, i32 %36)
  store i32 -1, i32* %value.addr, align 4
  br label %if.end.3

if.else.1:
  %37 = load i32, i32* %c.addr, align 4
  %38 = icmp sge i32 %37, 48
  br i1 %38, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %39 = load i32, i32* %c.addr, align 4
  %40 = add nsw i32 48, 10
  %41 = icmp slt i32 %39, %40
  br label %land.end.3

land.end.3:
  %42 = phi i1 [ false, %if.else.1 ], [ %41, %land.rhs.3 ]
  br i1 %42, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %43 = load i32, i32* %f.addr, align 4
  %44 = icmp eq i32 %43, 2
  br label %land.end.2

land.end.2:
  %45 = phi i1 [ false, %land.end.3 ], [ %44, %land.rhs.2 ]
  br i1 %45, label %if.then.5, label %if.end.5

if.then.5:
  %46 = load i32, i32* %value.addr, align 4
  %47 = icmp slt i32 %46, 0
  br i1 %47, label %if.then.6, label %if.else.2

if.then.6:
  %48 = load i32, i32* %c.addr, align 4
  %49 = sub nsw i32 %48, 48
  store i32 %49, i32* %value.addr, align 4
  br label %if.end.6

if.else.2:
  %50 = load i32, i32* %value.addr, align 4
  %51 = icmp slt i32 %50, 10000000
  br i1 %51, label %if.then.7, label %if.end.7

if.then.7:
  %52 = load i32, i32* %value.addr, align 4
  %53 = mul nsw i32 %52, 10
  %54 = load i32, i32* %c.addr, align 4
  %55 = sub nsw i32 %54, 48
  %56 = add nsw i32 %53, %55
  store i32 %56, i32* %value.addr, align 4
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  br label %if.end.3

if.end.3:
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %57 = load i32, i32* %k.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %59 = load i1, i1* %stopped.addr, align 1
  %60 = xor i1 %59, true
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %value.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %for.end ], [ %62, %land.rhs.4 ]
  br i1 %63, label %if.then.8, label %if.end.8

if.then.8:
  %64 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %65 = load i32, i32* %value.addr, align 4
  call void @nish.termPushUtf8(%struct.nish_array* %64, i32 %65)
  br label %if.end.8

if.end.8:
  %66 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %67 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = trunc i64 %69 to i32
  %71 = call i64 @nish_arena_mark()
  %72 = call i8* @nish.termBytesText(%struct.nish_array* %66, i32 %70)
  %73 = call i8* @nish_arena_keep(i64 %71, i8* %72)
  ret i8* %73
}

define internal noundef nonnull align 8 i8* @nish.termBytesRange(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %part.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %start.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %part.addr, align 8
  store i32 %from, i32* %start.addr, align 4
  %3 = load i32, i32* %start.addr, align 4
  %4 = icmp slt i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  store i32 0, i32* %start.addr, align 4
  br label %if.end

if.end:
  %5 = load i32, i32* %start.addr, align 4
  store i32 %5, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %k.addr, align 4
  %7 = icmp slt i32 %6, %to
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %k.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %8, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %15 = load i32, i32* %k.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %16
  %21 = load i8, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 1)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %23
  store i8 %21, i8* %30, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  br label %for.inc

for.inc:
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = call i64 @nish_arena_mark()
  %41 = call i8* @nish.termBytesText(%struct.nish_array* %35, i32 %39)
  %42 = call i8* @nish_arena_keep(i64 %40, i8* %41)
  ret i8* %42
}

define internal void @nish.termPushUtf8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, i32 noundef %cp) #2 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp sge i32 %cp, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %cp, 1114112
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = icmp sge i32 %cp, 55296
  br i1 %3, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %4 = icmp slt i32 %cp, 57344
  br label %land.end.2

land.end.2:
  %5 = phi i1 [ false, %land.rhs ], [ %4, %land.rhs.2 ]
  %6 = xor i1 %5, true
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.end.2 ]
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %cp, %cond.true ], [ 65533, %cond.false ]
  store i32 %8, i32* %c.addr, align 4
  %9 = load i32, i32* %c.addr, align 4
  %10 = icmp slt i32 %9, 128
  br i1 %10, label %if.then, label %if.else

if.then:
  %11 = load i32, i32* %c.addr, align 4
  %12 = trunc i32 %11 to i8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %14
  store i8 %12, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %if.end

if.else:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp slt i32 %24, 2048
  br i1 %25, label %if.then.1, label %if.else.1

if.then.1:
  %26 = load i32, i32* %c.addr, align 4
  %27 = ashr i32 %26, 6
  %28 = or i32 %27, 192
  %29 = trunc i32 %28 to i8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.1

push.store.1:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %31
  store i8 %29, i8* %38, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = load i32, i32* %c.addr, align 4
  %42 = and i32 %41, 63
  %43 = or i32 %42, 128
  %44 = trunc i32 %43 to i8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = icmp eq i64 %46, %48
  br i1 %49, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.2

push.store.2:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i8*
  %53 = getelementptr inbounds i8, i8* %52, i64 %46
  store i8 %44, i8* %53, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %54 = add i64 %46, 1
  store i64 %54, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  br label %if.end.1

if.else.1:
  %56 = load i32, i32* %c.addr, align 4
  %57 = icmp slt i32 %56, 65536
  br i1 %57, label %if.then.2, label %if.else.2

if.then.2:
  %58 = load i32, i32* %c.addr, align 4
  %59 = ashr i32 %58, 12
  %60 = or i32 %59, 224
  %61 = trunc i32 %60 to i8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = icmp eq i64 %63, %65
  br i1 %66, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.3

push.store.3:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 %63
  store i8 %61, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %71 = add i64 %63, 1
  store i64 %71, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = trunc i64 %71 to i32
  %73 = load i32, i32* %c.addr, align 4
  %74 = ashr i32 %73, 6
  %75 = and i32 %74, 63
  %76 = or i32 %75, 128
  %77 = trunc i32 %76 to i8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = icmp eq i64 %79, %81
  br i1 %82, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.4

push.store.4:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = bitcast i8* %84 to i8*
  %86 = getelementptr inbounds i8, i8* %85, i64 %79
  store i8 %77, i8* %86, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %87 = add i64 %79, 1
  store i64 %87, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = trunc i64 %87 to i32
  %89 = load i32, i32* %c.addr, align 4
  %90 = and i32 %89, 63
  %91 = or i32 %90, 128
  %92 = trunc i32 %91 to i8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.5

push.store.5:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i8*
  %101 = getelementptr inbounds i8, i8* %100, i64 %94
  store i8 %92, i8* %101, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  br label %if.end.2

if.else.2:
  %104 = load i32, i32* %c.addr, align 4
  %105 = ashr i32 %104, 18
  %106 = or i32 %105, 240
  %107 = trunc i32 %106 to i8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %112 = icmp eq i64 %109, %111
  br i1 %112, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.6

push.store.6:
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %115 = bitcast i8* %114 to i8*
  %116 = getelementptr inbounds i8, i8* %115, i64 %109
  store i8 %107, i8* %116, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = add i64 %109, 1
  store i64 %117, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = trunc i64 %117 to i32
  %119 = load i32, i32* %c.addr, align 4
  %120 = ashr i32 %119, 12
  %121 = and i32 %120, 63
  %122 = or i32 %121, 128
  %123 = trunc i32 %122 to i8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %128 = icmp eq i64 %125, %127
  br i1 %128, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.7

push.store.7:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %131 = bitcast i8* %130 to i8*
  %132 = getelementptr inbounds i8, i8* %131, i64 %125
  store i8 %123, i8* %132, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %133 = add i64 %125, 1
  store i64 %133, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = trunc i64 %133 to i32
  %135 = load i32, i32* %c.addr, align 4
  %136 = ashr i32 %135, 6
  %137 = and i32 %136, 63
  %138 = or i32 %137, 128
  %139 = trunc i32 %138 to i8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %144 = icmp eq i64 %141, %143
  br i1 %144, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.8

push.store.8:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %147 = bitcast i8* %146 to i8*
  %148 = getelementptr inbounds i8, i8* %147, i64 %141
  store i8 %139, i8* %148, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %149 = add i64 %141, 1
  store i64 %149, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = trunc i64 %149 to i32
  %151 = load i32, i32* %c.addr, align 4
  %152 = and i32 %151, 63
  %153 = or i32 %152, 128
  %154 = trunc i32 %153 to i8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %158 = load i64, i64* %157, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %159 = icmp eq i64 %156, %158
  br i1 %159, label %push.grow.9, label %push.store.9

push.grow.9:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.9

push.store.9:
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %161 = load i8*, i8** %160, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %162 = bitcast i8* %161 to i8*
  %163 = getelementptr inbounds i8, i8* %162, i64 %156
  store i8 %154, i8* %163, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %164 = add i64 %156, 1
  store i64 %164, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = trunc i64 %164 to i32
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void
}

define internal noundef i32 @nish.termKittyKind(i32 noundef %code) #1 {
entry:
  %0 = icmp eq i32 %code, 13
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 6

if.end:
  %1 = icmp eq i32 %code, 9
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 10

if.end.1:
  %2 = icmp eq i32 %code, 127
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %code, 8
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %if.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 11

if.end.2:
  %5 = icmp eq i32 %code, 27
  br i1 %5, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 8

if.end.3:
  %6 = icmp eq i32 %code, 32
  br i1 %6, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 7

if.end.4:
  %7 = icmp slt i32 %code, 0
  br i1 %7, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %8 = icmp sge i32 %code, 57344
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = icmp slt i32 %code, 63744
  br label %land.end

land.end:
  %10 = phi i1 [ false, %lor.rhs.2 ], [ %9, %land.rhs ]
  br label %lor.end.2

lor.end.2:
  %11 = phi i1 [ true, %if.end.4 ], [ %10, %land.end ]
  br i1 %11, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %12 = icmp sge i32 %code, 1114112
  br label %lor.end.1

lor.end.1:
  %13 = phi i1 [ true, %lor.end.2 ], [ %12, %lor.rhs.1 ]
  br i1 %13, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 13

if.end.5:
  %14 = icmp slt i32 %code, 32
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ 12, %cond.true ], [ 1, %cond.false ]
  ret i32 %15
}

define internal noundef i32 @nish.termTildeKind(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 1
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp eq i32 %n, 7
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 26

if.end:
  %3 = icmp eq i32 %n, 4
  br i1 %3, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %4 = icmp eq i32 %n, 8
  br label %lor.end.1

lor.end.1:
  %5 = phi i1 [ true, %if.end ], [ %4, %lor.rhs.1 ]
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 27

if.end.1:
  %6 = icmp eq i32 %n, 2
  br i1 %6, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 30

if.end.2:
  %7 = icmp eq i32 %n, 3
  br i1 %7, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 31

if.end.3:
  %8 = icmp eq i32 %n, 5
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 28

if.end.4:
  %9 = icmp eq i32 %n, 6
  br i1 %9, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 29

if.end.5:
  %10 = icmp sge i32 %n, 11
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = icmp sle i32 %n, 15
  br label %land.end

land.end:
  %12 = phi i1 [ false, %if.end.5 ], [ %11, %land.rhs ]
  br i1 %12, label %if.then.6, label %if.end.6

if.then.6:
  %13 = sub nsw i32 %n, 11
  %14 = add nsw i32 14, %13
  ret i32 %14

if.end.6:
  %15 = icmp sge i32 %n, 17
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = icmp sle i32 %n, 21
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %if.end.6 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %if.then.7, label %if.end.7

if.then.7:
  %18 = sub nsw i32 %n, 17
  %19 = add nsw i32 19, %18
  ret i32 %19

if.end.7:
  %20 = icmp eq i32 %n, 23
  br i1 %20, label %if.then.8, label %if.end.8

if.then.8:
  ret i32 24

if.end.8:
  %21 = icmp eq i32 %n, 24
  br i1 %21, label %if.then.9, label %if.end.9

if.then.9:
  ret i32 25

if.end.9:
  ret i32 13
}

define internal noundef i32 @nish.termLetterKind(i32 noundef %f) #1 {
entry:
  %0 = icmp eq i32 %f, 72
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 26

if.end:
  %1 = icmp eq i32 %f, 70
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 27

if.end.1:
  %2 = icmp sge i32 %f, 80
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = icmp sle i32 %f, 83
  br label %land.end

land.end:
  %4 = phi i1 [ false, %if.end.1 ], [ %3, %land.rhs ]
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  %5 = sub nsw i32 %f, 80
  %6 = add nsw i32 14, %5
  ret i32 %6

if.end.2:
  %7 = tail call i32 @nish.termArrowKind(i32 %f)
  ret i32 %7
}

define internal noundef zeroext i1 @nish.termFinite(double noundef %x) #1 {
entry:
  %0 = fsub double %x, %x
  %1 = fcmp oeq double %0, 0x0000000000000000
  ret i1 %1
}

define internal noundef zeroext i1 @nish.termIsCtrlC(%struct.TermEvent* noundef nonnull readonly align 8 dereferenceable(80) nocapture %e) #0 {
entry:
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !47
  %2 = icmp eq i32 %1, 9
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !47
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %7 = load i32, i32* %6, align 4, !tbaa !48
  %8 = icmp eq i32 %7, 99
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %lor.rhs ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %11 = load i32, i32* %10, align 4, !tbaa !49
  %12 = icmp eq i32 %11, 4
  br label %land.end

land.end:
  %13 = phi i1 [ false, %land.end.1 ], [ %12, %land.rhs ]
  br label %lor.end

lor.end:
  %14 = phi i1 [ true, %entry ], [ %13, %land.end ]
  ret i1 %14
}

define internal noundef zeroext i1 @nish.termNamesKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %batch, i32 noundef %id) #4 {
entry:
  %k.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %batch, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %batch, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %k.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to %struct.TermEvent**
  %10 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %9, i64 %8
  %11 = load %struct.TermEvent*, %struct.TermEvent** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.TermEvent* %11, %struct.TermEvent** %e.addr, align 8
  %12 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !46
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %17 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !47
  %19 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %20 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %19, i32 0, i32 2
  %21 = load i32, i32* %20, align 4, !tbaa !48
  %22 = call i32 @nish.termKeyId(i32 %18, i32 %21)
  %23 = icmp eq i32 %22, %id
  br label %land.end

land.end:
  %24 = phi i1 [ false, %for.body ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef i32 @nish.termKeyId(i32 noundef %key, i32 noundef %code) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp eq i32 %key, 1
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = icmp eq i32 %key, 12
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %key, 13
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %lor.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ %code, %cond.true ], [ 0, %cond.false ]
  store i32 %5, i32* %c.addr, align 4
  %6 = icmp eq i32 %key, 1
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %c.addr, align 4
  %8 = icmp sge i32 %7, 65
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %cond.end ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp sle i32 %10, 90
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %c.addr, align 4
  %14 = add nsw i32 %13, 32
  store i32 %14, i32* %c.addr, align 4
  br label %if.end

if.end:
  %15 = shl i32 %key, 21
  %16 = load i32, i32* %c.addr, align 4
  %17 = and i32 %16, 2097151
  %18 = or i32 %15, %17
  ret i32 %18
}

define internal noundef i32 @nish.termPasteEndByte(i32 noundef %k) #1 {
entry:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 27

if.end:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 91

if.end.1:
  %2 = icmp eq i32 %k, 5
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 126

if.end.2:
  %3 = icmp eq i32 %k, 3
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 48

if.end.3:
  %4 = icmp eq i32 %k, 2
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ 50, %cond.true ], [ 49, %cond.false ]
  ret i32 %5
}

define internal noundef i32 @nish.termDecodePaste(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %resume.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 %i, i32* %k.addr, align 4
  store i32 -1, i32* %resume.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %while.cond ], [ %9, %land.rhs ]
  br i1 %10, label %while.body, label %while.end

while.body:
  store i32 0, i32* %m.addr, align 4
  %11 = load i32, i32* %k.addr, align 4
  store i32 %11, i32* %at.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %16 = load i32, i32* %m.addr, align 4
  %17 = icmp slt i32 %16, 6
  br i1 %17, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %18 = load i32, i32* %at.addr, align 4
  %19 = icmp sge i32 %18, 0
  br label %land.end.3

land.end.3:
  %20 = phi i1 [ false, %while.cond.1 ], [ %19, %land.rhs.3 ]
  br i1 %20, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %21 = load i32, i32* %at.addr, align 4
  %22 = trunc i64 %13 to i32
  %23 = icmp slt i32 %21, %22
  br label %land.end.2

land.end.2:
  %24 = phi i1 [ false, %land.end.3 ], [ %23, %land.rhs.2 ]
  br i1 %24, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %25 = load i32, i32* %at.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %15 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %26
  %29 = load i8, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = zext i8 %29 to i32
  %31 = load i32, i32* %m.addr, align 4
  %32 = call i32 @nish.termPasteEndByte(i32 %31)
  %33 = icmp eq i32 %30, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %while.body.1, label %while.end.1

while.body.1:
  %35 = load i32, i32* %m.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %m.addr, align 4
  %37 = load i32, i32* %at.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %at.addr, align 4
  br label %while.cond.1

while.end.1:
  %39 = load i32, i32* %m.addr, align 4
  %40 = icmp eq i32 %39, 6
  br i1 %40, label %if.then, label %if.end

if.then:
  %41 = load i32, i32* %at.addr, align 4
  store i32 %41, i32* %resume.addr, align 4
  br label %while.end

if.end:
  %42 = load i32, i32* %m.addr, align 4
  %43 = icmp sgt i32 %42, 0
  br i1 %43, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %44 = load i32, i32* %at.addr, align 4
  %45 = load i32, i32* %n.addr, align 4
  %46 = icmp sge i32 %44, %45
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %if.end ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = xor i1 %last, true
  br label %land.end.4

land.end.4:
  %49 = phi i1 [ false, %land.end.5 ], [ %48, %land.rhs.4 ]
  br i1 %49, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end

if.end.1:
  %50 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !73
  %52 = load i32, i32* %k.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i8*
  %57 = getelementptr inbounds i8, i8* %56, i64 %53
  %58 = load i8, i8* %57, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = icmp eq i64 %60, %62
  br i1 %63, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %51, i64 1)
  br label %push.store

push.store:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8*
  %67 = getelementptr inbounds i8, i8* %66, i64 %60
  store i8 %58, i8* %67, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = add i64 %60, 1
  store i64 %68, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = trunc i64 %68 to i32
  %70 = load i32, i32* %k.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %72 = load i32, i32* %resume.addr, align 4
  %73 = icmp slt i32 %72, 0
  br i1 %73, label %if.then.2, label %if.end.2

if.then.2:
  %74 = load i32, i32* %k.addr, align 4
  ret i32 %74

if.end.2:
  %75 = call i8* @nish_alloc_struct(i64 80)
  %76 = bitcast i8* %75 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %76, i32 3)
  store %struct.TermEvent* %76, %struct.TermEvent** %e.addr, align 8
  %77 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %78 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %79 = load %struct.nish_array*, %struct.nish_array** %78, align 8, !tbaa !73
  %80 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !73
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = call i64 @nish_arena_mark()
  %86 = call i8* @nish.termBytesText(%struct.nish_array* %79, i32 %84)
  %87 = call i8* @nish_arena_keep(i64 %85, i8* %86)
  %88 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %77, i32 0, i32 10
  store i8* %87, i8** %88, align 8, !tbaa !56
  %89 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = icmp eq i64 %91, %93
  br i1 %94, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %96 to %struct.TermEvent**
  %98 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %97, i64 %91
  store %struct.TermEvent* %89, %struct.TermEvent** %98, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %99 = add i64 %91, 1
  store i64 %99, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = trunc i64 %99 to i32
  %101 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  store i1 false, i1* %101, align 1, !tbaa !72
  %102 = call i8* @nish_alloc_struct(i64 24)
  %103 = bitcast i8* %102 to %struct.nish_array*
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  store i64 0, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 1
  store i64 0, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  store i8* null, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %107 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  store %struct.nish_array* %103, %struct.nish_array** %107, align 8, !tbaa !73
  %108 = load i32, i32* %resume.addr, align 4
  ret i32 %108
}

define internal noundef i32 @nish.termFromOne(i32 noundef %v) #1 {
entry:
  %0 = icmp sgt i32 %v, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub nsw i32 %v, 1
  ret i32 %1

if.end:
  ret i32 0
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termMouseEvent(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %final) #3 {
entry:
  %b.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %bits.addr = alloca i32, align 4
  %none.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 0, i32 0)
  store i32 %0, i32* %b.addr, align 4
  %1 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 0)
  %2 = call i32 @nish.termFromOne(i32 %1)
  store i32 %2, i32* %x.addr, align 4
  %3 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 0)
  %4 = call i32 @nish.termFromOne(i32 %3)
  store i32 %4, i32* %y.addr, align 4
  %5 = call i8* @nish_alloc_struct(i64 80)
  %6 = bitcast i8* %5 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %6, i32 2)
  store %struct.TermEvent* %6, %struct.TermEvent** %e.addr, align 8
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %9 = load i32, i32* %b.addr, align 4
  br label %cond.end

cond.end:
  %10 = phi i32 [ 3, %cond.true ], [ %9, %cond.false ]
  store i32 %10, i32* %bits.addr, align 4
  store i32 0, i32* %none.addr, align 4
  %11 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %12 = load i32, i32* %bits.addr, align 4
  %13 = and i32 %12, 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %15 = load i32, i32* %none.addr, align 4
  br label %cond.end.1

cond.end.1:
  %16 = phi i32 [ 1, %cond.true.1 ], [ %15, %cond.false.1 ]
  %17 = load i32, i32* %bits.addr, align 4
  %18 = and i32 %17, 8
  %19 = icmp ne i32 %18, 0
  br i1 %19, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  %20 = load i32, i32* %none.addr, align 4
  br label %cond.end.2

cond.end.2:
  %21 = phi i32 [ 2, %cond.true.2 ], [ %20, %cond.false.2 ]
  %22 = or i32 %16, %21
  %23 = load i32, i32* %bits.addr, align 4
  %24 = and i32 %23, 16
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %cond.true.3, label %cond.false.3

cond.true.3:
  br label %cond.end.3

cond.false.3:
  %26 = load i32, i32* %none.addr, align 4
  br label %cond.end.3

cond.end.3:
  %27 = phi i32 [ 4, %cond.true.3 ], [ %26, %cond.false.3 ]
  %28 = or i32 %22, %27
  %29 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %11, i32 0, i32 3
  store i32 %28, i32* %29, align 4, !tbaa !49
  %30 = load i32, i32* %bits.addr, align 4
  %31 = and i32 %30, 3
  store i32 %31, i32* %low.addr, align 4
  %32 = load i32, i32* %bits.addr, align 4
  %33 = and i32 %32, 128
  %34 = icmp ne i32 %33, 0
  br i1 %34, label %if.then, label %if.else

if.then:
  %35 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %36 = load i32, i32* %low.addr, align 4
  %37 = add nsw i32 8, %36
  %38 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %35, i32 0, i32 5
  store i32 %37, i32* %38, align 4, !tbaa !51
  br label %if.end

if.else:
  %39 = load i32, i32* %bits.addr, align 4
  %40 = and i32 %39, 64
  %41 = icmp ne i32 %40, 0
  br i1 %41, label %if.then.1, label %if.else.1

if.then.1:
  %42 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %43 = load i32, i32* %low.addr, align 4
  %44 = add nsw i32 4, %43
  %45 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %42, i32 0, i32 5
  store i32 %44, i32* %45, align 4, !tbaa !51
  br label %if.end.1

if.else.1:
  %46 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %47 = load i32, i32* %low.addr, align 4
  %48 = icmp eq i32 %47, 3
  br i1 %48, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  %49 = load i32, i32* %low.addr, align 4
  %50 = add nsw i32 %49, 1
  br label %cond.end.4

cond.end.4:
  %51 = phi i32 [ 0, %cond.true.4 ], [ %50, %cond.false.4 ]
  %52 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %46, i32 0, i32 5
  store i32 %51, i32* %52, align 4, !tbaa !51
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %53 = load i32, i32* %bits.addr, align 4
  %54 = and i32 %53, 32
  %55 = icmp ne i32 %54, 0
  br i1 %55, label %if.then.2, label %if.else.2

if.then.2:
  %56 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %57 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %56, i32 0, i32 4
  store i32 4, i32* %57, align 4, !tbaa !50
  br label %if.end.2

if.else.2:
  %58 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %59 = icmp eq i32 %final, 77
  br i1 %59, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %60 = phi i32 [ 1, %cond.true.5 ], [ 3, %cond.false.5 ]
  %61 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %58, i32 0, i32 4
  store i32 %60, i32* %61, align 4, !tbaa !50
  br label %if.end.2

if.end.2:
  %62 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 7
  %63 = load i1, i1* %62, align 1, !tbaa !69
  %64 = xor i1 %63, true
  br i1 %64, label %if.then.3, label %if.end.3

if.then.3:
  %65 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %66 = load i32, i32* %x.addr, align 4
  %67 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %65, i32 0, i32 6
  store i32 %66, i32* %67, align 4, !tbaa !52
  %68 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %69 = load i32, i32* %y.addr, align 4
  %70 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %68, i32 0, i32 7
  store i32 %69, i32* %70, align 4, !tbaa !53
  %71 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %71

if.end.3:
  %72 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %73 = load i32, i32* %x.addr, align 4
  %74 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %72, i32 0, i32 8
  store i32 %73, i32* %74, align 4, !tbaa !54
  %75 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %76 = load i32, i32* %y.addr, align 4
  %77 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %75, i32 0, i32 9
  store i32 %76, i32* %77, align 4, !tbaa !55
  %78 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 5
  %79 = load i32, i32* %78, align 4, !tbaa !70
  store i32 %79, i32* %w.addr, align 4
  %80 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 6
  %81 = load i32, i32* %80, align 4, !tbaa !71
  store i32 %81, i32* %h.addr, align 4
  %82 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %83 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %82, i32 0, i32 6
  store i32 -1, i32* %83, align 4, !tbaa !52
  %84 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %85 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %84, i32 0, i32 7
  store i32 -1, i32* %85, align 4, !tbaa !53
  %86 = load i32, i32* %w.addr, align 4
  %87 = icmp sgt i32 %86, 0
  br i1 %87, label %if.then.4, label %if.end.4

if.then.4:
  %88 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %89 = load i32, i32* %x.addr, align 4
  %90 = load i32, i32* %w.addr, align 4
  %91 = sdiv i32 %89, %90
  %92 = or i32 %91, 0
  %93 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %88, i32 0, i32 6
  store i32 %92, i32* %93, align 4, !tbaa !52
  br label %if.end.4

if.end.4:
  %94 = load i32, i32* %h.addr, align 4
  %95 = icmp sgt i32 %94, 0
  br i1 %95, label %if.then.5, label %if.end.5

if.then.5:
  %96 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %97 = load i32, i32* %y.addr, align 4
  %98 = load i32, i32* %h.addr, align 4
  %99 = sdiv i32 %97, %98
  %100 = or i32 %99, 0
  %101 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %96, i32 0, i32 7
  store i32 %100, i32* %101, align 4, !tbaa !53
  br label %if.end.5

if.end.5:
  %102 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %102
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termReplyEvent(i32 noundef %introducer, i32 noundef %prefix, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %params, i32 noundef %intermediate, i32 noundef %reply, i8* noundef nonnull noalias readonly align 8 %text) #2 {
entry:
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = call i8* @nish_alloc_struct(i64 80)
  %1 = bitcast i8* %0 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %1, i32 6)
  store %struct.TermEvent* %1, %struct.TermEvent** %e.addr, align 8
  %2 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %2, i32 0, i32 12
  store i32 %introducer, i32* %3, align 4, !tbaa !58
  %4 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %4, i32 0, i32 13
  store i32 %prefix, i32* %5, align 4, !tbaa !59
  %6 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %6, i32 0, i32 15
  store %struct.nish_array* %params, %struct.nish_array** %7, align 8, !tbaa !61
  %8 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %8, i32 0, i32 14
  store i32 %intermediate, i32* %9, align 4, !tbaa !60
  %10 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %11 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %10, i32 0, i32 11
  store i32 %reply, i32* %11, align 4, !tbaa !57
  %12 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %12, i32 0, i32 10
  store i8* %text, i8** %13, align 8, !tbaa !56
  %14 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %14
}

define internal void @nish.termCsiEvent(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %prefix, i32 noundef %intermediate, i32 noundef %final, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %first.addr = alloca i32, align 4
  %cpr.addr = alloca i1, align 1
  %outstanding.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %mods.addr = alloca i32, align 4
  %action.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %e.addr.1 = alloca %struct.TermEvent*, align 8
  %kind.addr = alloca i32, align 4
  %e.addr.2 = alloca %struct.TermEvent*, align 8
  %0 = icmp eq i32 %prefix, 60
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp eq i32 %final, 77
  br i1 %1, label %lor.end, label %lor.rhs

lor.rhs:
  %2 = icmp eq i32 %final, 109
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %land.rhs ], [ %2, %lor.rhs ]
  br label %land.end

land.end:
  %4 = phi i1 [ false, %entry ], [ %3, %lor.end ]
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = call %struct.TermEvent* @nish.termMouseEvent(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %from, i32 %to, i32 %final)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.TermEvent**
  %14 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %13, i64 %7
  store %struct.TermEvent* %5, %struct.TermEvent** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  ret void

if.end:
  %17 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 0, i32 0)
  store i32 %17, i32* %first.addr, align 4
  %18 = icmp eq i32 %final, 82
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  %20 = load i32, i32* %19, align 4, !tbaa !68
  %21 = icmp sgt i32 %20, 0
  br label %land.end.1

land.end.1:
  %22 = phi i1 [ false, %if.end ], [ %21, %land.rhs.1 ]
  store i1 %22, i1* %cpr.addr, align 1
  %23 = icmp ne i32 %prefix, 0
  br i1 %23, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %24 = icmp ne i32 %intermediate, 0
  br label %lor.end.4

lor.end.4:
  %25 = phi i1 [ true, %land.end.1 ], [ %24, %lor.rhs.4 ]
  br i1 %25, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %26 = icmp eq i32 %final, 110
  br label %lor.end.3

lor.end.3:
  %27 = phi i1 [ true, %lor.end.4 ], [ %26, %lor.rhs.3 ]
  br i1 %27, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %28 = icmp eq i32 %final, 116
  br label %lor.end.2

lor.end.2:
  %29 = phi i1 [ true, %lor.end.3 ], [ %28, %lor.rhs.2 ]
  br i1 %29, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %30 = load i1, i1* %cpr.addr, align 1
  br label %lor.end.1

lor.end.1:
  %31 = phi i1 [ true, %lor.end.2 ], [ %30, %lor.rhs.1 ]
  br i1 %31, label %if.then.1, label %if.end.1

if.then.1:
  %32 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  %33 = load i32, i32* %32, align 4, !tbaa !68
  store i32 %33, i32* %outstanding.addr, align 4
  %34 = load i1, i1* %cpr.addr, align 1
  br i1 %34, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %35 = load i32, i32* %outstanding.addr, align 4
  %36 = icmp sgt i32 %35, 0
  br label %land.end.2

land.end.2:
  %37 = phi i1 [ false, %if.then.1 ], [ %36, %land.rhs.2 ]
  br i1 %37, label %if.then.2, label %if.end.2

if.then.2:
  %38 = load i32, i32* %outstanding.addr, align 4
  %39 = sub nsw i32 %38, 1
  %40 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  store i32 %39, i32* %40, align 4, !tbaa !68
  br label %if.end.2

if.end.2:
  %41 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %from, i32 %to)
  %42 = call %struct.TermEvent* @nish.termReplyEvent(i32 91, i32 %prefix, %struct.nish_array* %41, i32 %intermediate, i32 %final, i8* bitcast ({ i64, [1 x i8] }* @.str.12 to i8*))
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = icmp eq i64 %44, %46
  br i1 %47, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to %struct.TermEvent**
  %51 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %50, i64 %44
  store %struct.TermEvent* %42, %struct.TermEvent** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %52 = add i64 %44, 1
  store i64 %52, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = trunc i64 %52 to i32
  ret void

if.end.1:
  %54 = icmp eq i32 %final, 73
  br i1 %54, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %55 = icmp eq i32 %final, 79
  br label %lor.end.5

lor.end.5:
  %56 = phi i1 [ true, %if.end.1 ], [ %55, %lor.rhs.5 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = icmp eq i32 %from, %to
  br label %land.end.3

land.end.3:
  %58 = phi i1 [ false, %lor.end.5 ], [ %57, %land.rhs.3 ]
  br i1 %58, label %if.then.3, label %if.end.3

if.then.3:
  %59 = call i8* @nish_alloc_struct(i64 80)
  %60 = bitcast i8* %59 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %60, i32 4)
  store %struct.TermEvent* %60, %struct.TermEvent** %e.addr, align 8
  %61 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %62 = icmp eq i32 %final, 73
  %63 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %61, i32 0, i32 16
  store i1 %62, i1* %63, align 1, !tbaa !62
  %64 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to %struct.TermEvent**
  %73 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %72, i64 %66
  store %struct.TermEvent* %64, %struct.TermEvent** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  ret void

if.end.3:
  %76 = icmp eq i32 %final, 126
  br i1 %76, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %77 = load i32, i32* %first.addr, align 4
  %78 = icmp eq i32 %77, 200
  br i1 %78, label %lor.end.6, label %lor.rhs.6

lor.rhs.6:
  %79 = load i32, i32* %first.addr, align 4
  %80 = icmp eq i32 %79, 201
  br label %lor.end.6

lor.end.6:
  %81 = phi i1 [ true, %land.rhs.4 ], [ %80, %lor.rhs.6 ]
  br label %land.end.4

land.end.4:
  %82 = phi i1 [ false, %if.end.3 ], [ %81, %lor.end.6 ]
  br i1 %82, label %if.then.4, label %if.end.4

if.then.4:
  %83 = load i32, i32* %first.addr, align 4
  %84 = icmp eq i32 %83, 200
  %85 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  store i1 %84, i1* %85, align 1, !tbaa !72
  %86 = call i8* @nish_alloc_struct(i64 24)
  %87 = bitcast i8* %86 to %struct.nish_array*
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  store i64 0, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 1
  store i64 0, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  store i8* null, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  store %struct.nish_array* %87, %struct.nish_array** %91, align 8, !tbaa !73
  ret void

if.end.4:
  %92 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 0)
  %93 = call i32 @nish.termModifiers(i32 %92)
  store i32 %93, i32* %mods.addr, align 4
  %94 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 1)
  %95 = call i32 @nish.termAction(i32 %94)
  store i32 %95, i32* %action.addr, align 4
  %96 = icmp eq i32 %final, 117
  br i1 %96, label %lor.end.7, label %lor.rhs.7

lor.rhs.7:
  %97 = icmp eq i32 %final, 126
  br i1 %97, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %98 = load i32, i32* %first.addr, align 4
  %99 = icmp eq i32 %98, 27
  br label %land.end.5

land.end.5:
  %100 = phi i1 [ false, %lor.rhs.7 ], [ %99, %land.rhs.5 ]
  br label %lor.end.7

lor.end.7:
  %101 = phi i1 [ true, %if.end.4 ], [ %100, %land.end.5 ]
  br i1 %101, label %if.then.5, label %if.end.5

if.then.5:
  %102 = icmp eq i32 %final, 117
  br i1 %102, label %cond.true, label %cond.false

cond.true:
  %103 = load i32, i32* %first.addr, align 4
  br label %cond.end

cond.false:
  %104 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 0)
  br label %cond.end

cond.end:
  %105 = phi i32 [ %103, %cond.true ], [ %104, %cond.false ]
  store i32 %105, i32* %code.addr, align 4
  %106 = load i32, i32* %code.addr, align 4
  %107 = call i32 @nish.termKittyKind(i32 %106)
  %108 = load i32, i32* %code.addr, align 4
  %109 = icmp slt i32 %108, 0
  br i1 %109, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %110 = load i32, i32* %code.addr, align 4
  br label %cond.end.1

cond.end.1:
  %111 = phi i32 [ %final, %cond.true.1 ], [ %110, %cond.false.1 ]
  %112 = load i32, i32* %mods.addr, align 4
  %113 = load i32, i32* %action.addr, align 4
  %114 = call %struct.TermEvent* @nish.termKeyEvent(i32 %107, i32 %111, i32 %112, i32 %113)
  store %struct.TermEvent* %114, %struct.TermEvent** %e.addr.1, align 8
  %115 = icmp eq i32 %final, 117
  br i1 %115, label %if.then.6, label %if.end.6

if.then.6:
  %116 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.1, align 8
  %117 = call i8* @nish.termKittyText(%struct.nish_array* %bytes, i32 %from, i32 %to)
  %118 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %116, i32 0, i32 10
  store i8* %117, i8** %118, align 8, !tbaa !56
  br label %if.end.6

if.end.6:
  %119 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.1, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %124 = icmp eq i64 %121, %123
  br i1 %124, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %127 = bitcast i8* %126 to %struct.TermEvent**
  %128 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %127, i64 %121
  store %struct.TermEvent* %119, %struct.TermEvent** %128, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %129 = add i64 %121, 1
  store i64 %129, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = trunc i64 %129 to i32
  ret void

if.end.5:
  %131 = icmp eq i32 %final, 90
  br i1 %131, label %if.then.7, label %if.end.7

if.then.7:
  %132 = load i32, i32* %mods.addr, align 4
  %133 = or i32 %132, 1
  %134 = load i32, i32* %action.addr, align 4
  %135 = call %struct.TermEvent* @nish.termKeyEvent(i32 10, i32 9, i32 %133, i32 %134)
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = icmp eq i64 %137, %139
  br i1 %140, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %143 = bitcast i8* %142 to %struct.TermEvent**
  %144 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %143, i64 %137
  store %struct.TermEvent* %135, %struct.TermEvent** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %145 = add i64 %137, 1
  store i64 %145, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = trunc i64 %145 to i32
  ret void

if.end.7:
  %147 = icmp eq i32 %final, 126
  br i1 %147, label %cond.true.2, label %cond.false.2

cond.true.2:
  %148 = load i32, i32* %first.addr, align 4
  %149 = call i32 @nish.termTildeKind(i32 %148)
  br label %cond.end.2

cond.false.2:
  %150 = call i32 @nish.termLetterKind(i32 %final)
  br label %cond.end.2

cond.end.2:
  %151 = phi i32 [ %149, %cond.true.2 ], [ %150, %cond.false.2 ]
  store i32 %151, i32* %kind.addr, align 4
  %152 = load i32, i32* %kind.addr, align 4
  %153 = load i32, i32* %mods.addr, align 4
  %154 = load i32, i32* %action.addr, align 4
  %155 = call %struct.TermEvent* @nish.termKeyEvent(i32 %152, i32 %final, i32 %153, i32 %154)
  store %struct.TermEvent* %155, %struct.TermEvent** %e.addr.2, align 8
  %156 = load i32, i32* %kind.addr, align 4
  %157 = icmp eq i32 %156, 13
  br i1 %157, label %if.then.8, label %if.end.8

if.then.8:
  %158 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.2, align 8
  %159 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %from, i32 %to)
  %160 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %158, i32 0, i32 15
  store %struct.nish_array* %159, %struct.nish_array** %160, align 8, !tbaa !61
  br label %if.end.8

if.end.8:
  %161 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.2, align 8
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %165 = load i64, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %166 = icmp eq i64 %163, %165
  br i1 %166, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %169 = bitcast i8* %168 to %struct.TermEvent**
  %170 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %169, i64 %163
  store %struct.TermEvent* %161, %struct.TermEvent** %170, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %171 = add i64 %163, 1
  store i64 %171, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = trunc i64 %171 to i32
  ret void
}

define internal noundef i32 @nish.termDecodeCsi(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %open, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %n.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %key.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %prefix.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %intermediate.addr = alloca i32, align 4
  %back.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 %open, i32* %j.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %5 = load i32, i32* %j.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %j.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br label %land.end.1

land.end.1:
  %10 = phi i1 [ false, %while.cond ], [ %9, %land.rhs.1 ]
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %j.addr, align 4
  %12 = icmp eq i32 %11, %open
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = load i32, i32* %j.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %4 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = zext i8 %17 to i32
  %19 = icmp sge i32 %18, 32
  br i1 %19, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %20 = load i32, i32* %j.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %4 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 %21
  %24 = load i8, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = zext i8 %24 to i32
  %26 = icmp slt i32 %25, 64
  br label %land.end.2

land.end.2:
  %27 = phi i1 [ false, %lor.rhs ], [ %26, %land.rhs.2 ]
  br label %lor.end

lor.end:
  %28 = phi i1 [ true, %land.rhs ], [ %27, %land.end.2 ]
  br label %land.end

land.end:
  %29 = phi i1 [ false, %land.end.1 ], [ %28, %lor.end ]
  br i1 %29, label %while.body, label %while.end

while.body:
  %30 = load i32, i32* %j.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %j.addr, align 4
  %33 = icmp slt i32 %32, 0
  br i1 %33, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %34 = load i32, i32* %j.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  %38 = icmp sge i32 %34, %37
  br label %lor.end.1

lor.end.1:
  %39 = phi i1 [ true, %while.end ], [ %38, %lor.rhs.1 ]
  br i1 %39, label %if.then, label %if.end

if.then:
  %40 = xor i1 %last, true
  br i1 %40, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -1

if.end.1:
  %41 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 27, i32 0, i32 1)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to %struct.TermEvent**
  %50 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %49, i64 %43
  store %struct.TermEvent* %41, %struct.TermEvent** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  ret i32 %open

if.end:
  %53 = load i32, i32* %j.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i8*
  %58 = getelementptr inbounds i8, i8* %57, i64 %54
  %59 = load i8, i8* %58, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %60 = zext i8 %59 to i32
  store i32 %60, i32* %final.addr, align 4
  %61 = load i32, i32* %final.addr, align 4
  %62 = icmp sge i32 %61, 64
  br i1 %62, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %63 = load i32, i32* %final.addr, align 4
  %64 = icmp slt i32 %63, 127
  br label %land.end.3

land.end.3:
  %65 = phi i1 [ false, %if.end ], [ %64, %land.rhs.3 ]
  %66 = xor i1 %65, true
  br i1 %66, label %if.then.2, label %if.end.2

if.then.2:
  %67 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 27, i32 0, i32 1)
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = icmp eq i64 %69, %71
  br i1 %72, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to %struct.TermEvent**
  %76 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %75, i64 %69
  store %struct.TermEvent* %67, %struct.TermEvent** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %77 = add i64 %69, 1
  store i64 %77, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = trunc i64 %77 to i32
  ret i32 %open

if.end.2:
  store i32 %open, i32* %from.addr, align 4
  %79 = load i32, i32* %from.addr, align 4
  %80 = load i32, i32* %j.addr, align 4
  %81 = icmp slt i32 %79, %80
  br i1 %81, label %if.then.3, label %if.end.3

if.then.3:
  %82 = load i32, i32* %from.addr, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %from.addr, align 4
  br label %if.end.3

if.end.3:
  %84 = load i32, i32* %final.addr, align 4
  %85 = icmp eq i32 %84, 91
  br i1 %85, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %86 = load i32, i32* %from.addr, align 4
  %87 = load i32, i32* %j.addr, align 4
  %88 = icmp eq i32 %86, %87
  br label %land.end.4

land.end.4:
  %89 = phi i1 [ false, %if.end.3 ], [ %88, %land.rhs.4 ]
  br i1 %89, label %if.then.4, label %if.end.4

if.then.4:
  %90 = load i32, i32* %j.addr, align 4
  %91 = add nsw i32 %90, 1
  store i32 %91, i32* %key.addr, align 4
  %92 = load i32, i32* %key.addr, align 4
  %93 = load i32, i32* %n.addr, align 4
  %94 = icmp sge i32 %92, %93
  br i1 %94, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %95 = xor i1 %last, true
  br label %land.end.5

land.end.5:
  %96 = phi i1 [ false, %if.then.4 ], [ %95, %land.rhs.5 ]
  br i1 %96, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 -1

if.end.5:
  %97 = load i32, i32* %key.addr, align 4
  %98 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %97)
  store i32 %98, i32* %f.addr, align 4
  %99 = load i32, i32* %key.addr, align 4
  %100 = load i32, i32* %n.addr, align 4
  %101 = icmp slt i32 %99, %100
  br i1 %101, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %102 = load i32, i32* %f.addr, align 4
  %103 = icmp sge i32 %102, 65
  br label %land.end.7

land.end.7:
  %104 = phi i1 [ false, %if.end.5 ], [ %103, %land.rhs.7 ]
  br i1 %104, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %105 = load i32, i32* %f.addr, align 4
  %106 = icmp sle i32 %105, 69
  br label %land.end.6

land.end.6:
  %107 = phi i1 [ false, %land.end.7 ], [ %106, %land.rhs.6 ]
  br i1 %107, label %if.then.6, label %if.end.6

if.then.6:
  %108 = load i32, i32* %f.addr, align 4
  %109 = sub nsw i32 %108, 65
  %110 = add nsw i32 14, %109
  %111 = load i32, i32* %f.addr, align 4
  %112 = call %struct.TermEvent* @nish.termKeyEvent(i32 %110, i32 %111, i32 0, i32 1)
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = icmp eq i64 %114, %116
  br i1 %117, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %120 = bitcast i8* %119 to %struct.TermEvent**
  %121 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %120, i64 %114
  store %struct.TermEvent* %112, %struct.TermEvent** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %122 = add i64 %114, 1
  store i64 %122, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = trunc i64 %122 to i32
  %124 = load i32, i32* %key.addr, align 4
  %125 = add nsw i32 %124, 1
  ret i32 %125

if.end.6:
  br label %if.end.4

if.end.4:
  store i32 0, i32* %prefix.addr, align 4
  %126 = load i32, i32* %from.addr, align 4
  %127 = load i32, i32* %j.addr, align 4
  %128 = icmp slt i32 %126, %127
  br i1 %128, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %129 = load i32, i32* %from.addr, align 4
  %130 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %129)
  %131 = icmp sge i32 %130, 60
  br label %land.end.8

land.end.8:
  %132 = phi i1 [ false, %if.end.4 ], [ %131, %land.rhs.8 ]
  br i1 %132, label %if.then.7, label %if.end.7

if.then.7:
  %133 = load i32, i32* %from.addr, align 4
  %134 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %133)
  store i32 %134, i32* %prefix.addr, align 4
  %135 = load i32, i32* %from.addr, align 4
  %136 = add nsw i32 %135, 1
  store i32 %136, i32* %from.addr, align 4
  br label %if.end.7

if.end.7:
  %137 = load i32, i32* %from.addr, align 4
  store i32 %137, i32* %to.addr, align 4
  br label %while.cond.1

while.cond.1:
  %138 = load i32, i32* %to.addr, align 4
  %139 = load i32, i32* %j.addr, align 4
  %140 = icmp slt i32 %138, %139
  br i1 %140, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %141 = load i32, i32* %to.addr, align 4
  %142 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %141)
  %143 = icmp sge i32 %142, 48
  br label %land.end.9

land.end.9:
  %144 = phi i1 [ false, %while.cond.1 ], [ %143, %land.rhs.9 ]
  br i1 %144, label %while.body.1, label %while.end.1

while.body.1:
  %145 = load i32, i32* %to.addr, align 4
  %146 = add nsw i32 %145, 1
  store i32 %146, i32* %to.addr, align 4
  br label %while.cond.1

while.end.1:
  store i32 0, i32* %intermediate.addr, align 4
  %147 = load i32, i32* %to.addr, align 4
  %148 = load i32, i32* %j.addr, align 4
  %149 = icmp slt i32 %147, %148
  br i1 %149, label %if.then.8, label %if.end.8

if.then.8:
  %150 = load i32, i32* %j.addr, align 4
  %151 = sub nsw i32 %150, 1
  store i32 %151, i32* %back.addr, align 4
  %152 = load i32, i32* %back.addr, align 4
  %153 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %152)
  store i32 %153, i32* %intermediate.addr, align 4
  br label %if.end.8

if.end.8:
  %154 = load i32, i32* %from.addr, align 4
  %155 = load i32, i32* %to.addr, align 4
  %156 = load i32, i32* %prefix.addr, align 4
  %157 = load i32, i32* %intermediate.addr, align 4
  %158 = load i32, i32* %final.addr, align 4
  call void @nish.termCsiEvent(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %154, i32 %155, i32 %156, i32 %157, i32 %158, %struct.nish_array* %events)
  %159 = load i32, i32* %j.addr, align 4
  %160 = add nsw i32 %159, 1
  ret i32 %160
}

define internal noundef i32 @nish.termDecodeString(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %open, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %n.addr = alloca i32, align 4
  %introducer.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %resume.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %start.addr = alloca i32, align 4
  %reply.addr = alloca i32, align 4
  %text.addr = alloca i32, align 4
  %semi.addr = alloca i32, align 4
  %text.addr.1 = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %prefix.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %intermediate.addr = alloca i32, align 4
  %back.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %text.addr.2 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %open)
  store i32 %3, i32* %introducer.addr, align 4
  store i32 %open, i32* %end.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %8 = load i32, i32* %end.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %end.addr, align 4
  %11 = trunc i64 %5 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end.2

land.end.2:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs.2 ]
  br i1 %13, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %14 = load i32, i32* %end.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %7 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %19 = zext i8 %18 to i32
  %20 = icmp ne i32 %19, 7
  br label %land.end.1

land.end.1:
  %21 = phi i1 [ false, %land.end.2 ], [ %20, %land.rhs.1 ]
  br i1 %21, label %land.rhs, label %land.end

land.rhs:
  %22 = load i32, i32* %end.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %7 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 %23
  %26 = load i8, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = zext i8 %26 to i32
  %28 = icmp ne i32 %27, 27
  br label %land.end

land.end:
  %29 = phi i1 [ false, %land.end.1 ], [ %28, %land.rhs ]
  br i1 %29, label %while.body, label %while.end

while.body:
  %30 = load i32, i32* %end.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %end.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %end.addr, align 4
  %33 = icmp slt i32 %32, 0
  br i1 %33, label %lor.end, label %lor.rhs

lor.rhs:
  %34 = load i32, i32* %end.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  %38 = icmp sge i32 %34, %37
  br label %lor.end

lor.end:
  %39 = phi i1 [ true, %while.end ], [ %38, %lor.rhs ]
  br i1 %39, label %if.then, label %if.end

if.then:
  br i1 %last, label %cond.true, label %cond.false

cond.true:
  %40 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %41 = phi i32 [ %40, %cond.true ], [ -1, %cond.false ]
  ret i32 %41

if.end:
  %42 = load i32, i32* %end.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %resume.addr, align 4
  %44 = load i32, i32* %end.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 %45
  %50 = load i8, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %51 = zext i8 %50 to i32
  %52 = icmp eq i32 %51, 27
  br i1 %52, label %if.then.1, label %if.end.1

if.then.1:
  %53 = load i32, i32* %end.addr, align 4
  %54 = add nsw i32 %53, 1
  store i32 %54, i32* %after.addr, align 4
  %55 = load i32, i32* %after.addr, align 4
  %56 = load i32, i32* %n.addr, align 4
  %57 = icmp sge i32 %55, %56
  br i1 %57, label %if.then.2, label %if.end.2

if.then.2:
  br i1 %last, label %cond.true.1, label %cond.false.1

cond.true.1:
  %58 = load i32, i32* %n.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %59 = phi i32 [ %58, %cond.true.1 ], [ -1, %cond.false.1 ]
  ret i32 %59

if.end.2:
  %60 = load i32, i32* %after.addr, align 4
  %61 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %60)
  %62 = icmp ne i32 %61, 92
  br i1 %62, label %if.then.3, label %if.end.3

if.then.3:
  %63 = load i32, i32* %end.addr, align 4
  ret i32 %63

if.end.3:
  %64 = load i32, i32* %after.addr, align 4
  %65 = add nsw i32 %64, 1
  store i32 %65, i32* %resume.addr, align 4
  br label %if.end.1

if.end.1:
  store i32 %open, i32* %start.addr, align 4
  %66 = load i32, i32* %start.addr, align 4
  %67 = load i32, i32* %end.addr, align 4
  %68 = icmp slt i32 %66, %67
  br i1 %68, label %if.then.4, label %if.end.4

if.then.4:
  %69 = load i32, i32* %start.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %start.addr, align 4
  br label %if.end.4

if.end.4:
  %71 = load i32, i32* %introducer.addr, align 4
  %72 = icmp eq i32 %71, 95
  br i1 %72, label %if.then.5, label %if.end.5

if.then.5:
  store i32 0, i32* %reply.addr, align 4
  %73 = load i32, i32* %start.addr, align 4
  store i32 %73, i32* %text.addr, align 4
  %74 = load i32, i32* %start.addr, align 4
  %75 = load i32, i32* %end.addr, align 4
  %76 = icmp slt i32 %74, %75
  br i1 %76, label %if.then.6, label %if.end.6

if.then.6:
  %77 = load i32, i32* %start.addr, align 4
  %78 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %77)
  store i32 %78, i32* %reply.addr, align 4
  %79 = load i32, i32* %start.addr, align 4
  %80 = add nsw i32 %79, 1
  store i32 %80, i32* %text.addr, align 4
  br label %if.end.6

if.end.6:
  %81 = load i32, i32* %introducer.addr, align 4
  %82 = call i8* @nish_alloc_struct(i64 24)
  %83 = bitcast i8* %82 to %struct.nish_array*
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  store i64 0, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 1
  store i64 0, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  store i8* null, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = load i32, i32* %reply.addr, align 4
  %88 = load i32, i32* %text.addr, align 4
  %89 = load i32, i32* %end.addr, align 4
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %88, i32 %89)
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call %struct.TermEvent* @nish.termReplyEvent(i32 %81, i32 0, %struct.nish_array* %83, i32 0, i32 %87, i8* %92)
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %98 = icmp eq i64 %95, %97
  br i1 %98, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %101 = bitcast i8* %100 to %struct.TermEvent**
  %102 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %101, i64 %95
  store %struct.TermEvent* %93, %struct.TermEvent** %102, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %103 = add i64 %95, 1
  store i64 %103, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = trunc i64 %103 to i32
  %105 = load i32, i32* %resume.addr, align 4
  ret i32 %105

if.end.5:
  %106 = load i32, i32* %introducer.addr, align 4
  %107 = icmp eq i32 %106, 93
  br i1 %107, label %if.then.7, label %if.end.7

if.then.7:
  %108 = load i32, i32* %start.addr, align 4
  store i32 %108, i32* %semi.addr, align 4
  br label %while.cond.1

while.cond.1:
  %109 = load i32, i32* %semi.addr, align 4
  %110 = load i32, i32* %end.addr, align 4
  %111 = icmp slt i32 %109, %110
  br i1 %111, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %112 = load i32, i32* %semi.addr, align 4
  %113 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %112)
  %114 = icmp ne i32 %113, 59
  br label %land.end.3

land.end.3:
  %115 = phi i1 [ false, %while.cond.1 ], [ %114, %land.rhs.3 ]
  br i1 %115, label %while.body.1, label %while.end.1

while.body.1:
  %116 = load i32, i32* %semi.addr, align 4
  %117 = add nsw i32 %116, 1
  store i32 %117, i32* %semi.addr, align 4
  br label %while.cond.1

while.end.1:
  %118 = load i32, i32* %semi.addr, align 4
  store i32 %118, i32* %text.addr.1, align 4
  %119 = load i32, i32* %semi.addr, align 4
  %120 = load i32, i32* %end.addr, align 4
  %121 = icmp slt i32 %119, %120
  br i1 %121, label %if.then.8, label %if.end.8

if.then.8:
  %122 = load i32, i32* %semi.addr, align 4
  %123 = add nsw i32 %122, 1
  store i32 %123, i32* %text.addr.1, align 4
  br label %if.end.8

if.end.8:
  %124 = load i32, i32* %introducer.addr, align 4
  %125 = load i32, i32* %start.addr, align 4
  %126 = load i32, i32* %semi.addr, align 4
  %127 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %125, i32 %126)
  %128 = load i32, i32* %text.addr.1, align 4
  %129 = load i32, i32* %end.addr, align 4
  %130 = call i64 @nish_arena_mark()
  %131 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %128, i32 %129)
  %132 = call i8* @nish_arena_keep(i64 %130, i8* %131)
  %133 = call %struct.TermEvent* @nish.termReplyEvent(i32 %124, i32 0, %struct.nish_array* %127, i32 0, i32 0, i8* %132)
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = icmp eq i64 %135, %137
  br i1 %138, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to %struct.TermEvent**
  %142 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %141, i64 %135
  store %struct.TermEvent* %133, %struct.TermEvent** %142, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %143 = add i64 %135, 1
  store i64 %143, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = trunc i64 %143 to i32
  %145 = load i32, i32* %resume.addr, align 4
  ret i32 %145

if.end.7:
  %146 = load i32, i32* %introducer.addr, align 4
  %147 = icmp ne i32 %146, 80
  br i1 %147, label %if.then.9, label %if.end.9

if.then.9:
  %148 = load i32, i32* %introducer.addr, align 4
  %149 = call i8* @nish_alloc_struct(i64 24)
  %150 = bitcast i8* %149 to %struct.nish_array*
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 0
  store i64 0, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 1
  store i64 0, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 2
  store i8* null, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %154 = load i32, i32* %start.addr, align 4
  %155 = load i32, i32* %end.addr, align 4
  %156 = call i64 @nish_arena_mark()
  %157 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %154, i32 %155)
  %158 = call i8* @nish_arena_keep(i64 %156, i8* %157)
  %159 = call %struct.TermEvent* @nish.termReplyEvent(i32 %148, i32 0, %struct.nish_array* %150, i32 0, i32 0, i8* %158)
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %161 = load i64, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %164 = icmp eq i64 %161, %163
  br i1 %164, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %166 = load i8*, i8** %165, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %167 = bitcast i8* %166 to %struct.TermEvent**
  %168 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %167, i64 %161
  store %struct.TermEvent* %159, %struct.TermEvent** %168, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %169 = add i64 %161, 1
  store i64 %169, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %170 = trunc i64 %169 to i32
  %171 = load i32, i32* %resume.addr, align 4
  ret i32 %171

if.end.9:
  %172 = load i32, i32* %start.addr, align 4
  store i32 %172, i32* %from.addr, align 4
  store i32 0, i32* %prefix.addr, align 4
  %173 = load i32, i32* %from.addr, align 4
  %174 = load i32, i32* %end.addr, align 4
  %175 = icmp slt i32 %173, %174
  br i1 %175, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %176 = load i32, i32* %from.addr, align 4
  %177 = sext i32 %176 to i64
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %179 = load i64, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = icmp ult i64 %177, %179
  br i1 %180, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %177, i64 %179)
  unreachable

bounds.ok:
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %182 = load i8*, i8** %181, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %183 = bitcast i8* %182 to i8*
  %184 = getelementptr inbounds i8, i8* %183, i64 %177
  %185 = load i8, i8* %184, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %186 = zext i8 %185 to i32
  %187 = icmp sge i32 %186, 60
  br label %land.end.5

land.end.5:
  %188 = phi i1 [ false, %if.end.9 ], [ %187, %bounds.ok ]
  br i1 %188, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %189 = load i32, i32* %from.addr, align 4
  %190 = sext i32 %189 to i64
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %192 = load i64, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = icmp ult i64 %190, %192
  br i1 %193, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %190, i64 %192)
  unreachable

bounds.ok.1:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = bitcast i8* %195 to i8*
  %197 = getelementptr inbounds i8, i8* %196, i64 %190
  %198 = load i8, i8* %197, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %199 = zext i8 %198 to i32
  %200 = icmp slt i32 %199, 64
  br label %land.end.4

land.end.4:
  %201 = phi i1 [ false, %land.end.5 ], [ %200, %bounds.ok.1 ]
  br i1 %201, label %if.then.10, label %if.end.10

if.then.10:
  %202 = load i32, i32* %from.addr, align 4
  %203 = sext i32 %202 to i64
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %205 = load i64, i64* %204, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %206 = icmp ult i64 %203, %205
  br i1 %206, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %203, i64 %205)
  unreachable

bounds.ok.2:
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %208 = load i8*, i8** %207, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %209 = bitcast i8* %208 to i8*
  %210 = getelementptr inbounds i8, i8* %209, i64 %203
  %211 = load i8, i8* %210, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %212 = zext i8 %211 to i32
  store i32 %212, i32* %prefix.addr, align 4
  %213 = load i32, i32* %from.addr, align 4
  %214 = add nsw i32 %213, 1
  store i32 %214, i32* %from.addr, align 4
  br label %if.end.10

if.end.10:
  %215 = load i32, i32* %from.addr, align 4
  store i32 %215, i32* %to.addr, align 4
  br label %while.cond.2

while.cond.2:
  %216 = load i32, i32* %to.addr, align 4
  %217 = load i32, i32* %end.addr, align 4
  %218 = icmp slt i32 %216, %217
  br i1 %218, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %219 = load i32, i32* %to.addr, align 4
  %220 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %219)
  %221 = icmp sge i32 %220, 48
  br label %land.end.7

land.end.7:
  %222 = phi i1 [ false, %while.cond.2 ], [ %221, %land.rhs.7 ]
  br i1 %222, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %223 = load i32, i32* %to.addr, align 4
  %224 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %223)
  %225 = icmp slt i32 %224, 64
  br label %land.end.6

land.end.6:
  %226 = phi i1 [ false, %land.end.7 ], [ %225, %land.rhs.6 ]
  br i1 %226, label %while.body.2, label %while.end.2

while.body.2:
  %227 = load i32, i32* %to.addr, align 4
  %228 = add nsw i32 %227, 1
  store i32 %228, i32* %to.addr, align 4
  br label %while.cond.2

while.end.2:
  %229 = load i32, i32* %to.addr, align 4
  store i32 %229, i32* %f.addr, align 4
  br label %while.cond.3

while.cond.3:
  %230 = load i32, i32* %f.addr, align 4
  %231 = load i32, i32* %end.addr, align 4
  %232 = icmp slt i32 %230, %231
  br i1 %232, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %233 = load i32, i32* %f.addr, align 4
  %234 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %233)
  %235 = icmp sge i32 %234, 32
  br label %land.end.9

land.end.9:
  %236 = phi i1 [ false, %while.cond.3 ], [ %235, %land.rhs.9 ]
  br i1 %236, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %237 = load i32, i32* %f.addr, align 4
  %238 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %237)
  %239 = icmp slt i32 %238, 48
  br label %land.end.8

land.end.8:
  %240 = phi i1 [ false, %land.end.9 ], [ %239, %land.rhs.8 ]
  br i1 %240, label %while.body.3, label %while.end.3

while.body.3:
  %241 = load i32, i32* %f.addr, align 4
  %242 = add nsw i32 %241, 1
  store i32 %242, i32* %f.addr, align 4
  br label %while.cond.3

while.end.3:
  store i32 0, i32* %intermediate.addr, align 4
  %243 = load i32, i32* %f.addr, align 4
  %244 = load i32, i32* %to.addr, align 4
  %245 = icmp sgt i32 %243, %244
  br i1 %245, label %if.then.11, label %if.end.11

if.then.11:
  %246 = load i32, i32* %f.addr, align 4
  %247 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %246, i32 1)
  %248 = extractvalue { i32, i1 } %247, 0
  %249 = extractvalue { i32, i1 } %247, 1
  br i1 %249, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %248, i32* %back.addr, align 4
  %250 = load i32, i32* %back.addr, align 4
  %251 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %250)
  store i32 %251, i32* %intermediate.addr, align 4
  br label %if.end.11

if.end.11:
  store i32 0, i32* %final.addr, align 4
  %252 = load i32, i32* %f.addr, align 4
  store i32 %252, i32* %text.addr.2, align 4
  %253 = load i32, i32* %f.addr, align 4
  %254 = load i32, i32* %end.addr, align 4
  %255 = icmp slt i32 %253, %254
  br i1 %255, label %if.then.12, label %if.end.12

if.then.12:
  %256 = load i32, i32* %f.addr, align 4
  %257 = sext i32 %256 to i64
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %259 = load i64, i64* %258, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %260 = icmp ult i64 %257, %259
  br i1 %260, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %257, i64 %259)
  unreachable

bounds.ok.3:
  %261 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %262 = load i8*, i8** %261, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %263 = bitcast i8* %262 to i8*
  %264 = getelementptr inbounds i8, i8* %263, i64 %257
  %265 = load i8, i8* %264, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %266 = zext i8 %265 to i32
  store i32 %266, i32* %final.addr, align 4
  %267 = load i32, i32* %f.addr, align 4
  %268 = add nsw i32 %267, 1
  store i32 %268, i32* %text.addr.2, align 4
  br label %if.end.12

if.end.12:
  %269 = load i32, i32* %introducer.addr, align 4
  %270 = load i32, i32* %prefix.addr, align 4
  %271 = load i32, i32* %from.addr, align 4
  %272 = load i32, i32* %to.addr, align 4
  %273 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %271, i32 %272)
  %274 = load i32, i32* %intermediate.addr, align 4
  %275 = load i32, i32* %final.addr, align 4
  %276 = load i32, i32* %text.addr.2, align 4
  %277 = load i32, i32* %end.addr, align 4
  %278 = call i64 @nish_arena_mark()
  %279 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %276, i32 %277)
  %280 = call i8* @nish_arena_keep(i64 %278, i8* %279)
  %281 = call %struct.TermEvent* @nish.termReplyEvent(i32 %269, i32 %270, %struct.nish_array* %273, i32 %274, i32 %275, i8* %280)
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %283 = load i64, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %285 = load i64, i64* %284, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %286 = icmp eq i64 %283, %285
  br i1 %286, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %287 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %288 = load i8*, i8** %287, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %289 = bitcast i8* %288 to %struct.TermEvent**
  %290 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %289, i64 %283
  store %struct.TermEvent* %281, %struct.TermEvent** %290, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %291 = add i64 %283, 1
  store i64 %291, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %292 = trunc i64 %291 to i32
  %293 = load i32, i32* %resume.addr, align 4
  ret i32 %293

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish.termByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %k) #0 {
entry:
  %0 = icmp sge i32 %k, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %k, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = sext i32 %k to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %6
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = zext i8 %11 to i32
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %13 = phi i32 [ %12, %cond.true ], [ -1, %cond.false ]
  ret i32 %13
}

define internal noundef zeroext i1 @nish.termOpensString(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 80
  br i1 %0, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %1 = icmp eq i32 %b, 88
  br label %lor.end.3

lor.end.3:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.3 ]
  br i1 %2, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %3 = icmp eq i32 %b, 93
  br label %lor.end.2

lor.end.2:
  %4 = phi i1 [ true, %lor.end.3 ], [ %3, %lor.rhs.2 ]
  br i1 %4, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %5 = icmp eq i32 %b, 94
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = icmp eq i32 %b, 95
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %lor.end.1 ], [ %7, %lor.rhs ]
  ret i1 %8
}

define internal noundef i32 @nish.termDecodeEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %second.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %third.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %char.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %while.cond ], [ %9, %land.rhs ]
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %second.addr, align 4
  %13 = load i32, i32* %second.addr, align 4
  store i32 %13, i32* %next.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %21 = zext i8 %20 to i32
  store i32 %21, i32* %b.addr, align 4
  %22 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  %23 = load i1, i1* %22, align 1, !tbaa !72
  br i1 %23, label %if.then, label %if.else

if.then:
  %24 = load i32, i32* %i.addr, align 4
  %25 = call i32 @nish.termDecodePaste(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %24, i1 %last, %struct.nish_array* %events)
  store i32 %25, i32* %next.addr, align 4
  %26 = load i32, i32* %next.addr, align 4
  %27 = load i32, i32* %n.addr, align 4
  %28 = icmp slt i32 %26, %27
  br i1 %28, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %29 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  %30 = load i1, i1* %29, align 1, !tbaa !72
  br label %land.end.1

land.end.1:
  %31 = phi i1 [ false, %if.then ], [ %30, %land.rhs.1 ]
  br i1 %31, label %if.then.1, label %if.end.1

if.then.1:
  %32 = load i32, i32* %next.addr, align 4
  ret i32 %32

if.end.1:
  br label %if.end

if.else:
  %33 = load i32, i32* %b.addr, align 4
  %34 = icmp eq i32 %33, 27
  br i1 %34, label %if.then.2, label %if.else.1

if.then.2:
  %35 = load i32, i32* %second.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp sge i32 %35, %36
  br i1 %37, label %if.then.3, label %if.else.2

if.then.3:
  %38 = xor i1 %last, true
  br i1 %38, label %if.then.4, label %if.end.4

if.then.4:
  %39 = load i32, i32* %i.addr, align 4
  ret i32 %39

if.end.4:
  %40 = load i32, i32* %b.addr, align 4
  %41 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 %40, i32 0, i32 1)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to %struct.TermEvent**
  %50 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %49, i64 %43
  store %struct.TermEvent* %41, %struct.TermEvent** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  br label %if.end.3

if.else.2:
  %53 = load i32, i32* %second.addr, align 4
  %54 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %53)
  store i32 %54, i32* %after.addr, align 4
  %55 = load i32, i32* %second.addr, align 4
  %56 = add nsw i32 %55, 1
  store i32 %56, i32* %third.addr, align 4
  %57 = load i32, i32* %third.addr, align 4
  %58 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %57)
  store i32 %58, i32* %f.addr, align 4
  %59 = load i32, i32* %after.addr, align 4
  %60 = icmp eq i32 %59, 91
  br i1 %60, label %if.then.5, label %if.else.3

if.then.5:
  %61 = load i32, i32* %second.addr, align 4
  %62 = call i32 @nish.termDecodeCsi(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %61, i1 %last, %struct.nish_array* %events)
  store i32 %62, i32* %next.addr, align 4
  br label %if.end.5

if.else.3:
  %63 = load i32, i32* %after.addr, align 4
  %64 = call i1 @nish.termOpensString(i32 %63)
  br i1 %64, label %if.then.6, label %if.else.4

if.then.6:
  %65 = load i32, i32* %second.addr, align 4
  %66 = call i32 @nish.termDecodeString(%struct.nish_array* %bytes, i32 %65, i1 %last, %struct.nish_array* %events)
  store i32 %66, i32* %next.addr, align 4
  br label %if.end.6

if.else.4:
  %67 = load i32, i32* %after.addr, align 4
  %68 = icmp eq i32 %67, 79
  br i1 %68, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %69 = load i32, i32* %third.addr, align 4
  %70 = load i32, i32* %n.addr, align 4
  %71 = icmp sge i32 %69, %70
  br label %land.end.3

land.end.3:
  %72 = phi i1 [ false, %if.else.4 ], [ %71, %land.rhs.3 ]
  br i1 %72, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %73 = xor i1 %last, true
  br label %land.end.2

land.end.2:
  %74 = phi i1 [ false, %land.end.3 ], [ %73, %land.rhs.2 ]
  br i1 %74, label %if.then.7, label %if.else.5

if.then.7:
  store i32 -1, i32* %next.addr, align 4
  br label %if.end.7

if.else.5:
  %75 = load i32, i32* %after.addr, align 4
  %76 = icmp eq i32 %75, 79
  br i1 %76, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %77 = load i32, i32* %third.addr, align 4
  %78 = load i32, i32* %n.addr, align 4
  %79 = icmp slt i32 %77, %78
  br label %land.end.6

land.end.6:
  %80 = phi i1 [ false, %if.else.5 ], [ %79, %land.rhs.6 ]
  br i1 %80, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %81 = load i32, i32* %f.addr, align 4
  %82 = icmp sge i32 %81, 64
  br label %land.end.5

land.end.5:
  %83 = phi i1 [ false, %land.end.6 ], [ %82, %land.rhs.5 ]
  br i1 %83, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %84 = load i32, i32* %f.addr, align 4
  %85 = icmp slt i32 %84, 127
  br label %land.end.4

land.end.4:
  %86 = phi i1 [ false, %land.end.5 ], [ %85, %land.rhs.4 ]
  br i1 %86, label %if.then.8, label %if.else.6

if.then.8:
  %87 = load i32, i32* %f.addr, align 4
  %88 = icmp eq i32 %87, 77
  br i1 %88, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %89 = load i32, i32* %f.addr, align 4
  %90 = call i32 @nish.termLetterKind(i32 %89)
  br label %cond.end

cond.end:
  %91 = phi i32 [ 6, %cond.true ], [ %90, %cond.false ]
  %92 = load i32, i32* %f.addr, align 4
  %93 = icmp eq i32 %92, 77
  br i1 %93, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %94 = load i32, i32* %f.addr, align 4
  br label %cond.end.1

cond.end.1:
  %95 = phi i32 [ 13, %cond.true.1 ], [ %94, %cond.false.1 ]
  %96 = call %struct.TermEvent* @nish.termKeyEvent(i32 %91, i32 %95, i32 0, i32 1)
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = icmp eq i64 %98, %100
  br i1 %101, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %104 = bitcast i8* %103 to %struct.TermEvent**
  %105 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %104, i64 %98
  store %struct.TermEvent* %96, %struct.TermEvent** %105, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %106 = add i64 %98, 1
  store i64 %106, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = trunc i64 %106 to i32
  %108 = load i32, i32* %third.addr, align 4
  %109 = add nsw i32 %108, 1
  store i32 %109, i32* %next.addr, align 4
  br label %if.end.8

if.else.6:
  %110 = load i32, i32* %after.addr, align 4
  %111 = icmp ne i32 %110, 27
  br i1 %111, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %112 = load i32, i32* %after.addr, align 4
  %113 = icmp ne i32 %112, 79
  br label %land.end.8

land.end.8:
  %114 = phi i1 [ false, %if.else.6 ], [ %113, %land.rhs.8 ]
  br i1 %114, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %115 = load i32, i32* %after.addr, align 4
  %116 = icmp slt i32 %115, 128
  br label %land.end.7

land.end.7:
  %117 = phi i1 [ false, %land.end.8 ], [ %116, %land.rhs.7 ]
  br i1 %117, label %if.then.9, label %if.else.7

if.then.9:
  %118 = load i32, i32* %after.addr, align 4
  %119 = call i32 @nish.termAsciiKind(i32 %118)
  %120 = load i32, i32* %after.addr, align 4
  %121 = call %struct.TermEvent* @nish.termKeyEvent(i32 %119, i32 %120, i32 2, i32 1)
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = icmp eq i64 %123, %125
  br i1 %126, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %128 to %struct.TermEvent**
  %130 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %129, i64 %123
  store %struct.TermEvent* %121, %struct.TermEvent** %130, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %131 = add i64 %123, 1
  store i64 %131, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %132 = trunc i64 %131 to i32
  %133 = load i32, i32* %third.addr, align 4
  store i32 %133, i32* %next.addr, align 4
  br label %if.end.9

if.else.7:
  %134 = load i32, i32* %b.addr, align 4
  %135 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 %134, i32 0, i32 1)
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = icmp eq i64 %137, %139
  br i1 %140, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %143 = bitcast i8* %142 to %struct.TermEvent**
  %144 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %143, i64 %137
  store %struct.TermEvent* %135, %struct.TermEvent** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %145 = add i64 %137, 1
  store i64 %145, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = trunc i64 %145 to i32
  br label %if.end.9

if.end.9:
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  %147 = load i32, i32* %next.addr, align 4
  %148 = icmp slt i32 %147, 0
  br i1 %148, label %if.then.10, label %if.end.10

if.then.10:
  %149 = load i32, i32* %i.addr, align 4
  ret i32 %149

if.end.10:
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.else.1:
  %150 = load i32, i32* %b.addr, align 4
  %151 = icmp slt i32 %150, 128
  br i1 %151, label %if.then.11, label %if.else.8

if.then.11:
  %152 = load i32, i32* %b.addr, align 4
  %153 = call i32 @nish.termAsciiKind(i32 %152)
  %154 = load i32, i32* %b.addr, align 4
  %155 = call %struct.TermEvent* @nish.termKeyEvent(i32 %153, i32 %154, i32 0, i32 1)
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %157 = load i64, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %159 = load i64, i64* %158, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %160 = icmp eq i64 %157, %159
  br i1 %160, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %162 = load i8*, i8** %161, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %163 = bitcast i8* %162 to %struct.TermEvent**
  %164 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %163, i64 %157
  store %struct.TermEvent* %155, %struct.TermEvent** %164, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %165 = add i64 %157, 1
  store i64 %165, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %166 = trunc i64 %165 to i32
  br label %if.end.11

if.else.8:
  %167 = load i32, i32* %i.addr, align 4
  %168 = call i32 @nish.termUtf8At(%struct.nish_array* %bytes, i32 %167, i1 %last)
  store i32 %168, i32* %char.addr, align 4
  %169 = load i32, i32* %char.addr, align 4
  %170 = icmp slt i32 %169, 0
  br i1 %170, label %if.then.12, label %if.end.12

if.then.12:
  %171 = load i32, i32* %i.addr, align 4
  ret i32 %171

if.end.12:
  %172 = load i32, i32* %char.addr, align 4
  %173 = ashr i32 %172, 3
  %174 = call %struct.TermEvent* @nish.termKeyEvent(i32 1, i32 %173, i32 0, i32 1)
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %176 = load i64, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %178 = load i64, i64* %177, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %179 = icmp eq i64 %176, %178
  br i1 %179, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %181 = load i8*, i8** %180, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %182 = bitcast i8* %181 to %struct.TermEvent**
  %183 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %182, i64 %176
  store %struct.TermEvent* %174, %struct.TermEvent** %183, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %184 = add i64 %176, 1
  store i64 %184, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = trunc i64 %184 to i32
  %186 = load i32, i32* %char.addr, align 4
  %187 = and i32 %186, 7
  store i32 %187, i32* %used.addr, align 4
  %188 = load i32, i32* %i.addr, align 4
  store i32 %188, i32* %at.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %189 = load i32, i32* %k.addr, align 4
  %190 = load i32, i32* %used.addr, align 4
  %191 = icmp slt i32 %189, %190
  br i1 %191, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %192 = load i32, i32* %at.addr, align 4
  %193 = load i32, i32* %n.addr, align 4
  %194 = icmp slt i32 %192, %193
  br label %land.end.9

land.end.9:
  %195 = phi i1 [ false, %for.cond ], [ %194, %land.rhs.9 ]
  br i1 %195, label %for.body, label %for.end

for.body:
  %196 = load i32, i32* %at.addr, align 4
  %197 = add nsw i32 %196, 1
  store i32 %197, i32* %at.addr, align 4
  br label %for.inc

for.inc:
  %198 = load i32, i32* %k.addr, align 4
  %199 = add nsw i32 %198, 1
  store i32 %199, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %200 = load i32, i32* %at.addr, align 4
  store i32 %200, i32* %next.addr, align 4
  br label %if.end.11

if.end.11:
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  %201 = load i32, i32* %next.addr, align 4
  store i32 %201, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %202 = load i32, i32* %n.addr, align 4
  ret i32 %202
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }
attributes #4 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!95, !96, !97, !98, !99}
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"ptr", !6, i64 0}
!20 = !{!"i32", !6, i64 0}
!21 = !{!"i1", !6, i64 0}
!22 = !{!"Screen", !19, i64 0, !19, i64 8, !19, i64 16, !19, i64 24, !19, i64 32, !19, i64 40, !19, i64 48, !19, i64 56, !19, i64 64, !20, i64 72, !20, i64 76, !20, i64 80, !21, i64 84, !21, i64 85}
!23 = !{!22, !20, i64 72}
!24 = !{!22, !20, i64 76}
!25 = !{!22, !21, i64 84}
!26 = !{!22, !21, i64 85}
!27 = !{!22, !19, i64 0}
!28 = !{!22, !19, i64 8}
!29 = !{!22, !19, i64 16}
!30 = !{!22, !19, i64 24}
!31 = !{!22, !19, i64 32}
!32 = !{!22, !19, i64 40}
!33 = !{!22, !19, i64 48}
!34 = !{!22, !19, i64 56}
!35 = !{!22, !19, i64 64}
!36 = !{!22, !20, i64 80}
!37 = !{!"Canvas", !19, i64 0, !20, i64 8, !20, i64 12, !19, i64 16}
!38 = !{!37, !19, i64 0}
!39 = !{!37, !20, i64 8}
!40 = !{!37, !20, i64 12}
!41 = !{!37, !19, i64 16}
!42 = !{!"KeyEvent", !20, i64 0, !20, i64 4}
!43 = !{!42, !20, i64 0}
!44 = !{!42, !20, i64 4}
!45 = !{!"TermEvent", !20, i64 0, !20, i64 4, !20, i64 8, !20, i64 12, !20, i64 16, !20, i64 20, !20, i64 24, !20, i64 28, !20, i64 32, !20, i64 36, !19, i64 40, !20, i64 48, !20, i64 52, !20, i64 56, !20, i64 60, !19, i64 64, !21, i64 72}
!46 = !{!45, !20, i64 0}
!47 = !{!45, !20, i64 4}
!48 = !{!45, !20, i64 8}
!49 = !{!45, !20, i64 12}
!50 = !{!45, !20, i64 16}
!51 = !{!45, !20, i64 20}
!52 = !{!45, !20, i64 24}
!53 = !{!45, !20, i64 28}
!54 = !{!45, !20, i64 32}
!55 = !{!45, !20, i64 36}
!56 = !{!45, !19, i64 40}
!57 = !{!45, !20, i64 48}
!58 = !{!45, !20, i64 52}
!59 = !{!45, !20, i64 56}
!60 = !{!45, !20, i64 60}
!61 = !{!45, !19, i64 64}
!62 = !{!45, !21, i64 72}
!63 = !{!"double", !6, i64 0}
!64 = !{!"KeyDecoder", !63, i64 0, !19, i64 8, !63, i64 16, !19, i64 24, !20, i64 32, !20, i64 36, !20, i64 40, !21, i64 44, !21, i64 45}
!65 = !{!64, !63, i64 0}
!66 = !{!64, !19, i64 8}
!67 = !{!64, !63, i64 16}
!68 = !{!64, !20, i64 32}
!69 = !{!64, !21, i64 44}
!70 = !{!64, !20, i64 36}
!71 = !{!64, !20, i64 40}
!72 = !{!64, !21, i64 45}
!73 = !{!64, !19, i64 24}
!74 = !{!"KeyState", !63, i64 0, !63, i64 8, !63, i64 16, !19, i64 24, !19, i64 32, !21, i64 40, !21, i64 41, !21, i64 42}
!75 = !{!74, !21, i64 40}
!76 = !{!74, !63, i64 0}
!77 = !{!74, !63, i64 8}
!78 = !{!74, !63, i64 16}
!79 = !{!74, !21, i64 41}
!80 = !{!74, !21, i64 42}
!81 = !{!74, !19, i64 24}
!82 = !{!74, !19, i64 32}
!83 = !{!"TermHeldKey", !63, i64 0, !20, i64 8, !20, i64 12, !20, i64 16, !21, i64 20}
!84 = !{!83, !21, i64 20}
!85 = !{!83, !63, i64 0}
!86 = !{!83, !20, i64 8}
!87 = !{!83, !20, i64 12}
!88 = !{!83, !20, i64 16}
!89 = !{!"FixedStep", !63, i64 0, !63, i64 8, !63, i64 16, !20, i64 24, !21, i64 28}
!90 = !{!89, !63, i64 0}
!91 = !{!89, !20, i64 24}
!92 = !{!89, !63, i64 8}
!93 = !{!89, !63, i64 16}
!94 = !{!89, !21, i64 28}
!95 = !{i32 8, !"cf-protection-branch", i32 1}
!96 = !{i32 8, !"cf-protection-return", i32 1}
!97 = !{i32 8, !"branch-target-enforcement", i32 1}
!98 = !{i32 8, !"sign-return-address", i32 1}
!99 = !{i32 4, !"probe-stack", !"inline-asm"}
