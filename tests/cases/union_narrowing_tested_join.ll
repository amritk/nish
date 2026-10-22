%struct.VA = type { i32, i32 }
%struct.VB = type { i32, i32 }
%struct.VC = type { i32, i32 }
%union.tagged = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @m(%union.tagged* noundef %s, i1 noundef zeroext %c) #0 {
entry:
  br i1 %c, label %if.then, label %if.else

if.then:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 2
  br i1 %2, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 0

if.end.1:
  br label %if.end

if.else:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp ne i32 %4, 2
  br i1 %5, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 1

if.end.2:
  br label %if.end

if.end:
  %6 = bitcast %union.tagged* %s to %struct.VC*
  %7 = getelementptr inbounds %struct.VC, %struct.VC* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !4
  ret i32 %8
}

define internal noundef i32 @w(%union.tagged* noundef %s, i32 noundef %n) #0 {
entry:
  switch i32 %n, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 1
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  br label %sw.end

sw.case.1:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp ne i32 %4, 1
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1

if.end.1:
  br label %sw.end

sw.default:
  ret i32 2

sw.end:
  %6 = bitcast %union.tagged* %s to %struct.VB*
  %7 = getelementptr inbounds %struct.VB, %struct.VB* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !6
  ret i32 %8
}

define internal noundef zeroext i1 @e(i32 noundef %k, i1 noundef zeroext %c) #1 {
entry:
  br i1 %c, label %if.then, label %if.end

if.then:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %if.end

if.end:
  %1 = icmp eq i32 %k, 0
  ret i1 %1
}

define internal noundef zeroext i1 @x(i32 noundef %k, i32 noundef %n) #1 {
entry:
  switch i32 %n, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  br label %sw.end

sw.default:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %sw.end

sw.end:
  %1 = icmp eq i32 %k, 0
  ret i1 %1
}

define internal noundef zeroext i1 @o2(i32 noundef %k, i1 noundef zeroext %c) #1 {
entry:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br i1 %c, label %if.then.1, label %if.else

if.then.1:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %if.then.2, label %if.end.2

if.then.2:
  ret i1 false

if.end.2:
  br label %if.end.1

if.else:
  %2 = icmp eq i32 %k, 1
  br i1 %2, label %if.then.3, label %if.end.3

if.then.3:
  ret i1 true

if.end.3:
  br label %if.end.1

if.end.1:
  %3 = icmp eq i32 %k, 2
  ret i1 %3
}

define internal noundef zeroext i1 @ei2(i32 noundef %k, i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 1
  br i1 %0, label %if.then, label %if.else

if.then:
  %1 = icmp eq i32 %k, 0
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %if.end

if.else:
  %2 = icmp eq i32 %n, 2
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  %3 = icmp eq i32 %k, 0
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i1 true

if.end.3:
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  %4 = icmp eq i32 %k, 0
  ret i1 %4
}

define void @nish_main() #2 {
entry:
  %VC.obj = alloca %struct.VC, align 8
  %VA.obj = alloca %struct.VA, align 8
  %VB.obj = alloca %struct.VB, align 8
  %VA.obj.1 = alloca %struct.VA, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.VC, %struct.VC* %VC.obj, i32 0, i32 0
  store i32 2, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.VC, %struct.VC* %VC.obj, i32 0, i32 1
  store i32 3, i32* %1, align 4, !tbaa !4
  %2 = bitcast %struct.VC* %VC.obj to %union.tagged*
  %3 = call i32 @m(%union.tagged* %2, i1 true)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = getelementptr inbounds %struct.VA, %struct.VA* %VA.obj, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !9
  %6 = getelementptr inbounds %struct.VA, %struct.VA* %VA.obj, i32 0, i32 1
  store i32 1, i32* %6, align 4, !tbaa !10
  %7 = bitcast %struct.VA* %VA.obj to %union.tagged*
  %8 = call i32 @m(%union.tagged* %7, i1 false)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.VB, %struct.VB* %VB.obj, i32 0, i32 0
  store i32 1, i32* %10, align 4, !tbaa !11
  %11 = getelementptr inbounds %struct.VB, %struct.VB* %VB.obj, i32 0, i32 1
  store i32 2, i32* %11, align 4, !tbaa !6
  %12 = bitcast %struct.VB* %VB.obj to %union.tagged*
  %13 = call i32 @w(%union.tagged* %12, i32 2)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = getelementptr inbounds %struct.VA, %struct.VA* %VA.obj.1, i32 0, i32 0
  store i32 0, i32* %15, align 4, !tbaa !9
  %16 = getelementptr inbounds %struct.VA, %struct.VA* %VA.obj.1, i32 0, i32 1
  store i32 1, i32* %16, align 4, !tbaa !10
  %17 = bitcast %struct.VA* %VA.obj.1 to %union.tagged*
  %18 = call i32 @w(%union.tagged* %17, i32 1)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = call i1 @e(i32 0, i1 false)
  %21 = select i1 %20, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %21)
  %22 = call i1 @x(i32 0, i32 1)
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %23)
  %24 = call i1 @o2(i32 2, i1 true)
  %25 = select i1 %24, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %25)
  %26 = call i1 @ei2(i32 0, i32 3)
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"VC", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 4}
!5 = !{!"VB", !2, i64 0, !2, i64 4}
!6 = !{!5, !2, i64 4}
!7 = !{!3, !2, i64 0}
!8 = !{!"VA", !2, i64 0, !2, i64 4}
!9 = !{!8, !2, i64 0}
!10 = !{!8, !2, i64 4}
!11 = !{!5, !2, i64 0}
