%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 !dbg !12 {
entry:
  call void @llvm.dbg.value(metadata %struct.Point* %this, metadata !14, metadata !DIExpression()), !dbg !13
  call void @llvm.dbg.value(metadata i32 %x, metadata !15, metadata !DIExpression()), !dbg !13
  call void @llvm.dbg.value(metadata i32 %y, metadata !16, metadata !DIExpression()), !dbg !13
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0, !dbg !17
  store i32 %x, i32* %0, align 4, !dbg !17
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1, !dbg !19
  store i32 %y, i32* %1, align 4, !dbg !19
  ret void, !dbg !13
}

define internal noundef i32 @Point.sum(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 !dbg !23 {
entry:
  call void @llvm.dbg.value(metadata %struct.Point* %this, metadata !25, metadata !DIExpression()), !dbg !24
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0, !dbg !27
  %1 = load i32, i32* %0, align 4, !dbg !27
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1, !dbg !28
  %3 = load i32, i32* %2, align 4, !dbg !28
  %4 = add nsw i32 %1, %3, !dbg !27
  ret i32 %4, !dbg !26
}

define internal noundef nonnull align 8 i8* @label(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 !dbg !33 {
entry:
  call void @llvm.dbg.value(metadata %struct.Point* %p, metadata !35, metadata !DIExpression()), !dbg !34
  call void @llvm.dbg.value(metadata i8* %name, metadata !36, metadata !DIExpression()), !dbg !34
  %0 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*)), !dbg !38
  %1 = call i32 @Point.sum(%struct.Point* %p), !dbg !40
  %2 = call i8* @nish_str_from_i32(i32 %1), !dbg !38
  %3 = call i8* @nish_str_concat(i8* %0, i8* %2), !dbg !38
  ret i8* %3, !dbg !37
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %values) #1 !dbg !51 {
entry:
  %acc.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.nish_array* %values, metadata !53, metadata !DIExpression()), !dbg !52
  store i32 0, i32* %acc.addr, align 4, !dbg !54
  call void @llvm.dbg.declare(metadata i32* %acc.addr, metadata !56, metadata !DIExpression()), !dbg !54
  call void @llvm.dbg.declare(metadata i32* %v.addr, metadata !58, metadata !DIExpression()), !dbg !57
  store i64 0, i64* %forof.idx, align 8, !dbg !57
  br label %forof.cond, !dbg !57

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8, !dbg !57
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %values, i64 0, i32 0, !dbg !57
  %2 = load i64, i64* %1, align 8, !alias.scope !63, !noalias !64, !dbg !57
  %3 = icmp ult i64 %0, %2, !dbg !57
  br i1 %3, label %forof.body, label %forof.end, !dbg !57

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %values, i64 0, i32 2, !dbg !57
  %5 = load i8*, i8** %4, align 8, !alias.scope !63, !noalias !64, !dbg !57
  %6 = bitcast i8* %5 to i32*, !dbg !57
  %7 = getelementptr inbounds i32, i32* %6, i64 %0, !dbg !57
  %8 = load i32, i32* %7, align 4, !alias.scope !64, !noalias !63, !dbg !57
  store i32 %8, i32* %v.addr, align 4, !dbg !57
  %9 = load i32, i32* %acc.addr, align 4, !dbg !66
  %10 = load i32, i32* %v.addr, align 4, !dbg !67
  %11 = add nsw i32 %9, %10, !dbg !66
  store i32 %11, i32* %acc.addr, align 4, !dbg !66
  br label %forof.inc, !dbg !57

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8, !dbg !57
  %13 = add i64 %12, 1, !dbg !57
  store i64 %13, i64* %forof.idx, align 8, !dbg !57
  br label %forof.cond, !dbg !57

forof.end:
  %14 = load i32, i32* %acc.addr, align 4, !dbg !69
  ret i32 %14, !dbg !68
}

define noundef i32 @test() #0 !dbg !72 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %ok.addr = alloca i1, align 1
  %big.addr = alloca i64, align 8
  %ratio.addr = alloca double, align 8
  %s.addr = alloca i8*, align 8
  %t.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark(), !dbg !73
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4), !dbg !75
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8, !dbg !74
  call void @llvm.dbg.declare(metadata %struct.Point** %p.addr, metadata !78, metadata !DIExpression()), !dbg !74
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !80
  %1 = call i32 @Point.sum(%struct.Point* %0), !dbg !80
  %2 = icmp eq i32 %1, 7, !dbg !80
  store i1 %2, i1* %ok.addr, align 1, !dbg !79
  call void @llvm.dbg.declare(metadata i1* %ok.addr, metadata !83, metadata !DIExpression()), !dbg !79
  store i64 1, i64* %big.addr, align 8, !dbg !84
  call void @llvm.dbg.declare(metadata i64* %big.addr, metadata !86, metadata !DIExpression()), !dbg !84
  store double 0x4004000000000000, double* %ratio.addr, align 8, !dbg !87
  call void @llvm.dbg.declare(metadata double* %ratio.addr, metadata !90, metadata !DIExpression()), !dbg !87
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !93
  %4 = call i64 @nish_arena_mark(), !dbg !92
  %5 = call i8* @label(%struct.Point* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*)), !dbg !92
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5), !dbg !92
  store i8* %6, i8** %s.addr, align 8, !dbg !91
  call void @llvm.dbg.declare(metadata i8** %s.addr, metadata !95, metadata !DIExpression()), !dbg !91
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0, !dbg !98
  store i64 3, i64* %7, align 8, !alias.scope !63, !noalias !64, !dbg !98
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1, !dbg !98
  store i64 3, i64* %8, align 8, !alias.scope !63, !noalias !64, !dbg !98
  %9 = bitcast [3 x i32]* %arr.data to i8*, !dbg !98
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2, !dbg !98
  store i8* %9, i8** %10, align 8, !alias.scope !63, !noalias !64, !dbg !98
  %11 = bitcast i8* %9 to i32*, !dbg !98
  %12 = getelementptr inbounds i32, i32* %11, i64 0, !dbg !98
  store i32 1, i32* %12, align 4, !alias.scope !64, !noalias !63, !dbg !98
  %13 = getelementptr inbounds i32, i32* %11, i64 1, !dbg !98
  store i32 2, i32* %13, align 4, !alias.scope !64, !noalias !63, !dbg !98
  %14 = getelementptr inbounds i32, i32* %11, i64 2, !dbg !98
  store i32 3, i32* %14, align 4, !alias.scope !64, !noalias !63, !dbg !98
  %15 = call i32 @total(%struct.nish_array* %arr.hdr), !dbg !97
  store i32 %15, i32* %t.addr, align 4, !dbg !96
  call void @llvm.dbg.declare(metadata i32* %t.addr, metadata !102, metadata !DIExpression()), !dbg !96
  %16 = load i1, i1* %ok.addr, align 1, !dbg !104
  br i1 %16, label %land.rhs.2, label %land.end.2, !dbg !104

land.rhs.2:
  %17 = load i64, i64* %big.addr, align 8, !dbg !105
  %18 = icmp eq i64 %17, 1, !dbg !105
  br label %land.end.2, !dbg !104

land.end.2:
  %19 = phi i1 [ false, %entry ], [ %18, %land.rhs.2 ], !dbg !104
  br i1 %19, label %land.rhs.1, label %land.end.1, !dbg !104

land.rhs.1:
  %20 = load double, double* %ratio.addr, align 8, !dbg !107
  %21 = fcmp ogt double %20, 0x4000000000000000, !dbg !107
  br label %land.end.1, !dbg !104

land.end.1:
  %22 = phi i1 [ false, %land.end.2 ], [ %21, %land.rhs.1 ], !dbg !104
  br i1 %22, label %land.rhs, label %land.end, !dbg !104

land.rhs:
  %23 = load i8*, i8** %s.addr, align 8, !dbg !109
  %24 = bitcast i8* %23 to i64*, !dbg !109
  %25 = load i64, i64* %24, align 8, !dbg !109
  %26 = trunc i64 %25 to i32, !dbg !109
  %27 = icmp eq i32 %26, 4, !dbg !109
  br label %land.end, !dbg !104

land.end:
  %28 = phi i1 [ false, %land.end.1 ], [ %27, %land.rhs ], !dbg !104
  br i1 %28, label %if.then, label %if.end, !dbg !103

if.then:
  %29 = load i32, i32* %t.addr, align 4, !dbg !113
  %30 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !114
  %31 = call i32 @Point.sum(%struct.Point* %30), !dbg !114
  %32 = add nsw i32 %29, %31, !dbg !113
  call void @nish_arena_release(i64 %arena.mark), !dbg !112
  ret i32 %32, !dbg !112

if.end:
  call void @nish_arena_release(i64 %arena.mark), !dbg !115
  ret i32 0, !dbg !115
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_locals.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Point", file: !1, line: 1, size: 64, align: 32, elements: !9)
!5 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!6 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!7 = !DIDerivedType(tag: DW_TAG_member, name: "x", scope: !4, file: !1, line: 2, baseType: !6, size: 32, offset: 0)
!8 = !DIDerivedType(tag: DW_TAG_member, name: "y", scope: !4, file: !1, line: 3, baseType: !6, size: 32, offset: 32)
!9 = !{!7, !8}
!10 = !{null, !5, !6, !6}
!11 = !DISubroutineType(types: !10)
!12 = distinct !DISubprogram(name: "Point.constructor", linkageName: "Point.constructor", scope: !1, file: !1, line: 5, type: !11, scopeLine: 5, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!13 = !DILocation(line: 5, column: 3, scope: !12)
!14 = !DILocalVariable(name: "this", arg: 1, scope: !12, file: !1, line: 5, type: !5, flags: DIFlagArtificial | DIFlagObjectPointer)
!15 = !DILocalVariable(name: "x", arg: 2, scope: !12, file: !1, line: 5, type: !6)
!16 = !DILocalVariable(name: "y", arg: 3, scope: !12, file: !1, line: 5, type: !6)
!17 = !DILocation(line: 6, column: 5, scope: !12)
!18 = !DILocation(line: 6, column: 14, scope: !12)
!19 = !DILocation(line: 7, column: 5, scope: !12)
!20 = !DILocation(line: 7, column: 14, scope: !12)
!21 = !{!6, !5}
!22 = !DISubroutineType(types: !21)
!23 = distinct !DISubprogram(name: "Point.sum", linkageName: "Point.sum", scope: !1, file: !1, line: 10, type: !22, scopeLine: 10, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!24 = !DILocation(line: 10, column: 3, scope: !23)
!25 = !DILocalVariable(name: "this", arg: 1, scope: !23, file: !1, line: 10, type: !5, flags: DIFlagArtificial | DIFlagObjectPointer)
!26 = !DILocation(line: 11, column: 5, scope: !23)
!27 = !DILocation(line: 11, column: 12, scope: !23)
!28 = !DILocation(line: 11, column: 21, scope: !23)
!29 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!30 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !29, size: 64)
!31 = !{!30, !5, !30}
!32 = !DISubroutineType(types: !31)
!33 = distinct !DISubprogram(name: "label", linkageName: "label", scope: !1, file: !1, line: 15, type: !32, scopeLine: 15, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!34 = !DILocation(line: 15, column: 1, scope: !33)
!35 = !DILocalVariable(name: "p", arg: 1, scope: !33, file: !1, line: 15, type: !5)
!36 = !DILocalVariable(name: "name", arg: 2, scope: !33, file: !1, line: 15, type: !30)
!37 = !DILocation(line: 16, column: 3, scope: !33)
!38 = !DILocation(line: 16, column: 10, scope: !33)
!39 = !DILocation(line: 16, column: 13, scope: !33)
!40 = !DILocation(line: 16, column: 22, scope: !33)
!41 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !47)
!42 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!43 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !41, baseType: !42, size: 64, offset: 0)
!44 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !41, baseType: !42, size: 64, offset: 64)
!45 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !6, size: 64)
!46 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !41, baseType: !45, size: 64, offset: 128)
!47 = !{!43, !44, !46}
!48 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !41, size: 64)
!49 = !{!6, !48}
!50 = !DISubroutineType(types: !49)
!51 = distinct !DISubprogram(name: "total", linkageName: "total", scope: !1, file: !1, line: 19, type: !50, scopeLine: 19, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!52 = !DILocation(line: 19, column: 1, scope: !51)
!53 = !DILocalVariable(name: "values", arg: 1, scope: !51, file: !1, line: 19, type: !48)
!54 = !DILocation(line: 20, column: 3, scope: !51)
!55 = !DILocation(line: 20, column: 13, scope: !51)
!56 = !DILocalVariable(name: "acc", scope: !51, file: !1, line: 20, type: !6)
!57 = !DILocation(line: 21, column: 3, scope: !51)
!58 = !DILocalVariable(name: "v", scope: !51, file: !1, line: 21, type: !6)
!59 = !DILocation(line: 21, column: 19, scope: !51)
!60 = !{!"nish array"}
!61 = !{!"header", !60}
!62 = !{!"elements", !60}
!63 = !{!61}
!64 = !{!62}
!65 = !DILocation(line: 21, column: 27, scope: !51)
!66 = !DILocation(line: 22, column: 5, scope: !51)
!67 = !DILocation(line: 22, column: 12, scope: !51)
!68 = !DILocation(line: 24, column: 3, scope: !51)
!69 = !DILocation(line: 24, column: 10, scope: !51)
!70 = !{!6}
!71 = !DISubroutineType(types: !70)
!72 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 27, type: !71, scopeLine: 27, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!73 = !DILocation(line: 27, column: 1, scope: !72)
!74 = !DILocation(line: 28, column: 3, scope: !72)
!75 = !DILocation(line: 28, column: 13, scope: !72)
!76 = !DILocation(line: 28, column: 23, scope: !72)
!77 = !DILocation(line: 28, column: 26, scope: !72)
!78 = !DILocalVariable(name: "p", scope: !72, file: !1, line: 28, type: !5)
!79 = !DILocation(line: 29, column: 3, scope: !72)
!80 = !DILocation(line: 29, column: 23, scope: !72)
!81 = !DILocation(line: 29, column: 35, scope: !72)
!82 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!83 = !DILocalVariable(name: "ok", scope: !72, file: !1, line: 29, type: !82)
!84 = !DILocation(line: 30, column: 3, scope: !72)
!85 = !DILocation(line: 30, column: 20, scope: !72)
!86 = !DILocalVariable(name: "big", scope: !72, file: !1, line: 30, type: !42)
!87 = !DILocation(line: 31, column: 3, scope: !72)
!88 = !DILocation(line: 31, column: 22, scope: !72)
!89 = !DIBasicType(name: "double", size: 64, encoding: DW_ATE_float)
!90 = !DILocalVariable(name: "ratio", scope: !72, file: !1, line: 31, type: !89)
!91 = !DILocation(line: 32, column: 3, scope: !72)
!92 = !DILocation(line: 32, column: 13, scope: !72)
!93 = !DILocation(line: 32, column: 19, scope: !72)
!94 = !DILocation(line: 32, column: 22, scope: !72)
!95 = !DILocalVariable(name: "s", scope: !72, file: !1, line: 32, type: !30)
!96 = !DILocation(line: 33, column: 3, scope: !72)
!97 = !DILocation(line: 33, column: 13, scope: !72)
!98 = !DILocation(line: 33, column: 19, scope: !72)
!99 = !DILocation(line: 33, column: 20, scope: !72)
!100 = !DILocation(line: 33, column: 23, scope: !72)
!101 = !DILocation(line: 33, column: 26, scope: !72)
!102 = !DILocalVariable(name: "t", scope: !72, file: !1, line: 33, type: !6)
!103 = !DILocation(line: 34, column: 3, scope: !72)
!104 = !DILocation(line: 34, column: 7, scope: !72)
!105 = !DILocation(line: 34, column: 13, scope: !72)
!106 = !DILocation(line: 34, column: 21, scope: !72)
!107 = !DILocation(line: 34, column: 26, scope: !72)
!108 = !DILocation(line: 34, column: 34, scope: !72)
!109 = !DILocation(line: 34, column: 41, scope: !72)
!110 = !DILocation(line: 34, column: 54, scope: !72)
!111 = !DILocation(line: 34, column: 57, scope: !72)
!112 = !DILocation(line: 35, column: 5, scope: !72)
!113 = !DILocation(line: 35, column: 12, scope: !72)
!114 = !DILocation(line: 35, column: 16, scope: !72)
!115 = !DILocation(line: 37, column: 3, scope: !72)
!116 = !DILocation(line: 37, column: 10, scope: !72)
