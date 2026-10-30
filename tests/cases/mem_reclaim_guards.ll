%struct.Box = type { i8* }
%struct.nish_result.str.i32 = type { i1, i8*, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"L\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %text, i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @fill(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %b, i32 noundef %i) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i8* %2, i8** %3, align 8, !tbaa !4
  %4 = load i8*, i8** %s.addr, align 8
  ret i8* %4
}

define internal noundef nonnull align 8 i8* @sweep(i32 noundef %i) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = icmp slt i64 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)

if.end:
  %2 = call i8* @nish_str_from_i32(i32 %i)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %2)
  ret i8* %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.str.i32* @label(i32 noundef %i) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %0)
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_result.str.i32*
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 0
  store i1 true, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 1
  store i8* %1, i8** %5, align 8
  ret %struct.nish_result.str.i32* %3
}

define internal noundef nonnull align 8 i8* @plain(i32 noundef %i) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %0)
  ret i8* %1
}

define noundef i32 @nish_main() #1 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj, i8* bitcast ({ i64, [1 x i8] }* @.str.5 to i8*))
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %0 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %1 = call i8* @fill(%struct.Box* %0, i32 1)
  call void @nish_print(i8* %1)
  %2 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %2, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !4
  call void @nish_print(i8* %4)
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @sweep(i32 2)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  call void @nish_print(i8* %7)
  %8 = call %struct.nish_result.str.i32* @label(i32 3)
  %9 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %8, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok, label %res.alt

res.ok:
  %11 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %8, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %13 = phi i8* [ %12, %res.ok ], [ bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), %res.alt ]
  call void @nish_print(i8* %13)
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @plain(i32 4)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish_print(i8* %16)
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
