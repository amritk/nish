%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\F0\9F\98\80\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"letter\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"greeting\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"other\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"accented \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"wide\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"zz\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"before the empty word: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1

define internal noundef nonnull align 8 i8* @classify(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %out.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  %0 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br i1 %0, label %sw.case, label %sw.next

sw.next:
  %1 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %1, label %sw.case, label %sw.next.1

sw.next.1:
  %2 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*))
  br i1 %2, label %sw.case.1, label %sw.next.2

sw.next.2:
  %3 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*))
  br i1 %3, label %sw.case.2, label %sw.next.3

sw.next.3:
  %4 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*))
  br i1 %4, label %sw.case.3, label %sw.next.4

sw.next.4:
  %5 = call zeroext i1 @nish_str_eq(i8* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br i1 %5, label %sw.case.4, label %sw.next.5

sw.next.5:
  br label %sw.default

sw.case:
  store i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.case.1:
  store i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.default:
  store i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.case.2:
  store i8* bitcast ({ i64, [10 x i8] }* @.str.9 to i8*), i8** %out.addr, align 8
  br label %sw.case.3

sw.case.3:
  %6 = load i8*, i8** %out.addr, align 8
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*))
  store i8* %7, i8** %out.addr, align 8
  br label %sw.end

sw.case.4:
  store i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*), i8** %out.addr, align 8
  br label %sw.end

sw.end:
  %8 = load i8*, i8** %out.addr, align 8
  ret i8* %8
}

define void @nish_main() #0 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8*], align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %seen.addr = alloca double, align 8
  %w.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %4, i64 3
  store i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %4, i64 4
  store i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %4, i64 5
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8*, i8** %4, i64 6
  store i8* bitcast ({ i64, [6 x i8] }* @.str.12 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8*, i8** %4, i64 7
  store i8* bitcast ({ i64, [3 x i8] }* @.str.13 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %forof.body, label %forof.end

forof.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  %22 = load i8*, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %22, i8** %w.addr, align 8
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %26 = load i64, i64* %25, align 8
  %27 = load i8*, i8** %w.addr, align 8
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [3 x i8] }* @.str.14 to i8*))
  %29 = load i8*, i8** %w.addr, align 8
  %30 = call i64 @nish_arena_mark()
  %31 = call i8* @classify(i8* %29)
  %32 = call i8* @nish_arena_keep(i64 %30, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %28, i8* %32)
  call void @nish_print(i8* %33)
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %35 = load i8*, i8** %34, align 8
  %36 = icmp eq i8* %35, %24
  br i1 %36, label %pass.rewind, label %pass.free

pass.rewind:
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %26, i64* %37, align 8
  br label %pass.done

pass.free:
  %38 = ptrtoint i8* %24 to i64
  %39 = add i64 %38, %26
  call void @nish_arena_release(i64 %39)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %40 = load i64, i64* %forof.idx, align 8
  %41 = add i64 %40, 1
  store i64 %41, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store double 0x0000000000000000, double* %seen.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %43 = load i64, i64* %forof.idx.1, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 %43, %45
  br i1 %46, label %forof.body.1, label %forof.end.1

forof.body.1:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i8**
  %50 = getelementptr inbounds i8*, i8** %49, i64 %43
  %51 = load i8*, i8** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %51, i8** %w.addr.1, align 8
  %52 = load i8*, i8** %w.addr.1, align 8
  %53 = call zeroext i1 @nish_str_eq(i8* %52, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br i1 %53, label %sw.case, label %sw.next

sw.next:
  br label %sw.default

sw.case:
  br label %forof.end.1

sw.default:
  %54 = load double, double* %seen.addr, align 8
  %55 = fadd double %54, 0x3FF0000000000000
  store double %55, double* %seen.addr, align 8
  br label %sw.end

sw.end:
  br label %forof.inc.1

forof.inc.1:
  %56 = load i64, i64* %forof.idx.1, align 8
  %57 = add i64 %56, 1
  store i64 %57, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %58 = load double, double* %seen.addr, align 8
  %59 = call i8* @nish_str_from_f64(double %58)
  %60 = call i8* @nish_str_concat(i8* bitcast ({ i64, [24 x i8] }* @.str.15 to i8*), i8* %59)
  call void @nish_print(i8* %60)
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
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }

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
