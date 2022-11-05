import {
  AnyCodec,
  Codec,
  createCodec,
  DecodeError,
  Expand,
  metadata,
  Narrow,
  Native,
  withMetadata,
} from "../common/mod.ts";
import { dummy } from "./dummy.ts";
import { AnyField, NativeObject, object } from "./object.ts";

export function union<T extends Record<number, AnyCodec>>(
  getIndex: (value: Native<T[number]>) => keyof T & number,
  $members: Narrow<T>,
): Codec<Native<T[keyof T & number]>>;
export function union<T extends Record<number, AnyCodec>>(
  getIndex: (value: Native<T[number]>) => keyof T & number,
  $members: T,
): Codec<Native<T[keyof T & number]>> {
  return createCodec({
    _metadata: metadata("$.union", union, getIndex, $members as Narrow<T>),
    _staticSize: 1 + Math.max(...Object.values($members).map((x) => x._staticSize)),
    _encode(buffer, value) {
      const discriminant = getIndex(value);
      const $member = $members[discriminant]!;
      buffer.array[buffer.index++] = discriminant;
      $member._encode(buffer, value as never);
    },
    _decode(buffer) {
      const discriminant = buffer.array[buffer.index++]!;
      const $member = $members[discriminant];
      if (!$member) {
        throw new DecodeError(this, buffer, `No such member codec matching the discriminant \`${discriminant}\``);
      }
      return $member._decode(buffer);
    },
  });
}

export type AnyTaggedUnionMember = [tag: string, ...fields: AnyField[]];

export type NativeTaggedUnionMember<
  TK extends PropertyKey,
  M extends AnyTaggedUnionMember,
> = Expand<
  & Record<TK, M[0]>
  & (M extends [any, ...infer R] ? R extends AnyField[] ? NativeObject<R> : {} : never)
>;

export type NativeTaggedUnionMembers<
  TK extends PropertyKey,
  M extends Record<number, AnyTaggedUnionMember>,
> = [{ [K in keyof M]: NativeTaggedUnionMember<TK, Extract<M[K], AnyTaggedUnionMember>> }[keyof M & number]][0];

export function taggedUnion<
  TK extends PropertyKey,
  M extends Record<number, AnyTaggedUnionMember>,
>(
  tagKey: TK,
  members: Narrow<M>,
): Codec<NativeTaggedUnionMembers<TK, M>> {
  const tagToDiscriminant: Record<string, number> = {};
  const discriminantToMember: Record<number, Codec<any>> = {};
  for (const _discriminant in members) {
    const discriminant = +_discriminant;
    if (isNaN(discriminant)) continue;
    const [tag, ...fields] = (members as M)[discriminant]!;
    tagToDiscriminant[tag] = discriminant;
    discriminantToMember[discriminant] = object(
      [tagKey, dummy(tag)],
      ...fields,
    );
  }
  return withMetadata(
    metadata("$.taggedUnion", taggedUnion, tagKey, members),
    union(
      (value) => tagToDiscriminant[value[tagKey]]!,
      discriminantToMember,
    ),
  );
}

export function stringUnion<T extends string>(members: Record<number, T>): Codec<T> {
  const keyToDiscriminant: Record<string, number> = {};
  for (const _discriminant in members) {
    const discriminant = +_discriminant;
    if (isNaN(discriminant)) continue;
    const key = members[discriminant]!;
    keyToDiscriminant[key] = discriminant;
  }
  return createCodec({
    _metadata: metadata("$.stringUnion", stringUnion, members),
    _staticSize: 1,
    _encode(buffer, value) {
      const discriminant = keyToDiscriminant[value]!;
      buffer.array[buffer.index++] = discriminant;
    },
    _decode(buffer) {
      const discriminant = buffer.array[buffer.index++]!;
      return members[discriminant]!;
    },
  });
}
