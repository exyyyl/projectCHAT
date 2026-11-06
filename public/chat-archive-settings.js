export const archiveLimitRanges = Object.freeze({ maxMessages: [100, 1_000_000], maxBytes: [16 * 1024 * 1024, 2048 * 1024 * 1024] });
export function validArchiveLimits(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2
    && Object.entries(archiveLimitRanges).every(([key, [min, max]]) => Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max);
}
