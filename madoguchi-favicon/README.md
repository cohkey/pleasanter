# Madoguchi System favicon

This favicon follows the "service window" direction:

- `madoguchi-favicon.svg` is the editable source icon.
- `madoguchi-counter.svg` is a stronger reception-counter variation.
- `madoguchi-window-clean.svg` removes the status badge from the first icon.
- `madoguchi-window-blue-dot.svg` keeps the guide dot but avoids alert colors.
- `madoguchi-window-check.svg` uses a check mark for a received or confirmed state.
- `madoguchi-counter-calm.svg` keeps the counter shape but removes the warm badge color.
- `madoguchi-window-ticket-blue.svg` blends the E window with the B ticket concept in blue.
- `madoguchi-window-ticket-teal.svg` blends the E window with the B ticket concept in teal.
- `madoguchi-window-chat-slate.svg` blends the E window with the D chat/check concept.
- `madoguchi-window-chat-green.svg` uses the chat/check concept with a green completed tone.
- `madoguchi-window-outline-navy.svg` is a lighter white-ground navy version.
- `madoguchi-window-solid-indigo.svg` is a solid indigo window version with no badge.
- `madoguchi-ticket.svg` is a ticket and request-queue variation.
- `madoguchi-chat-check.svg` is a consultation and completion variation.
- `madoguchi-kanji.svg` is a Japanese "窓" monogram variation.
- `madoguchi-favicon-16.png`, `madoguchi-favicon-32.png`, and `madoguchi-favicon-64.png` are generated PNG targets.
- `preview.html` shows the first icon at browser-tab sizes.
- `tab-favicon-sample.html` compares the favicon candidates and can switch the active browser-tab icon.
- `generate-png.mjs` regenerates the PNG files from the same simplified geometry.

Recommended browser tags:

```html
<link rel="icon" href="./madoguchi-favicon.svg" type="image/svg+xml">
<link rel="icon" href="./madoguchi-favicon-32.png" sizes="32x32" type="image/png">
```

Use the 32px PNG when the upload target only accepts raster images.

The orange or warm badge in the first drafts was meant as a reception guide point, not an alert. Use the clean or blue-dot versions if the badge reads too much like a warning state.
