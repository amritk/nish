%struct.Hello = type { i8* }
%struct.JsonWriter = type { %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1, i1, i1 }
%struct.JsonLimits = type { i32, i32, i32, i32 }
%struct.JsonDecoder = type { %struct.JsonTokenizer*, i32, i32, i32, i1, i1 }
%struct.JsonTokenizer = type { %struct.nish_array*, i64, i64, %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1 }
%struct.JsonNumber = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"{\22message\22:\22Hello, World!\22}\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"message\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.JsonWriter.constructor(%struct.JsonWriter* noundef nonnull noalias align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.JsonWriter.reset(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.JsonWriter.setIndent(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #1
declare void @nish.JsonWriter.setIndentTab(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.setStrict(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i1 noundef zeroext) #1
declare noundef i32 @nish.JsonWriter.written(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #0
declare noundef zeroext i1 @nish.JsonWriter.complete(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #2
declare noundef nonnull align 8 i8* @nish.JsonWriter.text(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.beginObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.endObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.beginArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.endArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.key(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonWriter.string(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonWriter.keyBytes(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #0
declare void @nish.JsonWriter.stringBytes(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #0
declare void @nish.JsonWriter.i32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #0
declare void @nish.JsonWriter.u32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #0
declare void @nish.JsonWriter.i64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i64 noundef) #0
declare void @nish.JsonWriter.f64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, double noundef) #0
declare void @nish.JsonWriter.boolean(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i1 noundef zeroext) #0
declare void @nish.JsonWriter.nullValue(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.raw(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #0
declare void @nish.JsonLimits.constructor(%struct.JsonLimits* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #1
declare void @nish.JsonDecoder.constructor(%struct.JsonDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonDecoder.reset(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare void @nish.JsonDecoder.fail(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i32 @nish.JsonDecoder.take(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noundef i32 @nish.JsonDecoder.keyByte(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef zeroext i1 @nish.JsonDecoder.mapRoom(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #1
declare noundef nonnull align 8 i8* @nish.JsonDecoder.key(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.text(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #0
declare void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare void @nish.JsonDecoder.missingField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.takeNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextElement(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i64 @nish.JsonDecoder.integer(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i64 noundef, i64 noundef, i1 noundef zeroext) #0
declare noundef i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i32 @nish.JsonDecoder.u32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i64 @nish.JsonDecoder.i64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i64 @nish.JsonDecoder.u64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare void @nish.JsonDecoder.number(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture) #0
declare noundef double @nish.JsonDecoder.f64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.boolean(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.string(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.f64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.booleanArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.stringArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.f64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.booleanArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.stringArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef i32 @jtChecks() #0
declare noundef i32 @jtModes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture) #0
declare void @nish.JsonTokenizer.constructor(%struct.JsonTokenizer* noundef nonnull noalias align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonTokenizer.reset(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.fail(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.next(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.top(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.emit(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.close(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.open(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.key(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.value(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.literal(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i8* noundef nonnull noalias readonly align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.number(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.numberRefused(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.string(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.escapeCodePoint(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isText(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #2
declare noundef i32 @nish.JsonTokenizer.stringInto(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.stringLength(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #2
declare noundef zeroext i1 @nish.JsonTokenizer.keyEquals(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isInteger(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef i64 @nish.JsonTokenizer.numberI64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.integerScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef i64 @nish.JsonTokenizer.numberU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.unsignedScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberF64(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberSlow(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.skipValue(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #0
declare void @nish.JsonNumber.constructor(%struct.JsonNumber* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #1
declare noundef nonnull align 8 i8* @nish.JsonNumber.text(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef nonnull align 8 dereferenceable(96) %struct.JsonTokenizer* @nish.JsonNumber.reader(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef zeroext i1 @nish.JsonNumber.isI64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef i64 @nish.JsonNumber.i64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef zeroext i1 @nish.JsonNumber.isU64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef i64 @nish.JsonNumber.u64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef double @nish.JsonNumber.f64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef zeroext i1 @nish.JsonNumber.setText(%struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #4
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %mode.addr = alloca i32, align 4
  %text.addr = alloca i8*, align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %d.addr = alloca %struct.JsonDecoder*, align 8
  %JsonLimits.obj = alloca %struct.JsonLimits, align 8
  %hello.addr = alloca %struct.Hello*, align 8
  %code.addr = alloca i32, align 4
  %w.addr = alloca %struct.JsonWriter*, align 8
  %JsonWriter.obj = alloca %struct.JsonWriter, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = call i32 @jtModes(%struct.nish_array* %0)
  store i32 %1, i32* %mode.addr, align 4
  %2 = load i32, i32* %mode.addr, align 4
  %3 = icmp sge i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %mode.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4

if.end:
  store i8* bitcast ({ i64, [28 x i8] }* @.str.0 to i8*), i8** %text.addr, align 8
  %5 = load i8*, i8** %text.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = sext i32 %8 to i64
  %10 = icmp ule i64 %9, 2147483647
  br i1 %10, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 %9, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 %9, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %15, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %12, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = trunc i64 %19 to i32
  %24 = icmp slt i32 %22, %23
  br i1 %24, label %land.rhs, label %land.end

land.rhs:
  %25 = load i32, i32* %i.addr, align 4
  %26 = load i8*, i8** %text.addr, align 8
  %27 = bitcast i8* %26 to i64*
  %28 = load i64, i64* %27, align 8
  %29 = trunc i64 %28 to i32
  %30 = icmp slt i32 %25, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %for.cond ], [ %30, %land.rhs ]
  br i1 %31, label %for.body, label %for.end

for.body:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8*, i8** %text.addr, align 8
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds i8, i8* %34, i64 8
  %38 = getelementptr inbounds i8, i8* %37, i64 %36
  %39 = load i8, i8* %38, align 1
  %40 = zext i8 %39 to i32
  %41 = trunc i32 %40 to i8
  %42 = bitcast i8* %21 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %33
  store i8 %41, i8* %43, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %44 = load i32, i32* %i.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %46 = call i8* @nish_alloc_struct(i64 24)
  %47 = bitcast i8* %46 to %struct.JsonDecoder*
  %48 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %49 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  call void @nish.JsonLimits.constructor(%struct.JsonLimits* %JsonLimits.obj)
  call void @nish.JsonDecoder.constructor(%struct.JsonDecoder* %47, %struct.nish_array* %48, i32 0, i32 %52, %struct.JsonLimits* %JsonLimits.obj)
  store %struct.JsonDecoder* %47, %struct.JsonDecoder** %d.addr, align 8
  %53 = call i8* @nish_alloc_struct(i64 8)
  %54 = bitcast i8* %53 to %struct.Hello*
  %55 = getelementptr inbounds %struct.Hello, %struct.Hello* %54, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %55, align 8, !tbaa !17
  store %struct.Hello* %54, %struct.Hello** %hello.addr, align 8
  %56 = load %struct.JsonDecoder*, %struct.JsonDecoder** %d.addr, align 8
  %57 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.decode.Hello(%struct.JsonDecoder* %56, %struct.Hello* %57)
  %58 = call i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* %56)
  store i32 %58, i32* %code.addr, align 4
  %59 = call i8* @nish_alloc_struct(i64 24)
  %60 = bitcast i8* %59 to %struct.nish_array*
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  store i64 64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  store i64 64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = call i8* @nish_alloc_struct(i64 64)
  call void @llvm.memset.p0i8.i64(i8* align 8 %63, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  store i8* %63, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @nish.JsonWriter.constructor(%struct.JsonWriter* %JsonWriter.obj, %struct.nish_array* %60, i32 0)
  store %struct.JsonWriter* %JsonWriter.obj, %struct.JsonWriter** %w.addr, align 8
  %65 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %66 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.encode.Hello(%struct.JsonWriter* %65, %struct.Hello* %66)
  %67 = load i32, i32* %code.addr, align 4
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %70 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  %71 = getelementptr inbounds %struct.Hello, %struct.Hello* %70, i32 0, i32 0
  %72 = load i8*, i8** %71, align 8, !tbaa !17
  %73 = call i8* @nish_str_concat(i8* %69, i8* %72)
  %74 = call i8* @nish_str_concat(i8* %73, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %75 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %76 = call i64 @nish_arena_mark()
  %77 = call i8* @nish.JsonWriter.text(%struct.JsonWriter* %75)
  %78 = call i8* @nish_arena_keep(i64 %76, i8* %77)
  %79 = call i8* @nish_str_concat(i8* %74, i8* %78)
  call void @nish_print(i8* %79)
  %80 = call i32 @jtChecks()
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %80
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
  %2 = call i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* %r)
  switch i32 %2, label %json.unknown [ i32 7, label %json.length ]

json.length:
  %3 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  br i1 %3, label %json.field, label %json.unknown

json.field:
  %4 = load i1, i1* %seen, align 1
  br i1 %4, label %json.duplicate, label %json.take

json.take:
  store i1 true, i1* %seen, align 1
  %5 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %6 = load i8*, i8** %5, align 8, !tbaa !17
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @nish.JsonDecoder.string(%struct.JsonDecoder* %r, i8* %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  store i8* %9, i8** %10, align 8, !tbaa !17
  br label %json.loop

json.unknown:
  call void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* %r)
  br label %json.loop

json.duplicate:
  call void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* %r)
  br label %json.loop

json.check:
  %11 = load i1, i1* %seen, align 1
  br i1 %11, label %json.given, label %json.missing

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
  %1 = load i32, i32* %0, align 4, !tbaa !21
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %json.write, label %json.stop

json.stop:
  ret void

json.write:
  call void @nish.JsonWriter.beginObject(%struct.JsonWriter* %r)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %3 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !17
  call void @nish.JsonWriter.string(%struct.JsonWriter* %r, i8* %4)
  call void @nish.JsonWriter.endObject(%struct.JsonWriter* %r)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Hello", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"i32", !6, i64 0}
!19 = !{!"i1", !6, i64 0}
!20 = !{!"JsonWriter", !15, i64 0, !18, i64 8, !18, i64 12, !18, i64 16, !18, i64 20, !18, i64 24, !18, i64 28, !18, i64 32, !18, i64 36, !18, i64 40, !19, i64 44, !19, i64 45, !19, i64 46}
!21 = !{!20, !18, i64 16}
