# Demo sandbox

- URL: <https://vocab-confusion-log.sociobot.in/demo/>
- Entry point: select **Try it with sample data** on the first screen, or open `/demo/` directly.
- Storage: pairs and attempts use IndexedDB database `demo:vocab-confusion-log`. Demo licenses use `demo:sb_license:vocab-confusion-log` keys. The personal app uses different names.
- Sample: `affect / effect` is due with two generated spoken references; `desert / dessert` has one correct attempt; `embarazada / embarrassed` is resolved with three attempts.
- Reset: **Reset demo** replaces the demo database with the original three pairs and removes any demo license state.
- Exit: **Start for real** clears the demo database and demo license keys before opening `/log/`. It does not read or change the personal database.

The sample WAV files were generated locally with eSpeak NG 1.51 on 2026-09-06. They contain only the spoken words “affect” and “effect” and are included for the audio-to-text demonstration.
