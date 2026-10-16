%struct.ScalarNode = type { i32, i32 }
%struct.ArrayNode = type { i32, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal void @ArrayNode.constructor(%struct.ArrayNode* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %items) #0 {
entry:
  %0 = getelementptr inbounds %struct.ArrayNode, %struct.ArrayNode* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.ArrayNode, %struct.ArrayNode* %this, i32 0, i32 1
  store i32 %items, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @weight(i32 noundef %k) #1 {
entry:
  switch i32 %k, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 1

sw.case.1:
  ret i32 10

sw.default:
  ret i32 100
}

define internal noundef i32 @missing() #1 {
entry:
  ret i32 2
}

define internal noundef i32 @keep(i32 noundef %k) #1 {
entry:
  ret i32 %k
}

define noundef i32 @test() #2 {
entry:
  %s.addr = alloca %struct.ScalarNode*, align 8
  %ScalarNode.obj = alloca %struct.ScalarNode, align 8
  %a.addr = alloca %struct.ArrayNode*, align 8
  %ArrayNode.obj = alloca %struct.ArrayNode, align 8
  %m.addr = alloca i32, align 4
  %tag.addr = alloca i32, align 4
  %same.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.ScalarNode, %struct.ScalarNode* %ScalarNode.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.ScalarNode, %struct.ScalarNode* %ScalarNode.obj, i32 0, i32 1
  store i32 4, i32* %1, align 4
  store %struct.ScalarNode* %ScalarNode.obj, %struct.ScalarNode** %s.addr, align 8
  call void @ArrayNode.constructor(%struct.ArrayNode* %ArrayNode.obj, i32 3)
  store %struct.ArrayNode* %ArrayNode.obj, %struct.ArrayNode** %a.addr, align 8
  %2 = call i32 @missing()
  store i32 %2, i32* %m.addr, align 4
  %3 = load %struct.ArrayNode*, %struct.ArrayNode** %a.addr, align 8
  %4 = getelementptr inbounds %struct.ArrayNode, %struct.ArrayNode* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = call i32 @keep(i32 %5)
  store i32 %6, i32* %tag.addr, align 4
  %7 = load i32, i32* %tag.addr, align 4
  %8 = icmp eq i32 %7, 1
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i32 [ 1000, %cond.true ], [ 0, %cond.false ]
  store i32 %9, i32* %same.addr, align 4
  %10 = load %struct.ScalarNode*, %struct.ScalarNode** %s.addr, align 8
  %11 = getelementptr inbounds %struct.ScalarNode, %struct.ScalarNode* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = call i32 @weight(i32 %12)
  %14 = load %struct.ArrayNode*, %struct.ArrayNode** %a.addr, align 8
  %15 = getelementptr inbounds %struct.ArrayNode, %struct.ArrayNode* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4, !tbaa !4
  %17 = call i32 @weight(i32 %16)
  %18 = add nsw i32 %13, %17
  %19 = load i32, i32* %m.addr, align 4
  %20 = call i32 @weight(i32 %19)
  %21 = add nsw i32 %18, %20
  %22 = load %struct.ScalarNode*, %struct.ScalarNode** %s.addr, align 8
  %23 = getelementptr inbounds %struct.ScalarNode, %struct.ScalarNode* %22, i32 0, i32 1
  %24 = load i32, i32* %23, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  %28 = load %struct.ArrayNode*, %struct.ArrayNode** %a.addr, align 8
  %29 = getelementptr inbounds %struct.ArrayNode, %struct.ArrayNode* %28, i32 0, i32 1
  %30 = load i32, i32* %29, align 4, !tbaa !5
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %34 = load i32, i32* %same.addr, align 4
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %36

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ArrayNode", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
