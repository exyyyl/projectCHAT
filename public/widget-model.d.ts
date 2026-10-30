import type { WidgetSettings } from "../ui/panel/src/domain/polls";
export const widgetDefaults: WidgetSettings;
export function resolveWidget(input?: Partial<WidgetSettings>): WidgetSettings;
export function widgetStyle(
  input?: Partial<WidgetSettings>,
): Record<string, string>;
