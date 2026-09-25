%struct.Stack = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @Stack.constructor(%struct.Stack* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %items) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stack, %struct.Stack* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Stack, %struct.Stack* %this, i32 0, i32 0
  store %struct.nish_array* %items, %struct.nish_array** %1, align 8, !tbaa !6
  ret void
}

define internal noundef i32 @drop(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, %struct.Stack* noundef nonnull align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %3
  %8 = load i32, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = trunc i64 %10 to i32
  %12 = getelementptr inbounds %struct.Stack, %struct.Stack* %s, i32 0, i32 1
  store i32 %11, i32* %12, align 4, !tbaa !5
  %13 = getelementptr inbounds %struct.Stack, %struct.Stack* %s, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !5
  ret i32 %14
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca %struct.Stack*, align 8
  %Stack.obj = alloca %struct.Stack, align 8
  %alias.addr = alloca %struct.nish_array*, align 8
  %n0.addr = alloca i32, align 4
  %n1.addr = alloca i32, align 4
  %popped.addr = alloca i32, align 4
  %n2.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 4, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 5, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 6, i32* %9, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  call void @Stack.constructor(%struct.Stack* %Stack.obj, %struct.nish_array* %1)
  store %struct.Stack* %Stack.obj, %struct.Stack** %s.addr, align 8
  %10 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %11 = getelementptr inbounds %struct.Stack, %struct.Stack* %10, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !6
  store %struct.nish_array* %12, %struct.nish_array** %alias.addr, align 8
  %13 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %14 = getelementptr inbounds %struct.Stack, %struct.Stack* %13, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !6
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %18 = trunc i64 %17 to i32
  store i32 %18, i32* %n0.addr, align 4
  %19 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %20 = getelementptr inbounds %struct.Stack, %struct.Stack* %19, i32 0, i32 1
  store i32 9, i32* %20, align 4, !tbaa !5
  %21 = load %struct.nish_array*, %struct.nish_array** %alias.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %24 = icmp eq i64 %23, 0
  br i1 %24, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %25 = sub i64 %23, 1
  store i64 %25, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %25
  %30 = load i32, i32* %29, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %31 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %32 = getelementptr inbounds %struct.Stack, %struct.Stack* %31, i32 0, i32 1
  store i32 8, i32* %32, align 4, !tbaa !5
  %33 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %34 = getelementptr inbounds %struct.Stack, %struct.Stack* %33, i32 0, i32 0
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !6
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %38 = trunc i64 %37 to i32
  store i32 %38, i32* %n1.addr, align 4
  %39 = load %struct.nish_array*, %struct.nish_array** %alias.addr, align 8
  %40 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %41 = call i32 @drop(%struct.nish_array* %39, %struct.Stack* %40)
  store i32 %41, i32* %popped.addr, align 4
  %42 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %43 = getelementptr inbounds %struct.Stack, %struct.Stack* %42, i32 0, i32 0
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !6
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %47 = trunc i64 %46 to i32
  store i32 %47, i32* %n2.addr, align 4
  %48 = load i32, i32* %n0.addr, align 4
  %49 = mul nsw i32 %48, 1000
  %50 = load i32, i32* %n1.addr, align 4
  %51 = mul nsw i32 %50, 100
  %52 = add nsw i32 %49, %51
  %53 = load i32, i32* %n2.addr, align 4
  %54 = mul nsw i32 %53, 10
  %55 = add nsw i32 %52, %54
  %56 = load i32, i32* %popped.addr, align 4
  %57 = add nsw i32 %55, %56
  %58 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %59 = getelementptr inbounds %struct.Stack, %struct.Stack* %58, i32 0, i32 1
  %60 = load i32, i32* %59, align 4, !tbaa !5
  %61 = sub nsw i32 %57, %60
  %62 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %63 = getelementptr inbounds %struct.Stack, %struct.Stack* %62, i32 0, i32 0
  %64 = load %struct.nish_array*, %struct.nish_array** %63, align 8, !tbaa !6
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %67 = icmp ult i64 0, %66
  br i1 %67, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %66)
  unreachable

bounds.ok:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 0
  %72 = load i32, i32* %71, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %73 = add nsw i32 %61, %72
  ret i32 %73
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Stack", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!14, !12, i64 8}
