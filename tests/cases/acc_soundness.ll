%struct.Cell = type { i32, %struct.Cell* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4
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

define internal noundef i32 @swap(i32 noundef %a.in, i32 noundef %b.in, i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %a = phi i32 [ %a.in, %entry ], [ %b, %if.end ]
  %b = phi i32 [ %b.in, %entry ], [ %a, %if.end ]
  %n = phi i32 [ %n.in, %entry ], [ %7, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %a, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %a, i32 1000)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

if.end:
  %7 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %8 = call i32 @swap(i32 %a, i32 %b, i32 %n)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ], [ 0, %rec.call ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @baseDiv(i32 noundef %n.in, i32 noundef %d.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %10, %if.end ]
  %d = phi i32 [ %d.in, %entry ], [ %d, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ 1073741824, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = icmp eq i32 %d, 0
  %2 = icmp eq i32 10, -2147483648
  %3 = icmp eq i32 %d, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = srem i32 10, %d
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %8

if.end:
  %10 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %11 = call i32 @baseDiv(i32 %n, i32 %d)
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %13)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @stepDiv(i32 noundef %n.in, i32 noundef %d.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %12, %cond.end ]
  %d = phi i32 [ %d.in, %entry ], [ %d, %cond.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %cond.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %11, %cond.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %n, 0
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
  %4 = icmp eq i32 %n, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = icmp eq i32 %d, 0
  %6 = icmp eq i32 10, -2147483648
  %7 = icmp eq i32 %d, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = srem i32 10, %d
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %11 = phi i32 [ %10, %div.ok ], [ 1073741824, %cond.false ]
  %12 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %13 = call i32 @stepDiv(i32 %n, i32 %d)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %15)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %18

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nest(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %8, %rec.true.1 ], [ %14, %rec.false.2 ], [ %15, %rec.false ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %rec.true.1 ], [ %rec.sum, %rec.false.2 ], [ %rec.sum, %rec.false ]
  %rec.last = phi i32 [ 0, %entry ], [ 7, %rec.true.1 ], [ %n, %rec.false.2 ], [ 1, %rec.false ]
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
  %4 = srem i32 %n, 2
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %rec.true, label %rec.false

rec.true:
  %6 = srem i32 %n, 3
  %7 = icmp eq i32 %6, 0
  br i1 %7, label %rec.true.1, label %rec.false.1

rec.true.1:
  %8 = sub nsw i32 %n, 1
  br label %rec.head

rec.false.1:
  %9 = srem i32 %n, 5
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %rec.true.2, label %rec.false.2

rec.true.2:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 1000)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

rec.false.2:
  %14 = sub nsw i32 %n, 1
  br label %rec.head

rec.false:
  %15 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %16 = call i32 @nest(i32 %n)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %18)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @mixed(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %6, %if.then.1 ], [ %7, %if.end.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.then.1 ], [ %rec.sum, %if.end.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ -3, %if.then.1 ], [ %n, %if.end.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 5)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = srem i32 %n, 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  %6 = sub nsw i32 %n, 1
  br label %rec.head

if.end.1:
  %7 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %8 = call i32 @mixed(i32 %n)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value, %struct.Cell* noundef align 8 %next) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  store %struct.Cell* %next, %struct.Cell** %1, align 8, !tbaa !6
  ret void
}

define internal noundef i32 @total(%struct.Cell* noundef readonly align 8 nocapture %c.in) #0 {
entry:
  br label %rec.head

rec.head:
  %c = phi %struct.Cell* [ %c.in, %entry ], [ %7, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %5, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq %struct.Cell* %c, null
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
  %4 = getelementptr inbounds %struct.Cell, %struct.Cell* %c, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = getelementptr inbounds %struct.Cell, %struct.Cell* %c, i32 0, i32 1
  %7 = load %struct.Cell*, %struct.Cell** %6, align 8, !tbaa !6
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %8 = call i32 @total(%struct.Cell* %c)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %pick.addr = alloca i32, align 4
  %list.addr = alloca %struct.Cell*, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !11, !noalias !10, !tbaa !18
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ -1, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  %17 = load i32, i32* %pick.addr, align 4
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = call i32 @baseDiv(i32 3, i32 0)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  br label %if.end

if.end:
  %21 = load i32, i32* %pick.addr, align 4
  %22 = icmp eq i32 %21, 1
  br i1 %22, label %if.then.1, label %if.end.1

if.then.1:
  %23 = call i32 @stepDiv(i32 3, i32 0)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  br label %if.end.1

if.end.1:
  %25 = call i32 @swap(i32 1, i32 2, i32 5)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = call i32 @swap(i32 3, i32 -1, i32 6)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %27, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = call i32 @swap(i32 -4, i32 9, i32 7)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %31, i8* %33)
  call void @nish_print(i8* %34)
  %35 = call i32 @baseDiv(i32 1, i32 3)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = call i32 @stepDiv(i32 2, i32 7)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %37, i8* %39)
  call void @nish_print(i8* %40)
  %41 = call i32 @nest(i32 0)
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = call i32 @nest(i32 10)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = call i32 @nest(i32 25)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %47, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = call i32 @nest(i32 200)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %51, i8* %53)
  call void @nish_print(i8* %54)
  %55 = call i32 @mixed(i32 0)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = call i32 @mixed(i32 9)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %57, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %62 = call i32 @mixed(i32 1000)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %61, i8* %63)
  call void @nish_print(i8* %64)
  %65 = call i8* @nish_alloc_struct(i64 16)
  %66 = bitcast i8* %65 to %struct.Cell*
  %67 = call i8* @nish_alloc_struct(i64 16)
  %68 = bitcast i8* %67 to %struct.Cell*
  %69 = call i8* @nish_alloc_struct(i64 16)
  %70 = bitcast i8* %69 to %struct.Cell*
  %71 = call i8* @nish_alloc_struct(i64 16)
  %72 = bitcast i8* %71 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %72, i32 2147483000, %struct.Cell* null)
  call void @Cell.constructor(%struct.Cell* %70, i32 -2147483000, %struct.Cell* %72)
  call void @Cell.constructor(%struct.Cell* %68, i32 9, %struct.Cell* %70)
  call void @Cell.constructor(%struct.Cell* %66, i32 -7, %struct.Cell* %68)
  call void @Cell.constructor(%struct.Cell* %Cell.obj, i32 5, %struct.Cell* %66)
  store %struct.Cell* %Cell.obj, %struct.Cell** %list.addr, align 8
  %73 = call i32 @total(%struct.Cell* null)
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %76 = load %struct.Cell*, %struct.Cell** %list.addr, align 8
  %77 = call i32 @total(%struct.Cell* %76)
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %75, i8* %78)
  call void @nish_print(i8* %79)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
