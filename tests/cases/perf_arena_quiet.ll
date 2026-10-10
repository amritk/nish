%struct.Box = type { i8* }
%struct.Chain = type { %struct.Chain* }
%struct.Wrap = type { %struct.Box* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unbound\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"long \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"short \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"literal\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"world\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"d\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %inner) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %inner, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Chain.constructor(%struct.Chain* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Chain* noundef align 8 %prev) #0 {
entry:
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  store %struct.Chain* %prev, %struct.Chain** %0, align 8, !tbaa !6
  ret void
}

define internal void @Wrap.constructor(%struct.Wrap* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Box* noundef nonnull align 8 dereferenceable(8) %box) #0 {
entry:
  %0 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %this, i32 0, i32 0
  store %struct.Box* %box, %struct.Box** %0, align 8, !tbaa !8
  ret void
}

define internal noundef nonnull align 8 i8* @build(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %0, i8** %s.addr, align 8
  %1 = load i8*, i8** %s.addr, align 8
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %2, i8** %s.addr, align 8
  %3 = load i8*, i8** %s.addr, align 8
  ret i8* %3
}

define noundef i32 @test() #1 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %what.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %plain.addr = alloca i8*, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %row.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box*, align 8
  %wrapped.addr = alloca %struct.Wrap*, align 8
  %Wrap.obj = alloca %struct.Wrap, align 8
  %chain.addr = alloca %struct.Chain*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %0, i8** %a.addr, align 8
  %1 = load i8*, i8** %a.addr, align 8
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %2, i8** %b.addr, align 8
  store i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8** %what.addr, align 8
  %3 = load i8*, i8** %b.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sgt i32 %6, 2
  br i1 %7, label %if.then, label %if.else

if.then:
  %8 = load i8*, i8** %b.addr, align 8
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %8)
  store i8* %9, i8** %what.addr, align 8
  br label %if.end

if.else:
  %10 = load i8*, i8** %b.addr, align 8
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*), i8* %10)
  store i8* %11, i8** %what.addr, align 8
  br label %if.end

if.end:
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %12, i8** %s.addr, align 8
  store i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i8** %s.addr, align 8
  store i8* bitcast ({ i64, [6 x i8] }* @.str.10 to i8*), i8** %plain.addr, align 8
  store i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*), i8** %plain.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %13, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %14, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %15, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  %16 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %16, i8** %row.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %17 = load i32, i32* %i.addr, align 4
  %18 = icmp slt i32 %17, 2
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %20 = load i8*, i8** %row.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %20, i8** %29, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %31 = trunc i64 %30 to i32
  %32 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  store i8* %32, i8** %row.addr, align 8
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = call i8* @nish_alloc_struct(i64 8)
  %36 = bitcast i8* %35 to %struct.Box*
  %37 = load i8*, i8** %b.addr, align 8
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*))
  call void @Box.constructor(%struct.Box* %36, i8* %38)
  store %struct.Box* %36, %struct.Box** %box.addr, align 8
  %39 = load %struct.Box*, %struct.Box** %box.addr, align 8
  call void @Wrap.constructor(%struct.Wrap* %Wrap.obj, %struct.Box* %39)
  store %struct.Wrap* %Wrap.obj, %struct.Wrap** %wrapped.addr, align 8
  %40 = call i8* @nish_alloc_struct(i64 8)
  %41 = bitcast i8* %40 to %struct.Box*
  %42 = load %struct.Wrap*, %struct.Wrap** %wrapped.addr, align 8
  %43 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %42, i32 0, i32 0
  %44 = load %struct.Box*, %struct.Box** %43, align 8, !tbaa !8
  %45 = getelementptr inbounds %struct.Box, %struct.Box* %44, i32 0, i32 0
  %46 = load i8*, i8** %45, align 8, !tbaa !4
  call void @Box.constructor(%struct.Box* %41, i8* %46)
  store %struct.Box* %41, %struct.Box** %box.addr, align 8
  %47 = call i8* @nish_alloc_struct(i64 8)
  %48 = bitcast i8* %47 to %struct.Chain*
  call void @Chain.constructor(%struct.Chain* %48, %struct.Chain* null)
  store %struct.Chain* %48, %struct.Chain** %chain.addr, align 8
  %49 = call i8* @nish_alloc_struct(i64 8)
  %50 = bitcast i8* %49 to %struct.Chain*
  %51 = load %struct.Chain*, %struct.Chain** %chain.addr, align 8
  call void @Chain.constructor(%struct.Chain* %50, %struct.Chain* %51)
  store %struct.Chain* %50, %struct.Chain** %chain.addr, align 8
  %52 = load i8*, i8** %b.addr, align 8
  %53 = bitcast i8* %52 to i64*
  %54 = load i64, i64* %53, align 8
  %55 = trunc i64 %54 to i32
  %56 = load i8*, i8** %what.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %55, i32 %59)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok

ovf.ok:
  %63 = load i8*, i8** %s.addr, align 8
  %64 = bitcast i8* %63 to i64*
  %65 = load i64, i64* %64, align 8
  %66 = trunc i64 %65 to i32
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = call i64 @nish_arena_mark()
  %71 = call i8* @build(i32 1)
  %72 = call i8* @nish_arena_keep(i64 %70, i8* %71)
  %73 = bitcast i8* %72 to i64*
  %74 = load i64, i64* %73, align 8
  %75 = trunc i64 %74 to i32
  %76 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 %75)
  %77 = extractvalue { i32, i1 } %76, 0
  %78 = extractvalue { i32, i1 } %76, 1
  br i1 %78, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %79 = load i8*, i8** %plain.addr, align 8
  %80 = bitcast i8* %79 to i64*
  %81 = load i64, i64* %80, align 8
  %82 = trunc i64 %81 to i32
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %77, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %86 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %89 = trunc i64 %88 to i32
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %84, i32 %89)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %93 = load i8*, i8** %row.addr, align 8
  %94 = bitcast i8* %93 to i64*
  %95 = load i64, i64* %94, align 8
  %96 = trunc i64 %95 to i32
  %97 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 %96)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %100 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %101 = getelementptr inbounds %struct.Box, %struct.Box* %100, i32 0, i32 0
  %102 = load i8*, i8** %101, align 8, !tbaa !4
  %103 = bitcast i8* %102 to i64*
  %104 = load i64, i64* %103, align 8
  %105 = trunc i64 %104 to i32
  %106 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %98, i32 %105)
  %107 = extractvalue { i32, i1 } %106, 0
  %108 = extractvalue { i32, i1 } %106, 1
  br i1 %108, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %109 = load %struct.Chain*, %struct.Chain** %chain.addr, align 8
  %110 = getelementptr inbounds %struct.Chain, %struct.Chain* %109, i32 0, i32 0
  %111 = load %struct.Chain*, %struct.Chain** %110, align 8, !tbaa !6
  %112 = icmp ne %struct.Chain* %111, null
  br i1 %112, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %113 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %114 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %107, i32 %113)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %115

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Chain", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"Wrap", !2, i64 0}
!8 = !{!7, !2, i64 0}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element ptr", !1, i64 0}
!21 = !{!20, !20, i64 0}
