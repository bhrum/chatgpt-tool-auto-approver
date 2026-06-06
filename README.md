# ChatGPT Tool Auto Approver

A small Manifest V3 Chrome extension for users who repeatedly run trusted tools in ChatGPT and want confirmation cards to approve automatically.

The extension only runs on `chatgpt.com` and `chat.openai.com`. It looks for a guarded ChatGPT tool confirmation card that contains an explicit Allow/Approve button, a Reject/Deny button, and nearby tool-risk context. When that pattern is present, it clicks Allow automatically.

It never targets Reject/Deny buttons and does not collect, store, sell, or transmit user data. Optional stall recovery can refresh a ChatGPT page when a confirmation card appears stuck, while skipping refresh if the composer contains user-entered text.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `extension` directory.

## Test

```sh
npm test
```

## Files

- `extension/`: Chrome extension source.
- `tests/`: Node tests for the confirmation matching logic.
- `store-assets/`: Chrome Web Store listing, privacy policy, review notes, and images.
