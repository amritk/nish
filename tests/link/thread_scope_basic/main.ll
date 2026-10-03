%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare void @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4
declare void @nish_scope_join(i8* noundef nonnull) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define hidden noundef double @sumOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %t.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %t.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %0
  %8 = load double, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store double %8, double* %x.addr, align 8
  %9 = load double, double* %t.addr, align 8
  %10 = load double, double* %x.addr, align 8
  %11 = fadd double %9, %10
  store double %11, double* %t.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load double, double* %t.addr, align 8
  ret double %14
}

define hidden noundef i32 @primesBelow(i32 noundef %n) #1 {
entry:
  %count.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %prime.addr = alloca i1, align 1
  %d.addr = alloca i32, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 2, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  store i1 true, i1* %prime.addr, align 1
  store i32 2, i32* %d.addr, align 4
  br label %for.cond.1

for.cond.1:
  %2 = load i32, i32* %d.addr, align 4
  %3 = load i32, i32* %d.addr, align 4
  %4 = mul nsw i32 %2, %3
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp sle i32 %4, %5
  br i1 %6, label %for.body.1, label %for.end.1

for.body.1:
  %7 = load i32, i32* %k.addr, align 4
  %8 = load i32, i32* %d.addr, align 4
  %9 = icmp eq i32 %8, 0
  %10 = icmp eq i32 %7, -2147483648
  %11 = icmp eq i32 %8, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %9)
  unreachable

div.ok:
  %14 = srem i32 %7, %8
  %15 = icmp eq i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  store i1 false, i1* %prime.addr, align 1
  br label %for.end.1

if.end:
  br label %for.inc.1

for.inc.1:
  %16 = load i32, i32* %d.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %d.addr, align 4
  br label %for.cond.1

for.end.1:
  %18 = load i1, i1* %prime.addr, align 1
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  %19 = load i32, i32* %count.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %count.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %23 = load i32, i32* %count.addr, align 4
  ret i32 %23
}

define noundef i32 @nish_main() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %sums.addr = alloca %struct.nish_array*, align 8
  %counts.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to double*
  %7 = getelementptr inbounds double, double* %6, i64 0
  store double 0x3FF8000000000000, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds double, double* %6, i64 1
  store double 0x4004000000000000, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds double, double* %6, i64 2
  store double 0x4008000000000000, double* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = call i8* @nish_alloc_struct(i64 8)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %14 to double*
  %17 = getelementptr inbounds double, double* %16, i64 0
  store double 0x0000000000000000, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %11, %struct.nish_array** %sums.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 1, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 1, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = call i8* @nish_alloc_struct(i64 4)
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %22 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  store i32 0, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %19, %struct.nish_array** %counts.addr, align 8
  %26 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %26, %struct.ThreadScope** %s.addr, align 8
  %27 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %28 = bitcast %struct.ThreadScope* %27 to i8*
  %29 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf(%struct.ThreadScope* %29, %struct.nish_array* %30, %struct.nish_array* %31, i32 0)
  %32 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow(%struct.ThreadScope* %32, i32 1000, %struct.nish_array* %33, i32 0)
  call void @nish_scope_join(i8* %28)
  %34 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp ult i64 0, %36
  br i1 %37, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %36)
  unreachable

bounds.ok:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = bitcast i8* %39 to double*
  %41 = getelementptr inbounds double, double* %40, i64 0
  %42 = load double, double* %41, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %43 = call i8* @nish_str_from_f64(double %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp ult i64 0, %47
  br i1 %48, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %47)
  unreachable

bounds.ok.1:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = bitcast i8* %50 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 0
  %53 = load i32, i32* %52, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %44, i8* %54)
  call void @nish_print(i8* %55)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"element double", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
