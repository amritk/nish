%struct.Hello = type { i8* }
%struct.JsonWriter = type { %struct.nish_array*, i32, i32, i32, i32, i32, i32, i1, i1, i1 }
%struct.JsonLimits = type { i32, i32, i32, i32 }
%struct.JsonDecoder = type { %struct.JsonTokenizer*, i32, i32, i1, i1 }
%struct.JsonTokenizer = type { %struct.nish_array*, i64, %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"--round-trip\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--bench\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"{\22message\22:\22Hello, World!\22}\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"message\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.JsonWriter.constructor(%struct.JsonWriter* noundef nonnull noalias align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.JsonWriter.reset(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noundef i32 @nish.JsonWriter.written(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonWriter.complete(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #2
declare noundef nonnull align 8 i8* @nish.JsonWriter.text(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.beginObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.endObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.beginArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.endArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.key(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonWriter.string(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonWriter.i32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i32 noundef) #0
declare void @nish.JsonWriter.u32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i32 noundef) #0
declare void @nish.JsonWriter.i64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i64 noundef) #0
declare void @nish.JsonWriter.f64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, double noundef) #0
declare void @nish.JsonWriter.boolean(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, i1 noundef zeroext) #0
declare void @nish.JsonWriter.nullValue(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonWriter.raw(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #0
declare void @nish.JsonLimits.constructor(%struct.JsonLimits* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #1
declare void @nish.JsonDecoder.constructor(%struct.JsonDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonDecoder.reset(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare void @nish.JsonDecoder.fail(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i32 @nish.JsonDecoder.take(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare void @nish.JsonDecoder.missingField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.takeNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextElement(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i64 @nish.JsonDecoder.integer(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i32 @nish.JsonDecoder.u32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i64 @nish.JsonDecoder.i64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef double @nish.JsonDecoder.f64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.boolean(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.string(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.f64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.booleanArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.stringArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.f64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.booleanArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.stringArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef i32 @jtBench(i32 noundef) #0
declare noundef i32 @jtChecks() #0
declare noundef i32 @jtRoundTripFile(i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare void @nish.JsonTokenizer.constructor(%struct.JsonTokenizer* noundef nonnull noalias align 8 dereferenceable(88) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonTokenizer.reset(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.fail(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.next(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.top(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.emit(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.close(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.open(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.key(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.value(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.literal(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i8* noundef nonnull noalias readonly align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.number(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.numberRefused(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.string(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.escapeCodePoint(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isText(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #2
declare noundef i32 @nish.JsonTokenizer.stringInto(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.stringLength(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #2
declare noundef zeroext i1 @nish.JsonTokenizer.keyEquals(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isInteger(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef i64 @nish.JsonTokenizer.numberI64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.integerScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberF64(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberSlow(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.skipValue(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #5
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %argv.addr = alloca %struct.nish_array*, align 8
  %text.addr = alloca i8*, align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %d.addr = alloca %struct.JsonDecoder*, align 8
  %JsonLimits.obj = alloca %struct.JsonLimits, align 8
  %hello.addr = alloca %struct.Hello*, align 8
  %code.addr = alloca i32, align 4
  %w.addr = alloca %struct.JsonWriter*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  store %struct.nish_array* %0, %struct.nish_array** %argv.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 2
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 1
  %11 = load i8*, i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = call zeroext i1 @nish_str_eq(i8* %11, i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  br label %land.end

land.end:
  %13 = phi i1 [ false, %entry ], [ %12, %land.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = call i32 @jtRoundTripFile(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %20

if.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = trunc i64 %23 to i32
  %25 = icmp sgt i32 %24, 2
  br i1 %25, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %26 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 1
  %31 = load i8*, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = call zeroext i1 @nish_str_eq(i8* %31, i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*))
  br label %land.end.1

land.end.1:
  %33 = phi i1 [ false, %if.end ], [ %32, %land.rhs.1 ]
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = call double @nish_parse_number(i8* %39, i32 2)
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  call void @nish_arena_release(i64 %arena.mark)
  %42 = tail call i32 @jtBench(i32 %41)
  ret i32 %42

if.end.1:
  store i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i8** %text.addr, align 8
  %43 = load i8*, i8** %text.addr, align 8
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  %47 = sext i32 %46 to i64
  %48 = icmp ule i64 %47, 2147483647
  br i1 %48, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %49 = call i8* @nish_alloc_struct(i64 24)
  %50 = bitcast i8* %49 to %struct.nish_array*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  store i64 %47, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 1
  store i64 %47, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %53 = call i8* @nish_alloc_struct(i64 %47)
  call void @llvm.memset.p0i8.i64(i8* align 8 %53, i8 0, i64 %47, i1 false), !alias.scope !4, !noalias !3
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  store i8* %53, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %50, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %55 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %60 = load i32, i32* %i.addr, align 4
  %61 = trunc i64 %57 to i32
  %62 = icmp slt i32 %60, %61
  br i1 %62, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %63 = load i32, i32* %i.addr, align 4
  %64 = load i8*, i8** %text.addr, align 8
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = trunc i64 %66 to i32
  %68 = icmp slt i32 %63, %67
  br label %land.end.2

land.end.2:
  %69 = phi i1 [ false, %for.cond ], [ %68, %land.rhs.2 ]
  br i1 %69, label %for.body, label %for.end

for.body:
  %70 = load i32, i32* %i.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = load i8*, i8** %text.addr, align 8
  %73 = load i32, i32* %i.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = getelementptr inbounds i8, i8* %72, i64 8
  %76 = getelementptr inbounds i8, i8* %75, i64 %74
  %77 = load i8, i8* %76, align 1
  %78 = zext i8 %77 to i32
  %79 = trunc i32 %78 to i8
  %80 = bitcast i8* %59 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %71
  store i8 %79, i8* %81, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %82 = load i32, i32* %i.addr, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %84 = call i8* @nish_alloc_struct(i64 24)
  %85 = bitcast i8* %84 to %struct.JsonDecoder*
  %86 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = trunc i64 %89 to i32
  call void @nish.JsonLimits.constructor(%struct.JsonLimits* %JsonLimits.obj)
  call void @nish.JsonDecoder.constructor(%struct.JsonDecoder* %85, %struct.nish_array* %86, i32 0, i32 %90, %struct.JsonLimits* %JsonLimits.obj)
  store %struct.JsonDecoder* %85, %struct.JsonDecoder** %d.addr, align 8
  %91 = call i8* @nish_alloc_struct(i64 8)
  %92 = bitcast i8* %91 to %struct.Hello*
  %93 = getelementptr inbounds %struct.Hello, %struct.Hello* %92, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %93, align 8, !tbaa !19
  store %struct.Hello* %92, %struct.Hello** %hello.addr, align 8
  %94 = load %struct.JsonDecoder*, %struct.JsonDecoder** %d.addr, align 8
  %95 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.decode.Hello(%struct.JsonDecoder* %94, %struct.Hello* %95)
  %96 = call i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* %94)
  store i32 %96, i32* %code.addr, align 4
  %97 = call i8* @nish_alloc_struct(i64 40)
  %98 = bitcast i8* %97 to %struct.JsonWriter*
  %99 = call i8* @nish_alloc_struct(i64 24)
  %100 = bitcast i8* %99 to %struct.nish_array*
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 0
  store i64 64, i64* %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 1
  store i64 64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %103 = call i8* @nish_alloc_struct(i64 64)
  call void @llvm.memset.p0i8.i64(i8* align 8 %103, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 2
  store i8* %103, i8** %104, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @nish.JsonWriter.constructor(%struct.JsonWriter* %98, %struct.nish_array* %100, i32 0)
  store %struct.JsonWriter* %98, %struct.JsonWriter** %w.addr, align 8
  %105 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %106 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.encode.Hello(%struct.JsonWriter* %105, %struct.Hello* %106)
  %107 = load i32, i32* %code.addr, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %110 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  %111 = getelementptr inbounds %struct.Hello, %struct.Hello* %110, i32 0, i32 0
  %112 = load i8*, i8** %111, align 8, !tbaa !19
  %113 = call i8* @nish_str_concat(i8* %109, i8* %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %115 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %116 = call i64 @nish_arena_mark()
  %117 = call i8* @nish.JsonWriter.text(%struct.JsonWriter* %115)
  %118 = call i8* @nish_arena_keep(i64 %116, i8* %117)
  %119 = call i8* @nish_str_concat(i8* %114, i8* %118)
  call void @nish_print(i8* %119)
  %120 = call i32 @jtChecks()
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %120
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @.json.decode.Hello(%struct.JsonDecoder* %r, %struct.Hello* %v) {
entry:
  %seen = alloca i1, align 1
  store i1 false, i1* %seen, align 1
  %0 = call i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* %r)
  br i1 %0, label %json.loop, label %json.done

json.loop:
  %1 = call i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* %r)
  br i1 %1, label %json.key, label %json.check

json.key:
  %2 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*))
  br i1 %2, label %json.field, label %json.next

json.field:
  %3 = load i1, i1* %seen, align 1
  br i1 %3, label %json.duplicate, label %json.take

json.take:
  store i1 true, i1* %seen, align 1
  %4 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !19
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.JsonDecoder.string(%struct.JsonDecoder* %r, i8* %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  %9 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  store i8* %8, i8** %9, align 8, !tbaa !19
  br label %json.loop

json.next:
  call void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* %r)
  br label %json.loop

json.duplicate:
  call void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* %r)
  br label %json.loop

json.check:
  %10 = load i1, i1* %seen, align 1
  br i1 %10, label %json.given, label %json.missing

json.given:
  br label %json.done

json.missing:
  call void @nish.JsonDecoder.missingField(%struct.JsonDecoder* %r)
  br label %json.done

json.done:
  ret void
}

define internal void @.json.encode.Hello(%struct.JsonWriter* %r, %struct.Hello* %v) {
entry:
  %0 = getelementptr inbounds %struct.JsonWriter, %struct.JsonWriter* %r, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %json.write, label %json.stop

json.stop:
  ret void

json.write:
  call void @nish.JsonWriter.beginObject(%struct.JsonWriter* %r)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*))
  %3 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !19
  call void @nish.JsonWriter.string(%struct.JsonWriter* %r, i8* %4)
  call void @nish.JsonWriter.endObject(%struct.JsonWriter* %r)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"ptr", !6, i64 0}
!18 = !{!"Hello", !17, i64 0}
!19 = !{!18, !17, i64 0}
!20 = !{!"i32", !6, i64 0}
!21 = !{!"i1", !6, i64 0}
!22 = !{!"JsonWriter", !17, i64 0, !20, i64 8, !20, i64 12, !20, i64 16, !20, i64 20, !20, i64 24, !20, i64 28, !21, i64 32, !21, i64 33, !21, i64 34}
!23 = !{!22, !20, i64 16}
