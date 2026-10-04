# Experiment Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved experiment-scoped animal/collection/aliquot verification workflow with five-column Excel import, reliable audit history, and batch labels, then provide a working local preview.

**Architecture:** Retain Spring Boot/MyBatis authentication, users, roles, existing records, and React/Ant Design. Add a separately versioned experiment workflow domain with persistent per-operator scan sessions, immutable scan/audit snapshots and independent tube identities; legacy task APIs must never modify these new tubes. Use real database-backed tests for transaction, audit, state, and concurrency behavior, and browser tests for user-visible flows.

**Tech Stack:** Java 17+, Spring Boot 3.3.5, MySQL-compatible SQL, Apache POI for XLSX/XLS, JUnit/Spring testing, React 18/TypeScript/Ant Design, Playwright, existing QR SVG renderer.

## Global Constraints

- Only `jmz-eng/label-checking-system`; no medicine-reminder edits and no server deployment.
- Five tube spreadsheet columns, in order: `试验编号、动物号、时间点、管标信息、采样日期`.
- Label size `25 × 10毫米`; left square QR, right full information; never silently truncate or shrink into illegibility.
- Two tube tables use the original blood collection date; actual verification timestamps are separate.
- Select experiment, date, timepoint and (where multiple) purpose before scanning.
- Current chip mapping is authoritative for new checks; historical evidence is preserved.
- Failure blocks advancing unless corrected or explicitly closed with a required reason; exception closure never counts as PASS.
- Aliquot verification requires a prior successful collection verification for the exact source tube.
- Multiple operators in the same experiment must remain independent.
- Success, failure, amendments, voiding and reprints are traceable; retries do not overwrite or duplicate an operation.
- No real user data, credentials or runtime database files in commits.
- Work on branch `feat/experiment-verification` in this task's dedicated clone; preserve the existing preview database and main baseline.

## Task 1: Persistent backend, imports and verification

**Files:** New cohesive package `backend/src/main/java/com/tagmanagement/experiment/`; new schema/migration resources under `backend/src/main/resources/db/`; integration tests under `backend/src/test/java/com/tagmanagement/experiment/`; modify `backend/pom.xml`, schema locations and menu initialization/migration. Repair legacy `SampleTaskService` state and audit defects with regression tests. Produce `docs/experiment-api.md` as the exact frontend API contract.

**Interfaces:** `/api/experiments` routes use existing `ApiResponse<T>` and authenticated `CurrentUserContext`. Preserve project identity via `project_info`. API families cover experiment list/create/detail; mapping CRUD; purposes/pairing; tube CRUD/void/reissue; multipart import preview/commit/history/download/template; persistent scan sessions/actions/exception closure; labels print acknowledgement; immutable records/history/export. Every endpoint, method, request and response is documented in `docs/experiment-api.md` before frontend work starts.

- [ ] Write and run failing HTTP/database tests for missing experiment routes, wrong date/time/purpose, unknown chips, blocked aliquots, fail->correct and fail->close, version edits, repeated request IDs, and separate operators. Example HTTP contract assertion:

```java
mockMvc.perform(get("/api/experiments").header("Authorization", "Bearer " + token))
       .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
```

- [ ] Implement SQL persistence and transaction boundaries, append-only snapshots, actor-bound session transitions and server-side checks. Expected business mismatches return a persisted FAIL result, not an exception that rolls back the failure record.
- [ ] Implement real Excel preview/validation/commit with exact five columns, row-specific issues, original attachments and batch metadata, purpose confirmation and unambiguous source pairing. Preserve original tube text and identifiers.
- [ ] Implement edits/voids/reissues without rewriting printed label identity or historical data. New collection/aliquot records cannot be mutated through old APIs.
- [ ] Verify focused tests, then run `mvn -B test` once across the backend. Commit backend changes locally and write the exact API and test report.

## Task 2: Experiment workspace and operational UI

**Files:** New focused modules under `frontend/src/pages/experiments/`, `frontend/src/api/experiments.ts`, workflow types, label layout helpers and browser tests; integrate `App.tsx`, `AppShell.tsx`, styles and project/menu entry points. Consume the exact `docs/experiment-api.md` produced in Task 1.

**Interfaces:** authenticated API wrapper extended for multipart files/downloads/DELETE; experiment workspace links selected project to attachment management, purpose pairing, tube editing, printing, collection, aliquot and trace tabs. Scanner state is server-authoritative and restored after reload. All operational controls reflect the existing permission model.

- [ ] Write and run failing browser tests for experiment selection, import issue display, required date/time/purpose, scanner fail closure, source gate and batch label paging. Example independent-condition assertion:

```typescript
await page.getByRole('button', { name: '开始采血核对' }).click();
await expect(page.getByText('请选择采样日期')).toBeVisible();
```

- [ ] Implement the experiment list/detail workspace, five-column import and templates, classification/pairing confirmation, row edits/reissue/void history, and permission-aware controls.
- [ ] Implement separate collection and aliquot scan flows, strong error state with optional beep, required remark closure, proper reset and multi-operator independence. Clear original scan inputs only after confirmed server outcomes.
- [ ] Render complete five-field labels with compact QR identity, black/white SVG grid, quiet zone, 25x10mm paged batch print and readable overflow diagnostics. Record print requests truthfully, without claiming the physical printer completed printing.
- [ ] Provide immutable record/detail filters and CSV export plus attachment history. Keep existing administrative features accessible; clearly identify legacy records.
- [ ] Run focused tests, `npm run lint`, `npm run build`, then browser suite. Commit locally and write task report.

## Task 3: Integrated preview, review and handoff

**Files:** Durable development/preview instructions and synthetic sample spreadsheets; task runtime scripts outside tracked source; source fixes only where review/testing proves a gap.

- [ ] Run backend and frontend against a separate persistent preview database; do not overwrite the earlier preview database. Seed only clearly marked synthetic data and use separate operator accounts for concurrency checks.
- [ ] Exercise real API imports, mapping amendments, collection mismatch/correction/exception, one-to-many aliquots, invalid source prevention, stable history, label void/reissue and retry behavior.
- [ ] Conduct task-level and whole-branch code review, resolve important findings and re-run the tests covering fixes.
- [ ] Open the updated local UI in the user browser and inspect real rendered layouts, navigation and a label preview. Provide downloadable synthetic Excel templates/examples.
- [ ] Update requirements/implementation ledger and user handoff with verified checks and printer/MySQL limitations. Keep changes local for user review, no server deployment.

## Progress

- Approved requirements: `/Users/zhangjinming/Documents/Codex/2026-10-04/new-chat/work/label-implementation/approved-spec.md`.
- Initial baseline: clean main at `1be093bc08848e4ce075e38071f02208ef8ddb78`; existing 12 backend and 18 browser tests passed before feature work.
- New branch created; application implementation not started at plan creation.
