# Cue interface structure

Cue is a compact broadcast console used while streaming. Its interface should feel calm, dense enough for quick operation, and predictable from one section to the next. It should resemble a purpose-built desktop tool rather than a collection of dashboard cards.

## Page types

- **Workspace** — panes for a task and its live result. Polls use a two-pane workspace. Contests use a two-pane giveaway console: setup or participant management on the left and participant or winner chat on the right.
  Polls show voting controls and matching chat messages, with no OBS preview. Poll preparation separates question and option rows from a 320px settings and launch rail at wide desktop sizes; narrow windows stack them. Active results use compact choice rows with proportion fills and visible counts; end/extend actions directly follow results. Contest eligibility remains manually editable until a winner is selected; rerolls exclude earlier winners. At narrow sizes, contest conditions lead, followed by eligibility and chat. Widget previews live in the dedicated studio section.
- Contest setup follows a three-step flow inside the primary pane: large mode choices, audience groups, then mode-specific settings. The participant pool replaces the setup flow after launch and carries search, count and the winner action; chat stays in the right pane throughout. Back and next actions keep a stable footer position. Do not expose an empty participant rail during setup or duplicate the winner action.
- **Studio** — a broadcast canvas with output actions above and contextual editing below. No permanent property sidebar. Poll, chat and contest editors share the same toolbar and OBS connection controls. Keyboard/mouse output remains out of scope.
- **Library** — a compact adaptive list rail on the left and a detail area on the right. Creating or editing a template temporarily uses the full workspace width, so the same form never gets squeezed beside the list.
- **Page** — one centered, scrolling container. Settings use this shell.
  Stream Dock opens from a full-width Settings launcher with a keypad symbol, installation summary, small plugin marks and chevron. Its plugin window follows the approved soft tray: two substantial pastel plates side by side, lavender for Twitch and blue for Discord, each with its service mark and a full-width capsule download action. Discord’s Elgato prerequisite stays visible before downloading. A slim neutral strip below holds Опросы Cue and В разработке. Keep the visible header to Плагины and close; omit refresh/help buttons, installation disclosure text and the AJAZZ subtitle. Installation status refreshes on opening and window focus after an installer. At narrow widths the two service plates remain side by side with their marks above the names; the window stays within the viewport and its body scrolls when needed.
  Settings use one scrolling page of clearly separated, quiet blocks. A compact Twitch identity leads the page. Appearance spans the full width with small theme previews; Application and Updates share the next row, followed by Data and About Cue. Below 1024px the blocks form one column. All blocks use the same surface token, 12px corners, 20px padding and 20px spacing, without row dividers or nested settings navigation.

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
- Surface radius: 12px for controls and compact groups; 16px for larger panels. Utility launchers, utility windows, the chat composer and emote picker use the softer rounded language described below.

## Composition

- Group fields by the decision they support. Do not wrap every field in its own card.
- Keep labels directly above their control and use the same 8px label gap.
- Put persistent actions at the end of the form or in a stable footer.
- Route titles and explanatory subtitles are omitted. Status belongs near the relevant control or result.
- Preview surfaces use `panel-muted`; control rails and list rails use `sidebar`. The widget studio inspector uses `surface-subtle`.
- The widget studio uses a plain OBS canvas with local dark, light, or chroma backgrounds, without a dot grid or nested safe-area frame.
- Green marks live state, selection, and the primary action in the main workspace. Utility service plates, report download and the chat composer use their scoped pastel actions; keep these colors local to their function. Do not use green as ambient decoration.
- Navigation is flat. The active route uses a narrow signal rail. The single workspace frame separates content from app chrome; individual page sections retain their existing structure.
- Metadata stays inline unless it is directly interactive. Avoid turning every value into a pill.
- Avoid nested scroll areas unless the inner area is a live feed or a reorderable list.

## Widget editor

Poll, chat and contest editors share `WidgetStudioToolbar`: direct widget tabs, a local demo/live switch, labeled output visibility and an OBS connection popover. Test controls are direct buttons in a floating strip; opening it never changes canvas geometry. The stable URL, source dimensions, copy and open actions appear in the connection popover. Contest output is available in production now that its source is implemented.

Do not restore a permanent inspector or a source footer. Five small editing controls sit below the canvas: layout, text, options, colors and composition. They begin closed. Activating one opens only its relevant properties in a short tray below the controls; activating it again or closing the tray returns to the canvas. Clicking the question, options or background in the preview opens the corresponding properties. Question and option selection also support keyboard activation.

Keep every manual appearance setting available. Layout contains format, width, padding and radius; text contains font and question/option sizes; options contain result style, keyword style, bar thickness and spacing; colors contain surface, opacity and independent accent/background/text/secondary/track colors; composition contains the eight visibility and winner controls. Reuse shared dropdowns, switches and inputs. Numeric and HEX editors are compact property controls, not independent cards.

Properties use a two-column grid with 44px minimum rows. At 520px or less the tray becomes one column; it scrolls within a bounded height so the widget and category controls remain reachable. The canvas keeps its width when settings open and refits vertically. Compact controls retain their accessible names and current-selection states.

The poll test strip exposes voting, empty and final states, background swatches, zoom buttons and reset. None of these test controls mutates the live poll. Vertical and horizontal formats start at 440px and 960px and remain manually editable. Preview and OBS share `public/widget.css` and `public/widget-model.js`. Source dimensions include the measured content and 24px browser-source padding on each side.

## Main chat

The main chat has no route title or moderation header button. Keep the feed primary and place its composer below it as one rounded capsule (28px corners), with a quiet emote trigger and a circular lavender arrow submit action. The emote picker shares the soft charcoal utility material: rounded popover (26px corners), capsule search, a compact provider-filter row and a scrollable emote grid. Selected provider filters use soft lavender, mint, peach or sand fills; unselected filters stay quiet. The picker fits the available viewport, switches from seven to six grid columns on the narrowest windows, and restores composer focus on close.

Moderation belongs to each eligible message. Drag left to delete; drag right to progress through 1 minute, 5 minutes, 10 minutes, 1 hour, 1 day, 7 days, 14 days and finally permanent ban. Display the current action behind the moving message. Releasing a right swipe after the threshold replaces that same row with an inline confirmation showing the captured duration, viewer name and Yes/No buttons; only Yes executes a timeout or permanent ban. Focus No by default, let No and Escape cancel, and discard the pending choice if moderation permission or message eligibility is lost. Duration-menu selections use the same confirmation. Left-swipe deletion still commits on release. Scale travel to the message width so all choices remain reachable on touch screens. Escape, pointer cancellation and returning below the threshold cancel the gesture; vertical scrolling must remain available. Replace hover action buttons with one persistent six-dot grip at the left of each eligible message. The marker supports dragging and opens the compact action menu on click or keyboard activation; message-body swiping remains available. Keep permissions, deleted state and pending delivery respected. A permanent ban has its own final travel segment.

## Chat widget studio

The chat editor follows the poll editor: one full-size canvas and a bottom navigation with Appearance, Text, Colors, Messages and Motion. All settings start closed; opening a category reveals only that category in the shared, height-bounded property tray. Do not add a permanent look gallery, quick-settings strip or separate inspector. Widget types use direct labeled tabs in every editor, respecting production feature visibility. The chat header places widget tabs and direct Demo/Your Chat buttons with adjacent playback on the left, output visibility and OBS connection on the right. Test opens a floating strip of sample buttons and background swatches anchored below the header; it stays open so subsequent choices take one click. It must never participate in the canvas flex layout or change its geometry. Avoid nested dropdowns for preview controls. At narrow widths the preview controls form a compact second row. Output visibility uses a labeled eye button (Show/Hide overlay), a pressed state and action tooltip; the separate connection button explicitly says Connect OBS.

Appearance contains four compact samples rendered with the actual overlay CSS: Studio, Feed, Conversation and Light. Selecting a look changes appearance only, preserving output, lifetime, count, alignment, emote service and motion. Keep every manual setting accessible through the contextual categories; hide irrelevant background controls in text-only mode and fallback nickname color when Twitch colors are enabled. Use shared input, dropdown and switch controls.

Demo samples include long paragraphs, unbroken text, links and emote sequences. These stay local and never enter Twitch or the archive. Edge-case samples remain visible while paused; normal demonstration and live chat obey the configured expiry. Every overlay style wraps text and emotes within the source width. Use plain dark, light or chroma canvas backgrounds. Scale by available width and adapt the visible height for short windows.

## Shared forms

Loading states use shared Skeleton and SkeletonGroup components: low-contrast, theme-aware placeholders follow the actual journal, chat, profile, account, contest, update and emote layouts. A restrained 1.8-second shimmer stops completely for reduced motion. Keep loading labels available to assistive technology, preserve loaded content during background refreshes, and show real empty or error states after requests finish. Startup respects the saved sidebar state.

Stream Dock and the error journal share a utility launcher and window family in Settings: softly raised charcoal surfaces, generous rounded corners (24px launchers, 28px windows), quiet icon-led headers and circular close controls. Windows use a subtle border and ambient shadow, stay within the viewport and preserve a single primary scrolling body. Utility surfaces derive from the active theme rather than a separate hard-coded dark skin. Hover and focus remain visible; reduced motion removes their transitions.

The error journal is one expandable rounded list on desktop and narrow windows. Each initially closed entry shows a peach source chip, title, last occurrence, an optional lavender repeat chip and chevron. Opening an entry reveals the explanation and metadata; sanitized technical details remain behind a second, initially closed disclosure. Show the storage limits as quiet capsules: 100 records, 30 days and 512 KB. Clear, copy and report download stay in a stable footer with rounded capsule buttons: download is pastel blue, copy is neutral, and clear stays quiet. On narrow windows the download action spans its own row. Keep only the lightweight journal summary while the window is closed; load the report on opening and release its detailed contents on close. Error toasts place the shared secondary “Подробнее ↗” button below the description; inline errors use the same action label to open the journal.

Settings expose Stable and Beta through a direct segmented selector. Only the selected build's version, progress and explicit download/restart actions appear below it; choosing a segment never installs or activates a runtime. Check and release notes share the selector's action row. Omit repeated headings and persistent explanatory paragraphs. Cached versions remain launchable offline; downloading never activates a build until the user requests a restart. Development/browser restrictions stay inline; the short data-isolation note appears only when Beta is selected. Settings and profile controls do not add tooltips. About Cue places contributor names above their roles, with an icon-only, accessibly named Telegram link in its block header. Sidebar profiles use a 28px rounded-square avatar, a single-line name and a settings affordance, without an avatar dot, connection checkmark or normal-state status subtitle. Reconnection remains visibly labeled. The settings identity shows the Twitch service caption, a direct connect/disconnect action and any connection error inline.

Use `form-controls.tsx` for fields, sections, content/settings columns, duration, colors, dropdown properties and switch rows. Inputs are 36px high, with 12px horizontal padding and the same subtle background, border, 6px radius and 2px focus/error ring. Textareas use the same skin with a 96px minimum height. Labels are 12px medium with an 8px control gap. Form sections are 24px apart; option rows are 8px apart. Switch/dropdown property rows are 44px high. Polls and templates share the same content/settings form; a template adds its name above the question. The contextual widget tray uses shared dropdown and switch controls alongside its compact numeric and HEX editors. Contests share fields and duration with polls. Page columns and action placement may differ for the task; field skins and group padding do not. Avoid independent per-route control skins or extra cards around individual fields.

Polls, templates and contests use one creation grammar: content fields on the left, duration/source/rules/actions in the settings rail, and the same responsive collapse rules. Their segmented controls and action rows come from `form-controls.tsx`; routes must not recreate those skins locally. At intermediate widths, settings may use two compact columns; at the narrowest width all groups stack. Do not add a separate tinted card around the settings. Template creation hides the library rail and places cancel/save in the same settings action slot used by launch actions. Template details keep metadata inline below the title and keep destructive and primary actions in one stable footer. The widget tray uses horizontal property rows of at least 44px and shows only the selected editing category.

## Contest widget studio

The contest source at `/contest-overlay` is transparent, reconnects automatically and subscribes to a dedicated read-only public SSE feed. Public data contains participation instructions, an eligible participant count, up to eight recent names, a deadline and the winner. Never expose role data, chat history, eligibility reasons, account credentials or the hidden target of a running number contest. Selecting a winner and rerolling always remain server decisions; the source only animates the already selected winner for 2.4 seconds using the shared draw timestamp, then shows the result. Late connections show the settled result rather than replaying the draw.

Local previews cover collection, closed entry, drawing, winner and number guessing without starting or changing a real contest. The lower contextual tray groups layout, colors and composition. Width, text size, corners, opacity, three colors, timer, count and recent names persist in `contestOverlay` and are included in backup export/import. The preview and OBS use the same React view and stylesheet.

Hidden viewer count uses the fixed word “Скрыт” in place of the value. The actual count is not rendered into the DOM while hidden; never apply visual blur to the real digits or preserve their width. Keep the existing saved visibility preference.

Moderation refusals never silently discard a deliberate gesture: self-timeout and self-ban attempts explain that the streamer cannot moderate themselves and give a 360ms damped horizontal shake. Reduced-motion users receive the same text without the shake. Incomplete horizontal swipes explain the remaining threshold; permission failures explain why no action occurred. Track active movement and release on the window so capture transfer or capture loss does not terminate a held swipe; true pointer cancellation and window blur reset quietly. Use the captured row width for release decisions. The six-dot grip has an accessible name and no hover tooltip.

Packaged builds keep Templates visible only as a disabled “Скоро” entry in the sidebar and new-tab launcher. Block navigation to its workspace and disable saving a poll as a template; development retains access. Moderation feedback temporarily replaces the contents of its existing row for 2.2 seconds, without adding height below the message, then restores the original contents.
