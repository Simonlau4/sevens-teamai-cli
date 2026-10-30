# Scenario: Member — publish a reusable skill

<!-- SEVENS: skills are listed in Skill Pilot, not pushed with teamai (FORK.md). -->

Goal: the user turns something they built into team knowledge everyone can pull.
**Any member can do this — you do not need to be an admin.** The usual entry point
is the user just asking in plain language, e.g. *"share this xxx skill with my
team"*, in whatever language they work in.

**Publishing is a team-visible action — confirm before you run it.** A plain
worded request tells you *what* the user wants, not that they are ready to push
it to everyone. Before `teamai push` / `teamai contribute`, show exactly what
will be shared (which skill or file, and that it goes to the whole team) and get
an explicit go-ahead. Do not publish from an offhand mention of "sharing" in
ordinary conversation — only when the user has clearly asked to publish *this*
thing now.

## Which kind of contribution?

- **A learning** (a lesson, a gotcha, how you solved something) → this is
  **automatic** once recall is on (off by default) and the teamai config loads: TeamAI prompts at the end of a session worth sharing and the
  dedicated `share` workflow (`teamai skill get share`) takes over (it summarizes the
  session and runs `teamai contribute`). The user does not come through this flow
  for it. (Step A below is only a manual fallback for while recall is off.)
- **A reusable skill** (a `SKILL.md` others invoke) → it is listed in Skill
  Pilot, not pushed with teamai (Step B).

## Step A — Contribute a learning by hand (fallback only)

> Prefer the `share` workflow (`teamai skill get share`). Use these manual steps only while
> it refuses because recall is off.

1. Write a short Markdown doc that captures the lesson. Keep it concrete and
   actionable — a knowledge base, not a diary. Include YAML frontmatter for search
   indexing:

   ```markdown
   ---
   title: "<short title of the problem or finding>"
   author: <username>
   date: <YYYY-MM-DD>
   tags: [tag1, tag2, tag3]
   ---

   ## Background
   What were you doing? What went wrong?

   ## Solution
   How did you fix it? Key steps.

   ## Takeaways
   - Lesson 1
   - Lesson 2
   ```

2. Save it to a temp file, then push it to the team:

   ```bash
   teamai contribute --file /tmp/my-learning.md --title "K8s pod startup timeout"
   ```

The doc lands in the team's `learnings/` and appears for teammates on their next
`teamai pull`. It is also searchable via `teamai recall`.

> Tip: while recall is on, `teamai skill get share` auto-summarizes the current
> session instead of you writing the doc by hand.

## Step B — Contribute a reusable skill

This team shares skills through Skill Pilot, not the team repo: `teamai push`
never sends a skill, and `teamai push --skill` stops with a pointer to Skill
Pilot. Do not copy a skill into the team repo's `skills/` either; pull does not
deliver it.

1. Make sure the skill is a directory with a `SKILL.md` whose frontmatter has a
   `name` matching the directory and a one-line `description`.
2. Tell the user to publish it themselves in the Skill Pilot dashboard
   (`skill-pilot ui` opens it): its team page → the button to list a skill.
   Teammates install it from the same team page. The dashboard's labels are
   Chinese; `teamai push --skill <path>` prints them.

## After contributing

- A learning: teammates receive it on their next session, or via `teamai pull`.
- A skill: it shows on the Skill Pilot team page once listed.

Before listing rules, `push` refreshes copies whose bodies still match a recorded
sync revision. The header teamai generates for a tool's own rules format
(Cursor `.mdc`, JoyCode's own `.mdc`, Copilot `applyTo`, Kiro `inclusion`, Qoder
`trigger`, Trae `globs`/`alwaysApply`, CodeBuddy and WorkBuddy `alwaysApply`, Oh My Pi `alwaysApply`/`globs`) does not count as a local edit: unedited old copies update in that
format, including under `COPILOT_HOME` in user scope. Genuine local body edits remain push candidates.
Rule pre-sync leaves tools excluded by `enabledAgents` or `disabledAgents` untouched.
When only team `paths` change, `applyTo` refreshes if the local file still matches
a recorded version's generated copy; locally edited headers are kept.
The copies push refreshes are recorded, so a later `teamai pull` still updates them.
Oh My Pi and Kiro read only the top of their rules directories, so a namespaced
rule is written flat there (`rules/fe/style.md` as `fe.style.md`); an edit of that file
pushes back to `rules/fe/style.md`. Push requires a delivery record for the flat copy.
A personal file with that name is neither refreshed before push nor offered as
an edit of the team rule.
If two namespaced rules flatten to the same name, neither is written; `teamai doctor`
reports the collision even when no other rule reaches that tool. Rename one in the
team repo, then run `teamai pull`. Doctor also reports team-owned OpenCode globs
or inline blocks left after the last rule is removed.

A new file in the rules directory of a tool with a rules format of its own
(Cursor, JoyCode, Copilot, Kiro, Qoder, Trae, CodeBuddy, WorkBuddy, Oh My Pi) is the
member's own rule in that tool's format: push never offers it, and pull leaves
it. To author a new team rule, write it as a plain `.md` in `.claude/rules/`
(scope it with `paths:` frontmatter, which teamai renders into each tool's
format), then run `teamai push`. A YAML comment after an unquoted glob stays
outside its scope: `paths: **/*.ts # TypeScript files` matches `**/*.ts`, including
when written as a block-list entry under `paths:`.

## If push is denied

A permission error usually means you don't have write access to the team repo.
Copy the exact error to your admin and ask them to grant access. (In read-only
HTTP mode, `contribute` / `push` are not available — you can only consume.)
