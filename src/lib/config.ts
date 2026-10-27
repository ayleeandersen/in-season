// Every tunable threshold lives here. No magic numbers elsewhere.
export const CONFIG = {
  sampleSizePx: 15,          // square averaged around a photo tap
  dropBrightestPct: 0.10,    // ignore highlights/sheen when sampling
  nearestK: 3,               // swatches averaged per season score
  greatMaxDeltaE: 6,         // < 6  => Great
  okayMaxDeltaE: 12,         // 6–12 => Okay, > 12 => Avoid
  matchPctSlope: 5,          // match% = max(0, 100 - slope * deltaE)
  tieWindowPct: 3,           // show top-2 when within this many points
  maxSamplingEdgePx: 2048,   // photos are downscaled to this long edge before sampling
};
