%struct.Options = type { i1 }
%struct.Box = type { i8* }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"lid\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"top\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef nonnull align 8 i8* @greet(i8* noundef nonnull noalias readonly align 8 %name, %struct.Options* noundef readonly align 8 nocapture %opts) #0 {
entry:
  %0 = icmp ne %struct.Options* %opts, null
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Options, %struct.Options* %opts, i32 0, i32 0
  %2 = load i1, i1* %1, align 1, !tbaa !4
  br label %land.end

land.end:
  %3 = phi i1 [ false, %entry ], [ %2, %land.rhs ]
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i8* [ %4, %cond.true ], [ %name, %cond.false ]
  ret i8* %5
}

define internal noundef i32 @total(%struct.nish_array* noundef readonly align 8 nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  %0 = icmp ne %struct.nish_array* %xs, null
  br i1 %0, label %if.then, label %if.end

if.then:
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %1 = load i64, i64* %forof.idx, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %forof.body, label %forof.end

forof.body:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store i32 %9, i32* %x.addr, align 4
  %10 = load i32, i32* %sum.addr, align 4
  %11 = load i32, i32* %x.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %if.end

if.end:
  %17 = load i32, i32* %sum.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @suffix(i8* noundef nonnull noalias readonly align 8 %base, i8* noundef noalias readonly align 8 nocapture %end) #0 {
entry:
  %0 = icmp ne i8* %end, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_concat(i8* %base, i8* %end)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %1, %cond.true ], [ %base, %cond.false ]
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @repeat(i8* noundef nonnull noalias readonly align 8 nocapture %word, i32 noundef %n, %struct.Options* noundef readonly align 8 nocapture %opts) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i8*, i8** %out.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* %word)
  store i8* %3, i8** %out.addr, align 8
  br label %for.inc

for.inc:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %6 = icmp ne %struct.Options* %opts, null
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = getelementptr inbounds %struct.Options, %struct.Options* %opts, i32 0, i32 0
  %8 = load i1, i1* %7, align 1, !tbaa !4
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.end ], [ %8, %land.rhs ]
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = load i8*, i8** %out.addr, align 8
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  br label %cond.end

cond.false:
  %12 = load i8*, i8** %out.addr, align 8
  br label %cond.end

cond.end:
  %13 = phi i8* [ %11, %cond.true ], [ %12, %cond.false ]
  ret i8* %13
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef noalias readonly align 8 %label) #1 {
entry:
  %0 = icmp ne i8* %label, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i8* [ %label, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %cond.false ]
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %1, i8** %2, align 8, !tbaa !19
  ret void
}

define internal noundef nonnull align 8 i8* @Box.tag(%struct.Box* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Options* noundef readonly align 8 nocapture %opts) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !19
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @greet(i8* %1, %struct.Options* %opts)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret i8* %4
}

define void @nish_main() #0 {
entry:
  %Options.obj = alloca %struct.Options, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %Box.obj = alloca %struct.Box, align 8
  %Box.obj.1 = alloca %struct.Box, align 8
  %Options.obj.1 = alloca %struct.Options, align 8
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj.2 = alloca %struct.Box, align 8
  %Options.obj.2 = alloca %struct.Options, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @greet(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), %struct.Options* null)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish_print(i8* %2)
  %3 = getelementptr inbounds %struct.Options, %struct.Options* %Options.obj, i32 0, i32 0
  store i1 true, i1* %3, align 1, !tbaa !4
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @greet(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), %struct.Options* %Options.obj)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  call void @nish_print(i8* %6)
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @greet(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), %struct.Options* null)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  call void @nish_print(i8* %9)
  %10 = call i32 @total(%struct.nish_array* null)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !20
  %14 = bitcast [3 x i32]* %arr.data to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 1, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 2, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 3, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %20 = call i32 @total(%struct.nish_array* %arr.hdr)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @suffix(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* null)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  call void @nish_print(i8* %24)
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @suffix(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  call void @nish_print(i8* %27)
  call void @Box.constructor(%struct.Box* %Box.obj, i8* null)
  %28 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0
  %29 = load i8*, i8** %28, align 8, !tbaa !19
  call void @nish_print(i8* %29)
  call void @Box.constructor(%struct.Box* %Box.obj.1, i8* bitcast ({ i64, [4 x i8] }* @.str.8 to i8*))
  %30 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj.1, i32 0, i32 0
  %31 = load i8*, i8** %30, align 8, !tbaa !19
  call void @nish_print(i8* %31)
  %32 = call i64 @nish_arena_mark()
  %33 = call i8* @repeat(i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i32 2, %struct.Options* null)
  %34 = call i8* @nish_arena_keep(i64 %32, i8* %33)
  call void @nish_print(i8* %34)
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @repeat(i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i32 3, %struct.Options* null)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  call void @nish_print(i8* %37)
  %38 = getelementptr inbounds %struct.Options, %struct.Options* %Options.obj.1, i32 0, i32 0
  store i1 true, i1* %38, align 1, !tbaa !4
  %39 = call i64 @nish_arena_mark()
  %40 = call i8* @repeat(i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i32 1, %struct.Options* %Options.obj.1)
  %41 = call i8* @nish_arena_keep(i64 %39, i8* %40)
  call void @nish_print(i8* %41)
  call void @Box.constructor(%struct.Box* %Box.obj.2, i8* bitcast ({ i64, [4 x i8] }* @.str.10 to i8*))
  store %struct.Box* %Box.obj.2, %struct.Box** %b.addr, align 8
  %42 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %43 = call i64 @nish_arena_mark()
  %44 = call i8* @Box.tag(%struct.Box* %42, %struct.Options* null)
  %45 = call i8* @nish_arena_keep(i64 %43, i8* %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %47 = getelementptr inbounds %struct.Options, %struct.Options* %Options.obj.2, i32 0, i32 0
  store i1 true, i1* %47, align 1, !tbaa !4
  %48 = call i64 @nish_arena_mark()
  %49 = call i8* @Box.tag(%struct.Box* %46, %struct.Options* %Options.obj.2)
  %50 = call i8* @nish_arena_keep(i64 %48, i8* %49)
  call void @nish_print(i8* %50)
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"Options", !2, i64 0}
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
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"ptr", !1, i64 0}
!18 = !{!"Box", !17, i64 0}
!19 = !{!18, !17, i64 0}
!20 = !{!12, !10, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
