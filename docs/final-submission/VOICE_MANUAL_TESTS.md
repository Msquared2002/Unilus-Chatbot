# Voice manual tests

Run the isolated preview in Chrome, Edge, Firefox and a mobile browser. Record OS, browser version and permissions for each run. Test physical audio on the device.

1. Click the microphone and verify that the listening state begins after recognition starts. Speak, check the editable transcript, then send manually.
2. Deny permission, remain silent and cancel during startup. Verify useful inline feedback and that typing stays usable.
3. Start and stop rapidly, send during recognition and switch view or session. Verify stale callbacks cannot repopulate the draft.
4. Use Listen on prose, a timetable table, academic records, lists and recommendations. Check that substantive values are heard and that raw links are omitted.
5. Confirm Stop, replay and changing answers behave cleanly. Test unavailable voices and browsers that lack recognition.

The automated widget suite passed. Physical microphone, audible playback and browser support matrix results await device testing.
