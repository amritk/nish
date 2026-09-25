%struct.Rec = type { i32, i32 }
%struct.Grid = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

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

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #0 {
entry:
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define noundef i32 @stamp(%struct.Grid* noundef nonnull readonly align 8 dereferenceable(8) nocapture %g, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rs) #1 {
entry:
  %t.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %Rec.obj = alloca %struct.Rec, align 8
  store i32 0, i32* %t.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.Grid, %struct.Grid* %g, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %6 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %t.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %8 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %18
  %21 = load i32, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %22 = add nsw i32 %16, %21
  store i32 %22, i32* %t.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = load i32, i32* %n.addr, align 4
  %25 = icmp eq i32 %24, 0
  %26 = icmp eq i32 %23, -2147483648
  %27 = icmp eq i32 %24, -1
  %28 = and i1 %26, %27
  %29 = or i1 %25, %28
  br i1 %29, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %25)
  unreachable

div.ok:
  %30 = srem i32 %23, %24
  %31 = sext i32 %30 to i64
  %32 = load i32, i32* %i.addr, align 4
  %33 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store i32 %32, i32* %33, align 4
  %34 = load i32, i32* %t.addr, align 4
  %35 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 1
  store i32 %34, i32* %35, align 4
  %36 = icmp ult i64 %31, %10
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %31, i64 %10)
  unreachable

bounds.ok:
  %37 = bitcast i8* %12 to %struct.Rec*
  %38 = getelementptr inbounds %struct.Rec, %struct.Rec* %37, i64 %31
  %39 = bitcast %struct.Rec* %38 to i8*
  %40 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %39, i8* align 4 %40, i64 8, i1 false), !alias.scope !9, !noalias !8
  br label %for.inc

for.inc:
  %41 = load i32, i32* %i.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %43 = load i32, i32* %t.addr, align 4
  ret i32 %43
}

define noundef i32 @nish_main() #1 {
entry:
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Rec], align 8
  %t.addr = alloca i32, align 4
  %Grid.obj = alloca %struct.Grid, align 8
  %0 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 1
  store i32 0, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store i32 0, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 1
  store i32 0, i32* %3, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !8, !noalias !9
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast [2 x %struct.Rec]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %6 to %struct.Rec*
  %9 = getelementptr inbounds %struct.Rec, %struct.Rec* %8, i64 0
  %10 = bitcast %struct.Rec* %9 to i8*
  %11 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %10, i8* align 4 %11, i64 8, i1 false), !alias.scope !9, !noalias !8
  %12 = getelementptr inbounds %struct.Rec, %struct.Rec* %8, i64 1
  %13 = bitcast %struct.Rec* %12 to i8*
  %14 = bitcast %struct.Rec* %Rec.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %13, i8* align 4 %14, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 5, i64* %17, align 8, !alias.scope !8, !noalias !9
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 5, i64* %18, align 8, !alias.scope !8, !noalias !9
  %19 = call i8* @nish_alloc_struct(i64 20)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !8, !noalias !9
  %21 = bitcast i8* %19 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 10, i32* %22, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %23 = getelementptr inbounds i32, i32* %21, i64 1
  store i32 20, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %24 = getelementptr inbounds i32, i32* %21, i64 2
  store i32 30, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %25 = getelementptr inbounds i32, i32* %21, i64 3
  store i32 40, i32* %25, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %26 = getelementptr inbounds i32, i32* %21, i64 4
  store i32 50, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @Grid.constructor(%struct.Grid* %Grid.obj, %struct.nish_array* %16)
  %27 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %28 = call i32 @stamp(%struct.Grid* %Grid.obj, %struct.nish_array* %27)
  store i32 %28, i32* %t.addr, align 4
  %29 = load i32, i32* %t.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !8, !noalias !9
  %35 = icmp ult i64 0, %34
  br i1 %35, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %34)
  unreachable

bounds.ok:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9
  %38 = bitcast i8* %37 to %struct.Rec*
  %39 = getelementptr inbounds %struct.Rec, %struct.Rec* %38, i64 0
  %40 = getelementptr inbounds %struct.Rec, %struct.Rec* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %31, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9
  %48 = bitcast i8* %47 to %struct.Rec*
  %49 = getelementptr inbounds %struct.Rec, %struct.Rec* %48, i64 0
  %50 = getelementptr inbounds %struct.Rec, %struct.Rec* %49, i32 0, i32 1
  %51 = load i32, i32* %50, align 4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* %44, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %55 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !8, !noalias !9
  %58 = icmp ult i64 1, %57
  br i1 %58, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %57)
  unreachable

bounds.ok.1:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !8, !noalias !9
  %61 = bitcast i8* %60 to %struct.Rec*
  %62 = getelementptr inbounds %struct.Rec, %struct.Rec* %61, i64 1
  %63 = getelementptr inbounds %struct.Rec, %struct.Rec* %62, i32 0, i32 0
  %64 = load i32, i32* %63, align 4
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %54, i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %68 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !8, !noalias !9
  %71 = bitcast i8* %70 to %struct.Rec*
  %72 = getelementptr inbounds %struct.Rec, %struct.Rec* %71, i64 1
  %73 = getelementptr inbounds %struct.Rec, %struct.Rec* %72, i32 0, i32 1
  %74 = load i32, i32* %73, align 4
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %67, i8* %75)
  call void @nish_print(i8* %76)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Grid", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
