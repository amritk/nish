%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"tpl\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"par\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"into\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"after\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"group\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"template\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"paren\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"into \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"default\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" after\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"grouped \00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"loop\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"other\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"calls \00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"q\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"no\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"skip\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"stop\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

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

define internal noundef nonnull align 8 i8* @subject(i8* noundef nonnull noalias readonly align 8 %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %calls) #0 {
entry:
  %0 = fptosi double 0x0000000000000000 to i64
  %1 = fptosi double 0x0000000000000000 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %3 to double*
  %5 = getelementptr inbounds double, double* %4, i64 %1
  %6 = load double, double* %5, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %7 = fadd double %6, 0x3FF0000000000000
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to double*
  %11 = getelementptr inbounds double, double* %10, i64 %0
  store double %7, double* %11, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @label(i8* noundef nonnull noalias readonly align 8 %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %calls) #1 {
entry:
  %out.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  %0 = call i8* @subject(i8* %s, %struct.nish_array* %calls)
  %1 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  br i1 %1, label %sw.case, label %sw.next

sw.next:
  %2 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  br i1 %2, label %sw.case.1, label %sw.next.1

sw.next.1:
  %3 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  br i1 %3, label %sw.case.2, label %sw.next.2

sw.next.2:
  %4 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  br i1 %4, label %sw.case.3, label %sw.next.3

sw.next.3:
  %5 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  br i1 %5, label %sw.end, label %sw.next.4

sw.next.4:
  %6 = call zeroext i1 @nish_str_eq(i8* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*))
  br i1 %6, label %sw.end, label %sw.next.5

sw.next.5:
  br label %sw.default

sw.case:
  store i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.case.1:
  store i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.case.2:
  store i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*), i8** %out.addr, align 8
  br label %sw.default

sw.default:
  %7 = load i8*, i8** %out.addr, align 8
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*))
  store i8* %8, i8** %out.addr, align 8
  br label %sw.case.3

sw.case.3:
  %9 = load i8*, i8** %out.addr, align 8
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*))
  store i8* %10, i8** %out.addr, align 8
  br label %sw.end

sw.end:
  %11 = load i8*, i8** %out.addr, align 8
  ret i8* %11
}

define internal noundef nonnull align 8 i8* @grouped(i8* noundef nonnull noalias readonly align 8 %s) #1 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  br i1 %0, label %sw.default, label %sw.next

sw.next:
  %1 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*))
  br i1 %1, label %sw.default, label %sw.next.1

sw.next.1:
  %2 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  br i1 %2, label %sw.case, label %sw.next.2

sw.next.2:
  br label %sw.default

sw.default:
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.15 to i8*), i8* %s)
  ret i8* %3

sw.case:
  ret i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*)
}

define internal noundef double @loops(i8* noundef nonnull noalias readonly align 8 %s) #2 {
entry:
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  store double 0x0000000000000000, double* %n.addr, align 8
  %0 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [5 x i8] }* @.str.16 to i8*))
  br i1 %0, label %sw.case, label %sw.next

sw.next:
  br label %sw.default

sw.case:
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %1 = load double, double* %i.addr, align 8
  %2 = fcmp olt double %1, 0x4024000000000000
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load double, double* %i.addr, align 8
  %4 = fcmp oeq double %3, 0x4008000000000000
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %5 = load double, double* %n.addr, align 8
  %6 = fadd double %5, 0x3FF0000000000000
  store double %6, double* %n.addr, align 8
  br label %for.inc

for.inc:
  %7 = load double, double* %i.addr, align 8
  %8 = fadd double %7, 0x3FF0000000000000
  store double %8, double* %i.addr, align 8
  br label %for.cond

for.end:
  %9 = load double, double* %n.addr, align 8
  %10 = fadd double %9, 0x4059000000000000
  store double %10, double* %n.addr, align 8
  br label %sw.end

sw.default:
  %11 = fneg double 0x3FF0000000000000
  store double %11, double* %n.addr, align 8
  br label %sw.end

sw.end:
  %12 = load double, double* %n.addr, align 8
  ret double %12
}

define void @nish_main() #1 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i8*], align 8
  %calls.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x double], align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %seen.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %w.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [5 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [7 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i8*, i8** %4, i64 3
  store i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i8*, i8** %4, i64 4
  store i8* bitcast ({ i64, [6 x i8] }* @.str.17 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %10 = getelementptr inbounds i8*, i8** %4, i64 5
  store i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %11 = getelementptr inbounds i8*, i8** %4, i64 6
  store i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = bitcast [1 x double]* %arr.data.1 to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = bitcast i8* %14 to double*
  %17 = getelementptr inbounds double, double* %16, i64 0
  store double 0x0000000000000000, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %calls.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %19 = load i64, i64* %forof.idx, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %forof.body, label %forof.end

forof.body:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %27, i8** %w.addr, align 8
  %28 = load i8*, i8** %w.addr, align 8
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [3 x i8] }* @.str.18 to i8*))
  %30 = load i8*, i8** %w.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %calls.addr, align 8
  %32 = call i8* @label(i8* %30, %struct.nish_array* %31)
  %33 = call i8* @nish_str_concat(i8* %29, i8* %32)
  call void @nish_print(i8* %33)
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = add i64 %34, 1
  store i64 %35, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %36 = load %struct.nish_array*, %struct.nish_array** %calls.addr, align 8
  %37 = fptosi double 0x0000000000000000 to i64
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = bitcast i8* %39 to double*
  %41 = getelementptr inbounds double, double* %40, i64 %37
  %42 = load double, double* %41, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %43 = call i8* @nish_str_from_f64(double %42)
  %44 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.19 to i8*), i8* %43)
  call void @nish_print(i8* %44)
  %45 = call i64 @nish_arena_mark()
  %46 = call i8* @grouped(i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %47 = call i8* @nish_arena_keep(i64 %45, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [3 x i8] }* @.str.20 to i8*))
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @grouped(i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*))
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %48, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [3 x i8] }* @.str.20 to i8*))
  %54 = call i64 @nish_arena_mark()
  %55 = call i8* @grouped(i8* bitcast ({ i64, [2 x i8] }* @.str.21 to i8*))
  %56 = call i8* @nish_arena_keep(i64 %54, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %53, i8* %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [3 x i8] }* @.str.20 to i8*))
  %59 = call i64 @nish_arena_mark()
  %60 = call i8* @grouped(i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %61 = call i8* @nish_arena_keep(i64 %59, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %58, i8* %61)
  call void @nish_print(i8* %62)
  %63 = call double @loops(i8* bitcast ({ i64, [5 x i8] }* @.str.16 to i8*))
  %64 = call i8* @nish_str_from_f64(double %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %66 = call double @loops(i8* bitcast ({ i64, [3 x i8] }* @.str.23 to i8*))
  %67 = call i8* @nish_str_from_f64(double %66)
  %68 = call i8* @nish_str_concat(i8* %65, i8* %67)
  call void @nish_print(i8* %68)
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %seen.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 5, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 5, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %74 = bitcast [5 x i8*]* %arr.data.2 to i8*
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %74, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = bitcast i8* %74 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*), i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %78 = getelementptr inbounds i8*, i8** %76, i64 1
  store i8* bitcast ({ i64, [5 x i8] }* @.str.25 to i8*), i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %79 = getelementptr inbounds i8*, i8** %76, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*), i8** %79, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %80 = getelementptr inbounds i8*, i8** %76, i64 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.27 to i8*), i8** %80, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %81 = getelementptr inbounds i8*, i8** %76, i64 4
  store i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*), i8** %81, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %82 = load i64, i64* %forof.idx.1, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %85 = icmp ult i64 %82, %84
  br i1 %85, label %forof.body.1, label %forof.end.1

forof.body.1:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = bitcast i8* %87 to i8**
  %89 = getelementptr inbounds i8*, i8** %88, i64 %82
  %90 = load i8*, i8** %89, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %90, i8** %w.addr.1, align 8
  %91 = load i8*, i8** %w.addr.1, align 8
  %92 = call zeroext i1 @nish_str_eq(i8* %91, i8* bitcast ({ i64, [5 x i8] }* @.str.25 to i8*))
  br i1 %92, label %sw.case, label %sw.next

sw.next:
  %93 = call zeroext i1 @nish_str_eq(i8* %91, i8* bitcast ({ i64, [5 x i8] }* @.str.27 to i8*))
  br i1 %93, label %sw.case.1, label %sw.next.1

sw.next.1:
  br label %sw.default

sw.case:
  br label %forof.inc.1

sw.case.1:
  br label %sw.end

sw.default:
  %94 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %95 = load i8*, i8** %w.addr.1, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 1
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %100 = icmp eq i64 %97, %99
  br i1 %100, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %94, i64 8)
  br label %push.store

push.store:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* %102 to i8**
  %104 = getelementptr inbounds i8*, i8** %103, i64 %97
  store i8* %95, i8** %104, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %105 = add i64 %97, 1
  store i64 %105, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %106 = sitofp i64 %105 to double
  br label %forof.inc.1

sw.end:
  %107 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 1
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %112 = icmp eq i64 %109, %111
  br i1 %112, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %107, i64 8)
  br label %push.store.1

push.store.1:
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = bitcast i8* %114 to i8**
  %116 = getelementptr inbounds i8*, i8** %115, i64 %109
  store i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*), i8** %116, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = add i64 %109, 1
  store i64 %117, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %118 = sitofp i64 %117 to double
  br label %forof.inc.1

forof.inc.1:
  %119 = load i64, i64* %forof.idx.1, align 8
  %120 = add i64 %119, 1
  store i64 %120, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %121 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %124 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %125 = load i64, i64* %124, align 8
  %126 = sub i64 %123, 1
  %127 = mul i64 %125, %126
  %128 = icmp eq i64 %123, 0
  %129 = select i1 %128, i64 0, i64 %127
  store i64 %129, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %130 = load i64, i64* %join.at, align 8
  %131 = icmp ult i64 %130, %123
  br i1 %131, label %join.sum.body, label %join.copy

join.sum.body:
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = bitcast i8* %133 to i8**
  %135 = getelementptr inbounds i8*, i8** %134, i64 %130
  %136 = load i8*, i8** %135, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %137 = load i64, i64* %join.total, align 8
  %138 = bitcast i8* %136 to i64*
  %139 = load i64, i64* %138, align 8
  %140 = add i64 %137, %139
  store i64 %140, i64* %join.total, align 8
  %141 = add i64 %130, 1
  store i64 %141, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %142 = load i64, i64* %join.total, align 8
  %143 = icmp ugt i64 %142, 2147483647
  %144 = add i64 %142, 9
  %145 = select i1 %143, i64 4611686018427387904, i64 %144
  %146 = call i8* @nish_alloc_struct(i64 %145)
  %147 = bitcast i8* %146 to i64*
  store i64 %142, i64* %147, align 8
  %148 = getelementptr inbounds i8, i8* %146, i64 8
  store i8* %148, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %149 = load i64, i64* %join.at, align 8
  %150 = icmp ult i64 %149, %123
  br i1 %150, label %join.part, label %join.end

join.part:
  %151 = load i8*, i8** %join.p, align 8
  %152 = icmp eq i64 %149, 0
  %153 = select i1 %152, i64 0, i64 %125
  %154 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %151, i8* %154, i64 %153, i1 false)
  %155 = getelementptr inbounds i8, i8* %151, i64 %153
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %158 = bitcast i8* %157 to i8**
  %159 = getelementptr inbounds i8*, i8** %158, i64 %149
  %160 = load i8*, i8** %159, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %161 = bitcast i8* %160 to i64*
  %162 = load i64, i64* %161, align 8
  %163 = getelementptr inbounds i8, i8* %160, i64 8
  %164 = icmp eq i64 %162, 1
  br i1 %164, label %join.byte, label %join.bulk

join.byte:
  %165 = load i8, i8* %163, align 1
  store i8 %165, i8* %155, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %155, i8* %163, i64 %162, i1 false)
  br label %join.next

join.next:
  %166 = getelementptr inbounds i8, i8* %155, i64 %162
  store i8* %166, i8** %join.p, align 8
  %167 = add i64 %149, 1
  store i64 %167, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %168 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %168, align 1
  call void @nish_print(i8* %146)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #2 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!nish.compat = !{!22}
!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element double", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
!22 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
