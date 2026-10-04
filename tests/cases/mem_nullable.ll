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
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6

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
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %total.addr, align 4
  %9 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %10 = getelementptr inbounds %struct.Node, %struct.Node* %9, i32 0, i32 1
  %11 = load %struct.Node*, %struct.Node** %10, align 8, !tbaa !5
  store %struct.Node* %11, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %12 = load i32, i32* %total.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef align 8 %struct.Node* @find(%struct.Node* noundef align 8 %head, i32 noundef %want) #2 {
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

define internal noundef nonnull align 8 i8* @describe(%struct.Node* noundef readonly align 8 nocapture %n) #1 {
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

define internal noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #3 {
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.Node* @last(%struct.Node* noundef nonnull align 8 dereferenceable(16) %head) #2 {
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

define noundef i32 @nish_main() #1 {
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
  %29 = call i32 @valueOr(%struct.Node* %28, i32 -1)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  %31 = call i32 @valueOr(%struct.Node* null, i32 -1)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %34 = call %struct.Node* @last(%struct.Node* %33)
  %35 = getelementptr inbounds %struct.Node, %struct.Node* %34, i32 0, i32 0
  %36 = load i32, i32* %35, align 4, !tbaa !6
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  store i8* null, i8** %s.addr, align 8
  %38 = load i8*, i8** %s.addr, align 8
  %39 = icmp eq i8* %38, null
  %40 = select i1 %39, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %40)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8** %s.addr, align 8
  %41 = load i8*, i8** %s.addr, align 8
  %42 = icmp ne i8* %41, null
  br i1 %42, label %if.then, label %if.end

if.then:
  %43 = load i8*, i8** %s.addr, align 8
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  br label %if.end

if.end:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %48, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %49, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %50 = mul i64 2, 8
  %51 = bitcast [2 x %struct.Node*]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %51, i8 0, i64 %50, i1 false), !alias.scope !11, !noalias !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %51, i8** %52, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %54 = load %struct.Node*, %struct.Node** %c.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %57 = bitcast i8* %56 to %struct.Node**
  %58 = getelementptr inbounds %struct.Node*, %struct.Node** %57, i64 1
  store %struct.Node* %54, %struct.Node** %58, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  %59 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %62 = bitcast i8* %61 to %struct.Node**
  %63 = getelementptr inbounds %struct.Node*, %struct.Node** %62, i64 0
  %64 = load %struct.Node*, %struct.Node** %63, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.Node* %64, %struct.Node** %x0.addr, align 8
  %65 = load %struct.Node*, %struct.Node** %x0.addr, align 8
  %66 = icmp eq %struct.Node* %65, null
  %67 = select i1 %66, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %67)
  %68 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %71 = bitcast i8* %70 to %struct.Node**
  %72 = getelementptr inbounds %struct.Node*, %struct.Node** %71, i64 1
  %73 = load %struct.Node*, %struct.Node** %72, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.Node* %73, %struct.Node** %x1.addr, align 8
  %74 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %75 = icmp ne %struct.Node* %74, null
  br i1 %75, label %if.then.1, label %if.end.1

if.then.1:
  %76 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %77 = getelementptr inbounds %struct.Node, %struct.Node* %76, i32 0, i32 0
  %78 = load i32, i32* %77, align 4, !tbaa !6
  %79 = call i8* @nish_str_from_i32(i32 %78)
  call void @nish_print(i8* %79)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
