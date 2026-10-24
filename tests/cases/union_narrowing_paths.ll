%struct.H = type { i32 }
%struct.G = type { %struct.H* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store i32 %k, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @H.twice(%struct.H* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = icmp ne i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store i32 1, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = icmp eq i32 %5, 1
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %7 = phi i32 [ 2, %cond.true ], [ 1, %cond.false ]
  ret i32 %7
}

define internal void @G.constructor(%struct.G* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.H* noundef nonnull align 8 dereferenceable(4) %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.G, %struct.G* %this, i32 0, i32 0
  store %struct.H* %h, %struct.H** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @f(%struct.H* noundef nonnull align 8 dereferenceable(4) %h, %struct.G* noundef nonnull align 8 dereferenceable(8) nocapture %g, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i1 noundef zeroext %c) #1 {
entry:
  %n.addr = alloca i32, align 4
  %x.addr = alloca %struct.H*, align 8
  store i32 0, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 1, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = icmp eq i32 %5, 1
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = load i32, i32* %n.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %n.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %9 = getelementptr inbounds %struct.G, %struct.G* %g, i32 0, i32 0
  %10 = load %struct.H*, %struct.H** %9, align 8, !tbaa !7
  %11 = getelementptr inbounds %struct.H, %struct.H* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  %13 = icmp eq i32 %12, 0
  br i1 %13, label %if.then.2, label %if.end.2

if.then.2:
  %14 = getelementptr inbounds %struct.G, %struct.G* %g, i32 0, i32 0
  store %struct.H* %h, %struct.H** %14, align 8, !tbaa !7
  %15 = getelementptr inbounds %struct.G, %struct.G* %g, i32 0, i32 0
  %16 = load %struct.H*, %struct.H** %15, align 8, !tbaa !7
  %17 = getelementptr inbounds %struct.H, %struct.H* %16, i32 0, i32 0
  %18 = load i32, i32* %17, align 4, !tbaa !4
  %19 = icmp eq i32 %18, 1
  br i1 %19, label %if.then.3, label %if.end.3

if.then.3:
  %20 = load i32, i32* %n.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 2)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %22, i32* %n.addr, align 4
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  store %struct.H* %h, %struct.H** %x.addr, align 8
  %24 = load %struct.H*, %struct.H** %x.addr, align 8
  %25 = getelementptr inbounds %struct.H, %struct.H* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4, !tbaa !4
  %27 = icmp eq i32 %26, 1
  br i1 %27, label %if.then.4, label %if.end.4

if.then.4:
  %28 = call i8* @nish_alloc_struct(i64 4)
  %29 = bitcast i8* %28 to %struct.H*
  call void @H.constructor(%struct.H* %29, i32 2)
  store %struct.H* %29, %struct.H** %x.addr, align 8
  %30 = load %struct.H*, %struct.H** %x.addr, align 8
  %31 = getelementptr inbounds %struct.H, %struct.H* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !4
  %33 = icmp eq i32 %32, 2
  br i1 %33, label %if.then.5, label %if.end.5

if.then.5:
  %34 = load i32, i32* %n.addr, align 4
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 4)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %n.addr, align 4
  br label %if.end.5

if.end.5:
  br label %if.end.4

if.end.4:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %40 = icmp ult i64 0, %39
  br i1 %40, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %39)
  unreachable

bounds.ok:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %43 = bitcast i8* %42 to %struct.H**
  %44 = getelementptr inbounds %struct.H*, %struct.H** %43, i64 0
  %45 = load %struct.H*, %struct.H** %44, align 8, !alias.scope !12, !noalias !11, !tbaa !19
  %46 = getelementptr inbounds %struct.H, %struct.H* %45, i32 0, i32 0
  %47 = load i32, i32* %46, align 4, !tbaa !4
  %48 = icmp eq i32 %47, 0
  br i1 %48, label %if.then.6, label %if.end.6

if.then.6:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %51 = bitcast i8* %50 to %struct.H**
  %52 = getelementptr inbounds %struct.H*, %struct.H** %51, i64 0
  store %struct.H* %h, %struct.H** %52, align 8, !alias.scope !12, !noalias !11, !tbaa !19
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %55 = bitcast i8* %54 to %struct.H**
  %56 = getelementptr inbounds %struct.H*, %struct.H** %55, i64 0
  %57 = load %struct.H*, %struct.H** %56, align 8, !alias.scope !12, !noalias !11, !tbaa !19
  %58 = getelementptr inbounds %struct.H, %struct.H* %57, i32 0, i32 0
  %59 = load i32, i32* %58, align 4, !tbaa !4
  %60 = icmp eq i32 %59, 1
  br i1 %60, label %if.then.7, label %if.end.7

if.then.7:
  %61 = load i32, i32* %n.addr, align 4
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 8)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %63, i32* %n.addr, align 4
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  %65 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !4
  %67 = icmp eq i32 %66, 1
  br i1 %67, label %if.then.8, label %if.end.8

if.then.8:
  br i1 %c, label %if.then.9, label %if.end.9

if.then.9:
  %68 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 2, i32* %68, align 4, !tbaa !4
  br label %if.end.9

if.end.9:
  %69 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %70 = load i32, i32* %69, align 4, !tbaa !4
  %71 = icmp eq i32 %70, 2
  br i1 %71, label %if.then.10, label %if.end.10

if.then.10:
  %72 = load i32, i32* %n.addr, align 4
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 16)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %74, i32* %n.addr, align 4
  br label %if.end.10

if.end.10:
  br label %if.end.8

if.end.8:
  br label %while.cond

while.cond:
  %76 = load i32, i32* %n.addr, align 4
  %77 = icmp slt i32 %76, 100
  br i1 %77, label %while.body, label %while.end

while.body:
  %78 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  %79 = load i32, i32* %78, align 4, !tbaa !4
  %80 = icmp eq i32 %79, 0
  br i1 %80, label %if.then.11, label %if.end.11

if.then.11:
  %81 = load i32, i32* %n.addr, align 4
  %82 = add nsw i32 %81, 100
  store i32 %82, i32* %n.addr, align 4
  br label %if.end.11

if.end.11:
  %83 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store i32 0, i32* %83, align 4, !tbaa !4
  br label %while.cond

while.end:
  %84 = load i32, i32* %n.addr, align 4
  ret i32 %84

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %h.addr = alloca %struct.H*, align 8
  %G.obj = alloca %struct.G, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.H*], align 8
  %H.obj = alloca %struct.H, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.H*
  call void @H.constructor(%struct.H* %1, i32 0)
  store %struct.H* %1, %struct.H** %h.addr, align 8
  %2 = load %struct.H*, %struct.H** %h.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 4)
  %4 = bitcast i8* %3 to %struct.H*
  call void @H.constructor(%struct.H* %4, i32 0)
  call void @G.constructor(%struct.G* %G.obj, %struct.H* %4)
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = bitcast i8* %5 to %struct.H*
  call void @H.constructor(%struct.H* %6, i32 0)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %7, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %9 = bitcast [1 x %struct.H*]* %arr.data to i8*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %11 = bitcast i8* %9 to %struct.H**
  %12 = getelementptr inbounds %struct.H*, %struct.H** %11, i64 0
  store %struct.H* %6, %struct.H** %12, align 8, !alias.scope !12, !noalias !11, !tbaa !19
  %13 = call i32 @f(%struct.H* %2, %struct.G* %G.obj, %struct.nish_array* %arr.hdr, i1 true)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  call void @H.constructor(%struct.H* %H.obj, i32 0)
  %15 = call i32 @H.twice(%struct.H* %H.obj)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"G", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !14, i64 16}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!15, !13, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
