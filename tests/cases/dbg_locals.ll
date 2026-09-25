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
  store i32 %x, i32* %0, align 4, !tbaa !23, !dbg !17
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1, !dbg !24
  store i32 %y, i32* %1, align 4, !tbaa !26, !dbg !24
  ret void, !dbg !13
}

define internal noundef i32 @Point.sum(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 !dbg !29 {
entry:
  call void @llvm.dbg.value(metadata %struct.Point* %this, metadata !31, metadata !DIExpression()), !dbg !30
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0, !dbg !33
  %1 = load i32, i32* %0, align 4, !tbaa !23, !dbg !33
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1, !dbg !34
  %3 = load i32, i32* %2, align 4, !tbaa !26, !dbg !34
  %4 = add nsw i32 %1, %3, !dbg !33
  ret i32 %4, !dbg !32
}

define internal noundef nonnull align 8 i8* @label(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 !dbg !39 {
entry:
  call void @llvm.dbg.value(metadata %struct.Point* %p, metadata !41, metadata !DIExpression()), !dbg !40
  call void @llvm.dbg.value(metadata i8* %name, metadata !42, metadata !DIExpression()), !dbg !40
  %0 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*)), !dbg !44
  %1 = call i32 @Point.sum(%struct.Point* %p), !dbg !46
  %2 = call i8* @nish_str_from_i32(i32 %1), !dbg !44
  %3 = call i8* @nish_str_concat(i8* %0, i8* %2), !dbg !44
  ret i8* %3, !dbg !43
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %values) #1 !dbg !57 {
entry:
  %acc.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  call void @llvm.dbg.value(metadata %struct.nish_array* %values, metadata !59, metadata !DIExpression()), !dbg !58
  store i32 0, i32* %acc.addr, align 4, !dbg !60
  call void @llvm.dbg.declare(metadata i32* %acc.addr, metadata !62, metadata !DIExpression()), !dbg !60
  call void @llvm.dbg.declare(metadata i32* %v.addr, metadata !64, metadata !DIExpression()), !dbg !63
  store i64 0, i64* %forof.idx, align 8, !dbg !63
  br label %forof.cond, !dbg !63

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8, !dbg !63
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %values, i64 0, i32 0, !dbg !63
  %2 = load i64, i64* %1, align 8, !alias.scope !69, !noalias !70, !dbg !63
  %3 = icmp ult i64 %0, %2, !dbg !63
  br i1 %3, label %forof.body, label %forof.end, !dbg !63

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %values, i64 0, i32 2, !dbg !63
  %5 = load i8*, i8** %4, align 8, !alias.scope !69, !noalias !70, !dbg !63
  %6 = bitcast i8* %5 to i32*, !dbg !63
  %7 = getelementptr inbounds i32, i32* %6, i64 %0, !dbg !63
  %8 = load i32, i32* %7, align 4, !alias.scope !70, !noalias !69, !tbaa !72, !dbg !63
  store i32 %8, i32* %v.addr, align 4, !dbg !63
  %9 = load i32, i32* %acc.addr, align 4, !dbg !74
  %10 = load i32, i32* %v.addr, align 4, !dbg !75
  %11 = add nsw i32 %9, %10, !dbg !74
  store i32 %11, i32* %acc.addr, align 4, !dbg !74
  br label %forof.inc, !dbg !63

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8, !dbg !63
  %13 = add i64 %12, 1, !dbg !63
  store i64 %13, i64* %forof.idx, align 8, !dbg !63
  br label %forof.cond, !dbg !63

forof.end:
  %14 = load i32, i32* %acc.addr, align 4, !dbg !77
  ret i32 %14, !dbg !76
}

define noundef i32 @test() #0 !dbg !80 {
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
  %arena.mark = call i64 @nish_arena_mark(), !dbg !81
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4), !dbg !83
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8, !dbg !82
  call void @llvm.dbg.declare(metadata %struct.Point** %p.addr, metadata !86, metadata !DIExpression()), !dbg !82
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !88
  %1 = call i32 @Point.sum(%struct.Point* %0), !dbg !88
  %2 = icmp eq i32 %1, 7, !dbg !88
  store i1 %2, i1* %ok.addr, align 1, !dbg !87
  call void @llvm.dbg.declare(metadata i1* %ok.addr, metadata !91, metadata !DIExpression()), !dbg !87
  store i64 1, i64* %big.addr, align 8, !dbg !92
  call void @llvm.dbg.declare(metadata i64* %big.addr, metadata !94, metadata !DIExpression()), !dbg !92
  store double 0x4004000000000000, double* %ratio.addr, align 8, !dbg !95
  call void @llvm.dbg.declare(metadata double* %ratio.addr, metadata !98, metadata !DIExpression()), !dbg !95
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !101
  %4 = call i64 @nish_arena_mark(), !dbg !100
  %5 = call i8* @label(%struct.Point* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*)), !dbg !100
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5), !dbg !100
  store i8* %6, i8** %s.addr, align 8, !dbg !99
  call void @llvm.dbg.declare(metadata i8** %s.addr, metadata !103, metadata !DIExpression()), !dbg !99
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0, !dbg !106
  store i64 3, i64* %7, align 8, !alias.scope !69, !noalias !70, !dbg !106
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1, !dbg !106
  store i64 3, i64* %8, align 8, !alias.scope !69, !noalias !70, !dbg !106
  %9 = bitcast [3 x i32]* %arr.data to i8*, !dbg !106
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2, !dbg !106
  store i8* %9, i8** %10, align 8, !alias.scope !69, !noalias !70, !dbg !106
  %11 = bitcast i8* %9 to i32*, !dbg !106
  %12 = getelementptr inbounds i32, i32* %11, i64 0, !dbg !106
  store i32 1, i32* %12, align 4, !alias.scope !70, !noalias !69, !tbaa !72, !dbg !106
  %13 = getelementptr inbounds i32, i32* %11, i64 1, !dbg !106
  store i32 2, i32* %13, align 4, !alias.scope !70, !noalias !69, !tbaa !72, !dbg !106
  %14 = getelementptr inbounds i32, i32* %11, i64 2, !dbg !106
  store i32 3, i32* %14, align 4, !alias.scope !70, !noalias !69, !tbaa !72, !dbg !106
  %15 = call i32 @total(%struct.nish_array* %arr.hdr), !dbg !105
  store i32 %15, i32* %t.addr, align 4, !dbg !104
  call void @llvm.dbg.declare(metadata i32* %t.addr, metadata !110, metadata !DIExpression()), !dbg !104
  %16 = load i1, i1* %ok.addr, align 1, !dbg !112
  br i1 %16, label %land.rhs.2, label %land.end.2, !dbg !112

land.rhs.2:
  %17 = load i64, i64* %big.addr, align 8, !dbg !113
  %18 = icmp eq i64 %17, 1, !dbg !113
  br label %land.end.2, !dbg !112

land.end.2:
  %19 = phi i1 [ false, %entry ], [ %18, %land.rhs.2 ], !dbg !112
  br i1 %19, label %land.rhs.1, label %land.end.1, !dbg !112

land.rhs.1:
  %20 = load double, double* %ratio.addr, align 8, !dbg !115
  %21 = fcmp ogt double %20, 0x4000000000000000, !dbg !115
  br label %land.end.1, !dbg !112

land.end.1:
  %22 = phi i1 [ false, %land.end.2 ], [ %21, %land.rhs.1 ], !dbg !112
  br i1 %22, label %land.rhs, label %land.end, !dbg !112

land.rhs:
  %23 = load i8*, i8** %s.addr, align 8, !dbg !117
  %24 = bitcast i8* %23 to i64*, !dbg !117
  %25 = load i64, i64* %24, align 8, !dbg !117
  %26 = trunc i64 %25 to i32, !dbg !117
  %27 = icmp eq i32 %26, 4, !dbg !117
  br label %land.end, !dbg !112

land.end:
  %28 = phi i1 [ false, %land.end.1 ], [ %27, %land.rhs ], !dbg !112
  br i1 %28, label %if.then, label %if.end, !dbg !111

if.then:
  %29 = load i32, i32* %t.addr, align 4, !dbg !121
  %30 = load %struct.Point*, %struct.Point** %p.addr, align 8, !dbg !122
  %31 = call i32 @Point.sum(%struct.Point* %30), !dbg !122
  %32 = add nsw i32 %29, %31, !dbg !121
  call void @nish_arena_release(i64 %arena.mark), !dbg !120
  ret i32 %32, !dbg !120

if.end:
  call void @nish_arena_release(i64 %arena.mark), !dbg !123
  ret i32 0, !dbg !123
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
!19 = !{!"nish TBAA"}
!20 = !{!"omnipotent char", !19, i64 0}
!21 = !{!"i32", !20, i64 0}
!22 = !{!"Point", !21, i64 0, !21, i64 4}
!23 = !{!22, !21, i64 0}
!24 = !DILocation(line: 7, column: 5, scope: !12)
!25 = !DILocation(line: 7, column: 14, scope: !12)
!26 = !{!22, !21, i64 4}
!27 = !{!6, !5}
!28 = !DISubroutineType(types: !27)
!29 = distinct !DISubprogram(name: "Point.sum", linkageName: "Point.sum", scope: !1, file: !1, line: 10, type: !28, scopeLine: 10, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!30 = !DILocation(line: 10, column: 3, scope: !29)
!31 = !DILocalVariable(name: "this", arg: 1, scope: !29, file: !1, line: 10, type: !5, flags: DIFlagArtificial | DIFlagObjectPointer)
!32 = !DILocation(line: 11, column: 5, scope: !29)
!33 = !DILocation(line: 11, column: 12, scope: !29)
!34 = !DILocation(line: 11, column: 21, scope: !29)
!35 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!36 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !35, size: 64)
!37 = !{!36, !5, !36}
!38 = !DISubroutineType(types: !37)
!39 = distinct !DISubprogram(name: "label", linkageName: "label", scope: !1, file: !1, line: 15, type: !38, scopeLine: 15, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!40 = !DILocation(line: 15, column: 1, scope: !39)
!41 = !DILocalVariable(name: "p", arg: 1, scope: !39, file: !1, line: 15, type: !5)
!42 = !DILocalVariable(name: "name", arg: 2, scope: !39, file: !1, line: 15, type: !36)
!43 = !DILocation(line: 16, column: 3, scope: !39)
!44 = !DILocation(line: 16, column: 10, scope: !39)
!45 = !DILocation(line: 16, column: 13, scope: !39)
!46 = !DILocation(line: 16, column: 22, scope: !39)
!47 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "i32[]", file: !1, size: 192, align: 64, elements: !53)
!48 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!49 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !47, baseType: !48, size: 64, offset: 0)
!50 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !47, baseType: !48, size: 64, offset: 64)
!51 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !6, size: 64)
!52 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !47, baseType: !51, size: 64, offset: 128)
!53 = !{!49, !50, !52}
!54 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !47, size: 64)
!55 = !{!6, !54}
!56 = !DISubroutineType(types: !55)
!57 = distinct !DISubprogram(name: "total", linkageName: "total", scope: !1, file: !1, line: 19, type: !56, scopeLine: 19, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!58 = !DILocation(line: 19, column: 1, scope: !57)
!59 = !DILocalVariable(name: "values", arg: 1, scope: !57, file: !1, line: 19, type: !54)
!60 = !DILocation(line: 20, column: 3, scope: !57)
!61 = !DILocation(line: 20, column: 13, scope: !57)
!62 = !DILocalVariable(name: "acc", scope: !57, file: !1, line: 20, type: !6)
!63 = !DILocation(line: 21, column: 3, scope: !57)
!64 = !DILocalVariable(name: "v", scope: !57, file: !1, line: 21, type: !6)
!65 = !DILocation(line: 21, column: 19, scope: !57)
!66 = !{!"nish array"}
!67 = !{!"header", !66}
!68 = !{!"elements", !66}
!69 = !{!67}
!70 = !{!68}
!71 = !{!"element i32", !20, i64 0}
!72 = !{!71, !71, i64 0}
!73 = !DILocation(line: 21, column: 27, scope: !57)
!74 = !DILocation(line: 22, column: 5, scope: !57)
!75 = !DILocation(line: 22, column: 12, scope: !57)
!76 = !DILocation(line: 24, column: 3, scope: !57)
!77 = !DILocation(line: 24, column: 10, scope: !57)
!78 = !{!6}
!79 = !DISubroutineType(types: !78)
!80 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 27, type: !79, scopeLine: 27, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!81 = !DILocation(line: 27, column: 1, scope: !80)
!82 = !DILocation(line: 28, column: 3, scope: !80)
!83 = !DILocation(line: 28, column: 13, scope: !80)
!84 = !DILocation(line: 28, column: 23, scope: !80)
!85 = !DILocation(line: 28, column: 26, scope: !80)
!86 = !DILocalVariable(name: "p", scope: !80, file: !1, line: 28, type: !5)
!87 = !DILocation(line: 29, column: 3, scope: !80)
!88 = !DILocation(line: 29, column: 23, scope: !80)
!89 = !DILocation(line: 29, column: 35, scope: !80)
!90 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!91 = !DILocalVariable(name: "ok", scope: !80, file: !1, line: 29, type: !90)
!92 = !DILocation(line: 30, column: 3, scope: !80)
!93 = !DILocation(line: 30, column: 20, scope: !80)
!94 = !DILocalVariable(name: "big", scope: !80, file: !1, line: 30, type: !48)
!95 = !DILocation(line: 31, column: 3, scope: !80)
!96 = !DILocation(line: 31, column: 22, scope: !80)
!97 = !DIBasicType(name: "double", size: 64, encoding: DW_ATE_float)
!98 = !DILocalVariable(name: "ratio", scope: !80, file: !1, line: 31, type: !97)
!99 = !DILocation(line: 32, column: 3, scope: !80)
!100 = !DILocation(line: 32, column: 13, scope: !80)
!101 = !DILocation(line: 32, column: 19, scope: !80)
!102 = !DILocation(line: 32, column: 22, scope: !80)
!103 = !DILocalVariable(name: "s", scope: !80, file: !1, line: 32, type: !36)
!104 = !DILocation(line: 33, column: 3, scope: !80)
!105 = !DILocation(line: 33, column: 13, scope: !80)
!106 = !DILocation(line: 33, column: 19, scope: !80)
!107 = !DILocation(line: 33, column: 20, scope: !80)
!108 = !DILocation(line: 33, column: 23, scope: !80)
!109 = !DILocation(line: 33, column: 26, scope: !80)
!110 = !DILocalVariable(name: "t", scope: !80, file: !1, line: 33, type: !6)
!111 = !DILocation(line: 34, column: 3, scope: !80)
!112 = !DILocation(line: 34, column: 7, scope: !80)
!113 = !DILocation(line: 34, column: 13, scope: !80)
!114 = !DILocation(line: 34, column: 21, scope: !80)
!115 = !DILocation(line: 34, column: 26, scope: !80)
!116 = !DILocation(line: 34, column: 34, scope: !80)
!117 = !DILocation(line: 34, column: 41, scope: !80)
!118 = !DILocation(line: 34, column: 54, scope: !80)
!119 = !DILocation(line: 34, column: 57, scope: !80)
!120 = !DILocation(line: 35, column: 5, scope: !80)
!121 = !DILocation(line: 35, column: 12, scope: !80)
!122 = !DILocation(line: 35, column: 16, scope: !80)
!123 = !DILocation(line: 37, column: 3, scope: !80)
!124 = !DILocation(line: 37, column: 10, scope: !80)
