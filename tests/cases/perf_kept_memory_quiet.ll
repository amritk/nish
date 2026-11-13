%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"three\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @relabel(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  store i8* %2, i8** %s.addr, align 8
  br label %if.end

if.end:
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @fixed(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ %2, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.false ]
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef i32 @scoped(i32 noundef %n) #0 {
entry:
  %a.addr = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %2 = icmp sgt i32 %n, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = call i8* @nish_str_from_i32(i32 %n)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %s.addr, align 8
  br label %if.end

if.end:
  %5 = load i8*, i8** %s.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  call void @nish_arena_release(i64 %1)
  ret i32 %8
}

define internal noundef i32 @pick(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = srem i32 %n, 3
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  %6 = load i1, i1* %5, align 1
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8** %9, align 8
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ -1, %res.alt ]
  ret i32 %15
}

define void @nish_main() #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 1000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i32 @fixed(i32 %6)
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i32 @scoped(i32 %8)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @pick(i32 %13)
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %18 = call i8* @nish_str_from_i32(i32 %16)
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  store i8* %18, i8** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = icmp slt i32 %32, 1000
  br i1 %33, label %for.body.1, label %for.end.1

for.body.1:
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %35 = load i8*, i8** %34, align 8
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %37 = load i64, i64* %36, align 8
  %38 = load i32, i32* %total.addr, align 4
  %39 = load i32, i32* %i.addr.1, align 4
  %40 = call i32 @relabel(i32 %39)
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %42, i32* %total.addr, align 4
  %44 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %45 = load i8*, i8** %44, align 8
  %46 = icmp eq i8* %45, %35
  br i1 %46, label %pass.rewind, label %pass.free

pass.rewind:
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %37, i64* %47, align 8
  br label %pass.done

pass.free:
  %48 = ptrtoint i8* %35 to i64
  %49 = add i64 %48, %37
  call void @nish_arena_release(i64 %49)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %50 = load i32, i32* %i.addr.1, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %52 = load i32, i32* %i.addr.2, align 4
  %53 = icmp slt i32 %52, 1000
  br i1 %53, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %n.addr, align 4
  %54 = call i64 @nish_arena_mark()
  store i64 %54, i64* %a.addr, align 8
  %55 = load i64, i64* %a.addr, align 8
  %56 = load i32, i32* %i.addr.2, align 4
  %57 = call i32 @relabel(i32 %56)
  store i32 %57, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %55)
  %58 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %59 = load i32, i32* %n.addr, align 4
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = icmp eq i64 %62, %64
  br i1 %65, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %58, i64 8)
  br label %push.store.1

push.store.1:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i8**
  %69 = getelementptr inbounds i8*, i8** %68, i64 %62
  store i8* %60, i8** %69, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = add i64 %62, 1
  store i64 %70, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = trunc i64 %70 to i32
  br label %for.inc.2

for.inc.2:
  %72 = load i32, i32* %i.addr.2, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %74 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = trunc i64 %76 to i32
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %80 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ult i64 999, %82
  br i1 %83, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 999, i64 %82)
  unreachable

bounds.ok:
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = bitcast i8* %85 to i8**
  %87 = getelementptr inbounds i8*, i8** %86, i64 999
  %88 = load i8*, i8** %87, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %89 = call i8* @nish_str_concat(i8* %79, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %91 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = icmp ult i64 1999, %93
  br i1 %94, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1999, i64 %93)
  unreachable

bounds.ok.1:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %96 to i8**
  %98 = getelementptr inbounds i8*, i8** %97, i64 1999
  %99 = load i8*, i8** %98, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %100 = call i8* @nish_str_concat(i8* %90, i8* %99)
  %101 = call i8* @nish_str_concat(i8* %100, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %102 = load i32, i32* %total.addr, align 4
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* %101, i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %106 = call i32 @relabel(i32 7)
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %105, i8* %107)
  call void @nish_print(i8* %108)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
