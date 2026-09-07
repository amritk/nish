%struct.sts_result.i32.i32 = type { i1, i32, i32 }
%struct.sts_result.i32.str = type { i1, i32, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare noundef i64 @sts_arena_mark() #1
declare void @sts_arena_release(i64 noundef) #1
declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @sts_panic_div(i1 noundef zeroext) #4

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i64 @half(i32 noundef %n) #0 !dbg !15 {
entry:
  call void @llvm.dbg.value(metadata i32 %n, metadata !17, metadata !DIExpression()), !dbg !16
  %0 = icmp eq i32 2, 0, !dbg !19
  %1 = icmp eq i32 %n, -2147483648, !dbg !19
  %2 = icmp eq i32 2, -1, !dbg !19
  %3 = and i1 %1, %2, !dbg !19
  %4 = or i1 %0, %3, !dbg !19
  br i1 %4, label %div.fail, label %div.ok, !dbg !19

div.fail:
  call void @sts_panic_div(i1 zeroext %0), !dbg !19
  unreachable, !dbg !19

div.ok:
  %5 = srem i32 %n, 2, !dbg !19
  %6 = icmp ne i32 %5, 0, !dbg !19
  br i1 %6, label %if.then, label %if.end, !dbg !18

if.then:
  %7 = zext i32 %n to i64, !dbg !23
  %8 = shl i64 %7, 32, !dbg !23
  ret i64 %8, !dbg !23

if.end:
  %9 = icmp eq i32 2, 0, !dbg !26
  %10 = icmp eq i32 %n, -2147483648, !dbg !26
  %11 = icmp eq i32 2, -1, !dbg !26
  %12 = and i1 %10, %11, !dbg !26
  %13 = or i1 %9, %12, !dbg !26
  br i1 %13, label %div.fail.1, label %div.ok.1, !dbg !26

div.fail.1:
  call void @sts_panic_div(i1 zeroext %9), !dbg !26
  unreachable, !dbg !26

div.ok.1:
  %14 = sdiv i32 %n, 2, !dbg !26
  %15 = zext i32 %14 to i64, !dbg !25
  %16 = shl i64 %15, 32, !dbg !25
  %17 = or i64 %16, 1, !dbg !25
  ret i64 %17, !dbg !25
}

define noundef nonnull align 8 dereferenceable(16) %struct.sts_result.i32.str* @tag(i8* noundef nonnull noalias readonly align 8 nocapture %path) #1 !dbg !39 {
entry:
  call void @llvm.dbg.value(metadata i8* %path, metadata !41, metadata !DIExpression()), !dbg !40
  %0 = call zeroext i1 @sts_str_eq(i8* %path, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)), !dbg !43
  br i1 %0, label %if.then, label %if.end, !dbg !42

if.then:
  %1 = call i8* @sts_alloc_struct(i64 16), !dbg !47
  %2 = bitcast i8* %1 to %struct.sts_result.i32.str*, !dbg !47
  %3 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %2, i32 0, i32 0, !dbg !47
  store i1 false, i1* %3, align 1, !dbg !47
  %4 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %2, i32 0, i32 2, !dbg !47
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %4, align 8, !dbg !47
  ret %struct.sts_result.i32.str* %2, !dbg !46

if.end:
  %5 = bitcast i8* %path to i64*, !dbg !51
  %6 = load i64, i64* %5, align 8, !dbg !51
  %7 = trunc i64 %6 to i32, !dbg !51
  %8 = call i8* @sts_alloc_struct(i64 16), !dbg !50
  %9 = bitcast i8* %8 to %struct.sts_result.i32.str*, !dbg !50
  %10 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %9, i32 0, i32 0, !dbg !50
  store i1 true, i1* %10, align 1, !dbg !50
  %11 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %9, i32 0, i32 1, !dbg !50
  store i32 %7, i32* %11, align 4, !dbg !50
  ret %struct.sts_result.i32.str* %9, !dbg !49
}

define noundef i32 @test() #0 !dbg !54 {
entry:
  %r.addr = alloca %struct.sts_result.i32.i32*, align 8
  %sts_result.i32.i32.obj = alloca %struct.sts_result.i32.i32, align 8
  %named.addr = alloca %struct.sts_result.i32.str*, align 8
  %arena.mark = call i64 @sts_arena_mark(), !dbg !55
  %0 = call i64 @half(i32 8), !dbg !57
  %1 = trunc i64 %0 to i1, !dbg !57
  %2 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 0, !dbg !57
  store i1 %1, i1* %2, align 1, !dbg !57
  %3 = lshr i64 %0, 32, !dbg !57
  %4 = trunc i64 %3 to i32, !dbg !57
  %5 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 1, !dbg !57
  store i32 %4, i32* %5, align 4, !dbg !57
  %6 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, i32 0, i32 2, !dbg !57
  store i32 %4, i32* %6, align 4, !dbg !57
  store %struct.sts_result.i32.i32* %sts_result.i32.i32.obj, %struct.sts_result.i32.i32** %r.addr, align 8, !dbg !56
  call void @llvm.dbg.declare(metadata %struct.sts_result.i32.i32** %r.addr, metadata !65, metadata !DIExpression()), !dbg !56
  %7 = call %struct.sts_result.i32.str* @tag(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*)), !dbg !67
  store %struct.sts_result.i32.str* %7, %struct.sts_result.i32.str** %named.addr, align 8, !dbg !66
  call void @llvm.dbg.declare(metadata %struct.sts_result.i32.str** %named.addr, metadata !69, metadata !DIExpression()), !dbg !66
  %8 = load %struct.sts_result.i32.i32*, %struct.sts_result.i32.i32** %r.addr, align 8, !dbg !71
  %9 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %8, i32 0, i32 0, !dbg !71
  %10 = load i1, i1* %9, align 1, !dbg !71
  %11 = xor i1 %10, true, !dbg !71
  br i1 %11, label %lor.end, label %lor.rhs, !dbg !71

lor.rhs:
  %12 = load %struct.sts_result.i32.str*, %struct.sts_result.i32.str** %named.addr, align 8, !dbg !72
  %13 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %12, i32 0, i32 0, !dbg !72
  %14 = load i1, i1* %13, align 1, !dbg !72
  %15 = xor i1 %14, true, !dbg !72
  br label %lor.end, !dbg !71

lor.end:
  %16 = phi i1 [ true, %entry ], [ %15, %lor.rhs ], !dbg !71
  br i1 %16, label %if.then, label %if.end, !dbg !70

if.then:
  %17 = sub i32 0, 1, !dbg !75
  call void @sts_arena_release(i64 %arena.mark), !dbg !74
  ret i32 %17, !dbg !74

if.end:
  %18 = load %struct.sts_result.i32.i32*, %struct.sts_result.i32.i32** %r.addr, align 8, !dbg !78
  %19 = getelementptr inbounds %struct.sts_result.i32.i32, %struct.sts_result.i32.i32* %18, i32 0, i32 1, !dbg !78
  %20 = load i32, i32* %19, align 4, !dbg !78
  %21 = load %struct.sts_result.i32.str*, %struct.sts_result.i32.str** %named.addr, align 8, !dbg !79
  %22 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %21, i32 0, i32 1, !dbg !79
  %23 = load i32, i32* %22, align 4, !dbg !79
  %24 = add i32 %20, %23, !dbg !78
  call void @sts_arena_release(i64 %arena.mark), !dbg !77
  ret i32 %24, !dbg !77
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "statictsc 0.1.0", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_result.ts", directory: "<root>")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "sts_result.i32.i32.word", file: !1, size: 64, align: 32, elements: !12)
!5 = distinct !DICompositeType(tag: DW_TAG_union_type, name: "sts_result.i32.i32.arms", file: !1, size: 32, elements: !9)
!6 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!7 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !5, baseType: !6, size: 32, offset: 0)
!8 = !DIDerivedType(tag: DW_TAG_member, name: "error", scope: !5, baseType: !6, size: 32, offset: 0)
!9 = !{!7, !8}
!10 = !DIDerivedType(tag: DW_TAG_member, name: "ok", scope: !4, baseType: !6, size: 32, offset: 0)
!11 = !DIDerivedType(tag: DW_TAG_member, name: "as", scope: !4, baseType: !5, size: 32, offset: 32)
!12 = !{!10, !11}
!13 = !{!4, !6}
!14 = !DISubroutineType(types: !13)
!15 = distinct !DISubprogram(name: "half", linkageName: "half", scope: !1, file: !1, line: 7, type: !14, scopeLine: 7, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!16 = !DILocation(line: 7, column: 1, scope: !15)
!17 = !DILocalVariable(name: "n", arg: 1, scope: !15, file: !1, line: 7, type: !6)
!18 = !DILocation(line: 8, column: 3, scope: !15)
!19 = !DILocation(line: 8, column: 7, scope: !15)
!20 = !DILocation(line: 8, column: 11, scope: !15)
!21 = !DILocation(line: 8, column: 17, scope: !15)
!22 = !DILocation(line: 8, column: 20, scope: !15)
!23 = !DILocation(line: 9, column: 5, scope: !15)
!24 = !DILocation(line: 9, column: 16, scope: !15)
!25 = !DILocation(line: 11, column: 3, scope: !15)
!26 = !DILocation(line: 11, column: 13, scope: !15)
!27 = !DILocation(line: 11, column: 17, scope: !15)
!28 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "sts_result.i32.str", file: !1, size: 128, align: 64, elements: !35)
!29 = !DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)
!30 = !DIDerivedType(tag: DW_TAG_member, name: "ok", scope: !28, baseType: !29, size: 8, offset: 0)
!31 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !28, baseType: !6, size: 32, offset: 32)
!32 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!33 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !32, size: 64)
!34 = !DIDerivedType(tag: DW_TAG_member, name: "error", scope: !28, baseType: !33, size: 64, offset: 64)
!35 = !{!30, !31, !34}
!36 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !28, size: 64)
!37 = !{!36, !33}
!38 = !DISubroutineType(types: !37)
!39 = distinct !DISubprogram(name: "tag", linkageName: "tag", scope: !1, file: !1, line: 14, type: !38, scopeLine: 14, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!40 = !DILocation(line: 14, column: 1, scope: !39)
!41 = !DILocalVariable(name: "path", arg: 1, scope: !39, file: !1, line: 14, type: !33)
!42 = !DILocation(line: 15, column: 3, scope: !39)
!43 = !DILocation(line: 15, column: 7, scope: !39)
!44 = !DILocation(line: 15, column: 16, scope: !39)
!45 = !DILocation(line: 15, column: 20, scope: !39)
!46 = !DILocation(line: 16, column: 5, scope: !39)
!47 = !DILocation(line: 16, column: 12, scope: !39)
!48 = !DILocation(line: 16, column: 16, scope: !39)
!49 = !DILocation(line: 18, column: 3, scope: !39)
!50 = !DILocation(line: 18, column: 10, scope: !39)
!51 = !DILocation(line: 18, column: 13, scope: !39)
!52 = !{!6}
!53 = !DISubroutineType(types: !52)
!54 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 21, type: !53, scopeLine: 21, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!55 = !DILocation(line: 21, column: 1, scope: !54)
!56 = !DILocation(line: 22, column: 3, scope: !54)
!57 = !DILocation(line: 22, column: 13, scope: !54)
!58 = !DILocation(line: 22, column: 18, scope: !54)
!59 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "sts_result.i32.i32", file: !1, size: 96, align: 32, elements: !63)
!60 = !DIDerivedType(tag: DW_TAG_member, name: "ok", scope: !59, baseType: !29, size: 8, offset: 0)
!61 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !59, baseType: !6, size: 32, offset: 32)
!62 = !DIDerivedType(tag: DW_TAG_member, name: "error", scope: !59, baseType: !6, size: 32, offset: 64)
!63 = !{!60, !61, !62}
!64 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !59, size: 64)
!65 = !DILocalVariable(name: "r", scope: !54, file: !1, line: 22, type: !64)
!66 = !DILocation(line: 23, column: 3, scope: !54)
!67 = !DILocation(line: 23, column: 17, scope: !54)
!68 = !DILocation(line: 23, column: 21, scope: !54)
!69 = !DILocalVariable(name: "named", scope: !54, file: !1, line: 23, type: !36)
!70 = !DILocation(line: 24, column: 3, scope: !54)
!71 = !DILocation(line: 24, column: 7, scope: !54)
!72 = !DILocation(line: 24, column: 20, scope: !54)
!73 = !DILocation(line: 24, column: 35, scope: !54)
!74 = !DILocation(line: 25, column: 5, scope: !54)
!75 = !DILocation(line: 25, column: 12, scope: !54)
!76 = !DILocation(line: 25, column: 13, scope: !54)
!77 = !DILocation(line: 27, column: 3, scope: !54)
!78 = !DILocation(line: 27, column: 10, scope: !54)
!79 = !DILocation(line: 27, column: 20, scope: !54)
