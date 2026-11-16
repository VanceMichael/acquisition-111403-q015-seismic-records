// 连续性说明：按 台网.台站.位置码.通道 与采样间隔分组核对已归档分段。
// 只描述缺口、重叠与时间不确定，不为拼合连续数组而补值，不跨采样率边界合并。

function timeFlags(segment) {
  const flags = [];
  if (!segment.correctionApplied && BigInt(segment.timeCorrectionNs) !== 0n) flags.push('correction-pending');
  if (segment.timingQuality === null) flags.push('quality-unknown');
  return flags;
}

function entry(segment) {
  const start = BigInt(segment.startNs);
  const interval = BigInt(segment.intervalNs);
  const count = BigInt(segment.sampleCount);
  return {
    id: segment.id,
    startNs: segment.startNs,
    endNs: (start + count * interval).toString(),
    sampleCount: segment.sampleCount,
    timingQuality: segment.timingQuality,
    timeCorrectionNs: segment.timeCorrectionNs,
    correctionApplied: segment.correctionApplied,
    timeFlags: timeFlags(segment),
    replacementOf: segment.replacementOf,
    receipt: segment.receipt ?? null,
    sourceUrl: segment.sourceUrl ?? null,
    revision: segment.revision
  };
}

function divided(durationNs, intervalNs) {
  const duration = BigInt(durationNs), interval = BigInt(intervalNs);
  return duration % interval === 0n ? (duration / interval).toString() : null;
}

function assessRate(list) {
  const ordered = [...list].sort((left, right) => {
    const starts = BigInt(left.startNs) - BigInt(right.startNs);
    return starts < 0n ? -1 : starts > 0n ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const segments = ordered.map(entry);
  const gaps = [], overlaps = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1], current = ordered[index];
    const interval = BigInt(previous.intervalNs);
    const expected = BigInt(previous.startNs) + BigInt(previous.sampleCount) * interval;
    const start = BigInt(current.startNs);
    if (start > expected) {
      const duration = start - expected;
      gaps.push({
        afterId: previous.id, beforeId: current.id,
        fromNs: expected.toString(), toNs: current.startNs,
        durationNs: duration.toString(),
        missingSamples: divided(duration, interval)
      });
    } else if (start < expected) {
      const currentEnd = start + BigInt(current.sampleCount) * interval;
      const end = expected < currentEnd ? expected : currentEnd;
      const duration = end - start;
      overlaps.push({
        firstId: previous.id, secondId: current.id,
        fromNs: current.startNs, toNs: end.toString(),
        durationNs: duration.toString(),
        overlappingSamples: divided(duration, interval)
      });
    }
  }
  const uncertain = segments.filter(segment => segment.timeFlags.length > 0).length;
  return {
    intervalNs: ordered[0].intervalNs,
    segments, gaps, overlaps,
    summary: {segments: segments.length, gaps: gaps.length, overlaps: overlaps.length, uncertain}
  };
}

export function assessContinuity(segments) {
  const streams = new Map();
  for (const segment of segments) {
    if (!streams.has(segment.identifier)) streams.set(segment.identifier, new Map());
    const rates = streams.get(segment.identifier);
    if (!rates.has(segment.intervalNs)) rates.set(segment.intervalNs, []);
    rates.get(segment.intervalNs).push(segment);
  }
  const report = [];
  for (const identifier of [...streams.keys()].sort()) {
    const rates = streams.get(identifier);
    const first = rates.values().next().value[0];
    report.push({
      identifier,
      stream: first.stream,
      rates: [...rates.entries()]
        .sort((left, right) => (BigInt(left[0]) < BigInt(right[0]) ? -1 : 1))
        .map(([, list]) => assessRate(list))
    });
  }
  const all = report.flatMap(stream => stream.rates);
  return {
    streams: report,
    totals: {
      streams: report.length,
      segments: all.reduce((sum, rate) => sum + rate.summary.segments, 0),
      gaps: all.reduce((sum, rate) => sum + rate.summary.gaps, 0),
      overlaps: all.reduce((sum, rate) => sum + rate.summary.overlaps, 0),
      uncertain: all.reduce((sum, rate) => sum + rate.summary.uncertain, 0)
    }
  };
}
