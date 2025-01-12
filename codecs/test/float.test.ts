import * as $ from "../../mod.ts"
import { testCodec, testInvalid } from "../../test-util.ts"

testCodec($.f64, [
  0,
  1,
  -1,
  1.2345,
  1e23,
  4e-56,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  NaN,
  -Infinity,
  Infinity,
])

testInvalid($.f64, ["0", null, {}])
