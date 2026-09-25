%struct.nish_array = type { i64, i64, i8* }

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

declare noundef i64 @nish_arena_mark() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noundef nonnull align 8 i8* @build(i32 noundef %n) #0 {
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
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %15, align 8, !alias.scope !3, !noalias !4
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
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %20, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4
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
  %35 = load i8*, i8** %b.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = load i8*, i8** %what.addr, align 8
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = trunc i64 %41 to i32
  %43 = add nsw i32 %38, %42
  %44 = load i8*, i8** %s.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = add nsw i32 %43, %47
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @build(i32 1)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = trunc i64 %53 to i32
  %55 = add nsw i32 %48, %54
  %56 = load i8*, i8** %plain.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = add nsw i32 %55, %59
  %61 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4
  %64 = trunc i64 %63 to i32
  %65 = add nsw i32 %60, %64
  %66 = load i8*, i8** %row.addr, align 8
  %67 = bitcast i8* %66 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = trunc i64 %68 to i32
  %70 = add nsw i32 %65, %69
  ret i32 %70
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element ptr", !6, i64 0}
!8 = !{!7, !7, i64 0}
