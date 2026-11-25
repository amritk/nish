%struct.Hello = type { i8* }
%struct.JsonWriter = type { %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1, i1, i1 }
%struct.JsonLimits = type { i32, i32, i32, i32 }
%struct.JsonDecoder = type { %struct.JsonTokenizer*, i32, i32, i32, i32, i1, i1, i32, i32 }
%struct.JsonTokenizer = type { %struct.nish_array*, i64, i64, i64, %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1, i1 }
%struct.JsonNumber = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"{\22message\22:\22Hello, World!\22}\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"message\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"\22message\22:\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.JsonWriter.constructor(%struct.JsonWriter* noundef nonnull noalias align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.JsonWriter.reset(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.JsonWriter.setIndent(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #1
declare void @nish.JsonWriter.setIndentTab(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.setStrict(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i1 noundef zeroext) #1
declare noundef i32 @nish.JsonWriter.written(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #2
declare noundef zeroext i1 @nish.JsonWriter.complete(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #2
declare noundef nonnull align 8 i8* @nish.JsonWriter.text(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.beginObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.endObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.beginArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.endArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.key(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare void @nish.JsonWriter.keyQuoted(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare void @nish.JsonWriter.string(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #1
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
declare void @nish.JsonDecoder.constructor(%struct.JsonDecoder* noundef nonnull noalias align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonDecoder.reset(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.fail(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.enumString(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef i32 @nish.JsonDecoder.take(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #2
declare noundef i32 @nish.JsonDecoder.keyByte(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i32 noundef) #2
declare noundef zeroext i1 @nish.JsonDecoder.mapRoom(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare noundef nonnull align 8 i8* @nish.JsonDecoder.key(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.text(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.unionTag(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonDecoder.unknownTag(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.enterUnion(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare void @nish.JsonDecoder.tagValue(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare void @nish.JsonDecoder.missingField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #1
declare noundef i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.takeNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.beginArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.nextElement(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef i64 @nish.JsonDecoder.integer(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, i64 noundef, i64 noundef, i1 noundef zeroext) #0
declare noundef i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef i32 @nish.JsonDecoder.u32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef i64 @nish.JsonDecoder.i64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef i64 @nish.JsonDecoder.u64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare void @nish.JsonDecoder.number(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture) #0
declare noundef double @nish.JsonDecoder.f64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef zeroext i1 @nish.JsonDecoder.boolean(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.string(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.f64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.booleanArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.stringArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.f64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.booleanArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.stringArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(40) nocapture, %struct.nish_array* noundef align 8) #0
declare noundef i32 @jtChecks() #0
declare noundef i32 @jtModes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture) #0
declare void @nish.JsonTokenizer.constructor(%struct.JsonTokenizer* noundef nonnull noalias align 8 dereferenceable(120) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare void @nish.JsonTokenizer.reset(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.fail(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.next(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef i32 @nish.JsonTokenizer.emit(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.close(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.open(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.key(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.value(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.literal(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i8* noundef nonnull noalias readonly align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.number(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.numberRefused(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.string(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.escapeCodePoint(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isText(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #2
declare noundef i32 @nish.JsonTokenizer.stringInto(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.stringLength(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #2
declare noundef zeroext i1 @nish.JsonTokenizer.keyEquals(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isInteger(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef i64 @nish.JsonTokenizer.numberI64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.integerScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef i64 @nish.JsonTokenizer.numberU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.unsignedScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare noundef zeroext i1 @nish.JsonTokenizer.isIntegral(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberF64(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberWalk(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #0
declare noundef double @nish.JsonTokenizer.numberSlow(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(120) nocapture) #0
declare void @nish.JsonTokenizer.rewindObject(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.skipValue(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(120) nocapture) #0
declare void @nish.JsonNumber.constructor(%struct.JsonNumber* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #1
declare noundef nonnull align 8 i8* @nish.JsonNumber.text(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
declare noundef nonnull align 8 dereferenceable(120) %struct.JsonTokenizer* @nish.JsonNumber.reader(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #0
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
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 %9, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 %9, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %11, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %21 = load i32, i32* %i.addr, align 4
  %22 = trunc i64 %18 to i32
  %23 = icmp slt i32 %21, %22
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %i.addr, align 4
  %25 = load i8*, i8** %text.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = icmp slt i32 %24, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %for.cond ], [ %29, %land.rhs ]
  br i1 %30, label %for.body, label %for.end

for.body:
  %31 = load i32, i32* %i.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = load i8*, i8** %text.addr, align 8
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = getelementptr inbounds i8, i8* %33, i64 8
  %37 = getelementptr inbounds i8, i8* %36, i64 %35
  %38 = load i8, i8* %37, align 1
  %39 = zext i8 %38 to i32
  %40 = trunc i32 %39 to i8
  %41 = bitcast i8* %20 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %32
  store i8 %40, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %45 = call i8* @nish_alloc_struct(i64 40)
  %46 = bitcast i8* %45 to %struct.JsonDecoder*
  %47 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  call void @nish.JsonLimits.constructor(%struct.JsonLimits* %JsonLimits.obj)
  call void @nish.JsonDecoder.constructor(%struct.JsonDecoder* %46, %struct.nish_array* %47, i32 0, i32 %51, %struct.JsonLimits* %JsonLimits.obj)
  store %struct.JsonDecoder* %46, %struct.JsonDecoder** %d.addr, align 8
  %52 = call i8* @nish_alloc_struct(i64 8)
  %53 = bitcast i8* %52 to %struct.Hello*
  %54 = getelementptr inbounds %struct.Hello, %struct.Hello* %53, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %54, align 8, !tbaa !17
  store %struct.Hello* %53, %struct.Hello** %hello.addr, align 8
  %55 = load %struct.JsonDecoder*, %struct.JsonDecoder** %d.addr, align 8
  %56 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.decode.Hello(%struct.JsonDecoder* %55, %struct.Hello* %56)
  %57 = call i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* %55)
  store i32 %57, i32* %code.addr, align 4
  %58 = call i8* @nish_alloc_struct(i64 24)
  %59 = bitcast i8* %58 to %struct.nish_array*
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  store i64 64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 1
  store i64 64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %62 = call i8* @nish_alloc_struct(i64 64)
  call void @llvm.memset.p0i8.i64(i8* align 8 %62, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  store i8* %62, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @nish.JsonWriter.constructor(%struct.JsonWriter* %JsonWriter.obj, %struct.nish_array* %59, i32 0)
  store %struct.JsonWriter* %JsonWriter.obj, %struct.JsonWriter** %w.addr, align 8
  %64 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %65 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  call void @.json.encode.Hello(%struct.JsonWriter* %64, %struct.Hello* %65)
  %66 = load i32, i32* %code.addr, align 4
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %69 = load %struct.Hello*, %struct.Hello** %hello.addr, align 8
  %70 = getelementptr inbounds %struct.Hello, %struct.Hello* %69, i32 0, i32 0
  %71 = load i8*, i8** %70, align 8, !tbaa !17
  %72 = call i8* @nish_str_concat(i8* %68, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %74 = load %struct.JsonWriter*, %struct.JsonWriter** %w.addr, align 8
  %75 = call i64 @nish_arena_mark()
  %76 = call i8* @nish.JsonWriter.text(%struct.JsonWriter* %74)
  %77 = call i8* @nish_arena_keep(i64 %75, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %73, i8* %77)
  call void @nish_print(i8* %78)
  %79 = call i32 @jtChecks()
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %79
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @.json.decode.Hello(%struct.JsonDecoder* %r, %struct.Hello* %v) "probe-stack"="inline-asm" {
entry:
  %seen = alloca i1, align 1
  store i1 false, i1* %seen, align 1
  %0 = call i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* %r)
  br i1 %0, label %json.loop, label %json.done

json.loop:
  %1 = call i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* %r)
  br i1 %1, label %json.key, label %json.check

json.key:
  %2 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  br i1 %2, label %json.field, label %json.unknown

json.field:
  %3 = load i1, i1* %seen, align 1
  br i1 %3, label %json.duplicate, label %json.take

json.take:
  store i1 true, i1* %seen, align 1
  %4 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !17
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.JsonDecoder.string(%struct.JsonDecoder* %r, i8* %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  %9 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  store i8* %8, i8** %9, align 8, !tbaa !17
  br label %json.loop

json.unknown:
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

define internal void @.json.encode.Hello(%struct.JsonWriter* %r, %struct.Hello* %v) "probe-stack"="inline-asm" {
entry:
  %0 = getelementptr inbounds %struct.JsonWriter, %struct.JsonWriter* %r, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !21
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %json.write, label %json.stop

json.stop:
  ret void

json.write:
  call void @nish.JsonWriter.beginObject(%struct.JsonWriter* %r)
  call void @nish.JsonWriter.keyQuoted(%struct.JsonWriter* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*))
  %3 = getelementptr inbounds %struct.Hello, %struct.Hello* %v, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !17
  call void @nish.JsonWriter.string(%struct.JsonWriter* %r, i8* %4)
  call void @nish.JsonWriter.endObject(%struct.JsonWriter* %r)
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
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
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
