%struct.Renamed = type { %struct.JsonNumber*, i32, i32 }
%struct.JsonWriter = type { %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1, i1, i1 }
%struct.JsonDecoder = type { %struct.JsonTokenizer*, i32, i32, i1, i1 }
%struct.JsonNumber = type { %struct.nish_array*, i32 }
%struct.JsonTokenizer = type { %struct.nish_array*, i64, i64, %struct.nish_array*, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i1 }
%struct.JsonLimits = type { i32, i32, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"amount\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"user_id\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"tries\00" }, align 8
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
declare void @nish.JsonNumber.constructor(%struct.JsonNumber* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #0
declare noundef nonnull align 8 i8* @nish.JsonNumber.text(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef nonnull align 8 dereferenceable(96) %struct.JsonTokenizer* @nish.JsonNumber.reader(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.isI64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i64 @nish.JsonNumber.i64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.isU64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef i64 @nish.JsonNumber.u64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef double @nish.JsonNumber.f64(%struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noundef zeroext i1 @nish.JsonNumber.setText(%struct.JsonNumber* noundef nonnull align 8 dereferenceable(16) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #1
declare void @nish.jsonEncodeNumber(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.JsonNumber* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
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
declare void @nish.JsonLimits.constructor(%struct.JsonLimits* noundef nonnull noalias align 8 dereferenceable(16) nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3

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

define void @Renamed.constructor(%struct.Renamed* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %this, i32 0, i32 2
  store i32 3, i32* %1, align 4, !tbaa !6
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.JsonNumber*
  call void @nish.JsonNumber.constructor(%struct.JsonNumber* %3)
  %4 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %this, i32 0, i32 0
  store %struct.JsonNumber* %3, %struct.JsonNumber** %4, align 8, !tbaa !7
  ret void
}

define noundef i32 @renamedDecode(%struct.JsonDecoder* noundef nonnull align 8 dereferenceable(24) %d, %struct.Renamed* noundef nonnull align 8 dereferenceable(16) %r) #1 {
entry:
  call void @.json.decode.Renamed(%struct.JsonDecoder* %d, %struct.Renamed* %r)
  %0 = call i32 @nish.JsonDecoder.finish(%struct.JsonDecoder* %d)
  ret i32 %0
}

define void @renamedEncode(%struct.JsonWriter* noundef nonnull align 8 dereferenceable(48) nocapture %w, %struct.Renamed* noundef nonnull readonly align 8 dereferenceable(16) nocapture %r) #1 {
entry:
  call void @.json.encode.Renamed(%struct.JsonWriter* %w, %struct.Renamed* %r)
  ret void
}

define internal void @.json.decode.Renamed(%struct.JsonDecoder* %r, %struct.Renamed* %v) {
entry:
  %seen = alloca i1, align 1
  %seen.1 = alloca i1, align 1
  %seen.2 = alloca i1, align 1
  store i1 false, i1* %seen, align 1
  store i1 false, i1* %seen.1, align 1
  store i1 false, i1* %seen.2, align 1
  %0 = call i1 @nish.JsonDecoder.beginObject(%struct.JsonDecoder* %r)
  br i1 %0, label %json.loop, label %json.done

json.loop:
  %1 = call i1 @nish.JsonDecoder.nextField(%struct.JsonDecoder* %r)
  br i1 %1, label %json.key, label %json.check

json.key:
  %2 = call i32 @nish.JsonDecoder.keyLength(%struct.JsonDecoder* %r)
  switch i32 %2, label %json.unknown [ i32 6, label %json.length i32 7, label %json.length.1 i32 5, label %json.length.2 ]

json.length:
  %3 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  br i1 %3, label %json.field, label %json.unknown

json.length.1:
  %4 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*))
  br i1 %4, label %json.field.1, label %json.unknown

json.length.2:
  %5 = call i1 @nish.JsonDecoder.keyIs(%struct.JsonDecoder* %r, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  br i1 %5, label %json.field.2, label %json.unknown

json.field:
  %6 = load i1, i1* %seen, align 1
  br i1 %6, label %json.duplicate, label %json.take

json.take:
  store i1 true, i1* %seen, align 1
  %7 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 0
  %8 = load %struct.JsonNumber*, %struct.JsonNumber** %7, align 8, !tbaa !7
  call void @.json.decode.JsonNumber(%struct.JsonDecoder* %r, %struct.JsonNumber* %8)
  br label %json.loop

json.field.1:
  %9 = load i1, i1* %seen.1, align 1
  br i1 %9, label %json.duplicate, label %json.take.1

json.take.1:
  store i1 true, i1* %seen.1, align 1
  %10 = call i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* %r)
  %11 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 1
  store i32 %10, i32* %11, align 4, !tbaa !5
  br label %json.loop

json.field.2:
  %12 = load i1, i1* %seen.2, align 1
  br i1 %12, label %json.duplicate, label %json.take.2

json.take.2:
  store i1 true, i1* %seen.2, align 1
  %13 = call i32 @nish.JsonDecoder.i32(%struct.JsonDecoder* %r)
  %14 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 2
  store i32 %13, i32* %14, align 4, !tbaa !6
  br label %json.loop

json.unknown:
  call void @nish.JsonDecoder.unknownField(%struct.JsonDecoder* %r)
  br label %json.loop

json.duplicate:
  call void @nish.JsonDecoder.duplicateField(%struct.JsonDecoder* %r)
  br label %json.loop

json.check:
  %15 = load i1, i1* %seen, align 1
  br i1 %15, label %json.given, label %json.missing

json.given:
  %16 = load i1, i1* %seen.1, align 1
  br i1 %16, label %json.given.1, label %json.missing

json.given.1:
  %17 = load i1, i1* %seen.2, align 1
  br i1 %17, label %json.given.2, label %json.default

json.default:
  %18 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 2
  store i32 3, i32* %18, align 4, !tbaa !6
  br label %json.given.2

json.given.2:
  br label %json.done

json.missing:
  call void @nish.JsonDecoder.missingField(%struct.JsonDecoder* %r)
  br label %json.done

json.done:
  ret void
}

define internal void @.json.encode.Renamed(%struct.JsonWriter* %r, %struct.Renamed* %v) {
entry:
  %0 = getelementptr inbounds %struct.JsonWriter, %struct.JsonWriter* %r, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !10
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %json.write, label %json.stop

json.stop:
  ret void

json.write:
  call void @nish.JsonWriter.beginObject(%struct.JsonWriter* %r)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %3 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 0
  %4 = load %struct.JsonNumber*, %struct.JsonNumber** %3, align 8, !tbaa !7
  call void @.json.encode.JsonNumber(%struct.JsonWriter* %r, %struct.JsonNumber* %4)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*))
  %5 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  call void @nish.JsonWriter.i32(%struct.JsonWriter* %r, i32 %6)
  call void @nish.JsonWriter.key(%struct.JsonWriter* %r, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %7 = getelementptr inbounds %struct.Renamed, %struct.Renamed* %v, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !6
  call void @nish.JsonWriter.i32(%struct.JsonWriter* %r, i32 %8)
  call void @nish.JsonWriter.endObject(%struct.JsonWriter* %r)
  ret void
}

define internal void @.json.decode.JsonNumber(%struct.JsonDecoder* %r, %struct.JsonNumber* %v) {
entry:
  call void @nish.JsonDecoder.number(%struct.JsonDecoder* %r, %struct.JsonNumber* %v)
  ret void
}

define internal void @.json.encode.JsonNumber(%struct.JsonWriter* %r, %struct.JsonNumber* %v) {
entry:
  call void @nish.jsonEncodeNumber(%struct.JsonWriter* %r, %struct.JsonNumber* %v)
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Renamed", !2, i64 0, !3, i64 8, !3, i64 12}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !3, i64 12}
!7 = !{!4, !2, i64 0}
!8 = !{!"i1", !1, i64 0}
!9 = !{!"JsonWriter", !2, i64 0, !3, i64 8, !3, i64 12, !3, i64 16, !3, i64 20, !3, i64 24, !3, i64 28, !3, i64 32, !3, i64 36, !3, i64 40, !8, i64 44, !8, i64 45, !8, i64 46}
!10 = !{!9, !3, i64 16}
