# Conversation / Composer Fixture Notes

Additional fixtures captured for roadmap-level DOM reconnaissance.

## Coverage

- `chatgpt-message-assistant-full.sanitized.html` — normal assistant markdown plus richer inline structures such as code and citations.
- `chatgpt-message-assistant-image.sanitized.html` — generated-image assistant turn, including image-gen controls and response actions.
- `chatgpt-message-tool-output.sanitized.html` — assistant turn containing a visible GitHub/tool-result row and final response.
- `chatgpt-message-assistant-file-source.sanitized.html` — structural fixture for an answer that cites an uploaded file through `my_files` and shows the Sources footer.
- `chatgpt-message-user-basic.sanitized.html` — plain user message.
- `chatgpt-message-user-attachment-image.sanitized.html` — sent user image attachment.
- `chatgpt-message-user-attachment-file.sanitized.html` — sent user document attachment.
- `chatgpt-composer-empty.sanitized.html` — empty unified composer.
- `chatgpt-composer-with-image-and-file.sanitized.html` — draft composer with both image and file attachments.
- `chatgpt-search-dialog.sanitized.html` — native global-search dialog.

## Sanitization

Live conversation/message IDs, uploaded-file IDs, commit hashes, private image/file URLs, URL signatures, generated runtime IDs, chat titles, attachment names, and repository-specific values have been replaced or generalized. Inline runtime `<script>` elements were removed from composer fixtures.

Raw captures should remain outside the repository.
