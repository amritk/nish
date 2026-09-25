%struct.Slot = type { i1, double, i32 }
%struct.Frame = type { i1, double, i32 }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1

define noundef nonnull align 8 i8* @banner(i32 noundef %n) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i8*, i8** %out.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %3, i8** %out.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %6 = load i8*, i8** %out.addr, align 8
  ret i8* %6
}

define noundef nonnull align 8 i8* @tag(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i8*, i8** %s.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %3, i8** %s.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %6 = load i8*, i8** %s.addr, align 8
  ret i8* %6
}

define noundef i32 @test() #0 {
entry:
  %slot.addr = alloca %struct.Slot*, align 8
  %Slot.obj = alloca %struct.Slot, align 8
  %frame.addr = alloca %struct.Frame*, align 8
  %Frame.obj = alloca %struct.Frame, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !6
  %1 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %1, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !8
  store %struct.Slot* %Slot.obj, %struct.Slot** %slot.addr, align 8
  %3 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %4 = getelementptr inbounds %struct.Slot, %struct.Slot* %3, i32 0, i32 2
  store i32 1, i32* %4, align 4, !tbaa !8
  %5 = getelementptr inbounds %struct.Frame, %struct.Frame* %Frame.obj, i32 0, i32 0
  store i1 false, i1* %5, align 1, !tbaa !10
  %6 = getelementptr inbounds %struct.Frame, %struct.Frame* %Frame.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %6, align 8, !tbaa !11
  %7 = getelementptr inbounds %struct.Frame, %struct.Frame* %Frame.obj, i32 0, i32 2
  store i32 0, i32* %7, align 4, !tbaa !12
  store %struct.Frame* %Frame.obj, %struct.Frame** %frame.addr, align 8
  %8 = load %struct.Frame*, %struct.Frame** %frame.addr, align 8
  %9 = getelementptr inbounds %struct.Frame, %struct.Frame* %8, i32 0, i32 2
  store i32 2, i32* %9, align 4, !tbaa !12
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @banner(i32 2)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @tag(i32 3)
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = add nsw i32 %15, %21
  %23 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %24 = getelementptr inbounds %struct.Slot, %struct.Slot* %23, i32 0, i32 2
  %25 = load i32, i32* %24, align 4, !tbaa !8
  %26 = add nsw i32 %22, %25
  %27 = load %struct.Frame*, %struct.Frame** %frame.addr, align 8
  %28 = getelementptr inbounds %struct.Frame, %struct.Frame* %27, i32 0, i32 2
  %29 = load i32, i32* %28, align 4, !tbaa !12
  %30 = add nsw i32 %26, %29
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %30
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"double", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Slot", !2, i64 0, !3, i64 8, !4, i64 16}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 8}
!8 = !{!5, !4, i64 16}
!9 = !{!"Frame", !2, i64 0, !3, i64 8, !4, i64 16}
!10 = !{!9, !2, i64 0}
!11 = !{!9, !3, i64 8}
!12 = !{!9, !4, i64 16}
