declare i8* @malloc(i64)
declare void @free(i8*)
declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)

define noundef i32 @test() #0 !dbg !7 {
entry:
  %block.addr = alloca i8*, align 8
  %held.addr = alloca i8*, align 8
  %0 = call i8* @malloc(i64 32), !dbg !10
  store i8* %0, i8** %block.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata i8** %block.addr, metadata !13, metadata !DIExpression()), !dbg !9
  %1 = load i8*, i8** %block.addr, align 8, !dbg !15
  %2 = icmp eq i8* %1, null, !dbg !15
  br i1 %2, label %if.then, label %if.end, !dbg !14

if.then:
  ret i32 1, !dbg !18

if.end:
  %3 = load i8*, i8** %block.addr, align 8, !dbg !21
  store i8* %3, i8** %held.addr, align 8, !dbg !20
  call void @llvm.dbg.declare(metadata i8** %held.addr, metadata !22, metadata !DIExpression()), !dbg !20
  %4 = load i8*, i8** %held.addr, align 8, !dbg !24
  call void @free(i8* %4), !dbg !23
  ret i32 0, !dbg !25
}

attributes #0 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_cptr.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 16, type: !6, scopeLine: 16, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 16, column: 1, scope: !7)
!9 = !DILocation(line: 17, column: 3, scope: !7)
!10 = !DILocation(line: 17, column: 17, scope: !7)
!11 = !DILocation(line: 17, column: 24, scope: !7)
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: null, size: 64)
!13 = !DILocalVariable(name: "block", scope: !7, file: !1, line: 17, type: !12)
!14 = !DILocation(line: 18, column: 3, scope: !7)
!15 = !DILocation(line: 18, column: 7, scope: !7)
!16 = !DILocation(line: 18, column: 17, scope: !7)
!17 = !DILocation(line: 18, column: 23, scope: !7)
!18 = !DILocation(line: 19, column: 5, scope: !7)
!19 = !DILocation(line: 19, column: 12, scope: !7)
!20 = !DILocation(line: 24, column: 3, scope: !7)
!21 = !DILocation(line: 24, column: 16, scope: !7)
!22 = !DILocalVariable(name: "held", scope: !7, file: !1, line: 24, type: !12)
!23 = !DILocation(line: 25, column: 3, scope: !7)
!24 = !DILocation(line: 25, column: 8, scope: !7)
!25 = !DILocation(line: 26, column: 3, scope: !7)
!26 = !DILocation(line: 26, column: 10, scope: !7)
