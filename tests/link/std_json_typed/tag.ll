%struct.Tag = type { i64, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.JsonWriter = type { %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1, i1, i1 }
%struct.JsonDecoder = type { %struct.JsonTokenizer*, i32, i32, i32, i1, i1 }
%struct.JsonTokenizer = type { %struct.nish_array*, i64, i64, %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1 }
%struct.JsonNumber = type { %struct.nish_array*, i32 }
%struct.JsonLimits = type { i32, i32, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"id\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"scores\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"levels\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"level\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish.JsonWriter.constructor(%struct.JsonWriter* noundef nonnull noalias align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.JsonWriter.reset(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.JsonWriter.setIndent(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #0
declare void @nish.JsonWriter.setIndentTab(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #0
declare void @nish.JsonWriter.setStrict(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i1 noundef zeroext) #0
declare noundef i32 @nish.JsonWriter.written(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #1
declare noundef zeroext i1 @nish.JsonWriter.complete(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #2
declare noundef nonnull align 8 i8* @nish.JsonWriter.text(%struct.JsonWriter* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.beginObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.endObject(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.beginArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.endArray(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.key(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare void @nish.JsonWriter.string(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare void @nish.JsonWriter.keyBytes(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonWriter.stringBytes(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonWriter.i32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #1
declare void @nish.JsonWriter.u32(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i32 noundef) #1
declare void @nish.JsonWriter.i64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i64 noundef) #1
declare void @nish.JsonWriter.f64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, double noundef) #1
declare void @nish.JsonWriter.boolean(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i1 noundef zeroext) #1
declare void @nish.JsonWriter.nullValue(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture) #1
declare void @nish.JsonWriter.raw(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.constructor(%struct.JsonDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare void @nish.JsonDecoder.reset(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #1
declare void @nish.JsonDecoder.fail(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i32 @nish.JsonDecoder.take(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noundef i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noundef i32 @nish.JsonDecoder.keyByte(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef) #1
declare noundef zeroext i1 @nish.JsonDecoder.mapRoom(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.JsonDecoder.key(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #1
declare noundef nonnull align 8 i8* @nish.JsonDecoder.text(%struct.JsonDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #1
declare void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare void @nish.JsonDecoder.missingField(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.takeNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.beginArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.nextElement(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i64 @nish.JsonDecoder.integer(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i64 noundef, i64 noundef, i1 noundef zeroext) #1
declare noundef i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i32 @nish.JsonDecoder.u32(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i64 @nish.JsonDecoder.i64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef i64 @nish.JsonDecoder.u64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare void @nish.JsonDecoder.number(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture) #1
declare noundef double @nish.JsonDecoder.f64(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.JsonDecoder.boolean(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef nonnull align 8 i8* @nish.JsonDecoder.string(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u32Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.i64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.u64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.f64Array(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.booleanArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.JsonDecoder.stringArray(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u32ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.i64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.u64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.f64ArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.booleanArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare noundef align 8 %struct.nish_array* @nish.JsonDecoder.stringArrayOrNull(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef align 8) #1
declare void @nish.jsonEncodeU64(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, i64 noundef) #1
declare void @nish.jsonEncodeU64Array(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture) #1
declare void @nish.JsonTokenizer.constructor(%struct.JsonTokenizer* noundef nonnull noalias align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef, %struct.JsonLimits* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare void @nish.JsonTokenizer.reset(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.fail(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.next(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef i32 @nish.JsonTokenizer.top(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #1
declare noundef i32 @nish.JsonTokenizer.emit(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.JsonTokenizer.close(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.open(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.key(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.value(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.literal(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i8* noundef nonnull noalias readonly align 8 nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.number(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.numberRefused(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.string(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.escapeCodePoint(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i32 noundef) #1
declare noundef zeroext i1 @nish.JsonTokenizer.isText(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #2
declare noundef i32 @nish.JsonTokenizer.stringInto(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #1
declare noundef i32 @nish.JsonTokenizer.stringLength(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #2
declare noundef zeroext i1 @nish.JsonTokenizer.keyEquals(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #1
declare noundef zeroext i1 @nish.JsonTokenizer.isInteger(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef i64 @nish.JsonTokenizer.numberI64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef zeroext i1 @nish.JsonTokenizer.integerScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef zeroext i1 @nish.JsonTokenizer.isU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef i64 @nish.JsonTokenizer.numberU64(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef zeroext i1 @nish.JsonTokenizer.unsignedScan(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare noundef double @nish.JsonTokenizer.numberF64(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #1
declare noundef double @nish.JsonTokenizer.numberSlow(%struct.JsonTokenizer* noundef nonnull readonly align 8 dereferenceable(96) nocapture) #1
declare noundef i32 @nish.JsonTokenizer.skipValue(%struct.JsonTokenizer* noundef nonnull align 8 dereferenceable(96) nocapture) #1
declare void @nish.JsonNumber.constructor(%struct.JsonNumber* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonNumber.text(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef nonnull align 8 dereferenceable(96) %struct.JsonTokenizer* @nish.JsonNumber.reader(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.isI64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i64 @nish.JsonNumber.i64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.isU64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i64 @nish.JsonNumber.u64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef double @nish.JsonNumber.f64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.setText(%struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #1
declare void @nish.JsonLimits.constructor(%struct.JsonLimits* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

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

define void @Tag.constructor(%struct.Tag* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 0
  store i64 0, i64* %0, align 8, !tbaa !6
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !18
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %12 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 2
  store %struct.nish_array* %8, %struct.nish_array** %12, align 8, !tbaa !19
  %13 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 3
  store i32 0, i32* %13, align 4, !tbaa !20
  ret void
}

define noundef i32 @tagDecode(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) %d, %struct.Tag* noundef nonnull align 8 dereferenceable(32) %t) #1 {
entry:
  call void @.json.decode.Tag(%struct.JsonDecoder* %d, %struct.Tag* %t)
  %0 = call i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* %d)
  ret i32 %0
}

define void @tagEncode(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture %w, %struct.Tag* noundef nonnull readonly align 8 dereferenceable(32) nocapture %t) #1 {
entry:
  call void @.json.encode.Tag(%struct.JsonWriter* %w, %struct.Tag* %t)
  ret void
}

define internal void @.json.decode.Tag(%struct.JsonDecoder* %r, %struct.Tag* %v) {
entry:
  %seen = alloca i1, align 1
  %seen.1 = alloca i1, align 1
  %seen.2 = alloca i1, align 1
  %seen.3 = alloca i1, align 1
  store i1 false, i1* %seen, align 1
  store i1 false, i1* %seen.1, align 1
  store i1 false, i1* %seen.2, align 1
  store i1 false, i1* %seen.3, align 1
  %0 = call i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* %r)
  br i1 %0, label %json.loop, label %json.done

json.loop:
  %1 = call i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* %r)
  br i1 %1, label %json.key, label %json.check

json.key:
  %2 = call i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* %r)
  switch i32 %2, label %json.unknown [ i32 2, label %json.length i32 6, label %json.length.1 i32 5, label %json.length.2 ]

json.length:
  %3 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  br i1 %3, label %json.field, label %json.unknown

json.length.1:
  %4 = call i32 @nish.JsonDecoder.keyByte(%struct.JsonDecoder* %r, i32 0)
  switch i32 %4, label %json.unknown [ i32 115, label %json.byte i32 108, label %json.byte.1 i32 -1, label %json.escaped ]

json.byte:
  %5 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  br i1 %5, label %json.field.1, label %json.unknown

json.byte.1:
  %6 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  br i1 %6, label %json.field.2, label %json.unknown

json.escaped:
  %7 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  br i1 %7, label %json.field.1, label %json.next

json.next:
  %8 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  br i1 %8, label %json.field.2, label %json.unknown

json.length.2:
  %9 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*))
  br i1 %9, label %json.field.3, label %json.unknown

json.field:
  %10 = load i1, i1* %seen, align 1
  br i1 %10, label %json.duplicate, label %json.take

json.take:
  store i1 true, i1* %seen, align 1
  %11 = call i64 @nish.JsonDecoder.u64(%struct.JsonDecoder* %r)
  %12 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 0
  store i64 %11, i64* %12, align 8, !tbaa !6
  br label %json.loop

json.field.1:
  %13 = load i1, i1* %seen.1, align 1
  br i1 %13, label %json.duplicate, label %json.take.1

json.take.1:
  store i1 true, i1* %seen.1, align 1
  %14 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 1
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !18
  %16 = call %struct.nish_array* @nish.JsonDecoder.u64Array(%struct.JsonDecoder* %r, %struct.nish_array* %15)
  %17 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 1
  store %struct.nish_array* %16, %struct.nish_array** %17, align 8, !tbaa !18
  br label %json.loop

json.field.2:
  %18 = load i1, i1* %seen.2, align 1
  br i1 %18, label %json.duplicate, label %json.take.2

json.take.2:
  store i1 true, i1* %seen.2, align 1
  %19 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 2
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !19
  %21 = call %struct.nish_array* @.json.decode.array.enum.Level(%struct.JsonDecoder* %r, %struct.nish_array* %20)
  %22 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 2
  store %struct.nish_array* %21, %struct.nish_array** %22, align 8, !tbaa !19
  br label %json.loop

json.field.3:
  %23 = load i1, i1* %seen.3, align 1
  br i1 %23, label %json.duplicate, label %json.take.3

json.take.3:
  store i1 true, i1* %seen.3, align 1
  %24 = call i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* %r)
  %25 = getelementptr inbounds %struct.JsonDecoder, %struct.JsonDecoder* %r, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !23
  %27 = icmp eq i32 %26, 0
  br i1 %27, label %json.read, label %json.stored

json.read:
  switch i32 %24, label %json.other [ i32 0, label %json.member i32 5, label %json.member i32 9, label %json.member ]

json.member:
  %28 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 3
  store i32 %24, i32* %28, align 4, !tbaa !20
  br label %json.stored

json.other:
  call void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* %r)
  br label %json.stored

json.stored:
  br label %json.loop

json.unknown:
  call void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* %r)
  br label %json.loop

json.duplicate:
  call void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* %r)
  br label %json.loop

json.check:
  %29 = load i1, i1* %seen, align 1
  br i1 %29, label %json.given, label %json.missing

json.given:
  %30 = load i1, i1* %seen.1, align 1
  br i1 %30, label %json.given.1, label %json.missing

json.given.1:
  %31 = load i1, i1* %seen.2, align 1
  br i1 %31, label %json.given.2, label %json.missing

json.given.2:
  %32 = load i1, i1* %seen.3, align 1
  br i1 %32, label %json.given.3, label %json.missing

json.given.3:
  br label %json.done

json.missing:
  call void @nish.JsonDecoder.missingField(%struct.JsonDecoder* %r)
  br label %json.done

json.done:
  ret void
}

define internal void @.json.encode.Tag(%struct.JsonWriter* %r, %struct.Tag* %v) {
entry:
  %0 = getelementptr inbounds %struct.JsonWriter, %struct.JsonWriter* %r, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !25
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %json.write, label %json.stop

json.stop:
  ret void

json.write:
  call void @nish.JsonWriter.beginObject(%struct.JsonWriter* %r)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %3 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 0
  %4 = load i64, i64* %3, align 8, !tbaa !6
  call void @nish.jsonEncodeU64(%struct.JsonWriter* %r, i64 %4)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  %5 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !18
  call void @nish.jsonEncodeU64Array(%struct.JsonWriter* %r, %struct.nish_array* %6)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %7 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 2
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !19
  call void @.json.encode.array.enum.Level(%struct.JsonWriter* %r, %struct.nish_array* %8)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*))
  %9 = getelementptr inbounds %struct.Tag, %struct.Tag* %v, i32 0, i32 3
  %10 = load i32, i32* %9, align 4, !tbaa !20
  call void @nish.JsonWriter.i32(%struct.JsonWriter* %r, i32 %10)
  call void @nish.JsonWriter.endObject(%struct.JsonWriter* %r)
  ret void
}

define internal %struct.nish_array* @.json.decode.array.enum.Level(%struct.JsonDecoder* %r, %struct.nish_array* %v) {
entry:
  %0 = call i1 @nish.JsonDecoder.beginArray(%struct.JsonDecoder* %r)
  br i1 %0, label %json.empty, label %json.done

json.empty:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  br label %json.loop

json.loop:
  %2 = call i1 @nish.JsonDecoder.nextElement(%struct.JsonDecoder* %r)
  br i1 %2, label %json.element, label %json.done

json.element:
  %3 = call i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* %r)
  %4 = getelementptr inbounds %struct.JsonDecoder, %struct.JsonDecoder* %r, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !23
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %json.read, label %json.loop

json.read:
  switch i32 %3, label %json.other [ i32 0, label %json.member i32 5, label %json.member i32 9, label %json.member ]

json.member:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %v, i64 4)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  store i32 %3, i32* %15, align 4, !alias.scope !11, !noalias !10, !tbaa !27
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  br label %json.loop

json.other:
  call void @nish.JsonDecoder.wrongType(%struct.JsonDecoder* %r)
  br label %json.loop

json.done:
  ret %struct.nish_array* %v
}

define internal void @.json.encode.array.enum.Level(%struct.JsonWriter* %r, %struct.nish_array* %v) {
entry:
  %at = alloca i64, align 8
  store i64 0, i64* %at, align 8
  call void @nish.JsonWriter.beginArray(%struct.JsonWriter* %r)
  br label %json.loop

json.loop:
  %0 = load i64, i64* %at, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %json.element, label %json.end

json.element:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !27
  call void @nish.JsonWriter.i32(%struct.JsonWriter* %r, i32 %8)
  %9 = add i64 %0, 1
  store i64 %9, i64* %at, align 8
  br label %json.loop

json.end:
  call void @nish.JsonWriter.endArray(%struct.JsonWriter* %r)
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i64", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Tag", !2, i64 0, !3, i64 8, !3, i64 16, !4, i64 24}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!5, !3, i64 8}
!19 = !{!5, !3, i64 16}
!20 = !{!5, !4, i64 24}
!21 = !{!"i1", !1, i64 0}
!22 = !{!"JsonDecoder", !3, i64 0, !4, i64 8, !4, i64 12, !4, i64 16, !21, i64 20, !21, i64 21}
!23 = !{!22, !4, i64 8}
!24 = !{!"JsonWriter", !3, i64 0, !4, i64 8, !4, i64 12, !4, i64 16, !4, i64 20, !4, i64 24, !4, i64 28, !4, i64 32, !4, i64 36, !4, i64 40, !21, i64 44, !21, i64 45, !21, i64 46}
!25 = !{!24, !4, i64 16}
!26 = !{!"element i32", !1, i64 0}
!27 = !{!26, !26, i64 0}
