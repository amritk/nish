%struct.H = type { i32 }
%struct.G = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
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

define internal noundef i32 @keep(i32 noundef %k) #0 {
entry:
  ret i32 %k
}

define internal noundef zeroext i1 @pathLoop(%struct.H* noundef nonnull align 8 dereferenceable(4) nocapture %h, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 1, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 2, i32* %4, align 4, !tbaa !4
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %7 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  %9 = icmp eq i32 %8, 1
  ret i1 %9
}

define internal noundef zeroext i1 @argumentStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  %2 = call i32 @keep(i32 2)
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %5 = load i32, i32* %j.addr, align 4
  %6 = icmp eq i32 %5, 1
  ret i1 %6
}

define internal noundef zeroext i1 @initializerStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  store i32 2, i32* %t.addr, align 4
  %2 = load i32, i32* %t.addr, align 4
  %3 = call i32 @keep(i32 %2)
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 1
  ret i1 %7
}

define internal noundef zeroext i1 @chainStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %j.addr, align 4
  store i32 2, i32* %j.addr, align 4
  store i32 2, i32* %k.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %k.addr, align 4
  %5 = call i32 @keep(i32 %4)
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 1
  ret i1 %7
}

define internal noundef zeroext i1 @elementFieldStore(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %gs, i32 noundef %n) #1 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %gs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %gs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = icmp ult i64 0, %1
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %7 = bitcast i8* %3 to %struct.G**
  %8 = getelementptr inbounds %struct.G*, %struct.G** %7, i64 0
  %9 = load %struct.G*, %struct.G** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %10 = getelementptr inbounds %struct.G, %struct.G* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !18
  store i32 %11, i32* %j.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %14 = load i32, i32* %j.addr, align 4
  %15 = icmp eq i32 %14, 2
  ret i1 %15
}

define internal noundef zeroext i1 @bodyLetStore(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %t.addr, align 4
  %2 = load i32, i32* %t.addr, align 4
  store i32 %2, i32* %j.addr, align 4
  store i32 1, i32* %t.addr, align 4
  %3 = load i32, i32* %t.addr, align 4
  %4 = call i32 @keep(i32 %3)
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %7 = load i32, i32* %j.addr, align 4
  %8 = icmp eq i32 %7, 2
  ret i1 %8
}

define internal noundef zeroext i1 @wideLoop(i32 noundef %n) #2 {
entry:
  %w.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %w.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  store i32 1, i32* %w.addr, align 4
  store i32 2, i32* %w.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %w.addr, align 4
  %5 = icmp eq i32 %4, 1
  ret i1 %5
}

define void @nish_main() #1 {
entry:
  %h.addr = alloca %struct.H*, align 8
  %H.obj = alloca %struct.H, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.G*], align 8
  %0 = getelementptr inbounds %struct.H, %struct.H* %H.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store %struct.H* %H.obj, %struct.H** %h.addr, align 8
  %1 = load %struct.H*, %struct.H** %h.addr, align 8
  %2 = call i1 @pathLoop(%struct.H* %1, i32 2)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i1 @argumentStore(i32 2)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = call i1 @initializerStore(i32 2)
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %7)
  %8 = call i1 @chainStore(i32 2)
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %9)
  %10 = call i8* @nish_alloc_struct(i64 4)
  %11 = bitcast i8* %10 to %struct.G*
  %12 = getelementptr inbounds %struct.G, %struct.G* %11, i32 0, i32 0
  store i32 1, i32* %12, align 4, !tbaa !18
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %15 = bitcast [1 x %struct.G*]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %17 = bitcast i8* %15 to %struct.G**
  %18 = getelementptr inbounds %struct.G*, %struct.G** %17, i64 0
  store %struct.G* %11, %struct.G** %18, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %19 = call i1 @elementFieldStore(%struct.nish_array* %arr.hdr, i32 2)
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %20)
  %21 = call i1 @bodyLetStore(i32 2)
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %22)
  %23 = call i1 @wideLoop(i32 2)
  %24 = select i1 %23, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %24)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element ptr", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"G", !2, i64 0}
!18 = !{!17, !2, i64 0}
!19 = !{!12, !10, i64 8}
