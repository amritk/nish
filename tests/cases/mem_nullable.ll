%struct.Node = type { i32, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"node \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @sum(%struct.Node* noundef align 8 %head) #1 {
entry:
  %total.addr = alloca i32, align 4
  %cur.addr = alloca %struct.Node*, align 8
  store i32 0, i32* %total.addr, align 4
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = icmp ne %struct.Node* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %4 = getelementptr inbounds %struct.Node, %struct.Node* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !6
  %6 = add nsw i32 %2, %5
  store i32 %6, i32* %total.addr, align 4
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8, !tbaa !5
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load i32, i32* %total.addr, align 4
  ret i32 %10
}

define internal noundef align 8 %struct.Node* @find(%struct.Node* noundef align 8 %head, i32 noundef %want) #1 {
entry:
  %cur.addr = alloca %struct.Node*, align 8
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = icmp ne %struct.Node* %0, null
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %3 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !6
  %5 = icmp ne i32 %4, %want
  br label %land.end

land.end:
  %6 = phi i1 [ false, %while.cond ], [ %5, %land.rhs ]
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8, !tbaa !5
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  ret %struct.Node* %10
}

define internal noundef nonnull align 8 i8* @describe(%struct.Node* noundef readonly align 8 nocapture %n) #0 {
entry:
  %0 = icmp eq %struct.Node* %n, null
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)

if.end:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !6
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %3)
  ret i8* %4
}

define internal noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #2 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !6
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %fallback, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Node* @last(%struct.Node* noundef nonnull align 8 dereferenceable(16) %head) #1 {
entry:
  %cur.addr = alloca %struct.Node*, align 8
  %next.addr = alloca %struct.Node*, align 8
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %0, i32 0, i32 1
  %2 = load %struct.Node*, %struct.Node** %1, align 8, !tbaa !5
  store %struct.Node* %2, %struct.Node** %next.addr, align 8
  br label %while.cond

while.cond:
  %3 = load %struct.Node*, %struct.Node** %next.addr, align 8
  %4 = icmp ne %struct.Node* %3, null
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load %struct.Node*, %struct.Node** %next.addr, align 8
  store %struct.Node* %5, %struct.Node** %cur.addr, align 8
  %6 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 1
  %8 = load %struct.Node*, %struct.Node** %7, align 8, !tbaa !5
  store %struct.Node* %8, %struct.Node** %next.addr, align 8
  br label %while.cond

while.end:
  %9 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  ret %struct.Node* %9
}

define noundef i32 @nish_main() #3 {
entry:
  %a.addr = alloca %struct.Node*, align 8
  %b.addr = alloca %struct.Node*, align 8
  %c.addr = alloca %struct.Node*, align 8
  %s.addr = alloca i8*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Node*], align 8
  %x0.addr = alloca %struct.Node*, align 8
  %x1.addr = alloca %struct.Node*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 1)
  store %struct.Node* %1, %struct.Node** %a.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.Node*
  call void @Node.constructor(%struct.Node* %3, i32 2)
  store %struct.Node* %3, %struct.Node** %b.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.Node*
  call void @Node.constructor(%struct.Node* %5, i32 3)
  store %struct.Node* %5, %struct.Node** %c.addr, align 8
  %6 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %7 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 1
  store %struct.Node* %7, %struct.Node** %8, align 8, !tbaa !5
  %9 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %10 = load %struct.Node*, %struct.Node** %c.addr, align 8
  %11 = getelementptr inbounds %struct.Node, %struct.Node* %9, i32 0, i32 1
  store %struct.Node* %10, %struct.Node** %11, align 8, !tbaa !5
  %12 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %13 = call i32 @sum(%struct.Node* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = call i32 @sum(%struct.Node* null)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %18 = call %struct.Node* @find(%struct.Node* %17, i32 2)
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @describe(%struct.Node* %18)
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %23 = call %struct.Node* @find(%struct.Node* %22, i32 9)
  %24 = call i64 @nish_arena_mark()
  %25 = call i8* @describe(%struct.Node* %23)
  %26 = call i8* @nish_arena_keep(i64 %24, i8* %25)
  call void @nish_print(i8* %26)
  %27 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %28 = call %struct.Node* @find(%struct.Node* %27, i32 3)
  %29 = sub nsw i32 0, 1
  %30 = call i32 @valueOr(%struct.Node* %28, i32 %29)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
  %32 = sub nsw i32 0, 1
  %33 = call i32 @valueOr(%struct.Node* null, i32 %32)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %36 = call %struct.Node* @last(%struct.Node* %35)
  %37 = getelementptr inbounds %struct.Node, %struct.Node* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !6
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  store i8* null, i8** %s.addr, align 8
  %40 = load i8*, i8** %s.addr, align 8
  %41 = icmp eq i8* %40, null
  %42 = select i1 %41, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %42)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8** %s.addr, align 8
  %43 = load i8*, i8** %s.addr, align 8
  %44 = icmp ne i8* %43, null
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i8*, i8** %s.addr, align 8
  %46 = bitcast i8* %45 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = trunc i64 %47 to i32
  %49 = call i8* @nish_str_from_i32(i32 %48)
  call void @nish_print(i8* %49)
  br label %if.end

if.end:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %50, align 8, !alias.scope !10, !noalias !11
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %51, align 8, !alias.scope !10, !noalias !11
  %52 = mul i64 2, 8
  %53 = bitcast [2 x %struct.Node*]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %53, i8 0, i64 %52, i1 false), !alias.scope !11, !noalias !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %53, i8** %54, align 8, !alias.scope !10, !noalias !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %55 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %56 = load %struct.Node*, %struct.Node** %c.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !10, !noalias !11
  %59 = bitcast i8* %58 to %struct.Node**
  %60 = getelementptr inbounds %struct.Node*, %struct.Node** %59, i64 1
  store %struct.Node* %56, %struct.Node** %60, align 8, !alias.scope !11, !noalias !10, !tbaa !13
  %61 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !10, !noalias !11
  %64 = bitcast i8* %63 to %struct.Node**
  %65 = getelementptr inbounds %struct.Node*, %struct.Node** %64, i64 0
  %66 = load %struct.Node*, %struct.Node** %65, align 8, !alias.scope !11, !noalias !10, !tbaa !13
  store %struct.Node* %66, %struct.Node** %x0.addr, align 8
  %67 = load %struct.Node*, %struct.Node** %x0.addr, align 8
  %68 = icmp eq %struct.Node* %67, null
  %69 = select i1 %68, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !10, !noalias !11
  %73 = icmp ult i64 1, %72
  br i1 %73, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %72)
  unreachable

bounds.ok:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !10, !noalias !11
  %76 = bitcast i8* %75 to %struct.Node**
  %77 = getelementptr inbounds %struct.Node*, %struct.Node** %76, i64 1
  %78 = load %struct.Node*, %struct.Node** %77, align 8, !alias.scope !11, !noalias !10, !tbaa !13
  store %struct.Node* %78, %struct.Node** %x1.addr, align 8
  %79 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %80 = icmp ne %struct.Node* %79, null
  br i1 %80, label %if.then.1, label %if.end.1

if.then.1:
  %81 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %82 = getelementptr inbounds %struct.Node, %struct.Node* %81, i32 0, i32 0
  %83 = load i32, i32* %82, align 4, !tbaa !6
  %84 = call i8* @nish_str_from_i32(i32 %83)
  call void @nish_print(i8* %84)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Node", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"element ptr", !1, i64 0}
!13 = !{!12, !12, i64 0}
