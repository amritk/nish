@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\E2\80\94\00" }, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 !dbg !7 {
entry:
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark(), !dbg !8
  %0 = bitcast i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*) to i64*, !dbg !10
  %1 = load i64, i64* %0, align 8, !dbg !10
  %2 = trunc i64 %1 to i32, !dbg !10
  %3 = add nsw i32 %2, 8, !dbg !10
  store i32 %3, i32* %n.addr, align 4, !dbg !9
  call void @llvm.dbg.declare(metadata i32* %n.addr, metadata !12, metadata !DIExpression()), !dbg !9
  %4 = load i32, i32* %n.addr, align 4, !dbg !15
  %5 = call i8* @nish_str_from_i32(i32 %4), !dbg !14
  call void @nish_print(i8* %5), !dbg !13
  %6 = load i32, i32* %n.addr, align 4, !dbg !17
  %7 = sub nsw i32 %6, 11, !dbg !17
  call void @nish_arena_release(i64 %arena.mark), !dbg !16
  ret i32 %7, !dbg !16
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 !dbg !19 {
entry:
  %0 = call i32 @nish_main(), !dbg !20
  call void @nish_free_arena(), !dbg !20
  ret i32 %0, !dbg !20
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_utf8.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 12, type: !6, scopeLine: 12, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 12, column: 1, scope: !7)
!9 = !DILocation(line: 13, column: 3, scope: !7)
!10 = !DILocation(line: 13, column: 13, scope: !7)
!11 = !DILocation(line: 13, column: 28, scope: !7)
!12 = !DILocalVariable(name: "n", scope: !7, file: !1, line: 13, type: !4)
!13 = !DILocation(line: 14, column: 3, scope: !7)
!14 = !DILocation(line: 14, column: 15, scope: !7)
!15 = !DILocation(line: 14, column: 18, scope: !7)
!16 = !DILocation(line: 15, column: 3, scope: !7)
!17 = !DILocation(line: 15, column: 10, scope: !7)
!18 = !DILocation(line: 15, column: 14, scope: !7)
!19 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 12, type: !6, scopeLine: 12, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!20 = !DILocation(line: 12, column: 1, scope: !19)
