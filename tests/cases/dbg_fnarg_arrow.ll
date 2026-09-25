declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 !dbg !7 {
entry:
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = call i32 @apply$fn.16.nish_main$arrow0(i32 41), !dbg !11
  %1 = call i8* @nish_str_from_i32(i32 %0), !dbg !10
  call void @nish_print(i8* %1), !dbg !9
  call void @nish_arena_release(i64 %arena.mark), !dbg !13
  ret i32 0, !dbg !13
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %x) #1 !dbg !17 {
entry:
  call void @llvm.dbg.value(metadata i32 %x, metadata !19, metadata !DIExpression()), !dbg !18
  %0 = add nsw i32 %x, 1, !dbg !20
  ret i32 %0, !dbg !18
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(i32 noundef %x) #1 !dbg !22 {
entry:
  call void @llvm.dbg.value(metadata i32 %x, metadata !24, metadata !DIExpression()), !dbg !23
  %0 = tail call i32 @nish_main$arrow0(i32 %x), !dbg !25
  ret i32 %0, !dbg !23
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 !dbg !27 {
entry:
  %0 = call i32 @nish_main(), !dbg !28
  call void @nish_free_arena(), !dbg !28
  ret i32 %0, !dbg !28
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_fnarg_arrow.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 6, type: !6, scopeLine: 6, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 6, column: 1, scope: !7)
!9 = !DILocation(line: 7, column: 3, scope: !7)
!10 = !DILocation(line: 7, column: 15, scope: !7)
!11 = !DILocation(line: 7, column: 18, scope: !7)
!12 = !DILocation(line: 7, column: 38, scope: !7)
!13 = !DILocation(line: 8, column: 3, scope: !7)
!14 = !DILocation(line: 8, column: 10, scope: !7)
!15 = !{!4, !4}
!16 = !DISubroutineType(types: !15)
!17 = distinct !DISubprogram(name: "(x) => ...", linkageName: "nish_main$arrow0", scope: !1, file: !1, line: 7, type: !16, scopeLine: 7, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!18 = !DILocation(line: 7, column: 24, scope: !17)
!19 = !DILocalVariable(name: "x", arg: 1, scope: !17, file: !1, line: 7, type: !4)
!20 = !DILocation(line: 7, column: 31, scope: !17)
!21 = !DILocation(line: 7, column: 35, scope: !17)
!22 = distinct !DISubprogram(name: "apply<(x) => ...>", linkageName: "apply$fn.16.nish_main$arrow0", scope: !1, file: !1, line: 4, type: !16, scopeLine: 4, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!23 = !DILocation(line: 4, column: 1, scope: !22)
!24 = !DILocalVariable(name: "x", arg: 1, scope: !22, file: !1, line: 4, type: !4)
!25 = !DILocation(line: 4, column: 52, scope: !22)
!26 = !DILocation(line: 4, column: 54, scope: !22)
!27 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 6, type: !6, scopeLine: 6, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!28 = !DILocation(line: 6, column: 1, scope: !27)
