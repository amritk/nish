%struct.Box$i32 = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"two\00" }, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)

define noundef i32 @test() #0 !dbg !7 {
entry:
  %b.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 40), !dbg !10
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %b.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Box$i32** %b.addr, metadata !16, metadata !DIExpression()), !dbg !9
  %0 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8, !dbg !18
  %1 = call i32 @Box$i32.pair$str(%struct.Box$i32* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*)), !dbg !18
  %2 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8, !dbg !20
  %3 = call i32 @Box$i32.pair$i32(%struct.Box$i32* %2, i32 2), !dbg !20
  %4 = add nsw i32 %1, %3, !dbg !18
  ret i32 %4, !dbg !17
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #0 !dbg !24 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$i32* %this, metadata !26, metadata !DIExpression()), !dbg !25
  call void @llvm.dbg.value(metadata i32 %value, metadata !27, metadata !DIExpression()), !dbg !25
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0, !dbg !28
  store i32 %value, i32* %0, align 4, !tbaa !34, !dbg !28
  ret void, !dbg !25
}

define internal noundef i32 @Box$i32.pair$str(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i8* noundef nonnull noalias readonly align 8 %other) #1 !dbg !39 {
entry:
  %kept.addr = alloca i8*, align 8
  call void @llvm.dbg.value(metadata %struct.Box$i32* %this, metadata !41, metadata !DIExpression()), !dbg !40
  call void @llvm.dbg.value(metadata i8* %other, metadata !42, metadata !DIExpression()), !dbg !40
  store i8* %other, i8** %kept.addr, align 8, !dbg !43
  call void @llvm.dbg.declare(metadata i8** %kept.addr, metadata !45, metadata !DIExpression()), !dbg !43
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0, !dbg !47
  %1 = load i32, i32* %0, align 4, !tbaa !34, !dbg !47
  ret i32 %1, !dbg !46
}

define internal noundef i32 @Box$i32.pair$i32(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %other) #1 !dbg !50 {
entry:
  %kept.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata %struct.Box$i32* %this, metadata !52, metadata !DIExpression()), !dbg !51
  call void @llvm.dbg.value(metadata i32 %other, metadata !53, metadata !DIExpression()), !dbg !51
  store i32 %other, i32* %kept.addr, align 4, !dbg !54
  call void @llvm.dbg.declare(metadata i32* %kept.addr, metadata !56, metadata !DIExpression()), !dbg !54
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0, !dbg !58
  %1 = load i32, i32* %0, align 4, !tbaa !34, !dbg !58
  ret i32 %1, !dbg !57
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_generic_method.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 19, type: !6, scopeLine: 19, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 19, column: 1, scope: !7)
!9 = !DILocation(line: 20, column: 3, scope: !7)
!10 = !DILocation(line: 20, column: 13, scope: !7)
!11 = !DILocation(line: 20, column: 26, scope: !7)
!12 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Box<i32>", file: !1, line: 6, size: 32, align: 32, elements: !15)
!13 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !12, size: 64)
!14 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !12, file: !1, line: 7, baseType: !4, size: 32, offset: 0)
!15 = !{!14}
!16 = !DILocalVariable(name: "b", scope: !7, file: !1, line: 20, type: !13)
!17 = !DILocation(line: 21, column: 3, scope: !7)
!18 = !DILocation(line: 21, column: 10, scope: !7)
!19 = !DILocation(line: 21, column: 17, scope: !7)
!20 = !DILocation(line: 21, column: 26, scope: !7)
!21 = !DILocation(line: 21, column: 33, scope: !7)
!22 = !{null, !13, !4}
!23 = !DISubroutineType(types: !22)
!24 = distinct !DISubprogram(name: "Box<i32>.constructor", linkageName: "Box$i32.constructor", scope: !1, file: !1, line: 9, type: !23, scopeLine: 9, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!25 = !DILocation(line: 9, column: 3, scope: !24)
!26 = !DILocalVariable(name: "this", arg: 1, scope: !24, file: !1, line: 9, type: !13, flags: DIFlagArtificial | DIFlagObjectPointer)
!27 = !DILocalVariable(name: "value", arg: 2, scope: !24, file: !1, line: 9, type: !4)
!28 = !DILocation(line: 10, column: 5, scope: !24)
!29 = !DILocation(line: 10, column: 18, scope: !24)
!30 = !{!"nish TBAA"}
!31 = !{!"omnipotent char", !30, i64 0}
!32 = !{!"i32", !31, i64 0}
!33 = !{!"Box$i32", !32, i64 0}
!34 = !{!33, !32, i64 0}
!35 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!36 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !35, size: 64)
!37 = !{!4, !13, !36}
!38 = !DISubroutineType(types: !37)
!39 = distinct !DISubprogram(name: "Box<i32>.pair<string>", linkageName: "Box$i32.pair$str", scope: !1, file: !1, line: 13, type: !38, scopeLine: 13, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!40 = !DILocation(line: 13, column: 3, scope: !39)
!41 = !DILocalVariable(name: "this", arg: 1, scope: !39, file: !1, line: 13, type: !13, flags: DIFlagArtificial | DIFlagObjectPointer)
!42 = !DILocalVariable(name: "other", arg: 2, scope: !39, file: !1, line: 13, type: !36)
!43 = !DILocation(line: 14, column: 5, scope: !39)
!44 = !DILocation(line: 14, column: 21, scope: !39)
!45 = !DILocalVariable(name: "kept", scope: !39, file: !1, line: 14, type: !36)
!46 = !DILocation(line: 15, column: 5, scope: !39)
!47 = !DILocation(line: 15, column: 12, scope: !39)
!48 = !{!4, !13, !4}
!49 = !DISubroutineType(types: !48)
!50 = distinct !DISubprogram(name: "Box<i32>.pair<i32>", linkageName: "Box$i32.pair$i32", scope: !1, file: !1, line: 13, type: !49, scopeLine: 13, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!51 = !DILocation(line: 13, column: 3, scope: !50)
!52 = !DILocalVariable(name: "this", arg: 1, scope: !50, file: !1, line: 13, type: !13, flags: DIFlagArtificial | DIFlagObjectPointer)
!53 = !DILocalVariable(name: "other", arg: 2, scope: !50, file: !1, line: 13, type: !4)
!54 = !DILocation(line: 14, column: 5, scope: !50)
!55 = !DILocation(line: 14, column: 21, scope: !50)
!56 = !DILocalVariable(name: "kept", scope: !50, file: !1, line: 14, type: !4)
!57 = !DILocation(line: 15, column: 5, scope: !50)
!58 = !DILocation(line: 15, column: 12, scope: !50)
