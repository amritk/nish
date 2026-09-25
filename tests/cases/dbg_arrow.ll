%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 !dbg !7 {
entry:
  call void @llvm.dbg.value(metadata i32 %a, metadata !9, metadata !DIExpression()), !dbg !8
  call void @llvm.dbg.value(metadata i32 %b, metadata !10, metadata !DIExpression()), !dbg !8
  %0 = add nsw i32 %a, %b, !dbg !11
  ret i32 %0, !dbg !8
}

define internal noundef i32 @span(i32 noundef %lo, i32 noundef %hi) #0 !dbg !13 {
entry:
  call void @llvm.dbg.value(metadata i32 %lo, metadata !15, metadata !DIExpression()), !dbg !14
  call void @llvm.dbg.value(metadata i32 %hi, metadata !16, metadata !DIExpression()), !dbg !14
  %0 = sub nsw i32 %hi, %lo, !dbg !17
  ret i32 %0, !dbg !14
}

define internal noundef i32 @scaled(i32 noundef %n) #1 !dbg !21 {
entry:
  %acc.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  call void @llvm.dbg.value(metadata i32 %n, metadata !23, metadata !DIExpression()), !dbg !22
  store i32 0, i32* %acc.addr, align 4, !dbg !24
  call void @llvm.dbg.declare(metadata i32* %acc.addr, metadata !26, metadata !DIExpression()), !dbg !24
  call void @llvm.dbg.declare(metadata i32* %v.addr, metadata !28, metadata !DIExpression()), !dbg !27
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0, !dbg !29
  store i64 3, i64* %0, align 8, !alias.scope !36, !noalias !37, !dbg !29
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1, !dbg !29
  store i64 3, i64* %1, align 8, !alias.scope !36, !noalias !37, !dbg !29
  %2 = bitcast [3 x i32]* %arr.data to i8*, !dbg !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2, !dbg !29
  store i8* %2, i8** %3, align 8, !alias.scope !36, !noalias !37, !dbg !29
  %4 = bitcast i8* %2 to i32*, !dbg !29
  %5 = getelementptr inbounds i32, i32* %4, i64 0, !dbg !29
  store i32 1, i32* %5, align 4, !alias.scope !37, !noalias !36, !tbaa !41, !dbg !29
  %6 = getelementptr inbounds i32, i32* %4, i64 1, !dbg !29
  store i32 2, i32* %6, align 4, !alias.scope !37, !noalias !36, !tbaa !41, !dbg !29
  %7 = getelementptr inbounds i32, i32* %4, i64 2, !dbg !29
  store i32 3, i32* %7, align 4, !alias.scope !37, !noalias !36, !tbaa !41, !dbg !29
  store i64 0, i64* %forof.idx, align 8, !dbg !27
  br label %forof.cond, !dbg !27

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8, !dbg !27
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0, !dbg !27
  %10 = load i64, i64* %9, align 8, !alias.scope !36, !noalias !37, !dbg !27
  %11 = icmp ult i64 %8, %10, !dbg !27
  br i1 %11, label %forof.body, label %forof.end, !dbg !27

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2, !dbg !27
  %13 = load i8*, i8** %12, align 8, !alias.scope !36, !noalias !37, !dbg !27
  %14 = bitcast i8* %13 to i32*, !dbg !27
  %15 = getelementptr inbounds i32, i32* %14, i64 %8, !dbg !27
  %16 = load i32, i32* %15, align 4, !alias.scope !37, !noalias !36, !tbaa !41, !dbg !27
  store i32 %16, i32* %v.addr, align 4, !dbg !27
  %17 = load i32, i32* %acc.addr, align 4, !dbg !43
  %18 = load i32, i32* %v.addr, align 4, !dbg !44
  %19 = mul nsw i32 %18, %n, !dbg !44
  %20 = add nsw i32 %17, %19, !dbg !43
  store i32 %20, i32* %acc.addr, align 4, !dbg !43
  br label %forof.inc, !dbg !27

forof.inc:
  %21 = load i64, i64* %forof.idx, align 8, !dbg !27
  %22 = add i64 %21, 1, !dbg !27
  store i64 %22, i64* %forof.idx, align 8, !dbg !27
  br label %forof.cond, !dbg !27

forof.end:
  %23 = load i32, i32* %acc.addr, align 4, !dbg !47
  ret i32 %23, !dbg !46
}

define noundef i32 @nish_main() #2 !dbg !50 {
entry:
  %arena.mark = call i64 @nish_arena_mark(), !dbg !51
  %0 = call i32 @add(i32 2, i32 3), !dbg !54
  %1 = call i8* @nish_str_from_i32(i32 %0), !dbg !53
  call void @nish_print(i8* %1), !dbg !52
  %2 = call i32 @span(i32 1, i32 9), !dbg !59
  %3 = call i8* @nish_str_from_i32(i32 %2), !dbg !58
  call void @nish_print(i8* %3), !dbg !57
  %4 = call i32 @scaled(i32 2), !dbg !64
  %5 = call i8* @nish_str_from_i32(i32 %4), !dbg !63
  call void @nish_print(i8* %5), !dbg !62
  call void @nish_arena_release(i64 %arena.mark), !dbg !66
  ret i32 0, !dbg !66
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 !dbg !68 {
entry:
  %0 = call i32 @nish_main(), !dbg !69
  call void @nish_free_arena(), !dbg !69
  ret i32 %0, !dbg !69
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_arrow.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4, !4, !4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "add", linkageName: "add", scope: !1, file: !1, line: 16, type: !6, scopeLine: 16, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 16, column: 1, scope: !7)
!9 = !DILocalVariable(name: "a", arg: 1, scope: !7, file: !1, line: 16, type: !4)
!10 = !DILocalVariable(name: "b", arg: 2, scope: !7, file: !1, line: 16, type: !4)
!11 = !DILocation(line: 16, column: 45, scope: !7)
!12 = !DILocation(line: 16, column: 49, scope: !7)
!13 = distinct !DISubprogram(name: "span", linkageName: "span", scope: !1, file: !1, line: 18, type: !6, scopeLine: 18, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!14 = !DILocation(line: 18, column: 1, scope: !13)
!15 = !DILocalVariable(name: "lo", arg: 1, scope: !13, file: !1, line: 18, type: !4)
!16 = !DILocalVariable(name: "hi", arg: 2, scope: !13, file: !1, line: 18, type: !4)
!17 = !DILocation(line: 19, column: 30, scope: !13)
!18 = !DILocation(line: 19, column: 35, scope: !13)
!19 = !{!4, !4}
!20 = !DISubroutineType(types: !19)
!21 = distinct !DISubprogram(name: "scaled", linkageName: "scaled", scope: !1, file: !1, line: 21, type: !20, scopeLine: 21, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!22 = !DILocation(line: 21, column: 1, scope: !21)
!23 = !DILocalVariable(name: "n", arg: 1, scope: !21, file: !1, line: 21, type: !4)
!24 = !DILocation(line: 22, column: 3, scope: !21)
!25 = !DILocation(line: 22, column: 13, scope: !21)
!26 = !DILocalVariable(name: "acc", scope: !21, file: !1, line: 22, type: !4)
!27 = !DILocation(line: 23, column: 3, scope: !21)
!28 = !DILocalVariable(name: "v", scope: !21, file: !1, line: 23, type: !4)
!29 = !DILocation(line: 23, column: 19, scope: !21)
!30 = !DILocation(line: 23, column: 20, scope: !21)
!31 = !DILocation(line: 23, column: 23, scope: !21)
!32 = !DILocation(line: 23, column: 26, scope: !21)
!33 = !{!"nish array"}
!34 = !{!"header", !33}
!35 = !{!"elements", !33}
!36 = !{!34}
!37 = !{!35}
!38 = !{!"nish TBAA"}
!39 = !{!"omnipotent char", !38, i64 0}
!40 = !{!"element i32", !39, i64 0}
!41 = !{!40, !40, i64 0}
!42 = !DILocation(line: 23, column: 30, scope: !21)
!43 = !DILocation(line: 24, column: 5, scope: !21)
!44 = !DILocation(line: 24, column: 12, scope: !21)
!45 = !DILocation(line: 24, column: 16, scope: !21)
!46 = !DILocation(line: 26, column: 3, scope: !21)
!47 = !DILocation(line: 26, column: 10, scope: !21)
!48 = !{!4}
!49 = !DISubroutineType(types: !48)
!50 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 29, type: !49, scopeLine: 29, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!51 = !DILocation(line: 29, column: 1, scope: !50)
!52 = !DILocation(line: 30, column: 3, scope: !50)
!53 = !DILocation(line: 30, column: 15, scope: !50)
!54 = !DILocation(line: 30, column: 18, scope: !50)
!55 = !DILocation(line: 30, column: 22, scope: !50)
!56 = !DILocation(line: 30, column: 25, scope: !50)
!57 = !DILocation(line: 31, column: 3, scope: !50)
!58 = !DILocation(line: 31, column: 15, scope: !50)
!59 = !DILocation(line: 31, column: 18, scope: !50)
!60 = !DILocation(line: 31, column: 23, scope: !50)
!61 = !DILocation(line: 31, column: 26, scope: !50)
!62 = !DILocation(line: 32, column: 3, scope: !50)
!63 = !DILocation(line: 32, column: 15, scope: !50)
!64 = !DILocation(line: 32, column: 18, scope: !50)
!65 = !DILocation(line: 32, column: 25, scope: !50)
!66 = !DILocation(line: 33, column: 3, scope: !50)
!67 = !DILocation(line: 33, column: 10, scope: !50)
!68 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 29, type: !49, scopeLine: 29, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!69 = !DILocation(line: 29, column: 1, scope: !68)
