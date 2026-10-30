export function connectEvents(url: string, handlers: Record<string, (data: never) => void>, onConnection?: (connected: boolean) => void): { close(): void };
