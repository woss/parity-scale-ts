import * as $ from "../../mod.ts"
import { testCodec, testInvalid } from "../../test-util.ts"

testCodec($.lenPrefixed($.constant(null)), [null])

testCodec($.lenPrefixed($.array($.compact($.u32))), {
  empty: [],
  primes: [2, 3, 5, 7, 11, 13, 17, 23, 29],
  squares: [...Array(1000)].map((_, i) => i ** 2),
})

testCodec($.lenPrefixed($.promise($.compact($.u32))), {
  123: () => new Promise((r) => setTimeout(() => r(123), 100)),
}, true)

testInvalid($.lenPrefixed($.u8), [null, undefined, -1])
