# Critical browser acceptance repairs

## Root causes and changes

- campus-map.js gave Leaflet and its satellite tile layer the same display ceiling of 18. Pioneer and Leopards Hill now fit their actual boundaries and support display zoom up to 21. The satellite layer continues requesting tiles at native zoom 18 or lower. Silverest retains its previous display ceiling. Re-center fits the new campus boundary and Silverest retains its GPS behavior.
- campus-map.js built the mask from a finite padded boundary. The mask now uses the projected world's outer ring with the same campus boundary cutout. A ResizeObserver and nonanimated invalidation handle map dimensions. Reopening or expanding an already-rendered campus preserves zoom.
- campus-map.js inserted the directory list into the toolbar. The new toolbar keeps search, campus switching and a compact directory toggle. widget.css gives the directory a bounded overlay, a side panel in fullscreen desktop, a bottom sheet in narrow views and an independently scrollable list. The campus summary counts imported footprints where supplied.
- app.js removed old messages while the persistent avatar could be inside a message row. widget.js now resets the hero and inline slot, remounting the existing avatar before the chat is cleared. The existing canonical profile update refreshes entitlement swatches. Both Medicine catalogue spellings remain selectable. Only the explicitly entitled canonical ID has the Medicine outfits.
- voice.js treated all speak-btn elements as speaker controls. Feedback and PDF buttons use that class too. The voice-specific marker makes Listen discoverable alongside other answer actions. Unsupported speech synthesis shows an explanation. The microphone implementation was preserved.

## Browser observations

Compared v4 and the rebuilt integration frontend using isolated loopback backends. The v4 expanded directory displaced the map and clipped the controls. The repaired browser showed the search field, bounded directory and rendered map together.

The normal desktop Pioneer map was 380 by 407 pixels. Directory filtering left map height at 407 pixels across All floors, Ground, First and Unspecified, with respectively 48, 27, 19 and 2 entries. The list was 129 pixels high with 3,747 pixels of content and scrolled independently. Leopards Hill in fullscreen maintained 537 pixels of map height through five filters, showing 20, 7, 4, 1 and 8 entries respectively. It reported 12 footprints. Mobile browser emulation at 390 by 844 had a 375 by 671 map and an independently scrollable 268-pixel directory list. Switching campuses while the panel was open closed the old directory. Silverest, Pioneer and Leopards Hill screenshots were captured at initial zoom, as well as maximum zoom for both new campuses. At maximum displayed zoom the observed satellite requests were native zoom 18. Building selection opened the Room 19 anchor and its card.

The fixed student's next listed lecture was in Lecture Room 3. Its View on Map action opened Pioneer Campus, Main Academic Block.

Using the real portal buttons, renewed the flexible profile through Nursing, Medicine, Law, Computer Science, BIT and randomisation. Verified the connected visible avatar, cleaned chat and welcome state after renewal, then checked category-specific swatches. Checked both Medicine labels. The prospectus ID bachelor-of-medicine-and-bachelor-surgery received Health scrub and Doctor coat. The other Medicine label retained general outfits only. A randomly selected Public Health programme showed general outfits. The fixed-account profile was used for timetable acceptance.

A real browser showed Listen beside Helpful, Not helpful, Save PDF and Sources. Verified prose, a timetable list, an academic-results table and a sourced hospital answer with a map action. Listen changed to Stop and replay worked at the UI level. Audible playback remains a physical-device check. The user's previously verified microphone flow was preserved.

## Tests and release status

Widget suite: 187 tests passed, including reset-before-clear and supported/unsupported speech decoration regressions. The browser checks above exercised actual layout dimensions, scrolling, profile renewal, DOM attachment and wardrobe rendering. Browser evidence was captured separately from the source archive. Physical mobile hardware, audible playback and user sign-off remain open. This is a local review candidate. Candidate v4 is preserved.

## Start preview

From the integration root with Node 24 and installed dependencies, run npm --prefix dummy-environment/chatbot-widget run build. In PowerShell set UNILUS_PREVIEW_API_PORT to 5026 and UNILUS_PREVIEW_WEB_PORT to 8126, then run node scripts/isolated-preview.cjs. Use unused ports when another preview is listening. The launcher prints guest, fixed and flexible account URLs.
## Verified v5 archive

Candidate v5 is 115377546 bytes. SHA-256 is 74B5A2D373E9992BAC89686B860026AFE0AC65C9032D05DF8D1406A344216237. ZIP CRC, both clean dependency installs and the clean Vite build succeeded. The extracted archive passed all 610 backend and 187 widget tests. Its independently launched loopback preview returned HTTP 200 for the three review pages and the rebuilt widget. The backend confirmed memory-only SQLite, blocked outbound network and no remote credentials loaded. Candidate v4 retained its original SHA-256. The checkout records these post-extraction results separately from the archived snapshot.

## Owner acceptance

The owner confirmed manual local-browser acceptance of candidate v5. The later accommodation routing repair is documented in LIVE_AI_EVALUATION.md.
