%struct.Box = type { i8* }
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

define internal void @Wrap.constructor(%struct.Wrap* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Box* noundef nonnull align 8 dereferenceable(8) %box) #0 {
entry:
  %0 = getelementptr inbounds %struct.Wrap, %struct.Wrap* %this, i32 0, i32 0
  store %struct.Box* %box, %struct.Box** %0, align 8, !tbaa !6
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
  store i64 0, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %14, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !17
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
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %20, i8** %29, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
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
  %44 = load %struct.Box*, %struct.Box** %43, align 8, !tbaa !6
  %45 = getelementptr inbounds %struct.Box, %struct.Box* %44, i32 0, i32 0
  %46 = load i8*, i8** %45, align 8, !tbaa !4
  call void @Box.constructor(%struct.Box* %41, i8* %46)
  store %struct.Box* %41, %struct.Box** %box.addr, align 8
  %47 = load i8*, i8** %b.addr, align 8
  %48 = bitcast i8* %47 to i64*
  %49 = load i64, i64* %48, align 8
  %50 = trunc i64 %49 to i32
  %51 = load i8*, i8** %what.addr, align 8
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = trunc i64 %53 to i32
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok

ovf.ok:
  %58 = load i8*, i8** %s.addr, align 8
  %59 = bitcast i8* %58 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = trunc i64 %60 to i32
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 %61)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %65 = call i64 @nish_arena_mark()
  %66 = call i8* @build(i32 1)
  %67 = call i8* @nish_arena_keep(i64 %65, i8* %66)
  %68 = bitcast i8* %67 to i64*
  %69 = load i64, i64* %68, align 8
  %70 = trunc i64 %69 to i32
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %63, i32 %70)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %74 = load i8*, i8** %plain.addr, align 8
  %75 = bitcast i8* %74 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = trunc i64 %76 to i32
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %81 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %84)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %88 = load i8*, i8** %row.addr, align 8
  %89 = bitcast i8* %88 to i64*
  %90 = load i64, i64* %89, align 8
  %91 = trunc i64 %90 to i32
  %92 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %91)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %95 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %96 = getelementptr inbounds %struct.Box, %struct.Box* %95, i32 0, i32 0
  %97 = load i8*, i8** %96, align 8, !tbaa !4
  %98 = bitcast i8* %97 to i64*
  %99 = load i64, i64* %98, align 8
  %100 = trunc i64 %99 to i32
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %93, i32 %100)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %102

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
!5 = !{!"Wrap", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
