%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pass \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" of \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"a\C3\A9\F0\9F\98\80\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"pp\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"dd\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\E2\82\ACx\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"round \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare i64 @llvm.smin.i64(i64, i64) #3

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

define internal noundef nonnull align 8 i8* @lastOf(i8* noundef nonnull noalias readonly align 8 nocapture %s, double noundef %n) #0 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca double, align 8
  %_t.addr = alloca i8*, align 8
  %c.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %forof.next = alloca i64, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %last.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %0 = load double, double* %i.addr, align 8
  %1 = fcmp olt double %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load double, double* %i.addr, align 8
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %6 = call i8* @nish_str_from_f64(double %n)
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  store i8* %7, i8** %_t.addr, align 8
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %11 = load i64, i64* %forof.idx, align 8
  %12 = icmp ult i64 %11, %9
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds i8, i8* %10, i64 %11
  %14 = load i8, i8* %13
  %15 = icmp uge i8 %14, -64
  %16 = zext i1 %15 to i64
  %17 = add i64 1, %16
  %18 = icmp uge i8 %14, -32
  %19 = zext i1 %18 to i64
  %20 = add i64 %17, %19
  %21 = icmp uge i8 %14, -16
  %22 = zext i1 %21 to i64
  %23 = add i64 %20, %22
  %24 = sub i64 %9, %11
  %25 = call i64 @llvm.smin.i64(i64 %23, i64 %24)
  br label %forof.run

forof.run:
  %forof.run.n = phi i64 [ 1, %forof.body ], [ %forof.run.grown, %forof.run.test ]
  %26 = icmp ult i64 %forof.run.n, %25
  br i1 %26, label %forof.run.test, label %forof.take

forof.run.test:
  %27 = getelementptr inbounds i8, i8* %13, i64 %forof.run.n
  %28 = load i8, i8* %27
  %29 = and i8 %28, -64
  %30 = icmp eq i8 %29, -128
  %forof.run.grown = add i64 %forof.run.n, 1
  br i1 %30, label %forof.run, label %forof.take

forof.take:
  %31 = add i64 %11, %forof.run.n
  store i64 %31, i64* %forof.next, align 8
  %32 = call i8* @nish_str_new(i8* %13, i64 %forof.run.n)
  store i8* %32, i8** %c.addr, align 8
  %33 = load i8*, i8** %c.addr, align 8
  store i8* %33, i8** %last.addr, align 8
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.next, align 8
  store i64 %34, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %for.inc

for.inc:
  %35 = load double, double* %i.addr, align 8
  %36 = fadd double %35, 0x3FF0000000000000
  store double %36, double* %i.addr, align 8
  br label %for.cond

for.end:
  %37 = load i8*, i8** %last.addr, align 8
  ret i8* %37
}

define internal noundef nonnull align 8 i8* @first(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %c.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %forof.next = alloca i64, align 8
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %s, i64 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %forof.body, label %forof.end

forof.body:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = icmp uge i8 %6, -64
  %8 = zext i1 %7 to i64
  %9 = add i64 1, %8
  %10 = icmp uge i8 %6, -32
  %11 = zext i1 %10 to i64
  %12 = add i64 %9, %11
  %13 = icmp uge i8 %6, -16
  %14 = zext i1 %13 to i64
  %15 = add i64 %12, %14
  %16 = sub i64 %1, %3
  %17 = call i64 @llvm.smin.i64(i64 %15, i64 %16)
  br label %forof.run

forof.run:
  %forof.run.n = phi i64 [ 1, %forof.body ], [ %forof.run.grown, %forof.run.test ]
  %18 = icmp ult i64 %forof.run.n, %17
  br i1 %18, label %forof.run.test, label %forof.take

forof.run.test:
  %19 = getelementptr inbounds i8, i8* %5, i64 %forof.run.n
  %20 = load i8, i8* %19
  %21 = and i8 %20, -64
  %22 = icmp eq i8 %21, -128
  %forof.run.grown = add i64 %forof.run.n, 1
  br i1 %22, label %forof.run, label %forof.take

forof.take:
  %23 = add i64 %3, %forof.run.n
  store i64 %23, i64* %forof.next, align 8
  %24 = call i8* @nish_str_new(i8* %5, i64 %forof.run.n)
  store i8* %24, i8** %c.addr, align 8
  %25 = load i8*, i8** %c.addr, align 8
  ret i8* %25

forof.inc:
  %26 = load i64, i64* %forof.next, align 8
  store i64 %26, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define void @nish_main() #0 {
entry:
  %kept.addr = alloca i8*, align 8
  %pad.addr = alloca i8*, align 8
  %heads.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca double, align 8
  %head.addr = alloca i8*, align 8
  %_u.addr = alloca i8*, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @lastOf(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), double 0x4008000000000000)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %kept.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @first(i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @first(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*))
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %5, i8* %8)
  store i8* %9, i8** %pad.addr, align 8
  %10 = load i8*, i8** %kept.addr, align 8
  call void @nish_print(i8* %10)
  %11 = load i8*, i8** %pad.addr, align 8
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %heads.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %15 = load double, double* %i.addr, align 8
  %16 = fcmp olt double %15, 0x4008000000000000
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @first(i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*))
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  store i8* %19, i8** %head.addr, align 8
  %20 = load double, double* %i.addr, align 8
  %21 = call i8* @nish_str_from_f64(double %20)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*), i8* %21)
  store i8* %22, i8** %_u.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %heads.addr, align 8
  %24 = load i8*, i8** %head.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8**
  %33 = getelementptr inbounds i8*, i8** %32, i64 %26
  store i8* %24, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = sitofp i64 %34 to double
  br label %for.inc

for.inc:
  %36 = load double, double* %i.addr, align 8
  %37 = fadd double %36, 0x3FF0000000000000
  store double %37, double* %i.addr, align 8
  br label %for.cond

for.end:
  %38 = load %struct.nish_array*, %struct.nish_array** %heads.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %42 = load i64, i64* %41, align 8
  %43 = sub i64 %40, 1
  %44 = mul i64 %42, %43
  %45 = icmp eq i64 %40, 0
  %46 = select i1 %45, i64 0, i64 %44
  store i64 %46, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %47 = load i64, i64* %join.at, align 8
  %48 = icmp ult i64 %47, %40
  br i1 %48, label %join.sum.body, label %join.copy

join.sum.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 %47
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = load i64, i64* %join.total, align 8
  %55 = bitcast i8* %53 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = add i64 %54, %56
  store i64 %57, i64* %join.total, align 8
  %58 = add i64 %47, 1
  store i64 %58, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %59 = load i64, i64* %join.total, align 8
  %60 = icmp ugt i64 %59, 2147483647
  %61 = add i64 %59, 9
  %62 = select i1 %60, i64 4611686018427387904, i64 %61
  %63 = call i8* @nish_alloc_struct(i64 %62)
  %64 = bitcast i8* %63 to i64*
  store i64 %59, i64* %64, align 8
  %65 = getelementptr inbounds i8, i8* %63, i64 8
  store i8* %65, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %66 = load i64, i64* %join.at, align 8
  %67 = icmp ult i64 %66, %40
  br i1 %67, label %join.part, label %join.end

join.part:
  %68 = load i8*, i8** %join.p, align 8
  %69 = icmp eq i64 %66, 0
  %70 = select i1 %69, i64 0, i64 %42
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = bitcast i8* %77 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = getelementptr inbounds i8, i8* %77, i64 8
  %81 = icmp eq i64 %79, 1
  br i1 %81, label %join.byte, label %join.bulk

join.byte:
  %82 = load i8, i8* %80, align 1
  store i8 %82, i8* %72, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %80, i64 %79, i1 false)
  br label %join.next

join.next:
  %83 = getelementptr inbounds i8, i8* %72, i64 %79
  store i8* %83, i8** %join.p, align 8
  %84 = add i64 %66, 1
  store i64 %84, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %85 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %85, align 1
  call void @nish_print(i8* %63)
  %86 = call i64 @nish_arena_mark()
  %87 = call i8* @first(i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  %88 = call i8* @nish_arena_keep(i64 %86, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @first(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call i8* @nish_str_concat(i8* %89, i8* %92)
  call void @nish_print(i8* %93)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!nish.compat = !{!20}
!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
!20 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
