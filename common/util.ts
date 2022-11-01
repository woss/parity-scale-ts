import type { DecodeBuffer } from "./buffer.ts";
import type { AnyCodec } from "./codec.ts";

export class CodecError extends Error {
  constructor(readonly codec: AnyCodec, message: string) {
    super(message);
  }
}

export class EncodeError extends CodecError {
  name = "EncodeError";
  constructor(codec: AnyCodec, readonly value: unknown, message: string) {
    super(codec, message);
  }
}

export class DecodeError extends CodecError {
  name = "DecodeError";
  constructor(codec: AnyCodec, readonly buffer: DecodeBuffer, message: string) {
    super(codec, message);
  }
}

export type Expand<T> = T extends T ? { [K in keyof T]: T[K] } : never;
export type U2I<U> = (U extends U ? (u: U) => 0 : never) extends (i: infer I) => 0 ? Extract<I, U> : never;
export type Narrow<T> =
  | (T extends infer U ? U : never)
  | Extract<T, number | string | boolean | bigint | symbol | null | undefined | []>
  | ([T] extends [[]] ? [] : { [K in keyof T]: Narrow<T[K]> });