# Chrome Web Store Listing Draft

## Name

ChatGPT Tool Auto Approver

## Short Description

Automatically approves trusted ChatGPT tool confirmations and refreshes stalled prompt views.

## Detailed Description

ChatGPT Tool Auto Approver helps users who repeatedly run trusted tools in ChatGPT avoid getting stuck on confirmation cards.

It only runs on `chatgpt.com` and `chat.openai.com`. The extension looks for ChatGPT tool confirmation cards that contain an explicit Allow/Approve button, a Reject/Deny button, and nearby tool-risk context. When that guarded pattern is present, it clicks Allow automatically. It never targets Reject/Deny buttons.

Optional stall recovery can refresh a ChatGPT page when a tool confirmation card or retry state appears stuck. Refresh is skipped while the composer contains user-entered text.

Key features:

- Auto-clicks Allow/Approve on ChatGPT tool confirmation cards.
- Avoids Reject/Deny by exact label matching.
- Limits behavior to ChatGPT pages.
- Includes a popup to toggle auto-approval and stall refresh.
- Does not collect, store, sell, or transmit user data.

Use this extension only with tools and connectors you trust.

## Category

Productivity

## Language

English

## Permission Justifications

### storage

Stores the user's extension settings, including whether auto-approval and stall refresh are enabled.

### activeTab

Allows the popup's "scan current page" action to send a one-time message to the active ChatGPT tab.

### Host permissions: chatgpt.com and chat.openai.com

Required so the content script can inspect ChatGPT tool confirmation cards and click the Allow/Approve button when the guarded confirmation pattern is present.

## Data Disclosure

The extension does not collect user data. It reads visible DOM text on ChatGPT pages locally in the browser to identify confirmation cards. It does not send page content, prompts, account information, tool arguments, browsing history, or any other user data to the developer or a third party.

## Single Purpose

Automatically approve trusted ChatGPT tool confirmation prompts and recover stalled confirmation views.
