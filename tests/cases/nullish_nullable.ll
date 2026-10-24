%struct.Node = type { i32 }
%struct.Count = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"anonymous\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Node* @make(%struct.Count* noundef nonnull align 8 dereferenceable(4) nocapture %count, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !6
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Count, %struct.Count* %count, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !6
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = bitcast i8* %6 to %struct.Node*
  call void @Node.constructor(%struct.Node* %7, i32 %value)
  ret %struct.Node* %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Node* @orFallback(%struct.Node* noundef align 8 %n, %struct.Node* noundef nonnull align 8 dereferenceable(4) %fallback) #2 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  %1 = select i1 %0, %struct.Node* %n, %struct.Node* %fallback
  ret %struct.Node* %1
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Node* @orMade(%struct.Node* noundef align 8 %n, %struct.Count* noundef nonnull align 8 dereferenceable(4) nocapture %count) #1 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  %1 = call %struct.Node* @make(%struct.Count* %count, i32 -2)
  br label %nullish.end

nullish.end:
  %2 = phi %struct.Node* [ %n, %entry ], [ %1, %nullish.default ]
  ret %struct.Node* %2
}

define internal noundef nonnull align 8 i8* @nameOr(i8* noundef noalias readonly align 8 %name) #2 {
entry:
  %0 = icmp ne i8* %name, null
  %1 = select i1 %0, i8* %name, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*)
  ret i8* %1
}

define noundef i32 @nish_main() #1 {
entry:
  %one.addr = alloca %struct.Node*, align 8
  %fallback.addr = alloca %struct.Node*, align 8
  %count.addr = alloca %struct.Count*, align 8
  %Count.obj = alloca %struct.Count, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 1)
  store %struct.Node* %1, %struct.Node** %one.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Node*
  call void @Node.constructor(%struct.Node* %3, i32 -1)
  store %struct.Node* %3, %struct.Node** %fallback.addr, align 8
  %4 = load %struct.Node*, %struct.Node** %one.addr, align 8
  %5 = load %struct.Node*, %struct.Node** %fallback.addr, align 8
  %6 = call %struct.Node* @orFallback(%struct.Node* %4, %struct.Node* %5)
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %11 = load %struct.Node*, %struct.Node** %fallback.addr, align 8
  %12 = call %struct.Node* @orFallback(%struct.Node* null, %struct.Node* %11)
  %13 = getelementptr inbounds %struct.Node, %struct.Node* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %10, i8* %15)
  call void @nish_print(i8* %16)
  %17 = getelementptr inbounds %struct.Count, %struct.Count* %Count.obj, i32 0, i32 0
  store i32 0, i32* %17, align 4, !tbaa !6
  store %struct.Count* %Count.obj, %struct.Count** %count.addr, align 8
  %18 = load %struct.Node*, %struct.Node** %one.addr, align 8
  %19 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %20 = call %struct.Node* @orMade(%struct.Node* %18, %struct.Count* %19)
  %21 = getelementptr inbounds %struct.Node, %struct.Node* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4, !tbaa !4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %25 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %26 = getelementptr inbounds %struct.Count, %struct.Count* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4, !tbaa !6
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %24, i8* %28)
  call void @nish_print(i8* %29)
  %30 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %31 = call %struct.Node* @orMade(%struct.Node* null, %struct.Count* %30)
  %32 = getelementptr inbounds %struct.Node, %struct.Node* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4, !tbaa !4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %36 = load %struct.Count*, %struct.Count** %count.addr, align 8
  %37 = getelementptr inbounds %struct.Count, %struct.Count* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !6
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %35, i8* %39)
  call void @nish_print(i8* %40)
  %41 = call i8* @nameOr(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %43 = call i8* @nameOr(i8* null)
  %44 = call i8* @nish_str_concat(i8* %42, i8* %43)
  call void @nish_print(i8* %44)
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
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Node", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Count", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
