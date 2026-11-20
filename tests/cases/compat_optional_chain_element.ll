%struct.Row = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yz\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bc\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define internal void @Row.constructor(%struct.Row* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %cells) #0 {
entry:
  %0 = getelementptr inbounds %struct.Row, %struct.Row* %this, i32 0, i32 0
  store %struct.nish_array* %cells, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef double @width(%struct.nish_array* noundef readonly align 8 nocapture %xs, double noundef %i) #1 {
entry:
  %0 = icmp eq %struct.nish_array* %xs, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = fptosi double %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 %1
  %9 = load i8*, i8** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = sitofp i64 %11 to double
  br label %nullish.end

nullish.default:
  %13 = fneg double 0x3FF0000000000000
  br label %nullish.end

nullish.end:
  %14 = phi double [ %12, %bounds.ok ], [ %13, %nullish.default ]
  ret double %14
}

define internal noundef double @cellCount(%struct.Row* noundef readonly align 8 nocapture %r) #2 {
entry:
  %0 = icmp eq %struct.Row* %r, null
  br i1 %0, label %nullish.default, label %chain.next

chain.next:
  %1 = getelementptr inbounds %struct.Row, %struct.Row* %r, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  br label %nullish.end

nullish.default:
  %6 = fneg double 0x3FF0000000000000
  br label %nullish.end

nullish.end:
  %7 = phi double [ %5, %chain.next ], [ %6, %nullish.default ]
  ret double %7
}

define void @nish_main() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8*], align 8
  %Row.obj = alloca %struct.Row, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %2 = bitcast [2 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %7 = call double @width(%struct.nish_array* %arr.hdr, double 0x3FF0000000000000)
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %10 = call double @width(%struct.nish_array* null, double 0x3FF0000000000000)
  %11 = call i8* @nish_str_from_f64(double %10)
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %16 = bitcast [1 x i8*]* %arr.data.1 to i8*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %18 = bitcast i8* %16 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %19, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %20 = call double @width(%struct.nish_array* %arr.hdr.1, double 0x0000000000000000)
  %21 = call i8* @nish_str_from_f64(double %20)
  %22 = call i8* @nish_str_concat(i8* %13, i8* %21)
  call void @nish_print(i8* %22)
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 2, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 2, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %27 = call i8* @nish_alloc_struct(i64 16)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %29 = bitcast i8* %27 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8** %30, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %31 = getelementptr inbounds i8*, i8** %29, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %31, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  call void @Row.constructor(%struct.Row* %Row.obj, %struct.nish_array* %24)
  %32 = call double @cellCount(%struct.Row* %Row.obj)
  %33 = call i8* @nish_str_from_f64(double %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %35 = call double @cellCount(%struct.Row* null)
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %34, i8* %36)
  call void @nish_print(i8* %37)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!nish.compat = !{!23}
!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Row", !2, i64 0}
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
!17 = !{!12, !10, i64 8}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
!23 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
