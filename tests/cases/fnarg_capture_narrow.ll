%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"hey\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bye\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"Ada\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"skipped\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"?\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c" (\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c")\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @greet(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8* noundef noalias readonly align 8 %name, i8* noundef nonnull noalias readonly align 8 nocapture %bang) #0 {
entry:
  %tag.addr = alloca i8*, align 8
  %0 = icmp ne i8* %name, null
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @each$fn.12.greet$arrow0(%struct.nish_array* %xs, i8* %name)
  br label %if.end

if.end:
  %1 = call i8* @nish_str_concat(i8* %bang, i8* %bang)
  store i8* %1, i8** %tag.addr, align 8
  %2 = load i8*, i8** %tag.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @twice$str$fn.12.greet$arrow1(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %tag.addr, align 8
  %7 = call i32 @twice$i32$fn.12.greet$arrow2(i32 2, i8* %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8*], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @greet(%struct.nish_array* %arr.hdr, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast [1 x i8*]* %arr.data.1 to i8*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %9 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @greet(%struct.nish_array* %arr.hdr.1, i8* null, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @greet$arrow0(i8* noundef nonnull noalias readonly align 8 nocapture %x, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %x, i8* bitcast ({ i64, [3 x i8] }* @.str.7 to i8*))
  %1 = call i8* @nish_str_concat(i8* %0, i8* %name)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*))
  %3 = bitcast i8* %name to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %2, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 i8* @greet$arrow1(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %tag) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* %s, i8* %tag)
  ret i8* %0
}

define internal noundef i32 @greet$arrow2(i32 noundef %n, i8* noundef nonnull noalias readonly align 8 nocapture %tag) #0 {
entry:
  %0 = bitcast i8* %tag to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %7

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @each$fn.12.greet$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8* noundef %cap.0) #0 {
entry:
  %x.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
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
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %8, i8** %x.addr, align 8
  %9 = load i8*, i8** %x.addr, align 8
  call void @greet$arrow0(i8* %9, i8* %cap.0)
  br label %forof.inc

forof.inc:
  %10 = load i64, i64* %forof.idx, align 8
  %11 = add i64 %10, 1
  store i64 %11, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void
}

define internal noundef nonnull align 8 i8* @twice$str$fn.12.greet$arrow1(i8* noundef nonnull noalias readonly align 8 %x, i8* noundef %cap.0) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @greet$arrow1(i8* %x, i8* %cap.0)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @greet$arrow1(i8* %2, i8* %cap.0)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5
}

define internal noundef i32 @twice$i32$fn.12.greet$arrow2(i32 noundef %x, i8* noundef %cap.0) #0 {
entry:
  %0 = call i32 @greet$arrow2(i32 %x, i8* %cap.0)
  %1 = call i32 @greet$arrow2(i32 %0, i8* %cap.0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
