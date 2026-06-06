# ChatGPT Tool Auto Approver

本地 Chrome 插件，只在 `chatgpt.com` / `chat.openai.com` 生效。

功能：

- 自动点击 ChatGPT 工具确认卡里的 `允许` / `Allow` / `Approve`。
- 明确排除 `拒绝` / `Deny` / `Reject` / `Decline`。
- 只有在同一确认卡中同时出现拒绝按钮和工具风险/详情上下文时才会点击。
- 页面卡住时可自动刷新：确认风险文案出现但允许按钮没有渲染，或工具重试按钮停留过久。
- 如果输入框里有用户正在输入的内容，不会自动刷新。

安装：

1. 打开 Chrome 的扩展程序页面。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 选择本目录：`extension`。

加载后，打开或刷新 ChatGPT 对话页即可生效。
