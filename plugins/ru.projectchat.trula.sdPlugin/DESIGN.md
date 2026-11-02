---
name: Trula Audio property inspector
description: Compact dark Stream Dock configuration surface within Cue.
colors:
  background: "#202226"
  text: "#f2f3f5"
  muted: "#b8bbc2"
  accent: "#d3fb75"
  accent-hover: "#e1ffa1"
  border: "#626670"
  input: "#17191d"
  button: "#303238"
  button-hover: "#42454c"
  error: "#ffb9b2"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 650
  paragraph:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    lineHeight: 1.55
rounded:
  control: "8px"
spacing:
  tight: "6px"
  control: "8px"
  action: "12px"
  inset: "16px"
  status: "20px"
  section: "24px"
components:
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    width: "100%"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Trula Audio property inspector

## Overview

This is a narrow native-feeling utility inside Stream Dock, extending the existing Cue property inspector. Its dark surface, system typography and restrained lime action preserve the established visual language. The opening comment in `property-inspector/index.html` is the direction contract; this document records the implemented surface, not a new application-wide design.

The reading order is output identity → shared connection → current state → short routing guidance. Keep Russian copy brief and operational.

## Colors

Use the neutral background as one continuous canvas. Bright text identifies controls and status; muted text carries descriptions, hints and guidance. The darker input and bordered secondary buttons distinguish editable and actionable regions. Lime marks the connection action and keyboard focus. Errors use the error text color with an explicit message.

## Typography

Use the native system stack throughout. The single output heading uses the title role; labels, controls and text use the body size. Paragraphs use the paragraph line height to remain readable at narrow widths. Volume percentages use tabular numerals. There is no display typography or uppercase label treatment.

## Layout

One centered column has a maximum outer width of 480px and 16px padding. It remains a single column at 320px; copy wraps, fields fill the available width and the secondary action row wraps with an 8px gap. Do not introduce a sidebar, grid of cards or fixed-width field.

The heading and description are separated by 6px. The form starts 24px below the identity; labels sit 8px above controls. The primary action follows the hint by 12px. Status starts 20px below the form, the action row has 12px top spacing, and guidance starts after 24px with a divider and 8px top padding. Inputs and buttons have a minimum height of 36px.

## Elevation & Depth

The inspector is flat, with no shadows or animated elevation. Input tone, control borders and one divider provide separation.

## Shapes

Controls have 8px corners and 1px borders. The primary button uses a transparent border. Keep the enclosing canvas unboxed; guidance is separated by a horizontal rule rather than a card.

## Components

- **Output identity:** the selected Stream Dock action changes the heading to «Звук на стриме» or «Звук у стримера» and supplies its matching description. These are two independent output actions sharing the same inspector structure.
- **Shared connection form:** an explicitly labeled password field accepts a token or panel URL. Its hint states that connection is shared by all Trula Audio buttons. The full-width lime submit button changes from «Подключить Trula» to «Сменить подключение» when a token is present. A successful submitted connection clears the field.
- **Status:** a persistent text line shows waiting, checking, connected, music muted/unmuted, inactive output or error states. Connected output levels appear below it as two plain label/value rows, «Заказы» and «Плейлист»; hide these rows when disconnected.
- **Secondary actions:** «Проверить связь» and conditional «Отключить» share a wrapping row. Connect and check start disabled until the Stream Dock socket opens and become disabled when it closes. Connect is disabled while its submission awaits a response. Disabled controls use 55% opacity; hover uses the corresponding lighter fill.
- **Routing guidance:** two short paragraphs below the divider explain Trula's «Оба» routing, each output's destination, and music mute/restore behavior. Preserve this as supporting copy beneath the controls.
- **Accessibility:** retain semantic form controls, associated label, `aria-describedby` hint, password masking, Russian document language and the polite live status region. Keyboard focus uses a 2px lime outline with 3px offset. State changes must remain readable in text; hidden content must leave the layout. Preserve natural wrapping without horizontal overflow.

## Do's and Don'ts

- **Do** keep shared connection settings visibly shared while output identity and state follow the selected action.
- **Do** use the existing compact control geometry and plain textual states.
- **Don't** add decorative lime surfaces, gradients, shadows, extra cards or a new visual identity.
- **Don't** import the main application's wider page spacing into this narrow inspector.
