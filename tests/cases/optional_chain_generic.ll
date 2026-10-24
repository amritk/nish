%struct.Box$str = type { i8*, %struct.Box$str* }
%struct.Box$i32 = type { i32, %struct.Box$i32* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"nil\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %item) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 1
  store %struct.Box$str* null, %struct.Box$str** %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %item, i8** %1, align 8, !tbaa !5
  ret void
}

define internal noundef align 8 %struct.Box$str* @noBox() #1 {
entry:
  ret %struct.Box$str* null
}

define noundef i32 @nish_main() #2 {
entry:
  %a.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %s.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 1)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %a.addr, align 8
  %0 = load %struct.Box$i32*, %struct.Box$i32** %a.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.Box$i32*
  call void @Box$i32.constructor(%struct.Box$i32* %2, i32 2)
  %3 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %0, i32 0, i32 1
  store %struct.Box$i32* %2, %struct.Box$i32** %3, align 8, !tbaa !8
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %s.addr, align 8
  %4 = load %struct.Box$i32*, %struct.Box$i32** %a.addr, align 8
  %5 = call i32 @nextItem$i32(%struct.Box$i32* %4, i32 -1)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %8 = load %struct.Box$i32*, %struct.Box$i32** %a.addr, align 8
  %9 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %8, i32 0, i32 1
  %10 = load %struct.Box$i32*, %struct.Box$i32** %9, align 8, !tbaa !8
  %11 = call i32 @nextItem$i32(%struct.Box$i32* %10, i32 -1)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %7, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = load %struct.Box$str*, %struct.Box$str** %s.addr, align 8
  %16 = call i8* @nextItem$str(%struct.Box$str* %15, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = call %struct.Box$str* @noBox()
  %20 = call i8* @nextItem$str(%struct.Box$str* %19, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  call void @nish_print(i8* %21)
  ret i32 0
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %item) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 1
  store %struct.Box$i32* null, %struct.Box$i32** %0, align 8, !tbaa !8
  %1 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %item, i32* %1, align 4, !tbaa !9
  ret void
}

define internal noundef i32 @nextItem$i32(%struct.Box$i32* noundef readonly align 8 nocapture %b, i32 noundef %fallback) #3 {
entry:
  %0 = icmp eq %struct.Box$i32* %b, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %b, i32 0, i32 1
  %2 = load %struct.Box$i32*, %struct.Box$i32** %1, align 8, !tbaa !8
  %3 = icmp eq %struct.Box$i32* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %2, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !9
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %6 = phi i32 [ %5, %chain.next.1 ], [ %fallback, %nullish.default ]
  ret i32 %6
}

define internal noundef nonnull align 8 i8* @nextItem$str(%struct.Box$str* noundef readonly align 8 nocapture %b, i8* noundef nonnull noalias readonly align 8 %fallback) #3 {
entry:
  %0 = icmp eq %struct.Box$str* %b, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %b, i32 0, i32 1
  %2 = load %struct.Box$str*, %struct.Box$str** %1, align 8, !tbaa !4
  %3 = icmp eq %struct.Box$str* %2, null
  br i1 %3, label %nullish.default, label %chain.next.1

chain.next.1:
  %4 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %2, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !5
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %6 = phi i8* [ %5, %chain.next.1 ], [ %fallback, %nullish.default ]
  ret i8* %6
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!10, !11, !12, !13, !14}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box$str", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 8}
!5 = !{!3, !2, i64 0}
!6 = !{!"i32", !1, i64 0}
!7 = !{!"Box$i32", !6, i64 0, !2, i64 8}
!8 = !{!7, !2, i64 8}
!9 = !{!7, !6, i64 0}
!10 = !{i32 8, !"cf-protection-branch", i32 1}
!11 = !{i32 8, !"cf-protection-return", i32 1}
!12 = !{i32 8, !"branch-target-enforcement", i32 1}
!13 = !{i32 8, !"sign-return-address", i32 1}
!14 = !{i32 4, !"probe-stack", !"inline-asm"}
