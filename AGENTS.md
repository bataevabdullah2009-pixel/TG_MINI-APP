# AI Agent Rules

Work in the order SPEC -> PLAN -> CODE.

- Start with analysis and an audit of the relevant files.
- Make a short implementation plan before broad changes.
- Prefer existing architecture and local helpers.
- Do not change architecture without a clear reason.
- Do not delete working features while fixing one issue.
- Always check environment variables and routes when touching Telegram, webhook, or deployment code.
- Never hardcode production URLs.
- Verify with build, lint, and typecheck before deploy whenever possible.
