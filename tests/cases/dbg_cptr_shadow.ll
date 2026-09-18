%struct.CPtr = type { i32 }

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare i8* @malloc(i64)
declare void @free(i8*)
declare void @llvm.dbg.declare(metadata, metadata, metadata)

define internal void @CPtr.constructor(%struct.CPtr* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 !dbg !11 {
entry:
  call void @llvm.dbg.value(metadata %struct.CPtr* %this, metadata !13, metadata !DIExpression()), !dbg !12
  call void @llvm.dbg.value(metadata i32 %n, metadata !14, metadata !DIExpression()), !dbg !12
  %0 = getelementptr inbounds %struct.CPtr, %struct.CPtr* %this, i32 0, i32 0, !dbg !15
  store i32 %n, i32* %0, align 4, !tbaa !21, !dbg !15
  ret void, !dbg !12
}

define noundef i32 @test() #1 !dbg !24 {
entry:
  %count.addr = alloca %struct.CPtr*, align 8
  %CPtr.obj = alloca %struct.CPtr, align 8
  %raw.addr = alloca i8*, align 8
  call void @CPtr.constructor(%struct.CPtr* %CPtr.obj, i32 7), !dbg !27
  store %struct.CPtr* %CPtr.obj, %struct.CPtr** %count.addr, align 8, !dbg !26
  call void @llvm.dbg.declare(metadata %struct.CPtr** %count.addr, metadata !29, metadata !DIExpression()), !dbg !26
  %0 = call i8* @malloc(i64 16), !dbg !31
  store i8* %0, i8** %raw.addr, align 8, !dbg !30
  call void @llvm.dbg.declare(metadata i8** %raw.addr, metadata !34, metadata !DIExpression()), !dbg !30
  %1 = load i8*, i8** %raw.addr, align 8, !dbg !36
  %2 = icmp eq i8* %1, null, !dbg !36
  br i1 %2, label %if.then, label %if.end, !dbg !35

if.then:
  ret i32 0, !dbg !39

if.end:
  %3 = load i8*, i8** %raw.addr, align 8, !dbg !42
  call void @free(i8* %3), !dbg !41
  %4 = load %struct.CPtr*, %struct.CPtr** %count.addr, align 8, !dbg !44
  %5 = getelementptr inbounds %struct.CPtr, %struct.CPtr* %4, i32 0, i32 0, !dbg !44
  %6 = load i32, i32* %5, align 4, !tbaa !21, !dbg !44
  ret i32 %6, !dbg !43
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_cptr_shadow.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "CPtr", file: !1, line: 13, size: 32, align: 32, elements: !8)
!5 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!6 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!7 = !DIDerivedType(tag: DW_TAG_member, name: "n", scope: !4, file: !1, line: 14, baseType: !6, size: 32, offset: 0)
!8 = !{!7}
!9 = !{null, !5, !6}
!10 = !DISubroutineType(types: !9)
!11 = distinct !DISubprogram(name: "CPtr.constructor", linkageName: "CPtr.constructor", scope: !1, file: !1, line: 16, type: !10, scopeLine: 16, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!12 = !DILocation(line: 16, column: 3, scope: !11)
!13 = !DILocalVariable(name: "this", arg: 1, scope: !11, file: !1, line: 16, type: !5, flags: DIFlagArtificial | DIFlagObjectPointer)
!14 = !DILocalVariable(name: "n", arg: 2, scope: !11, file: !1, line: 16, type: !6)
!15 = !DILocation(line: 17, column: 5, scope: !11)
!16 = !DILocation(line: 17, column: 14, scope: !11)
!17 = !{!"nish TBAA"}
!18 = !{!"omnipotent char", !17, i64 0}
!19 = !{!"i32", !18, i64 0}
!20 = !{!"CPtr", !19, i64 0}
!21 = !{!20, !19, i64 0}
!22 = !{!6}
!23 = !DISubroutineType(types: !22)
!24 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 24, type: !23, scopeLine: 24, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!25 = !DILocation(line: 24, column: 1, scope: !24)
!26 = !DILocation(line: 25, column: 3, scope: !24)
!27 = !DILocation(line: 25, column: 17, scope: !24)
!28 = !DILocation(line: 25, column: 26, scope: !24)
!29 = !DILocalVariable(name: "count", scope: !24, file: !1, line: 25, type: !5)
!30 = !DILocation(line: 26, column: 3, scope: !24)
!31 = !DILocation(line: 26, column: 15, scope: !24)
!32 = !DILocation(line: 26, column: 22, scope: !24)
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: null, size: 64)
!34 = !DILocalVariable(name: "raw", scope: !24, file: !1, line: 26, type: !33)
!35 = !DILocation(line: 27, column: 3, scope: !24)
!36 = !DILocation(line: 27, column: 7, scope: !24)
!37 = !DILocation(line: 27, column: 15, scope: !24)
!38 = !DILocation(line: 27, column: 21, scope: !24)
!39 = !DILocation(line: 28, column: 5, scope: !24)
!40 = !DILocation(line: 28, column: 12, scope: !24)
!41 = !DILocation(line: 30, column: 3, scope: !24)
!42 = !DILocation(line: 30, column: 8, scope: !24)
!43 = !DILocation(line: 31, column: 3, scope: !24)
!44 = !DILocation(line: 31, column: 10, scope: !24)
