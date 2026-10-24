%struct.Named = type { i8* }
%struct.Node = type { i32, %struct.Node* }
%struct.Count = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"four\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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

define internal noundef align 8 %struct.Node* @Node.after(%struct.Node* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  %1 = load %struct.Node*, %struct.Node** %0, align 8, !tbaa !5
  ret %struct.Node* %1
}

define internal noundef align 8 %struct.Node* @make(%struct.Count* noundef nonnull align 8 dereferenceable(4) nocapture %count, i32 noundef %v) #2 {
entry:
  %0 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !8
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !8
  %6 = icmp sgt i32 %v, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.Node*
  call void @Node.constructor(%struct.Node* %8, i32 %v)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi %struct.Node* [ %8, %cond.true ], [ null, %cond.false ]
  ret %struct.Node* %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tick(%struct.Count* noundef nonnull align 8 dereferenceable(4) nocapture %count) #2 {
entry:
  %0 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !8
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 100)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !8
  ret i32 1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef align 8 %struct.Node* @nothing() #3 {
entry:
  ret %struct.Node* null
}

define internal noundef nonnull align 8 i8* @nameOf(%struct.Named* noundef readonly align 8 nocapture %n) #1 {
entry:
  %0 = icmp eq %struct.Named* %n, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Named, %struct.Named* %n, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %3 = phi i8* [ %2, %chain.next ], [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %nullish.default ]
  ret i8* %3
}

define internal noundef i32 @lengthOf(i8* noundef noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = icmp eq i8* %s, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %chain.next ], [ -1, %nullish.default ]
  ret i32 %4
}

define internal noundef i32 @sizeOf(%struct.nish_array* noundef readonly align 8 nocapture %xs) #1 {
entry:
  %0 = icmp eq %struct.nish_array* %xs, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = trunc i64 %2 to i32
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %chain.next ], [ -1, %nullish.default ]
  ret i32 %4
}

define internal noundef i32 @secondNext(%struct.Node* noundef readonly align 8 nocapture %n) #1 {
entry:
  %0 = icmp eq %struct.Node* %n, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = call %struct.Node* @Node.after(%struct.Node* %n)
  %2 = icmp eq %struct.Node* %1, null
  br i1 %2, label %nullish.default, label %chain.next.1

chain.next.1:
  %3 = call %struct.Node* @Node.after(%struct.Node* %1)
  %4 = icmp eq %struct.Node* %3, null
  br i1 %4, label %nullish.default, label %chain.next.2

chain.next.2:
  %5 = getelementptr inbounds %struct.Node, %struct.Node* %3, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !6
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %7 = phi i32 [ %6, %chain.next.2 ], [ 0, %nullish.default ]
  ret i32 %7
}

define internal noundef i32 @either(%struct.Node* noundef readonly align 8 nocapture %a, %struct.Node* noundef readonly align 8 nocapture %b) #1 {
entry:
  %0 = icmp ne %struct.Node* %a, null
  %1 = select i1 %0, %struct.Node* %a, %struct.Node* %b
  %2 = icmp eq %struct.Node* %1, null
  br i1 %2, label %nullish.default, label %chain.next

chain.next:
  %3 = getelementptr inbounds %struct.Node, %struct.Node* %1, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !6
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %5 = phi i32 [ %4, %chain.next ], [ -1, %nullish.default ]
  ret i32 %5
}

define noundef i32 @nish_main() #2 {
entry:
  %count.addr = alloca %struct.Count*, align 8
  %Count.obj = alloca %struct.Count, align 8
  %none.addr = alloca %struct.Node*, align 8
  %some.addr = alloca %struct.Node*, align 8
  %skipped.addr = alloca i32, align 4
  %Named.obj = alloca %struct.Named, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %a.addr = alloca %struct.Node*, align 8
  %Node.obj = alloca %struct.Node, align 8
  %b.addr = alloca %struct.Node*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Count, %struct.Count* %Count.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !8
  store %struct.Count* %Count.obj, %struct.Count** %count.addr, align 8
  %1 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %2 = call %struct.Node* @make(%struct.Count* %1, i32 5)
  %3 = icmp eq %struct.Node* %2, null
  br i1 %3, label %nullish.default, label %chain.next

chain.next:
  %4 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !6
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %6 = phi i32 [ %5, %chain.next ], [ 0, %nullish.default ]
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %10 = call %struct.Node* @make(%struct.Count* %9, i32 0)
  %11 = icmp eq %struct.Node* %10, null
  br i1 %11, label %nullish.default.1, label %chain.next.1

chain.next.1:
  %12 = getelementptr inbounds %struct.Node, %struct.Node* %10, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !6
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %14 = phi i32 [ %13, %chain.next.1 ], [ 0, %nullish.default.1 ]
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %8, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %18 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %19 = getelementptr inbounds %struct.Count, %struct.Count* %18, i32 0, i32 0
  %20 = load i32, i32* %19, align 4, !tbaa !8
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  call void @nish_print(i8* %22)
  %23 = call %struct.Node* @nothing()
  store %struct.Node* %23, %struct.Node** %none.addr, align 8
  %24 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %25 = call %struct.Node* @make(%struct.Count* %24, i32 3)
  store %struct.Node* %25, %struct.Node** %some.addr, align 8
  %26 = load %struct.Node*, %struct.Node** %none.addr, align 8
  %27 = icmp eq %struct.Node* %26, null
  br i1 %27, label %nullish.default.2, label %chain.next.2

chain.next.2:
  %28 = getelementptr inbounds %struct.Node, %struct.Node* %26, i32 0, i32 1
  %29 = load %struct.Node*, %struct.Node** %28, align 8, !tbaa !5
  %30 = icmp eq %struct.Node* %29, null
  br i1 %30, label %nullish.default.2, label %chain.next.3

chain.next.3:
  %31 = getelementptr inbounds %struct.Node, %struct.Node* %29, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !6
  br label %nullish.end.2

nullish.default.2:
  %33 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %34 = call i32 @tick(%struct.Count* %33)
  br label %nullish.end.2

nullish.end.2:
  %35 = phi i32 [ %32, %chain.next.3 ], [ %34, %nullish.default.2 ]
  store i32 %35, i32* %skipped.addr, align 4
  %36 = load i32, i32* %skipped.addr, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %39 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %40 = getelementptr inbounds %struct.Count, %struct.Count* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !8
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %38, i8* %42)
  call void @nish_print(i8* %43)
  %44 = call i8* @nameOf(%struct.Named* null)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %46 = getelementptr inbounds %struct.Named, %struct.Named* %Named.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %46, align 8
  %47 = call i8* @nameOf(%struct.Named* %Named.obj)
  %48 = call i8* @nish_str_concat(i8* %45, i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %50 = call i32 @lengthOf(i8* null)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %49, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %54 = call i32 @lengthOf(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %53, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %58 = call i32 @sizeOf(%struct.nish_array* null)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %57, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %62, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %63, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %64 = bitcast [2 x i32]* %arr.data to i8*
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %64, i8** %65, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %66 = bitcast i8* %64 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 0
  store i32 1, i32* %67, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %68 = getelementptr inbounds i32, i32* %66, i64 1
  store i32 2, i32* %68, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %69 = call i32 @sizeOf(%struct.nish_array* %arr.hdr)
  %70 = call i8* @nish_str_from_i32(i32 %69)
  %71 = call i8* @nish_str_concat(i8* %61, i8* %70)
  call void @nish_print(i8* %71)
  call void @Node.constructor(%struct.Node* %Node.obj, i32 1)
  store %struct.Node* %Node.obj, %struct.Node** %a.addr, align 8
  %72 = call i8* @nish_alloc_struct(i64 16)
  %73 = bitcast i8* %72 to %struct.Node*
  call void @Node.constructor(%struct.Node* %73, i32 2)
  store %struct.Node* %73, %struct.Node** %b.addr, align 8
  %74 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %75 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %76 = getelementptr inbounds %struct.Node, %struct.Node* %74, i32 0, i32 1
  store %struct.Node* %75, %struct.Node** %76, align 8, !tbaa !5
  %77 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %78 = call i8* @nish_alloc_struct(i64 16)
  %79 = bitcast i8* %78 to %struct.Node*
  call void @Node.constructor(%struct.Node* %79, i32 3)
  %80 = getelementptr inbounds %struct.Node, %struct.Node* %77, i32 0, i32 1
  store %struct.Node* %79, %struct.Node** %80, align 8, !tbaa !5
  %81 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %82 = call i32 @secondNext(%struct.Node* %81)
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %85 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %86 = call i32 @secondNext(%struct.Node* %85)
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %84, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %90 = call i32 @secondNext(%struct.Node* null)
  %91 = call i8* @nish_str_from_i32(i32 %90)
  %92 = call i8* @nish_str_concat(i8* %89, i8* %91)
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %94 = load %struct.Node*, %struct.Node** %some.addr, align 8
  %95 = call i32 @either(%struct.Node* null, %struct.Node* %94)
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* %93, i8* %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %99 = call i32 @either(%struct.Node* null, %struct.Node* null)
  %100 = call i8* @nish_str_from_i32(i32 %99)
  %101 = call i8* @nish_str_concat(i8* %98, i8* %100)
  call void @nish_print(i8* %101)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
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

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Node", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"Count", !2, i64 0}
!8 = !{!7, !2, i64 0}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
