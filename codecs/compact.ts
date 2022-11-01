import { Codec, CodecVisitor, createCodec, DecodeError, withMetadata } from "../common/mod.ts";
import { dummy } from "./dummy.ts";
import { u128, u16, u256, u32, u64, u8 } from "./int.ts";
import { object } from "./object.ts";
import { tuple } from "./tuple.ts";

const MAX_U6 = 0b00111111;
const MAX_U14 = 0b00111111_11111111;
const MAX_U30 = 0b00111111_11111111_11111111_11111111;

export const compactVisitor = new CodecVisitor<Codec<any>>();

export function compact<T>(codec: Codec<T>): Codec<T> {
  return compactVisitor.visit(codec);
}

const compactNumber: Codec<number> = createCodec({
  name: "$.compactNumber",
  _metadata: null,
  _staticSize: 5,
  _encode(buffer, value) {
    if (value <= MAX_U6) {
      buffer.array[buffer.index++] = value << 2;
    } else if (value <= MAX_U14) {
      u16._encode(buffer, (value << 2) | 0b01);
    } else if (value <= MAX_U30) {
      // Because JS bitwise ops use *signed* 32-bit ints, this operation
      // produces negative values when `value >= 2 ** 29`. However, this is ok,
      // as `setUint32` correctly casts these negative values back to unsigned
      // 32-bit ints.
      u32._encode(buffer, (value << 2) | 0b10);
    } else {
      buffer.array[buffer.index++] = 0b11;
      u32._encode(buffer, value);
    }
  },
  _decode(buffer) {
    switch (buffer.array[buffer.index]! & 0b11) {
      case 0:
        return buffer.array[buffer.index++]! >> 2;
      case 1:
        return u16._decode(buffer) >> 2;
      case 2:
        // We use an unsigned right shift, as the default shift operator
        // uses signed 32-bit ints, which would yield invalid values.
        return u32._decode(buffer) >>> 2;
      default:
        if (buffer.array[buffer.index++]! !== 3) throw new DecodeError(this, buffer, "Out of range for U32");
        return u32._decode(buffer);
    }
  },
});

const compactU8 = withMetadata("$.compact", [compact, u8], compactNumber);
const compactU16 = withMetadata("$.compact", [compact, u16], compactNumber);
const compactU32 = withMetadata("$.compact", [compact, u32], compactNumber);

compactVisitor.add(u8, () => compactU8);
compactVisitor.add(u16, () => compactU16);
compactVisitor.add(u32, () => compactU32);

const compactBigInt: Codec<bigint> = createCodec({
  name: "$.compactBigInt",
  _metadata: null,
  _staticSize: 5,
  _encode(buffer, value) {
    if (value <= 0xff_ff_ff_ff) {
      compactNumber._encode(buffer, Number(value));
      return;
    }
    let extraBytes = 0;
    let _value = value >> 32n;
    while (_value > 0n) {
      _value >>= 8n;
      extraBytes++;
    }
    buffer.array[buffer.index++] = (extraBytes << 2) | 0b11;
    u32._encode(buffer, Number(value & 0xff_ff_ff_ffn));
    _value = value >> 32n;
    buffer.pushAlloc(extraBytes);
    for (let i = 0; i < extraBytes; i++) {
      buffer.array[buffer.index++] = Number(_value & 0xffn);
      _value >>= 8n;
    }
    buffer.popAlloc();
  },
  _decode(buffer) {
    const b = buffer.array[buffer.index]!;
    if ((b & 0b11) < 3 || b === 3) {
      return BigInt(compactNumber._decode(buffer));
    }
    const extraBytes = b >> 2;
    buffer.index++;
    let value = BigInt(u32._decode(buffer));
    for (let i = 0; i < extraBytes; i++) {
      value |= BigInt(buffer.array[buffer.index++]!) << BigInt(32 + i * 8);
    }
    return value;
  },
});

const compactU64 = withMetadata("$.compact", [compact, u64], compactBigInt);
const compactU128 = withMetadata("$.compact", [compact, u128], compactBigInt);
const compactU256 = withMetadata("$.compact", [compact, u256], compactBigInt);

compactVisitor.add(u64, () => compactU64);
compactVisitor.add(u128, () => compactU128);
compactVisitor.add(u256, () => compactU256);

compactVisitor.add(dummy<any>, (codec) => codec);

compactVisitor.add(tuple<any[]>, (codec, ...entries) => {
  if (entries.length === 0) return codec;
  if (entries.length > 1) throw new Error("Cannot derive compact codec for tuples with more than one field");
  return withMetadata("$.compact", [compact, codec], tuple<any[]>(compact(entries[0]!)));
});

compactVisitor.add(object<any[]>, (codec, ...entries) => {
  if (entries.length === 0) return codec;
  if (entries.length > 1) throw new Error("Cannot derive compact codec for objects with more than one field");
  return withMetadata("$.compact", [compact, codec], object<any[]>([entries[0][0], compact(entries[0][1])]));
});