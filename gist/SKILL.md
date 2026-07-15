---
name: gist
description: Create a private (secret) GitHub gist from a given file and copy the URL to the clipboard. Use when the user wants to share a file as a gist, e.g. "gist this file", "make a gist of foo.ts".
---

# gist — File to Private GitHub Gist

Create a secret GitHub gist from a file and return its URL.

---

## Steps

1. **Get the file path** from the user's invocation. If not provided, ask the user which file to gist. If the invocation includes extra words beyond the path, treat them as the gist description.

2. **Verify the file exists** via Bash (`test -f <path>`). If it doesn't, tell the user and stop.

3. **Create the gist** via Bash (`gh gist create` is secret/private by default — do NOT pass `--public`):
   ```bash
   gh gist create "<path>" --desc "<description>"
   ```
   If no description was given, use the file's basename as the description.

4. **Copy the URL to the clipboard**:
   ```bash
   echo "<gist_url>" | pbcopy
   ```

5. **Output the gist URL** to the user and confirm it was copied to the clipboard.

## Error handling

- If `gh` is not authenticated, tell the user to run `gh auth login`.
- If gist creation fails (e.g. missing `gist` scope), surface the error from the `gh` command; suggest `gh auth refresh -h github.com -s gist` if it's a scope problem.
- Never pass `--public`; the whole point of this skill is that the gist stays private.
