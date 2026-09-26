%struct.Counter = type { i32, i8* }
%struct.Pair = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Counter.bump(%struct.Counter* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %2, i32* %3, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @twice(i32 noundef %x) #1 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #2 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %i.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = icmp slt i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %11 = load i32, i32* %sum.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = add nsw i32 %11, %12
  store i32 %13, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp sgt i32 %18, 2
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end

if.end.1:
  br label %while.cond

while.end:
  br label %do.body

do.body:
  %20 = load i32, i32* %i.addr, align 4
  %21 = sub nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %do.cond

do.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = icmp sgt i32 %22, 0
  br i1 %23, label %do.body, label %do.end

do.end:
  %24 = load i32, i32* %sum.addr, align 4
  ret i32 %24
}

define noundef i32 @nish_main() #3 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %p.addr = alloca %struct.Pair*, align 8
  %Pair.obj = alloca %struct.Pair, align 8
  %t.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !18
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  call void @Counter.bump(%struct.Counter* %2)
  %3 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  call void @Counter.bump(%struct.Counter* %3)
  %4 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i32 1, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 1
  store i32 2, i32* %5, align 4
  store %struct.Pair* %Pair.obj, %struct.Pair** %p.addr, align 8
  %6 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %10 = getelementptr inbounds %struct.Pair, %struct.Pair* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  %12 = sub nsw i32 0, 5
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !19
  %15 = bitcast [3 x i32]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 %8, i32* %18, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 %11, i32* %19, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %20 = getelementptr inbounds i32, i32* %17, i64 2
  store i32 %12, i32* %20, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %21 = call i32 @total(%struct.nish_array* %arr.hdr)
  store i32 %21, i32* %t.addr, align 4
  %22 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %23 = getelementptr inbounds %struct.Counter, %struct.Counter* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !5
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %27 = load i32, i32* %t.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %31 = load i32, i32* %t.addr, align 4
  %32 = call i32 @twice(i32 %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %30, i8* %33)
  call void @nish_print(i8* %34)
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
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Counter", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!4, !3, i64 8}
!19 = !{!13, !11, i64 8}
