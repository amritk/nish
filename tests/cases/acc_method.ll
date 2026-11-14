%struct.TreeNode = type { i32, %struct.TreeNode*, %struct.TreeNode* }
%struct.Counter = type { i32 }
%struct.Stepper = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
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

define internal void @TreeNode.constructor(%struct.TreeNode* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %value, %struct.TreeNode* noundef align 8 %left, %struct.TreeNode* noundef align 8 %right) #0 {
entry:
  %0 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 1
  store %struct.TreeNode* %left, %struct.TreeNode** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 2
  store %struct.TreeNode* %right, %struct.TreeNode** %2, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @TreeNode.sum(%struct.TreeNode* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this.in) #1 {
entry:
  %left.addr = alloca %struct.TreeNode*, align 8
  %right.addr = alloca %struct.TreeNode*, align 8
  %l.addr = alloca i32, align 4
  br label %rec.head

rec.head:
  %this = phi %struct.TreeNode* [ %this.in, %entry ], [ %26, %ovf.ok.2 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.2 ]
  %rec.last = phi i32 [ 0, %entry ], [ %24, %ovf.ok.2 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  br i1 %rec.cold, label %rec.call, label %rec.body

rec.body:
  %0 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 1
  %1 = load %struct.TreeNode*, %struct.TreeNode** %0, align 8, !tbaa !6
  store %struct.TreeNode* %1, %struct.TreeNode** %left.addr, align 8
  %2 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 2
  %3 = load %struct.TreeNode*, %struct.TreeNode** %2, align 8, !tbaa !7
  store %struct.TreeNode* %3, %struct.TreeNode** %right.addr, align 8
  %4 = load %struct.TreeNode*, %struct.TreeNode** %left.addr, align 8
  %5 = icmp eq %struct.TreeNode* %4, null
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %6 = load %struct.TreeNode*, %struct.TreeNode** %left.addr, align 8
  %7 = call i32 @TreeNode.sum(%struct.TreeNode* %6)
  br label %cond.end

cond.end:
  %8 = phi i32 [ 0, %cond.true ], [ %7, %cond.false ]
  store i32 %8, i32* %l.addr, align 4
  %9 = load %struct.TreeNode*, %struct.TreeNode** %right.addr, align 8
  %10 = icmp eq %struct.TreeNode* %9, null
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !5
  %13 = load i32, i32* %l.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %15)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %18

if.end:
  %20 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %this, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !5
  %22 = load i32, i32* %l.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = load %struct.TreeNode*, %struct.TreeNode** %right.addr, align 8
  br label %rec.head

rec.call:
  %27 = call i32 @TreeNode.sum(%struct.TreeNode* %this)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %29)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %32

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !9
  ret void
}

define internal noundef i32 @Counter.total(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %this.in, i32 noundef %n.in) #1 {
entry:
  br label %rec.head

rec.head:
  %this = phi %struct.Counter* [ %this.in, %entry ], [ %this, %ovf.ok.1 ]
  %n = phi i32 [ %n.in, %entry ], [ %10, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %n, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 0)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !9
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %7, i32* %9, align 4, !tbaa !9
  %10 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %11 = call i32 @Counter.total(%struct.Counter* %this, i32 %n)
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %13)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @Counter.twice(%struct.Counter* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this.in, i32 noundef %n.in, i32 noundef %k.in) #1 {
entry:
  br label %rec.head

rec.head:
  %this = phi %struct.Counter* [ %this.in, %entry ], [ %this, %if.end ]
  %n = phi i32 [ %n.in, %entry ], [ %6, %if.end ]
  %k = phi i32 [ %k.in, %entry ], [ %k, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %k, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !9
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

if.end:
  %6 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %7 = call i32 @Counter.twice(%struct.Counter* %this, i32 %n, i32 %k)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %9)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Stepper.constructor(%struct.Stepper* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %this, i32 0, i32 0
  store i32 %step, i32* %0, align 4, !tbaa !11
  ret void
}

define internal noundef i32 @Stepper.total(%struct.Stepper* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this.in, i32 noundef %n.in) #1 {
entry:
  br label %rec.head

rec.head:
  %this = phi %struct.Stepper* [ %this.in, %entry ], [ %this, %if.end ]
  %n = phi i32 [ %n.in, %entry ], [ %6, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %5, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 0)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !11
  %6 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %7 = call i32 @Stepper.total(%struct.Stepper* %this, i32 %n)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %9)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef align 8 %struct.TreeNode* @build(i32 noundef %depth, i32 noundef %first) #1 {
entry:
  %0 = icmp eq i32 %depth, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret %struct.TreeNode* null

if.end:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.TreeNode*
  %3 = sub nsw i32 %depth, 1
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %first, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = call %struct.TreeNode* @build(i32 %3, i32 %5)
  %8 = sub nsw i32 %depth, 1
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %first, i32 2)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 1)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %15 = call %struct.TreeNode* @build(i32 %8, i32 %13)
  call void @TreeNode.constructor(%struct.TreeNode* %2, i32 %first, %struct.TreeNode* %7, %struct.TreeNode* %15)
  ret %struct.TreeNode* %2

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %leaf.addr = alloca %struct.TreeNode*, align 8
  %TreeNode.obj = alloca %struct.TreeNode, align 8
  %spine.addr = alloca %struct.TreeNode*, align 8
  %TreeNode.obj.1 = alloca %struct.TreeNode, align 8
  %tree.addr = alloca %struct.TreeNode*, align 8
  %big.addr = alloca i32, align 4
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %t.addr = alloca i32, align 4
  %s.addr = alloca %struct.Stepper*, align 8
  %Stepper.obj = alloca %struct.Stepper, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @TreeNode.constructor(%struct.TreeNode* %TreeNode.obj, i32 7, %struct.TreeNode* null, %struct.TreeNode* null)
  store %struct.TreeNode* %TreeNode.obj, %struct.TreeNode** %leaf.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.TreeNode*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.TreeNode*
  call void @TreeNode.constructor(%struct.TreeNode* %3, i32 30, %struct.TreeNode* null, %struct.TreeNode* null)
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.TreeNode*
  call void @TreeNode.constructor(%struct.TreeNode* %5, i32 4, %struct.TreeNode* null, %struct.TreeNode* null)
  call void @TreeNode.constructor(%struct.TreeNode* %1, i32 -2, %struct.TreeNode* %3, %struct.TreeNode* %5)
  call void @TreeNode.constructor(%struct.TreeNode* %TreeNode.obj.1, i32 1, %struct.TreeNode* null, %struct.TreeNode* %1)
  store %struct.TreeNode* %TreeNode.obj.1, %struct.TreeNode** %spine.addr, align 8
  %6 = call %struct.TreeNode* @build(i32 10, i32 1)
  store %struct.TreeNode* %6, %struct.TreeNode** %tree.addr, align 8
  %7 = load %struct.TreeNode*, %struct.TreeNode** %tree.addr, align 8
  %8 = icmp eq %struct.TreeNode* %7, null
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %9 = load %struct.TreeNode*, %struct.TreeNode** %tree.addr, align 8
  %10 = call i32 @TreeNode.sum(%struct.TreeNode* %9)
  br label %cond.end

cond.end:
  %11 = phi i32 [ 0, %cond.true ], [ %10, %cond.false ]
  store i32 %11, i32* %big.addr, align 4
  call void @Counter.constructor(%struct.Counter* %Counter.obj)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %12 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %13 = call i32 @Counter.total(%struct.Counter* %12, i32 1000)
  store i32 %13, i32* %t.addr, align 4
  call void @Stepper.constructor(%struct.Stepper* %Stepper.obj, i32 3)
  store %struct.Stepper* %Stepper.obj, %struct.Stepper** %s.addr, align 8
  %14 = load %struct.TreeNode*, %struct.TreeNode** %leaf.addr, align 8
  %15 = call i32 @TreeNode.sum(%struct.TreeNode* %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load %struct.TreeNode*, %struct.TreeNode** %spine.addr, align 8
  %19 = call i32 @TreeNode.sum(%struct.TreeNode* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = load i32, i32* %big.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = load i32, i32* %t.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %32 = getelementptr inbounds %struct.Counter, %struct.Counter* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4, !tbaa !9
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %30, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %38 = call i32 @Counter.twice(%struct.Counter* %37, i32 5, i32 3)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %36, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load %struct.Stepper*, %struct.Stepper** %s.addr, align 8
  %43 = call i32 @Stepper.total(%struct.Stepper* %42, i32 4)
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %41, i8* %44)
  call void @nish_print(i8* %45)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!12, !13, !14, !15, !16}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"TreeNode", !2, i64 0, !3, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!4, !3, i64 16}
!8 = !{!"Counter", !2, i64 0}
!9 = !{!8, !2, i64 0}
!10 = !{!"Stepper", !2, i64 0}
!11 = !{!10, !2, i64 0}
!12 = !{i32 8, !"cf-protection-branch", i32 1}
!13 = !{i32 8, !"cf-protection-return", i32 1}
!14 = !{i32 8, !"branch-target-enforcement", i32 1}
!15 = !{i32 8, !"sign-return-address", i32 1}
!16 = !{i32 4, !"probe-stack", !"inline-asm"}
