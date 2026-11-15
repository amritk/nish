%struct.Chain = type { i32 }
%struct.Link = type { i32, %struct.Link* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

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

define internal void @Chain.constructor(%struct.Chain* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  store i32 %c, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Chain.term(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %i) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %c.addr, align 4
  %2 = load i32, i32* %c.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = icmp eq i32 %i, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ 2147483647, %cond.true ], [ 1, %cond.false ]
  ret i32 %5

if.end:
  %6 = load i32, i32* %c.addr, align 4
  %7 = icmp eq i32 %6, 1
  br i1 %7, label %if.then.1, label %if.end.1

if.then.1:
  %8 = icmp eq i32 %i, 1
  br i1 %8, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %9 = phi i32 [ 2147483647, %cond.true.1 ], [ -1, %cond.false.1 ]
  ret i32 %9

if.end.1:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp eq i32 %10, 2
  br i1 %11, label %if.then.2, label %if.end.2

if.then.2:
  %12 = icmp eq i32 %i, 2
  br i1 %12, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %13 = phi i32 [ 2147483647, %cond.true.2 ], [ 1, %cond.false.2 ]
  ret i32 %13

if.end.2:
  %14 = load i32, i32* %c.addr, align 4
  %15 = icmp eq i32 %14, 3
  br i1 %15, label %if.then.3, label %if.end.3

if.then.3:
  %16 = icmp eq i32 %i, 1
  br i1 %16, label %cond.true.3, label %cond.false.3

cond.true.3:
  %17 = sub nsw i32 0, 2147483647
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %18 = phi i32 [ %17, %cond.true.3 ], [ 2147483647, %cond.false.3 ]
  ret i32 %18

if.end.3:
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp eq i32 %19, 10
  br i1 %20, label %if.then.4, label %if.end.4

if.then.4:
  %21 = icmp eq i32 %i, 2
  br i1 %21, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %22 = phi i32 [ 2147483647, %cond.true.4 ], [ -1, %cond.false.4 ]
  ret i32 %22

if.end.4:
  %23 = load i32, i32* %c.addr, align 4
  %24 = icmp eq i32 %23, 11
  br i1 %24, label %if.then.5, label %if.end.5

if.then.5:
  %25 = icmp eq i32 %i, 1
  br i1 %25, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %26 = phi i32 [ 2147483647, %cond.true.5 ], [ 1, %cond.false.5 ]
  ret i32 %26

if.end.5:
  %27 = load i32, i32* %c.addr, align 4
  %28 = icmp eq i32 %27, 12
  br i1 %28, label %if.then.6, label %if.end.6

if.then.6:
  %29 = icmp eq i32 %i, 1
  br i1 %29, label %cond.true.6, label %cond.false.6

cond.true.6:
  %30 = sub nsw i32 0, 2147483647
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %31 = phi i32 [ %30, %cond.true.6 ], [ -1, %cond.false.6 ]
  ret i32 %31

if.end.6:
  ret i32 %i
}

define internal noundef i32 @Chain.last(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %c.addr, align 4
  %2 = load i32, i32* %c.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %4 = load i32, i32* %c.addr, align 4
  %5 = icmp eq i32 %4, 1
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = load i32, i32* %c.addr, align 4
  %8 = icmp eq i32 %7, 10
  br label %lor.end

lor.end:
  %9 = phi i1 [ true, %lor.end.1 ], [ %8, %lor.rhs ]
  br i1 %9, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp eq i32 %10, 11
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -5

if.end.1:
  ret i32 0
}

define internal noundef i32 @Chain.chain(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this.in, i32 noundef %i.in) #2 {
entry:
  br label %rec.head

rec.head:
  %this = phi %struct.Chain* [ %this.in, %entry ], [ %this, %ovf.ok.1 ]
  %i = phi i32 [ %i.in, %entry ], [ %7, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %5, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %i, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call i32 @Chain.last(%struct.Chain* %this)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

if.end:
  %5 = call i32 @Chain.term(%struct.Chain* %this, i32 %i)
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %i, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %9 = call i32 @Chain.chain(%struct.Chain* %this, i32 %i)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %11)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %14

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 1, %if.end ], [ 0, %rec.call ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Link.constructor(%struct.Link* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %v, %struct.Link* noundef align 8 %next) #0 {
entry:
  %0 = getelementptr inbounds %struct.Link, %struct.Link* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Link, %struct.Link* %this, i32 0, i32 1
  store %struct.Link* %next, %struct.Link** %1, align 8, !tbaa !8
  ret void
}

define internal noundef i32 @Link.sum(%struct.Link* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this.in) #2 {
entry:
  %next.addr = alloca %struct.Link*, align 8
  br label %rec.head

rec.head:
  %this = phi %struct.Link* [ %this.in, %entry ], [ %11, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %10, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  br i1 %rec.cold, label %rec.call, label %rec.body

rec.body:
  %0 = getelementptr inbounds %struct.Link, %struct.Link* %this, i32 0, i32 1
  %1 = load %struct.Link*, %struct.Link** %0, align 8, !tbaa !8
  store %struct.Link* %1, %struct.Link** %next.addr, align 8
  %2 = load %struct.Link*, %struct.Link** %next.addr, align 8
  %3 = icmp eq %struct.Link* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Link, %struct.Link* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !7
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %7

if.end:
  %9 = getelementptr inbounds %struct.Link, %struct.Link* %this, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !7
  %11 = load %struct.Link*, %struct.Link** %next.addr, align 8
  br label %rec.head

rec.call:
  %12 = call i32 @Link.sum(%struct.Link* %this)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %14)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Link* @listOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %vs) #2 {
entry:
  %head.addr = alloca %struct.Link*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Link*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = trunc i64 %3 to i32
  %5 = sub nsw i32 %4, 1
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  %14 = load i32, i32* %13, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  call void @Link.constructor(%struct.Link* %1, i32 %14, %struct.Link* null)
  store %struct.Link* %1, %struct.Link** %head.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = trunc i64 %16 to i32
  %18 = sub nsw i32 %17, 2
  store i32 %18, i32* %i.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %vs, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  br label %for.cond

for.cond:
  %23 = load i32, i32* %i.addr, align 4
  %24 = icmp sge i32 %23, 0
  br i1 %24, label %for.body, label %for.end

for.body:
  %25 = call i8* @nish_alloc_struct(i64 16)
  %26 = bitcast i8* %25 to %struct.Link*
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = bitcast i8* %22 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %28
  %31 = load i32, i32* %30, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %32 = load %struct.Link*, %struct.Link** %head.addr, align 8
  call void @Link.constructor(%struct.Link* %26, i32 %31, %struct.Link* %32)
  store %struct.Link* %26, %struct.Link** %head.addr, align 8
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = sub nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = load %struct.Link*, %struct.Link** %head.addr, align 8
  ret %struct.Link* %35
}

define internal noundef i32 @steps(i32 noundef %c) #3 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = icmp eq i32 %c, 3
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 4

if.end.1:
  ret i32 2
}

define noundef i32 @nish_main() #2 {
entry:
  %pick.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %Chain.obj = alloca %struct.Chain, align 8
  %a.addr = alloca i32, align 4
  %Chain.obj.1 = alloca %struct.Chain, align 8
  %b.addr = alloca i32, align 4
  %Chain.obj.2 = alloca %struct.Chain, align 8
  %d.addr = alloca i32, align 4
  %Chain.obj.3 = alloca %struct.Chain, align 8
  %e.addr = alloca i32, align 4
  %Chain.obj.4 = alloca %struct.Chain, align 8
  %f.addr = alloca i32, align 4
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [4 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ -1, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  %17 = load i32, i32* %pick.addr, align 4
  %18 = icmp eq i32 %17, 4
  br i1 %18, label %if.then, label %if.else

if.then:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %19, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %20, align 8, !alias.scope !12, !noalias !13, !tbaa !23
  %21 = bitcast [2 x i32]* %arr.data to i8*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %23 = bitcast i8* %21 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  store i32 1, i32* %24, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %25 = getelementptr inbounds i32, i32* %23, i64 1
  store i32 2147483647, i32* %25, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %26 = call %struct.Link* @listOf(%struct.nish_array* %arr.hdr)
  %27 = call i32 @Link.sum(%struct.Link* %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  br label %if.end

if.else:
  %29 = load i32, i32* %pick.addr, align 4
  %30 = icmp eq i32 %29, 5
  br i1 %30, label %if.then.1, label %if.else.1

if.then.1:
  %31 = sub nsw i32 0, 2147483647
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %32, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %33, align 8, !alias.scope !12, !noalias !13, !tbaa !23
  %34 = bitcast [4 x i32]* %arr.data.1 to i8*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %34, i8** %35, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %36 = bitcast i8* %34 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 0
  store i32 2147483647, i32* %37, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %38 = getelementptr inbounds i32, i32* %36, i64 1
  store i32 2147483647, i32* %38, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %39 = getelementptr inbounds i32, i32* %36, i64 2
  store i32 2147483647, i32* %39, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %40 = getelementptr inbounds i32, i32* %36, i64 3
  store i32 %31, i32* %40, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %41 = call %struct.Link* @listOf(%struct.nish_array* %arr.hdr.1)
  %42 = call i32 @Link.sum(%struct.Link* %41)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  br label %if.end.1

if.else.1:
  %44 = load i32, i32* %pick.addr, align 4
  %45 = icmp sge i32 %44, 0
  br i1 %45, label %if.then.2, label %if.end.2

if.then.2:
  %46 = load i32, i32* %pick.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj, i32 %46)
  %47 = load i32, i32* %pick.addr, align 4
  %48 = call i32 @steps(i32 %47)
  %49 = call i32 @Chain.chain(%struct.Chain* %Chain.obj, i32 %48)
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  call void @Chain.constructor(%struct.Chain* %Chain.obj.1, i32 10)
  %51 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.1, i32 2)
  store i32 %51, i32* %a.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.2, i32 11)
  %52 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.2, i32 2)
  store i32 %52, i32* %b.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.3, i32 12)
  %53 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.3, i32 2)
  store i32 %53, i32* %d.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.4, i32 20)
  %54 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.4, i32 1000)
  store i32 %54, i32* %e.addr, align 4
  %55 = sub nsw i32 0, 2147483647
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 4, i64* %56, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 4, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !23
  %58 = bitcast [4 x i32]* %arr.data.2 to i8*
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %58, i8** %59, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %60 = bitcast i8* %58 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 0
  store i32 2147483647, i32* %61, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %62 = getelementptr inbounds i32, i32* %60, i64 1
  store i32 -1, i32* %62, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %63 = getelementptr inbounds i32, i32* %60, i64 2
  store i32 2147483647, i32* %63, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %64 = getelementptr inbounds i32, i32* %60, i64 3
  store i32 %55, i32* %64, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %65 = call %struct.Link* @listOf(%struct.nish_array* %arr.hdr.2)
  %66 = call i32 @Link.sum(%struct.Link* %65)
  store i32 %66, i32* %f.addr, align 4
  %67 = load i32, i32* %a.addr, align 4
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %70 = load i32, i32* %b.addr, align 4
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %69, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %74 = load i32, i32* %d.addr, align 4
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %73, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %78 = load i32, i32* %e.addr, align 4
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %77, i8* %79)
  %81 = call i8* @nish_str_concat(i8* %80, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %82 = load i32, i32* %f.addr, align 4
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %81, i8* %83)
  call void @nish_print(i8* %84)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!24, !25, !26, !27, !28}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Chain", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Link", !2, i64 0, !5, i64 8}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !5, i64 8}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !15, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!16, !14, i64 8}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}
