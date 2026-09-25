%struct.Element = type { i32, %struct.Element* }
%struct.List = type {}
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"List: tail returned an empty list\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"List: tail reached an empty list\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #5

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

define internal void @Element.constructor(%struct.Element* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Element, %struct.Element* %this, i32 0, i32 1
  store %struct.Element* null, %struct.Element** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Element, %struct.Element* %this, i32 0, i32 0
  store i32 %v, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @Element.length(%struct.Element* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %next.addr = alloca %struct.Element*, align 8
  %0 = getelementptr inbounds %struct.Element, %struct.Element* %this, i32 0, i32 1
  %1 = load %struct.Element*, %struct.Element** %0, align 8, !tbaa !5
  store %struct.Element* %1, %struct.Element** %next.addr, align 8
  %2 = load %struct.Element*, %struct.Element** %next.addr, align 8
  %3 = icmp eq %struct.Element* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %4 = load %struct.Element*, %struct.Element** %next.addr, align 8
  %5 = call i32 @Element.length(%struct.Element* %4)
  %6 = add nsw i32 1, %5
  ret i32 %6
}

define internal noundef i32 @List.benchmark(%struct.List* noundef nonnull readonly align 8 nocapture %this) #2 {
entry:
  %result.addr = alloca %struct.Element*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Element* @List.makeList(%struct.List* %this, i32 15)
  %1 = call %struct.Element* @List.makeList(%struct.List* %this, i32 10)
  %2 = call %struct.Element* @List.makeList(%struct.List* %this, i32 6)
  %3 = call %struct.Element* @List.tail(%struct.List* %this, %struct.Element* %0, %struct.Element* %1, %struct.Element* %2)
  store %struct.Element* %3, %struct.Element** %result.addr, align 8
  %4 = load %struct.Element*, %struct.Element** %result.addr, align 8
  %5 = icmp eq %struct.Element* %4, null
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [34 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %6 = load %struct.Element*, %struct.Element** %result.addr, align 8
  %7 = call i32 @Element.length(%struct.Element* %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef align 8 %struct.Element* @List.makeList(%struct.List* noundef nonnull readonly align 8 nocapture %this, i32 noundef %length) #0 {
entry:
  %e.addr = alloca %struct.Element*, align 8
  %0 = icmp eq i32 %length, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret %struct.Element* null

if.end:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.Element*
  call void @Element.constructor(%struct.Element* %2, i32 %length)
  store %struct.Element* %2, %struct.Element** %e.addr, align 8
  %3 = load %struct.Element*, %struct.Element** %e.addr, align 8
  %4 = sub nsw i32 %length, 1
  %5 = call %struct.Element* @List.makeList(%struct.List* %this, i32 %4)
  %6 = getelementptr inbounds %struct.Element, %struct.Element* %3, i32 0, i32 1
  store %struct.Element* %5, %struct.Element** %6, align 8, !tbaa !5
  %7 = load %struct.Element*, %struct.Element** %e.addr, align 8
  ret %struct.Element* %7
}

define internal noundef zeroext i1 @List.isShorterThan(%struct.List* noundef nonnull readonly align 8 nocapture %this, %struct.Element* noundef align 8 %x, %struct.Element* noundef align 8 %y) #3 {
entry:
  %xTail.addr = alloca %struct.Element*, align 8
  %yTail.addr = alloca %struct.Element*, align 8
  store %struct.Element* %x, %struct.Element** %xTail.addr, align 8
  store %struct.Element* %y, %struct.Element** %yTail.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Element*, %struct.Element** %yTail.addr, align 8
  %1 = icmp ne %struct.Element* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load %struct.Element*, %struct.Element** %xTail.addr, align 8
  %3 = icmp eq %struct.Element* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  %4 = load %struct.Element*, %struct.Element** %xTail.addr, align 8
  %5 = getelementptr inbounds %struct.Element, %struct.Element* %4, i32 0, i32 1
  %6 = load %struct.Element*, %struct.Element** %5, align 8, !tbaa !5
  store %struct.Element* %6, %struct.Element** %xTail.addr, align 8
  %7 = load %struct.Element*, %struct.Element** %yTail.addr, align 8
  %8 = getelementptr inbounds %struct.Element, %struct.Element* %7, i32 0, i32 1
  %9 = load %struct.Element*, %struct.Element** %8, align 8, !tbaa !5
  store %struct.Element* %9, %struct.Element** %yTail.addr, align 8
  br label %while.cond

while.end:
  ret i1 false
}

define internal noundef align 8 %struct.Element* @List.tail(%struct.List* noundef nonnull readonly align 8 nocapture %this, %struct.Element* noundef align 8 %x, %struct.Element* noundef align 8 %y, %struct.Element* noundef align 8 %z) #2 {
entry:
  %0 = call i1 @List.isShorterThan(%struct.List* %this, %struct.Element* %y, %struct.Element* %x)
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp eq %struct.Element* %x, null
  br i1 %1, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %2 = icmp eq %struct.Element* %y, null
  br label %lor.end.1

lor.end.1:
  %3 = phi i1 [ true, %if.then ], [ %2, %lor.rhs.1 ]
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = icmp eq %struct.Element* %z, null
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %lor.end.1 ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [33 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  %6 = getelementptr inbounds %struct.Element, %struct.Element* %x, i32 0, i32 1
  %7 = load %struct.Element*, %struct.Element** %6, align 8, !tbaa !5
  %8 = call %struct.Element* @List.tail(%struct.List* %this, %struct.Element* %7, %struct.Element* %y, %struct.Element* %z)
  %9 = getelementptr inbounds %struct.Element, %struct.Element* %y, i32 0, i32 1
  %10 = load %struct.Element*, %struct.Element** %9, align 8, !tbaa !5
  %11 = call %struct.Element* @List.tail(%struct.List* %this, %struct.Element* %10, %struct.Element* %z, %struct.Element* %x)
  %12 = getelementptr inbounds %struct.Element, %struct.Element* %z, i32 0, i32 1
  %13 = load %struct.Element*, %struct.Element** %12, align 8, !tbaa !5
  %14 = call %struct.Element* @List.tail(%struct.List* %this, %struct.Element* %13, %struct.Element* %x, %struct.Element* %y)
  %15 = call %struct.Element* @List.tail(%struct.List* %this, %struct.Element* %8, %struct.Element* %11, %struct.Element* %14)
  ret %struct.Element* %15

if.end:
  ret %struct.Element* %z
}

define noundef i32 @nish_main() #2 {
entry:
  %list.addr = alloca %struct.List*, align 8
  %List.obj = alloca %struct.List, align 8
  %before.addr = alloca i64, align 8
  %same.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  store %struct.List* %List.obj, %struct.List** %list.addr, align 8
  %0 = load %struct.List*, %struct.List** %list.addr, align 8
  %1 = call i32 @List.benchmark(%struct.List* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_used()
  store i64 %3, i64* %before.addr, align 8
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 1000
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i1, i1* %same.addr, align 1
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load %struct.List*, %struct.List** %list.addr, align 8
  %8 = call i32 @List.benchmark(%struct.List* %7)
  %9 = icmp eq i32 %8, 10
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.body ], [ %9, %land.rhs ]
  store i1 %10, i1* %same.addr, align 1
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %13 = load i1, i1* %same.addr, align 1
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %14)
  %15 = call i64 @nish_arena_used()
  %16 = load i64, i64* %before.addr, align 8
  %17 = icmp eq i64 %15, %16
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %18)
  ret i32 0
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
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Element", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
