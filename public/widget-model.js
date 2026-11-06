import { widgetFontFamily } from './widget-fonts.js';
// Shared by the editor, saved-state migration, and the OBS browser source.
export const widgetDefaults = {
  accent: '#d3fb75', surface: 'solid', density: 'comfortable', radius: 'medium',
  titleSize: 'medium', width: 'medium', opacity: 100, font: 'geist',
  optionStyle: 'cards', optionSize: 'medium', keywordStyle: 'filled', barSize: 'medium',
  showTimer: true, showKeywords: true, showBars: true, showVotes: true, showPercentages: true,
  layout: 'vertical', alignment: 'left', panelColor: '#111318', textColor: '#f4f4f5', mutedColor: '#a1a5af',
  trackColor: '#30343c', panelWidth: 440, padding: 24, gap: 12, cornerRadius: 16,
  titleFontSize: 30, optionFontSize: 16, barHeight: 6, showTotal: true,
  showNumbers: false, highlightWinner: true,
};

export function resolveWidget(input = {}) {
  const value = { ...widgetDefaults, ...input };
  return {
    ...value,
    panelWidth: input.panelWidth ?? (value.layout === 'horizontal' ? 960 : value.layout === 'grid' ? 760 : { narrow: 360, medium: 440, wide: 640 }[value.width]),
    padding: input.padding ?? (value.density === 'compact' ? 16 : 24),
    gap: input.gap ?? (value.density === 'compact' ? 8 : 12),
    cornerRadius: input.cornerRadius ?? ({ small: 8, medium: 16, large: 28 }[value.radius]),
    titleFontSize: input.titleFontSize ?? ({ small: 24, medium: 30, large: 38 }[value.titleSize]),
    optionFontSize: input.optionFontSize ?? ({ small: 14, medium: 16, large: 20 }[value.optionSize]),
    barHeight: input.barHeight ?? ({ thin: 3, medium: 6, thick: 10 }[value.barSize]),
  };
}

export function widgetStyle(input) {
  const widget = resolveWidget(input);
  return {
    '--cue-accent': widget.accent, '--cue-panel': widget.panelColor,
    '--cue-text': widget.textColor, '--cue-muted': widget.mutedColor,
    '--cue-track': widget.trackColor, '--cue-opacity': String(widget.opacity / 100),
    '--cue-width': `${widget.panelWidth}px`, '--cue-padding': `${widget.padding}px`,
    '--cue-gap': `${widget.gap}px`, '--cue-radius': `${widget.cornerRadius}px`,
    '--cue-title-size': `${widget.titleFontSize}px`, '--cue-option-size': `${widget.optionFontSize}px`,
    '--cue-bar-height': `${widget.barHeight}px`,
    fontFamily: widgetFontFamily(widget.font),
  };
}
