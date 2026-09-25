%struct.Node = type { i32 }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"null\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"node\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_div(i1 noundef zeroext) #5

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

define internal noundef align 4 %struct.Node* @nothing() #0 {
entry:
  ret %struct.Node* null
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @args() #1 {
entry:
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  ret %struct.nish_array* %0
}

define internal noundef nonnull align 8 i8* @firstArg() #2 {
entry:
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8* %8
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @half(i32 noundef %n) #2 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %10, align 8
  br label %cond.end

cond.false:
  %11 = icmp eq i32 2, 0
  %12 = icmp eq i32 %n, -2147483648
  %13 = icmp eq i32 2, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %11)
  unreachable

div.ok.1:
  %16 = sdiv i32 %n, 2
  %17 = call i8* @nish_alloc_struct(i64 16)
  %18 = bitcast i8* %17 to %struct.nish_result.i32.str*
  %19 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 0
  store i1 true, i1* %19, align 1
  %20 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 1
  store i32 %16, i32* %20, align 4
  br label %cond.end

cond.end:
  %21 = phi %struct.nish_result.i32.str* [ %8, %cond.true ], [ %18, %div.ok.1 ]
  ret %struct.nish_result.i32.str* %21
}

define internal noundef i32 @field(%struct.Node* noundef nonnull readonly align 4 dereferenceable(4) nocapture %n) #1 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define internal noundef i32 @element(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  ret i32 %7
}

define noundef i32 @nish_main() #2 {
entry:
  %maybe.addr = alloca %struct.Node*, align 8
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %n.addr = alloca %struct.Node*, align 8
  %Node.obj = alloca %struct.Node, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Node* @nothing()
  store %struct.Node* %0, %struct.Node** %maybe.addr, align 8
  %1 = load %struct.Node*, %struct.Node** %maybe.addr, align 8
  %2 = icmp eq %struct.Node* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %3)
  %4 = call %struct.nish_array* @args()
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  %8 = icmp sgt i32 %7, 0
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %9)
  %10 = call i8* @firstArg()
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = icmp sgt i32 %13, 0
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %15)
  %16 = call %struct.nish_result.i32.str* @half(i32 8)
  store %struct.nish_result.i32.str* %16, %struct.nish_result.i32.str** %r.addr, align 8
  %17 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %18 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %17, i32 0, i32 0
  %19 = load i1, i1* %18, align 1
  br i1 %19, label %res.ok, label %res.alt

res.ok:
  %20 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %17, i32 0, i32 1
  %21 = load i32, i32* %20, align 4
  br label %res.end

res.alt:
  %22 = sub nsw i32 0, 1
  br label %res.end

res.end:
  %23 = phi i32 [ %21, %res.ok ], [ %22, %res.alt ]
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = getelementptr inbounds %struct.Node, %struct.Node* %Node.obj, i32 0, i32 0
  store i32 4, i32* %25, align 4
  store %struct.Node* %Node.obj, %struct.Node** %n.addr, align 8
  %26 = load %struct.Node*, %struct.Node** %n.addr, align 8
  %27 = call i32 @field(%struct.Node* %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %32 = bitcast [2 x i32]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 7, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %36 = getelementptr inbounds i32, i32* %34, i64 1
  store i32 8, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %37 = call i32 @element(%struct.nish_array* %arr.hdr)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %29, i8* %38)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i32", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
