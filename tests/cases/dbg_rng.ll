%struct.Level = type { i32 }

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @brighter(i32 noundef %x) #0 !dbg !8 {
entry:
  call void @llvm.dbg.value(metadata i32 %x, metadata !10, metadata !DIExpression()), !dbg !9
  %0 = add nsw i32 %x, 1, !dbg !11
  ret i32 %0, !dbg !9
}

define noundef i32 @nish_main() #1 !dbg !15 {
entry:
  %l.addr = alloca %struct.Level*, align 8
  %Level.obj = alloca %struct.Level, align 8
  %b.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark(), !dbg !16
  %0 = getelementptr inbounds %struct.Level, %struct.Level* %Level.obj, i32 0, i32 0, !dbg !18
  store i32 0, i32* %0, align 4, !tbaa !23, !dbg !18
  store %struct.Level* %Level.obj, %struct.Level** %l.addr, align 8, !dbg !17
  call void @llvm.dbg.declare(metadata %struct.Level** %l.addr, metadata !28, metadata !DIExpression()), !dbg !17
  store i32 200, i32* %b.addr, align 4, !dbg !29
  call void @llvm.dbg.declare(metadata i32* %b.addr, metadata !31, metadata !DIExpression()), !dbg !29
  %1 = load %struct.Level*, %struct.Level** %l.addr, align 8, !dbg !32
  %2 = load i32, i32* %b.addr, align 4, !dbg !33
  %3 = getelementptr inbounds %struct.Level, %struct.Level* %1, i32 0, i32 0, !dbg !32
  store i32 %2, i32* %3, align 4, !tbaa !23, !dbg !32
  %4 = load %struct.Level*, %struct.Level** %l.addr, align 8, !dbg !37
  %5 = getelementptr inbounds %struct.Level, %struct.Level* %4, i32 0, i32 0, !dbg !37
  %6 = load i32, i32* %5, align 4, !tbaa !23, !dbg !37
  %7 = call i32 @brighter(i32 %6), !dbg !36
  %8 = call i8* @nish_str_from_i32(i32 %7), !dbg !35
  call void @nish_print(i8* %8), !dbg !34
  call void @nish_arena_release(i64 %arena.mark), !dbg !38
  ret i32 0, !dbg !38
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 !dbg !40 {
entry:
  %0 = call i32 @nish_main(), !dbg !41
  call void @nish_free_arena(), !dbg !41
  ret i32 %0, !dbg !41
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_rng.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !DIDerivedType(tag: DW_TAG_typedef, name: "integer<0, 255>", file: !1, baseType: !4)
!6 = !{!4, !5}
!7 = !DISubroutineType(types: !6)
!8 = distinct !DISubprogram(name: "brighter", linkageName: "brighter", scope: !1, file: !1, line: 9, type: !7, scopeLine: 9, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!9 = !DILocation(line: 9, column: 1, scope: !8)
!10 = !DILocalVariable(name: "x", arg: 1, scope: !8, file: !1, line: 9, type: !5)
!11 = !DILocation(line: 9, column: 47, scope: !8)
!12 = !DILocation(line: 9, column: 51, scope: !8)
!13 = !{!4}
!14 = !DISubroutineType(types: !13)
!15 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 11, type: !14, scopeLine: 11, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!16 = !DILocation(line: 11, column: 1, scope: !15)
!17 = !DILocation(line: 12, column: 3, scope: !15)
!18 = !DILocation(line: 12, column: 13, scope: !15)
!19 = !{!"nish TBAA"}
!20 = !{!"omnipotent char", !19, i64 0}
!21 = !{!"i32", !20, i64 0}
!22 = !{!"Level", !21, i64 0}
!23 = !{!22, !21, i64 0}
!24 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Level", file: !1, line: 5, size: 32, align: 32, elements: !27)
!25 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !24, size: 64)
!26 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !24, file: !1, line: 6, baseType: !5, size: 32, offset: 0)
!27 = !{!26}
!28 = !DILocalVariable(name: "l", scope: !15, file: !1, line: 12, type: !25)
!29 = !DILocation(line: 13, column: 3, scope: !15)
!30 = !DILocation(line: 13, column: 30, scope: !15)
!31 = !DILocalVariable(name: "b", scope: !15, file: !1, line: 13, type: !5)
!32 = !DILocation(line: 14, column: 3, scope: !15)
!33 = !DILocation(line: 14, column: 13, scope: !15)
!34 = !DILocation(line: 15, column: 3, scope: !15)
!35 = !DILocation(line: 15, column: 15, scope: !15)
!36 = !DILocation(line: 15, column: 18, scope: !15)
!37 = !DILocation(line: 15, column: 27, scope: !15)
!38 = !DILocation(line: 16, column: 3, scope: !15)
!39 = !DILocation(line: 16, column: 10, scope: !15)
!40 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 11, type: !14, scopeLine: 11, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!41 = !DILocation(line: 11, column: 1, scope: !40)
