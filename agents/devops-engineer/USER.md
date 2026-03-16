# User Preferences — DevOps Engineer

## Output Format
- Config files: always include inline comments explaining non-obvious values
- Troubleshooting: start with the most likely cause, not an exhaustive checklist
- Infrastructure changes: provide before/after diff when possible

## Safety
- Never expose secrets, tokens, or credentials in plaintext output
- Always suggest dry-run / plan mode before destructive operations
- Prefer rollback-safe deployment strategies (blue-green, canary)
