%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" | \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4

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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @piece(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @skipOdd(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @piece(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %s.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp eq i32 2, 0
  %12 = icmp eq i32 %10, -2147483648
  %13 = icmp eq i32 2, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %11)
  unreachable

div.ok:
  %16 = srem i32 %10, 2
  %17 = icmp eq i32 %16, 1
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %19 = load i8*, i8** %18, align 8
  %20 = icmp eq i8* %19, %1
  br i1 %20, label %pass.rewind, label %pass.free

pass.rewind:
  %21 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %21, align 8
  br label %pass.done

pass.free:
  %22 = ptrtoint i8* %1 to i64
  %23 = add i64 %22, %3
  call void @nish_arena_release(i64 %23)
  br label %pass.done

pass.done:
  br label %while.cond

if.end:
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp sgt i32 %24, %rounds
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = icmp eq i8* %27, %1
  br i1 %28, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %29, align 8
  br label %pass.done.1

pass.free.1:
  %30 = ptrtoint i8* %1 to i64
  %31 = add i64 %30, %3
  call void @nish_arena_release(i64 %31)
  br label %pass.done.1

pass.done.1:
  br label %while.end

if.end.1:
  %32 = load i32, i32* %total.addr, align 4
  %33 = load i8*, i8** %s.addr, align 8
  %34 = bitcast i8* %33 to i64*
  %35 = load i64, i64* %34, align 8
  %36 = trunc i64 %35 to i32
  %37 = add nsw i32 %32, %36
  store i32 %37, i32* %total.addr, align 4
  %38 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %39 = load i8*, i8** %38, align 8
  %40 = icmp eq i8* %39, %1
  br i1 %40, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %41 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %41, align 8
  br label %pass.done.2

pass.free.2:
  %42 = ptrtoint i8* %1 to i64
  %43 = add i64 %42, %3
  call void @nish_arena_release(i64 %43)
  br label %pass.done.2

pass.done.2:
  br label %while.cond

while.end:
  %44 = call i8* @nish_alloc_struct(i64 4)
  %45 = bitcast i8* %44 to %struct.Box*
  %46 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %45, i32 %46)
  ret %struct.Box* %45
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @grid(i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %row.addr = alloca i8*, align 8
  %c.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %r.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @piece(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %row.addr, align 8
  store i32 0, i32* %c.addr, align 4
  br label %for.cond.1

for.cond.1:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp slt i32 %10, %n
  br i1 %11, label %for.body.1, label %for.end.1

for.body.1:
  %12 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %13 = load i8*, i8** %12, align 8
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %15 = load i64, i64* %14, align 8
  %16 = load i32, i32* %c.addr, align 4
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @piece(i32 %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  store i8* %19, i8** %cell.addr, align 8
  %20 = load i32, i32* %c.addr, align 4
  %21 = icmp eq i32 3, 0
  %22 = icmp eq i32 %20, -2147483648
  %23 = icmp eq i32 3, -1
  %24 = and i1 %22, %23
  %25 = or i1 %21, %24
  br i1 %25, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %21)
  unreachable

div.ok:
  %26 = srem i32 %20, 3
  switch i32 %26, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = icmp eq i8* %28, %13
  br i1 %29, label %pass.rewind, label %pass.free

pass.rewind:
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %30, align 8
  br label %pass.done

pass.free:
  %31 = ptrtoint i8* %13 to i64
  %32 = add i64 %31, %15
  call void @nish_arena_release(i64 %32)
  br label %pass.done

pass.done:
  br label %for.inc.1

sw.case.1:
  %33 = load i32, i32* %total.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %total.addr, align 4
  br label %sw.end

sw.default:
  %35 = load i32, i32* %total.addr, align 4
  %36 = load i8*, i8** %cell.addr, align 8
  %37 = bitcast i8* %36 to i64*
  %38 = load i64, i64* %37, align 8
  %39 = trunc i64 %38 to i32
  %40 = add nsw i32 %35, %39
  store i32 %40, i32* %total.addr, align 4
  br label %sw.end

sw.end:
  %41 = load i32, i32* %c.addr, align 4
  %42 = load i32, i32* %r.addr, align 4
  %43 = icmp sgt i32 %41, %42
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %45 = load i8*, i8** %44, align 8
  %46 = icmp eq i8* %45, %13
  br i1 %46, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %47, align 8
  br label %pass.done.1

pass.free.1:
  %48 = ptrtoint i8* %13 to i64
  %49 = add i64 %48, %15
  call void @nish_arena_release(i64 %49)
  br label %pass.done.1

pass.done.1:
  br label %for.end.1

if.end:
  %50 = load i32, i32* %total.addr, align 4
  %51 = load i8*, i8** %row.addr, align 8
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = trunc i64 %53 to i32
  %55 = add nsw i32 %50, %54
  store i32 %55, i32* %total.addr, align 4
  %56 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %57 = load i8*, i8** %56, align 8
  %58 = icmp eq i8* %57, %13
  br i1 %58, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %59, align 8
  br label %pass.done.2

pass.free.2:
  %60 = ptrtoint i8* %13 to i64
  %61 = add i64 %60, %15
  call void @nish_arena_release(i64 %61)
  br label %pass.done.2

pass.done.2:
  br label %for.inc.1

for.inc.1:
  %62 = load i32, i32* %c.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %65 = load i8*, i8** %64, align 8
  %66 = icmp eq i8* %65, %3
  br i1 %66, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %67 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %67, align 8
  br label %pass.done.3

pass.free.3:
  %68 = ptrtoint i8* %3 to i64
  %69 = add i64 %68, %5
  call void @nish_arena_release(i64 %69)
  br label %pass.done.3

pass.done.3:
  br label %for.inc

for.inc:
  %70 = load i32, i32* %r.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %72 = call i8* @nish_alloc_struct(i64 4)
  %73 = bitcast i8* %72 to %struct.Box*
  %74 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %73, i32 %74)
  ret %struct.Box* %73
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @countDown(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 %rounds, i32* %i.addr, align 4
  br label %do.body

do.body:
  %0 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @piece(i32 %4)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = sub nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp eq i32 3, 0
  %12 = icmp eq i32 %10, -2147483648
  %13 = icmp eq i32 3, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %11)
  unreachable

div.ok:
  %16 = srem i32 %10, 3
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %19 = load i8*, i8** %18, align 8
  %20 = icmp eq i8* %19, %1
  br i1 %20, label %pass.rewind, label %pass.free

pass.rewind:
  %21 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %21, align 8
  br label %pass.done

pass.free:
  %22 = ptrtoint i8* %1 to i64
  %23 = add i64 %22, %3
  call void @nish_arena_release(i64 %23)
  br label %pass.done

pass.done:
  br label %do.cond

if.end:
  %24 = load i32, i32* %total.addr, align 4
  %25 = load i8*, i8** %s.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = add nsw i32 %24, %28
  store i32 %29, i32* %total.addr, align 4
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %31 = load i8*, i8** %30, align 8
  %32 = icmp eq i8* %31, %1
  br i1 %32, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %33, align 8
  br label %pass.done.1

pass.free.1:
  %34 = ptrtoint i8* %1 to i64
  %35 = add i64 %34, %3
  call void @nish_arena_release(i64 %35)
  br label %pass.done.1

pass.done.1:
  br label %do.cond

do.cond:
  %36 = load i32, i32* %i.addr, align 4
  %37 = icmp sgt i32 %36, 0
  br i1 %37, label %do.body, label %do.end

do.end:
  %38 = call i8* @nish_alloc_struct(i64 4)
  %39 = bitcast i8* %38 to %struct.Box*
  %40 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %39, i32 %40)
  ret %struct.Box* %39
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @find(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %boxes, i32 noundef %want) #1 {
entry:
  %r.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box*, align 8
  %forof.idx = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %6 = load i64, i64* %forof.idx, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %forof.body, label %forof.end

forof.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9
  %12 = bitcast i8* %11 to %struct.Box**
  %13 = getelementptr inbounds %struct.Box*, %struct.Box** %12, i64 %6
  %14 = load %struct.Box*, %struct.Box** %13, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.Box* %14, %struct.Box** %box.addr, align 8
  %15 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %16 = load i8*, i8** %15, align 8
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %18 = load i64, i64* %17, align 8
  %19 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %20 = getelementptr inbounds %struct.Box, %struct.Box* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !4
  %22 = load i32, i32* %r.addr, align 4
  %23 = add nsw i32 %21, %22
  %24 = call i64 @nish_arena_mark()
  %25 = call i8* @piece(i32 %23)
  %26 = call i8* @nish_arena_keep(i64 %24, i8* %25)
  store i8* %26, i8** %s.addr, align 8
  %27 = load i8*, i8** %s.addr, align 8
  %28 = bitcast i8* %27 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = trunc i64 %29 to i32
  %31 = icmp eq i32 %30, %want
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load %struct.Box*, %struct.Box** %box.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.Box* %32

if.end:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %34 = load i8*, i8** %33, align 8
  %35 = icmp eq i8* %34, %16
  br i1 %35, label %pass.rewind, label %pass.free

pass.rewind:
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %18, i64* %36, align 8
  br label %pass.done

pass.free:
  %37 = ptrtoint i8* %16 to i64
  %38 = add i64 %37, %18
  call void @nish_arena_release(i64 %38)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %42 = load i8*, i8** %41, align 8
  %43 = icmp eq i8* %42, %3
  br i1 %43, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %44 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %44, align 8
  br label %pass.done.1

pass.free.1:
  %45 = ptrtoint i8* %3 to i64
  %46 = add i64 %45, %5
  call void @nish_arena_release(i64 %46)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %47 = load i32, i32* %r.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !8, !noalias !9
  %51 = icmp ult i64 0, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !8, !noalias !9
  %54 = bitcast i8* %53 to %struct.Box**
  %55 = getelementptr inbounds %struct.Box*, %struct.Box** %54, i64 0
  %56 = load %struct.Box*, %struct.Box** %55, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.Box* %56
}

define internal noundef i32 @settle(i32 noundef %i) #2 {
entry:
  %0 = mul nsw i32 %i, 2
  ret i32 %0
}

define internal noundef i32 @firstWide(i32 noundef %rounds) #0 {
entry:
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @piece(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %s.addr, align 8
  %10 = load i8*, i8** %s.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = icmp sgt i32 %13, 3
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %i.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  %16 = tail call i32 @settle(i32 %15)
  ret i32 %16

if.end:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %18 = load i8*, i8** %17, align 8
  %19 = icmp eq i8* %18, %3
  br i1 %19, label %pass.rewind, label %pass.free

pass.rewind:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %20, align 8
  br label %pass.done

pass.free:
  %21 = ptrtoint i8* %3 to i64
  %22 = add i64 %21, %5
  call void @nish_arena_release(i64 %22)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = sub nsw i32 0, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %25
}

define internal noundef nonnull align 8 i8* @growth(i32 noundef %which, i32 noundef %rounds) #1 {
entry:
  %m.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %grown.addr = alloca i64, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i64 @nish_arena_used()
  store i64 %1, i64* %before.addr, align 8
  store i32 0, i32* %n.addr, align 4
  %2 = icmp eq i32 %which, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = call %struct.Box* @skipOdd(i32 %rounds)
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  store i32 %5, i32* %n.addr, align 4
  br label %if.end

if.else:
  %6 = icmp eq i32 %which, 1
  br i1 %6, label %if.then.1, label %if.else.1

if.then.1:
  %7 = call %struct.Box* @grid(i32 %rounds)
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !4
  store i32 %9, i32* %n.addr, align 4
  br label %if.end.1

if.else.1:
  %10 = call %struct.Box* @countDown(i32 %rounds)
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  store i32 %12, i32* %n.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %13 = call i64 @nish_arena_used()
  %14 = load i64, i64* %before.addr, align 8
  %15 = sub nsw i64 %13, %14
  store i64 %15, i64* %grown.addr, align 8
  %16 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %16)
  %17 = load i32, i32* %n.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %20 = load i64, i64* %grown.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  ret i8* %22
}

define void @nish_main() #1 {
entry:
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @growth(i32 0, i32 5)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %2 = call i8* @growth(i32 0, i32 300)
  %3 = call i8* @nish_str_concat(i8* %1, i8* %2)
  call void @nish_print(i8* %3)
  %4 = call i8* @growth(i32 1, i32 5)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %6 = call i8* @growth(i32 1, i32 300)
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  call void @nish_print(i8* %7)
  %8 = call i8* @growth(i32 2, i32 5)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %10 = call i8* @growth(i32 2, i32 300)
  %11 = call i8* @nish_str_concat(i8* %9, i8* %10)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !8, !noalias !9
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !8, !noalias !9
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !8, !noalias !9
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %boxes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 200
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.Box*
  %20 = load i32, i32* %i.addr, align 4
  call void @Box.constructor(%struct.Box* %19, i32 %20)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !8, !noalias !9
  %28 = bitcast i8* %27 to %struct.Box**
  %29 = getelementptr inbounds %struct.Box*, %struct.Box** %28, i64 %22
  store %struct.Box* %19, %struct.Box** %29, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !8, !noalias !9
  %31 = trunc i64 %30 to i32
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %35 = call %struct.Box* @find(%struct.nish_array* %34, i32 4)
  %36 = getelementptr inbounds %struct.Box, %struct.Box* %35, i32 0, i32 0
  %37 = load i32, i32* %36, align 4, !tbaa !4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %40 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %41 = call %struct.Box* @find(%struct.nish_array* %40, i32 9)
  %42 = getelementptr inbounds %struct.Box, %struct.Box* %41, i32 0, i32 0
  %43 = load i32, i32* %42, align 4, !tbaa !4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %39, i8* %44)
  call void @nish_print(i8* %45)
  %46 = call i32 @firstWide(i32 2000)
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element ptr", !1, i64 0}
!11 = !{!10, !10, i64 0}
