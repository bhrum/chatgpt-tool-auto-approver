# Chrome Web Store Review Notes

This extension has one narrow purpose: automatically approving trusted ChatGPT tool confirmation cards for users who intentionally run tools repeatedly.

The content script is limited to `chatgpt.com` and `chat.openai.com`. It does not collect data or make network requests. It only scans local DOM text and button labels to identify a confirmation card containing:

- an exact Allow/Approve label,
- an exact Reject/Deny label,
- nearby tool-risk or tool-call context.

The extension intentionally avoids broad text matching for denial labels and never clicks Reject/Deny. Its optional refresh recovery also detects ChatGPT display-error messages such as "Unable to display this message" / "出错了，无法显示此消息" and reloads only when refresh recovery is enabled and the composer is empty.

Manual test performed:

1. Loaded the unpacked extension in Chrome with developer mode.
2. Opened a new ChatGPT conversation separate from the user's existing conversation.
3. Selected `bhrum1 vps` as the tool.
4. Selected the non-Pro `Instant` model.
5. Sent: `pwd && echo auto-approve-test`.
6. The tool confirmation was approved without manual clicking.
7. ChatGPT displayed tool output: `/home/ubuntu auto-approve-test`.
