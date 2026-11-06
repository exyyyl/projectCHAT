export type ArchiveLimits = { maxMessages: number; maxBytes: number };
export const archiveLimitRanges: Readonly<Record<keyof ArchiveLimits, readonly [number, number]>>;
export function validArchiveLimits(value: unknown): value is ArchiveLimits;
