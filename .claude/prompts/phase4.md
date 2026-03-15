Read PRD.md. Phase 4: Polish, email, dark mode, full test suite.

1. Email Edge Function (send invoice PDF via Resend or SMTP)
2. Automatic overdue detection (SENT + past due_date → mark OVERDUE)
3. Urssaf declaration helper (useCotisations.ts: CA per period, estimated amounts, next deadline)
4. Declaration reminder widget in sidebar (next deadline + amount)
5. Dark mode toggle (persisted in localStorage)
6. Complete Playwright e2e suite covering ALL critical flows
7. Update README.md with full setup instructions
8. Final spec-reviewer run: 0 missing features for phases 1-4
9. Final qa-auditor run: 0 FAIL items

SUCCESS CRITERIA:
- All e2e tests pass
- Test coverage >= 80% on composables and utils
- README instructions work from scratch (clone → install → run)
- Dark mode works on all pages
- spec-reviewer: 0 missing features
- qa-auditor: 0 FAIL

Output <promise>PHASE4_DONE</promise> when ALL verified.
