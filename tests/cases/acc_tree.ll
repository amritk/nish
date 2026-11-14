%struct.TreeNode = type { i32, %struct.TreeNode*, %struct.TreeNode* }
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

define internal noundef i32 @sum(%struct.TreeNode* noundef readonly align 8 nocapture %t.in) #1 {
entry:
  br label %rec.head

rec.head:
  %t = phi %struct.TreeNode* [ %t.in, %entry ], [ %13, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %10, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq %struct.TreeNode* %t, null
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
  %4 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %t, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %t, i32 0, i32 1
  %7 = load %struct.TreeNode*, %struct.TreeNode** %6, align 8, !tbaa !6
  %8 = call i32 @sum(%struct.TreeNode* %7)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = getelementptr inbounds %struct.TreeNode, %struct.TreeNode* %t, i32 0, i32 2
  %13 = load %struct.TreeNode*, %struct.TreeNode** %12, align 8, !tbaa !7
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %14 = call i32 @sum(%struct.TreeNode* %t)
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %16)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %19

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
  %spine.addr = alloca %struct.TreeNode*, align 8
  %TreeNode.obj = alloca %struct.TreeNode, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.TreeNode*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.TreeNode*
  call void @TreeNode.constructor(%struct.TreeNode* %3, i32 30, %struct.TreeNode* null, %struct.TreeNode* null)
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.TreeNode*
  call void @TreeNode.constructor(%struct.TreeNode* %5, i32 4, %struct.TreeNode* null, %struct.TreeNode* null)
  call void @TreeNode.constructor(%struct.TreeNode* %1, i32 -2, %struct.TreeNode* %3, %struct.TreeNode* %5)
  call void @TreeNode.constructor(%struct.TreeNode* %TreeNode.obj, i32 1, %struct.TreeNode* null, %struct.TreeNode* %1)
  store %struct.TreeNode* %TreeNode.obj, %struct.TreeNode** %spine.addr, align 8
  %6 = call i32 @sum(%struct.TreeNode* null)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load %struct.TreeNode*, %struct.TreeNode** %spine.addr, align 8
  %10 = call i32 @sum(%struct.TreeNode* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = call %struct.TreeNode* @build(i32 10, i32 1)
  %15 = call i32 @sum(%struct.TreeNode* %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  call void @nish_print(i8* %17)
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

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"TreeNode", !2, i64 0, !3, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!4, !3, i64 16}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}
