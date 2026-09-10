# BongoCat Empire 1.8.3

- Added a saved idle paw setting: A raises both paws by default; B raises the keyboard paw while the pointer paw stays on the trackpad or mouse. Applies to keyboard + trackpad/mouse modes.
- Restored the original raised-paw artwork, with fixed sleeve connections. Keyboard presses, pointer movement, clicks, dragging, and scrolling retain their feedback.
- Added Chinese and English controls; desktop and wardrobe previews share the selected pose. Existing settings without this preference default to A.
- Published as GitHub release `v1.8.3` with the Apple Silicon macOS package and SHA-256 checksum.

---

# BongoCat Empire 1.8.1

Release date: 2026-09-10

## Highlights

- Renamed the application and its settings window to **BongoCat Empire**.
- Added a new Emperor-themed application icon based on the ninth level of the Road to the Throne theme.
- Added complete Simplified Chinese and English interface support. The language picker in Settings applies immediately and persists after restart.
- Added twelve wardrobe themes with nine levels each: 108 outfits in total, including localized names and story copy.
- Shortened the desktop surface to the cat's chest and input-device area. The desk no longer extends behind the cat, while the paw, keyboard, trackpad, mouse, and gamepad mappings stay intact.

## macOS package

`BongoCat-Empire-1.8.1-macos-arm64.zip` contains the Apple Silicon build. It is ad-hoc signed for local distribution and is not notarized. Its SHA-256 is listed in the release asset checksum file.

On first launch, allow **BongoCat Empire** in **System Settings → Privacy & Security → Input Monitoring** so keyboard, pointer, click, and scroll feedback can work. The app processes these events locally and stores only aggregate counters for diagnostics.

## Validation

- TypeScript validation and 26 frontend / localization data tests passed.
- 38 bilingual interface assertions, 9 growth navigation checks, and 5 original-appearance / blink checks passed.
- All 216 rendered outfit states and 80 interaction-geometry checks passed.
- The installed macOS build was checked for keyboard, pointer, click, scroll, growth counting, language persistence, and permission persistence across a normal restart.

## Compatibility

This release keeps the `com.harry.bongocat.arcana` application identifier to preserve existing local BongoCat Empire / Arcana data. It does not migrate or reset growth, wardrobe, thresholds, or preferences.

## Attribution and license

BongoCat Empire is derived from [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat). It remains distributed under the [MIT License](LICENSE).
