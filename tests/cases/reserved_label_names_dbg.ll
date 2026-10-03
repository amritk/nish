%struct.Tally = type { i32 }
%struct.nish_result.i32.bool = type { i1, i32, i1 }

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @next(i32 noundef %entry.param) #0 !dbg !7 {
entry:
  call void @llvm.dbg.value(metadata i32 %entry.param, metadata !9, metadata !DIExpression()), !dbg !8
  %0 = add nsw i32 %entry.param, 1, !dbg !10
  ret i32 %0, !dbg !8
}

define internal noundef i32 @counted() #0 !dbg !14 {
entry:
  %entry.addr = alloca i32, align 4
  store i32 4, i32* %entry.addr, align 4, !dbg !16
  call void @llvm.dbg.declare(metadata i32* %entry.addr, metadata !18, metadata !DIExpression()), !dbg !16
  %0 = load i32, i32* %entry.addr, align 4, !dbg !19
  %1 = add nsw i32 %0, 1, !dbg !19
  store i32 %1, i32* %entry.addr, align 4, !dbg !19
  %2 = load i32, i32* %entry.addr, align 4, !dbg !22
  ret i32 %2, !dbg !21
}

define internal noundef nonnull align 8 i8* @letter(i32 noundef %chr.param) #1 !dbg !27 {
entry:
  %chr = alloca i8, align 1
  call void @llvm.dbg.value(metadata i32 %chr.param, metadata !29, metadata !DIExpression()), !dbg !28
  %0 = sext i32 %chr.param to i64, !dbg !30
  %1 = trunc i64 %0 to i8, !dbg !30
  store i8 %1, i8* %chr, align 1, !dbg !30
  %2 = call i8* @nish_str_new(i8* %chr, i64 1), !dbg !30
  ret i8* %2, !dbg !28
}

define internal { i1, i32, i32 } @parse(i32 noundef %n) #1 !dbg !43 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  %nish_result.i32.bool.obj.1 = alloca %struct.nish_result.i32.bool, align 8
  call void @llvm.dbg.value(metadata i32 %n, metadata !45, metadata !DIExpression()), !dbg !44
  %0 = icmp slt i32 %n, 0, !dbg !47
  br i1 %0, label %cond.true, label %cond.false, !dbg !47

cond.true:
  %1 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0, !dbg !49
  store i1 false, i1* %1, align 1, !dbg !49
  %2 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2, !dbg !49
  store i1 false, i1* %2, align 1, !dbg !49
  br label %cond.end, !dbg !47

cond.false:
  %3 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj.1, i32 0, i32 0, !dbg !51
  store i1 true, i1* %3, align 1, !dbg !51
  %4 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj.1, i32 0, i32 1, !dbg !51
  store i32 %n, i32* %4, align 4, !dbg !51
  br label %cond.end, !dbg !47

cond.end:
  %5 = phi %struct.nish_result.i32.bool* [ %nish_result.i32.bool.obj, %cond.true ], [ %nish_result.i32.bool.obj.1, %cond.false ], !dbg !47
  %6 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 0, !dbg !44
  %7 = load i1, i1* %6, align 1, !dbg !44
  %8 = insertvalue { i1, i32, i32 } undef, i1 %7, 0, !dbg !44
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 2, !dbg !44
  %10 = load i1, i1* %9, align 1, !dbg !44
  %11 = zext i1 %10 to i32, !dbg !44
  %12 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 1, !dbg !44
  %13 = load i32, i32* %12, align 4, !dbg !44
  %14 = insertvalue { i1, i32, i32 } %8, i32 %13, 1, !dbg !44
  %15 = insertvalue { i1, i32, i32 } %14, i32 %11, 2, !dbg !44
  ret { i1, i32, i32 } %15, !dbg !44
}

define internal noundef i32 @orZero({ i1, i32, i32 } %entry.param) #2 !dbg !55 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  call void @llvm.dbg.value(metadata { i1, i32, i32 } %entry.param, metadata !57, metadata !DIExpression()), !dbg !56
  %0 = extractvalue { i1, i32, i32 } %entry.param, 0, !dbg !56
  %1 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0, !dbg !56
  store i1 %0, i1* %1, align 1, !dbg !56
  %2 = extractvalue { i1, i32, i32 } %entry.param, 1, !dbg !56
  %3 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1, !dbg !56
  store i32 %2, i32* %3, align 4, !dbg !56
  %4 = extractvalue { i1, i32, i32 } %entry.param, 2, !dbg !56
  %5 = trunc i32 %4 to i1, !dbg !56
  %6 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2, !dbg !56
  store i1 %5, i1* %6, align 1, !dbg !56
  %7 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0, !dbg !58
  %8 = load i1, i1* %7, align 1, !dbg !58
  br i1 %8, label %res.ok, label %res.alt, !dbg !58

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1, !dbg !58
  %10 = load i32, i32* %9, align 4, !dbg !58
  br label %res.end, !dbg !58

res.alt:
  br label %res.end, !dbg !58

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ 0, %res.alt ], !dbg !58
  ret i32 %11, !dbg !56
}

define internal void @Tally.constructor(%struct.Tally* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %entry.param) #1 !dbg !66 {
entry:
  call void @llvm.dbg.value(metadata %struct.Tally* %this, metadata !68, metadata !DIExpression()), !dbg !67
  call void @llvm.dbg.value(metadata i32 %entry.param, metadata !69, metadata !DIExpression()), !dbg !67
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0, !dbg !70
  store i32 %entry.param, i32* %0, align 4, !tbaa !76, !dbg !70
  ret void, !dbg !67
}

define internal noundef i32 @Tally.plus(%struct.Tally* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %entry.param) #3 !dbg !79 {
entry:
  call void @llvm.dbg.value(metadata %struct.Tally* %this, metadata !81, metadata !DIExpression()), !dbg !80
  call void @llvm.dbg.value(metadata i32 %entry.param, metadata !82, metadata !DIExpression()), !dbg !80
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0, !dbg !84
  %1 = load i32, i32* %0, align 4, !tbaa !76, !dbg !84
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %entry.param), !dbg !84
  %3 = extractvalue { i32, i1 } %2, 0, !dbg !84
  %4 = extractvalue { i32, i1 } %2, 1, !dbg !84
  br i1 %4, label %ovf.fail, label %ovf.ok, !dbg !84

ovf.ok:
  ret i32 %3, !dbg !83

ovf.fail:
  call void @nish_panic_overflow(i32 0), !dbg !84
  unreachable
}

define noundef i32 @nish_main() #3 !dbg !86 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  %Tally.obj = alloca %struct.Tally, align 8
  %arena.mark = call i64 @nish_arena_mark(), !dbg !87
  %0 = call i32 @next(i32 1), !dbg !89
  %1 = call i8* @nish_str_from_i32(i32 %0), !dbg !88
  call void @nish_print(i8* %1), !dbg !88
  %2 = call i32 @counted(), !dbg !92
  %3 = call i8* @nish_str_from_i32(i32 %2), !dbg !91
  call void @nish_print(i8* %3), !dbg !91
  %4 = call i64 @nish_arena_mark(), !dbg !94
  %5 = call i8* @letter(i32 65), !dbg !94
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5), !dbg !94
  call void @nish_print(i8* %6), !dbg !93
  %7 = call { i1, i32, i32 } @parse(i32 7), !dbg !98
  %8 = extractvalue { i1, i32, i32 } %7, 0, !dbg !98
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0, !dbg !98
  store i1 %8, i1* %9, align 1, !dbg !98
  %10 = extractvalue { i1, i32, i32 } %7, 1, !dbg !98
  %11 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1, !dbg !98
  store i32 %10, i32* %11, align 4, !dbg !98
  %12 = extractvalue { i1, i32, i32 } %7, 2, !dbg !98
  %13 = trunc i32 %12 to i1, !dbg !98
  %14 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2, !dbg !98
  store i1 %13, i1* %14, align 1, !dbg !98
  %15 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0, !dbg !97
  %16 = load i1, i1* %15, align 1, !dbg !97
  %17 = insertvalue { i1, i32, i32 } undef, i1 %16, 0, !dbg !97
  %18 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2, !dbg !97
  %19 = load i1, i1* %18, align 1, !dbg !97
  %20 = zext i1 %19 to i32, !dbg !97
  %21 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1, !dbg !97
  %22 = load i32, i32* %21, align 4, !dbg !97
  %23 = insertvalue { i1, i32, i32 } %17, i32 %22, 1, !dbg !97
  %24 = insertvalue { i1, i32, i32 } %23, i32 %20, 2, !dbg !97
  %25 = call i32 @orZero({ i1, i32, i32 } %24), !dbg !97
  %26 = call i8* @nish_str_from_i32(i32 %25), !dbg !96
  call void @nish_print(i8* %26), !dbg !96
  call void @Tally.constructor(%struct.Tally* %Tally.obj, i32 2), !dbg !101
  %27 = call i32 @Tally.plus(%struct.Tally* %Tally.obj, i32 3), !dbg !101
  %28 = call i8* @nish_str_from_i32(i32 %27), !dbg !100
  call void @nish_print(i8* %28), !dbg !100
  call void @nish_arena_release(i64 %arena.mark), !dbg !104
  ret i32 0, !dbg !104
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 !dbg !106 {
entry:
  %0 = call i32 @nish_main(), !dbg !107
  call void @nish_free_arena(), !dbg !107
  ret i32 %0, !dbg !107
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }
attributes #4 = { nounwind noreturn cold }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/reserved_label_names_dbg.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4, !4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "next", linkageName: "next", scope: !1, file: !1, line: 8, type: !6, scopeLine: 8, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!8 = !DILocation(line: 8, column: 1, scope: !7)
!9 = !DILocalVariable(name: "entry", arg: 1, scope: !7, file: !1, line: 8, type: !4)
!10 = !DILocation(line: 8, column: 35, scope: !7)
!11 = !DILocation(line: 8, column: 43, scope: !7)
!12 = !{!4}
!13 = !DISubroutineType(types: !12)
!14 = distinct !DISubprogram(name: "counted", linkageName: "counted", scope: !1, file: !1, line: 10, type: !13, scopeLine: 10, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!15 = !DILocation(line: 10, column: 1, scope: !14)
!16 = !DILocation(line: 11, column: 3, scope: !14)
!17 = !DILocation(line: 11, column: 15, scope: !14)
!18 = !DILocalVariable(name: "entry", scope: !14, file: !1, line: 11, type: !4)
!19 = !DILocation(line: 12, column: 3, scope: !14)
!20 = !DILocation(line: 12, column: 12, scope: !14)
!21 = !DILocation(line: 13, column: 3, scope: !14)
!22 = !DILocation(line: 13, column: 10, scope: !14)
!23 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!24 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !23, size: 64)
!25 = !{!24, !4}
!26 = !DISubroutineType(types: !25)
!27 = distinct !DISubprogram(name: "letter", linkageName: "letter", scope: !1, file: !1, line: 16, type: !26, scopeLine: 16, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!28 = !DILocation(line: 16, column: 1, scope: !27)
!29 = !DILocalVariable(name: "chr", arg: 1, scope: !27, file: !1, line: 16, type: !4)
!30 = !DILocation(line: 16, column: 38, scope: !27)
!31 = !DILocation(line: 16, column: 58, scope: !27)
!32 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "nish_result.i32.bool.word", file: !1, size: 64, align: 32, elements: !40)
!33 = distinct !DICompositeType(tag: DW_TAG_union_type, name: "nish_result.i32.bool.arms", file: !1, size: 32, elements: !37)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !33, baseType: !4, size: 32, offset: 0)
!35 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!36 = !DIDerivedType(tag: DW_TAG_member, name: "error", scope: !33, baseType: !35, size: 8, offset: 0)
!37 = !{!34, !36}
!38 = !DIDerivedType(tag: DW_TAG_member, name: "ok", scope: !32, baseType: !4, size: 32, offset: 0)
!39 = !DIDerivedType(tag: DW_TAG_member, name: "as", scope: !32, baseType: !33, size: 32, offset: 32)
!40 = !{!38, !39}
!41 = !{!32, !4}
!42 = !DISubroutineType(types: !41)
!43 = distinct !DISubprogram(name: "parse", linkageName: "parse", scope: !1, file: !1, line: 18, type: !42, scopeLine: 18, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!44 = !DILocation(line: 18, column: 1, scope: !43)
!45 = !DILocalVariable(name: "n", arg: 1, scope: !43, file: !1, line: 18, type: !4)
!46 = !DILocation(line: 18, column: 49, scope: !43)
!47 = !DILocation(line: 18, column: 50, scope: !43)
!48 = !DILocation(line: 18, column: 54, scope: !43)
!49 = !DILocation(line: 18, column: 58, scope: !43)
!50 = !DILocation(line: 18, column: 62, scope: !43)
!51 = !DILocation(line: 18, column: 71, scope: !43)
!52 = !DILocation(line: 18, column: 74, scope: !43)
!53 = !{!4, !32}
!54 = !DISubroutineType(types: !53)
!55 = distinct !DISubprogram(name: "orZero", linkageName: "orZero", scope: !1, file: !1, line: 21, type: !54, scopeLine: 21, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!56 = !DILocation(line: 21, column: 1, scope: !55)
!57 = !DILocalVariable(name: "entry", arg: 1, scope: !55, file: !1, line: 21, type: !32)
!58 = !DILocation(line: 21, column: 54, scope: !55)
!59 = !DILocation(line: 21, column: 69, scope: !55)
!60 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Tally", file: !1, line: 23, size: 32, align: 32, elements: !63)
!61 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !60, size: 64)
!62 = !DIDerivedType(tag: DW_TAG_member, name: "entry", scope: !60, file: !1, line: 24, baseType: !4, size: 32, offset: 0)
!63 = !{!62}
!64 = !{null, !61, !4}
!65 = !DISubroutineType(types: !64)
!66 = distinct !DISubprogram(name: "Tally.constructor", linkageName: "Tally.constructor", scope: !1, file: !1, line: 26, type: !65, scopeLine: 26, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!67 = !DILocation(line: 26, column: 3, scope: !66)
!68 = !DILocalVariable(name: "this", arg: 1, scope: !66, file: !1, line: 26, type: !61, flags: DIFlagArtificial | DIFlagObjectPointer)
!69 = !DILocalVariable(name: "entry", arg: 2, scope: !66, file: !1, line: 26, type: !4)
!70 = !DILocation(line: 27, column: 5, scope: !66)
!71 = !DILocation(line: 27, column: 18, scope: !66)
!72 = !{!"nish TBAA"}
!73 = !{!"omnipotent char", !72, i64 0}
!74 = !{!"i32", !73, i64 0}
!75 = !{!"Tally", !74, i64 0}
!76 = !{!75, !74, i64 0}
!77 = !{!4, !61, !4}
!78 = !DISubroutineType(types: !77)
!79 = distinct !DISubprogram(name: "Tally.plus", linkageName: "Tally.plus", scope: !1, file: !1, line: 30, type: !78, scopeLine: 30, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!80 = !DILocation(line: 30, column: 3, scope: !79)
!81 = !DILocalVariable(name: "this", arg: 1, scope: !79, file: !1, line: 30, type: !61, flags: DIFlagArtificial | DIFlagObjectPointer)
!82 = !DILocalVariable(name: "entry", arg: 2, scope: !79, file: !1, line: 30, type: !4)
!83 = !DILocation(line: 31, column: 5, scope: !79)
!84 = !DILocation(line: 31, column: 12, scope: !79)
!85 = !DILocation(line: 31, column: 25, scope: !79)
!86 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 35, type: !13, scopeLine: 35, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!87 = !DILocation(line: 35, column: 1, scope: !86)
!88 = !DILocation(line: 36, column: 3, scope: !86)
!89 = !DILocation(line: 36, column: 15, scope: !86)
!90 = !DILocation(line: 36, column: 20, scope: !86)
!91 = !DILocation(line: 37, column: 3, scope: !86)
!92 = !DILocation(line: 37, column: 15, scope: !86)
!93 = !DILocation(line: 38, column: 3, scope: !86)
!94 = !DILocation(line: 38, column: 15, scope: !86)
!95 = !DILocation(line: 38, column: 22, scope: !86)
!96 = !DILocation(line: 39, column: 3, scope: !86)
!97 = !DILocation(line: 39, column: 15, scope: !86)
!98 = !DILocation(line: 39, column: 22, scope: !86)
!99 = !DILocation(line: 39, column: 28, scope: !86)
!100 = !DILocation(line: 40, column: 3, scope: !86)
!101 = !DILocation(line: 40, column: 15, scope: !86)
!102 = !DILocation(line: 40, column: 25, scope: !86)
!103 = !DILocation(line: 40, column: 33, scope: !86)
!104 = !DILocation(line: 41, column: 3, scope: !86)
!105 = !DILocation(line: 41, column: 10, scope: !86)
!106 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 35, type: !13, scopeLine: 35, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!107 = !DILocation(line: 35, column: 1, scope: !106)
