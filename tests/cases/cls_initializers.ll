%struct.Defaults = type { i32, i32, i1, i8* }
%struct.Mixed = type { i32, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mixed\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Mixed.constructor(%struct.Mixed* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %limit) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 1
  store i32 %limit, i32* %2, align 4, !tbaa !7
  %3 = icmp sgt i32 %limit, 100
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %4, align 8, !tbaa !6
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %d.addr = alloca %struct.Defaults*, align 8
  %Defaults.obj = alloca %struct.Defaults, align 8
  %m.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %Mixed.obj.1 = alloca %struct.Mixed, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 0
  store i32 42, i32* %0, align 4, !tbaa !10
  %1 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 1
  store i32 -1, i32* %1, align 4, !tbaa !11
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 2
  store i1 true, i1* %2, align 1, !tbaa !12
  %3 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %3, align 8, !tbaa !13
  store %struct.Defaults* %Defaults.obj, %struct.Defaults** %d.addr, align 8
  %4 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %5 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !10
  %7 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %8 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !11
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %13)
  %14 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %15 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %14, i32 0, i32 2
  %16 = load i1, i1* %15, align 1, !tbaa !12
  %17 = select i1 %16, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %17)
  %18 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %19 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %18, i32 0, i32 3
  %20 = load i8*, i8** %19, align 8, !tbaa !13
  call void @nish_print(i8* %20)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj, i32 500)
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %m.addr, align 8
  %21 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %22 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !5
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %26 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %25, i32 0, i32 1
  %27 = load i32, i32* %26, align 4, !tbaa !7
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %30 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %29, i32 0, i32 2
  %31 = load i8*, i8** %30, align 8, !tbaa !6
  call void @nish_print(i8* %31)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj.1, i32 1)
  %32 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj.1, i32 0, i32 2
  %33 = load i8*, i8** %32, align 8, !tbaa !6
  call void @nish_print(i8* %33)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Mixed", !2, i64 0, !2, i64 4, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!4, !2, i64 4}
!8 = !{!"i1", !1, i64 0}
!9 = !{!"Defaults", !2, i64 0, !2, i64 4, !8, i64 8, !3, i64 16}
!10 = !{!9, !2, i64 0}
!11 = !{!9, !2, i64 4}
!12 = !{!9, !8, i64 8}
!13 = !{!9, !3, i64 16}
