# Cue interface structure

Cue is a compact broadcast console used while streaming. Its interface should feel calm, dense enough for quick operation, and predictable from one section to the next. It should resemble a purpose-built desktop tool rather than a collection of dashboard cards.

## Page types

- **Workspace** — panes for a task and its live result. Polls use a two-pane workspace. Contests use a two-pane giveaway console: setup or participant management on the left and participant or winner chat on the right.
  Polls show voting controls and matching chat messages, with no OBS preview. Poll preparation separates question and option rows from a 320px settings and launch rail at wide desktop sizes; narrow windows stack them. Active results use compact choice rows with proportion fills and visible counts; end/extend actions directly follow results. Contest eligibility remains manually editable until a winner is selected; rerolls exclude earlier winners. At narrow sizes, contest conditions lead, followed by eligibility and chat. Widget previews live in the dedicated studio section.
- Contest setup follows a three-step flow inside the primary pane: large mode choices, audience groups, then mode-specific settings. The participant pool replaces the setup flow after launch and carries search, count and the winner action; chat stays in the right pane throughout. Back and next actions keep a stable footer position. Do not expose an empty participant rail during setup or duplicate the winner action.
- **Studio** — a large preview with a fixed control rail on the right. The shared Widgets section selects polls, keyboard/mouse, or the unavailable contest widget. Available editors retain their state on switching and use the same studio shell. Contest must explicitly state that no OBS source exists until one is implemented.
- **Library** — a compact adaptive list rail on the left and a detail area on the right. Creating or editing a template temporarily uses the full workspace width, so the same form never gets squeezed beside the list.
- **Page** — one centered, scrolling container. Settings and Stream Dock use this shell.
  Settings use a single narrow reading column. Each section places its heading above one consistent list surface; individual rows never become separate cards. Account status leads the page, while project credits and support form a quiet footer outside the settings surfaces.

The application main area never scrolls. Every page owns exactly one primary scroll surface; desktop split panes may scroll independently.

## Application shell

- Sidebar and title bar share the theme's background. The main workspace is one inset surface with a 1px subtle border, 12px radius, and 8px clearance at the right and bottom edges.
- A 40px title bar contains browser-style workspace tabs. Sidebar navigation changes the current tab; only the plus button creates a new tab. Each tab owns navigation history, visited page state and its template editor. Polls, OBS and Twitch remain shared application resources. Closing a tab never stops a running poll or contest.
- Tabs scroll horizontally when space is limited. Keep native window controls and a draggable area clear. Hiding the sidebar removes it entirely and expands content to an 8px inset; the title bar reserves room for macOS controls.
- Keep page scrolling inside the workspace frame so its corners, sidebar, and tabs stay fixed. Shell colors use theme tokens.
- All tabs are 168px wide. Labels truncate with an ellipsis; full titles remain available on hover. Tab width is independent of label length and tab count.

## Spatial rules

- Page inset: 24px; 32px at large widths.
- Section gap: 24px. Use 32px only between distinct page groups.
- Control gap: 8px or 12px.
- Compact surface padding: 12px or 16px.
- Form surface padding: 20px.
- Main content width: 672px inside task panes; 1152px on centered pages.
- Control rail width: 352px.
- List rail width: 200–272px according to the available workspace width. Long names truncate inside the rail without increasing its width.
- App sidebar width: 220px visible, completely removed when hidden. The chosen state persists locally. Polls, templates and widget share one muted block without a visible category title. Navigation uses 40px rows, consistent icon alignment and restrained selection fill; other tools are separated by space. The profile has a matching compact surface at the bottom.
- Surface radius: 12px for controls and compact groups; 16px for larger panels.

## Composition

- Group fields by the decision they support. Do not wrap every field in its own card.
- Keep labels directly above their control and use the same 8px label gap.
- Put persistent actions at the end of the form or in a stable footer.
- Route titles and explanatory subtitles are omitted. Status belongs near the relevant control or result.
- Preview surfaces use `panel-muted`; control rails and list rails use `sidebar`.
- The preview is an OBS canvas: a restrained dot grid and safe-area frame make its purpose visible without explanatory text.
- Green marks live state, selection, and the primary action. Do not use it as ambient decoration.
- Navigation is flat. The active route uses a narrow signal rail. The single workspace frame separates content from app chrome; individual page sections retain their existing structure.
- Metadata stays inline unless it is directly interactive. Avoid turning every value into a pill.
- Avoid nested scroll areas unless the inner area is a live feed or a reorderable list.

## Widget editor

The Widgets page uses a compact 56px toolbar above the preview and inspector. Poll widget visibility lives in that toolbar. The inspector is 336px wide, aligns with the preview, and uses 44px property rows with dropdowns instead of repeated segmented buttons. Keep color selection compact and the OBS source/link actions at the inspector bottom. Poll preview uses a plain muted surface without a dot grid or nested safe-area border; the configured overlay itself remains unchanged.

## Shared forms

Use `form-controls.tsx` for fields, sections, content/settings columns, duration, colors, dropdown properties and switch rows. Inputs are 36px high, with 12px horizontal padding and the same subtle background, border, 6px radius and 2px focus/error ring. Textareas use the same skin with a 96px minimum height. Labels are 12px medium with an 8px control gap. Form sections are 24px apart; option rows are 8px apart. Switch/dropdown property rows are 44px high. Polls and templates share the same content/settings form; a template adds its name above the question. Both widget editors share color and property controls. Contests share fields and duration with polls. Page columns and action placement may differ for the task; field skins and group padding do not. Avoid independent per-route control skins or extra cards around individual fields.

Polls, templates and contests use one creation grammar: content fields on the left, duration/source/rules/actions in the settings rail, and the same responsive collapse rules. Their segmented controls and action rows come from `form-controls.tsx`; routes must not recreate those skins locally. At intermediate widths, settings may use two compact columns; at the narrowest width all groups stack. Do not add a separate tinted card around the settings. Template creation hides the library rail and places cancel/save in the same settings action slot used by launch actions. Template details keep metadata inline below the title and keep destructive and primary actions in one stable footer. Widget inspectors consistently use horizontal 44px property rows because they are property panels, not creation forms.
