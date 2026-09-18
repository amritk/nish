declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)

define internal noundef i32 @weight(i32 noundef %k) #0 !dbg !12 {
entry:
  %w.addr = alloca i32, align 4
  call void @llvm.dbg.value(metadata i32 %k, metadata !14, metadata !DIExpression()), !dbg !13
  store i32 %k, i32* %w.addr, align 4, !dbg !15
  call void @llvm.dbg.declare(metadata i32* %w.addr, metadata !17, metadata !DIExpression()), !dbg !15
  %0 = load i32, i32* %w.addr, align 4, !dbg !19
  switch i32 %0, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ], !dbg !18

sw.case:
  ret i32 10, !dbg !20

sw.case.1:
  ret i32 20, !dbg !22

sw.default:
  ret i32 30, !dbg !24
}

define noundef i32 @test() #0 !dbg !28 {
entry:
  %0 = tail call i32 @weight(i32 2), !dbg !31
  ret i32 %0, !dbg !30
}

attributes #0 = { nounwind willreturn readnone }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_enum.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !DIEnumerator(name: "If", value: 1)
!6 = !DIEnumerator(name: "While", value: 2)
!7 = !DIEnumerator(name: "Return", value: 3)
!8 = !{!5, !6, !7}
!9 = !DICompositeType(tag: DW_TAG_enumeration_type, name: "Kind", file: !1, line: 10, size: 32, align: 32, elements: !8, baseType: !4)
!10 = !{!4, !9}
!11 = !DISubroutineType(types: !10)
!12 = distinct !DISubprogram(name: "weight", linkageName: "weight", scope: !1, file: !1, line: 16, type: !11, scopeLine: 16, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!13 = !DILocation(line: 16, column: 1, scope: !12)
!14 = !DILocalVariable(name: "k", arg: 1, scope: !12, file: !1, line: 16, type: !9)
!15 = !DILocation(line: 17, column: 3, scope: !12)
!16 = !DILocation(line: 17, column: 19, scope: !12)
!17 = !DILocalVariable(name: "w", scope: !12, file: !1, line: 17, type: !9)
!18 = !DILocation(line: 18, column: 3, scope: !12)
!19 = !DILocation(line: 18, column: 11, scope: !12)
!20 = !DILocation(line: 20, column: 7, scope: !12)
!21 = !DILocation(line: 20, column: 14, scope: !12)
!22 = !DILocation(line: 22, column: 7, scope: !12)
!23 = !DILocation(line: 22, column: 14, scope: !12)
!24 = !DILocation(line: 24, column: 7, scope: !12)
!25 = !DILocation(line: 24, column: 14, scope: !12)
!26 = !{!4}
!27 = !DISubroutineType(types: !26)
!28 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 28, type: !27, scopeLine: 28, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!29 = !DILocation(line: 28, column: 1, scope: !28)
!30 = !DILocation(line: 29, column: 3, scope: !28)
!31 = !DILocation(line: 29, column: 10, scope: !28)
!32 = !DILocation(line: 29, column: 17, scope: !28)
