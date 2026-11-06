import type { WidgetFont } from './widget-fonts.js';
export type ContestOverlaySettings = { enabled:boolean; font:WidgetFont; layout:'stacked'|'split'|'banner'; alignment:'auto'|'left'|'center'; width:number; fontSize:number; radius:number; opacity:number; accentColor:string; backgroundColor:string; textColor:string; showTimer:boolean; showCount:boolean; showRecent:boolean };
export const contestOverlayDefaults: Readonly<ContestOverlaySettings>;
export const contestOverlayRanges: Readonly<Record<string,readonly [number,number]>>;
export type PublicContest = {id:string;status:'collecting'|'ready'|'winner'|'finished';mode:'keyword'|'active'|'number';keyword:string;numberMin:number|null;numberMax:number|null;winningNumber:number|null;deadline:number;drawnAt:number;participantCount:number;recentNames:string[];winner:{name:string}|null};
export function publicContest(contest: {id:string;status:PublicContest['status'];mode:PublicContest['mode'];keyword:string;numberMin:number|null;numberMax:number|null;winningNumber:number|null;deadline:number;drawnAt?:number;participants:{name:string;eligible:boolean}[];winner:{name:string}|null}|null):PublicContest|null;
export function contestPresentation(contest:PublicContest|null,now:number):{phase:string;seconds:number;name:string};
