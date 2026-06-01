# pi-learning-loop

Approval-gated learning loop for Pi.

`/learn` turns a concrete Pi mistake into a proposed durable rule. It drafts first, shows the target and proposed text, and only writes after explicit approval.

## Commands

```text
/learn pick
/learn note <what went wrong>
/learn draft <id>
/learn show <id>
/learn pending
/learn approve <id>
/learn reject <id> [reason]
```

`/learn pick` is the preferred interactive path. It opens only when invoked, lets you select a recent turn, asks for a short issue description plus optional future behavior, then creates a pending draft. It never writes `AGENTS.md`; approval still happens via `/learn approve <id>`.

## Safety model

- No silent writes to `AGENTS.md`.
- Repo-local learning artifacts live under `.pi/learnings/`.
- Approved repo rules are inserted under `## Agent Learnings` in `AGENTS.md`.
- Global Pi files are intentionally not implemented yet.
- Raw transcript excerpts should stay bounded and should not be copied into durable rules.
