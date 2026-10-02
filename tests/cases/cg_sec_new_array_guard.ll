%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"3\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"4\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"5\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"6\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

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

define noundef i32 @test() #0 {
entry:
  %wide.addr = alloca i64, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %unsigned.addr = alloca i32, align 4
  %b.addr = alloca %struct.nish_array*, align 8
  %float.addr = alloca double, align 8
  %c.addr = alloca %struct.nish_array*, align 8
  %plain.addr = alloca %struct.nish_array*, align 8
  %literal.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = sext i32 %1 to i64
  store i64 %2, i64* %wide.addr, align 8
  %3 = load i64, i64* %wide.addr, align 8
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = mul i64 %3, 8
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %a.addr, align 8
  %12 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i32 2)
  %13 = call i32 @llvm.fptosi.sat.i32.f64(double %12)
  store i32 %13, i32* %unsigned.addr, align 4
  %14 = load i32, i32* %unsigned.addr, align 4
  %15 = zext i32 %14 to i64
  %16 = icmp ule i64 %15, 2147483647
  br i1 %16, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 %15, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 %15, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = call i8* @nish_alloc_struct(i64 %15)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %15, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %18, %struct.nish_array** %b.addr, align 8
  %23 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i32 2)
  %24 = call i32 @llvm.fptosi.sat.i32.f64(double %23)
  %25 = sitofp i32 %24 to double
  store double %25, double* %float.addr, align 8
  %26 = load double, double* %float.addr, align 8
  %27 = fcmp oge double %26, 0.0
  %28 = fcmp ole double %26, 2147483647.0
  %29 = and i1 %27, %28
  br i1 %29, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.2:
  %30 = fptosi double %26 to i64
  %31 = call i8* @nish_alloc_struct(i64 24)
  %32 = bitcast i8* %31 to %struct.nish_array*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  store i64 %30, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  store i64 %30, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = mul i64 %30, 4
  %36 = call i8* @nish_alloc_struct(i64 %35)
  call void @llvm.memset.p0i8.i64(i8* align 8 %36, i8 0, i64 %35, i1 false), !alias.scope !4, !noalias !3
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  store i8* %36, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %32, %struct.nish_array** %c.addr, align 8
  %38 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i32 2)
  %39 = call i32 @llvm.fptosi.sat.i32.f64(double %38)
  %40 = sext i32 %39 to i64
  %41 = call i8* @nish_alloc_struct(i64 24)
  %42 = bitcast i8* %41 to %struct.nish_array*
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  store i64 %40, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 1
  store i64 %40, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = mul i64 %40, 4
  %46 = call i8* @nish_alloc_struct(i64 %45)
  call void @llvm.memset.p0i8.i64(i8* align 8 %46, i8 0, i64 %45, i1 false), !alias.scope !4, !noalias !3
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  store i8* %46, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %42, %struct.nish_array** %plain.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = bitcast [7 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %50, i8 0, i64 7, i1 false), !alias.scope !4, !noalias !3
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %literal.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %58 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = trunc i64 %60 to i32
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %57, i8* %62)
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %65 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* %64, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %72 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %71, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %79 = load %struct.nish_array*, %struct.nish_array** %literal.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = trunc i64 %81 to i32
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %78, i8* %83)
  call void @nish_print(i8* %84)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
