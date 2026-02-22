# ClawHealth Task Board

## 🟢 In Progress

### Albert (Builder)
| Task | Status | Notes |
|------|--------|-------|
| Dashboard UI redesign — light sidebar | ✅ LIVE | Deployed to app.clawmd.ai |
| Patient Timeline feature | ✅ LIVE | Merged to master |
| Three-tier prompt management | ✅ LIVE | Disease templates + patient overrides |
| Physician Action Center | ✅ LIVE | Messaging, alert resolution, inbox |
| Fix clawmd.ai vs app.clawmd.ai routing | 🔧 NOW | clawmd.ai needs hero page, not dashboard |

### Manus (Researcher/Content)
| Task | Status | Notes |
|------|--------|-------|
| 12 Disease templates | ✅ DELIVERED | Imported to DB |
| ABIM Question Bank | ✅ DELIVERED | 100+ questions, quiz app deployed |
| Business plan | ✅ DELIVERED | In docs/ |
| Competitive landscape | ✅ DELIVERED | In docs/ |
| Clinical interaction framework | ✅ DELIVERED | In docs/ |
| Hero page design | ✅ DELIVERED | In bot-channel, NOT live yet |
| Pencil/Figma MCP research | 🔄 ASSIGNED | Waiting for deliverable |
| Voice strategy | 🔄 ASSIGNED | Waiting for deliverable |
| Prompt architecture review | 🔄 ASSIGNED | Waiting for deliverable |

### Jeff (Approval Required)
| Task | Needs | Status |
|------|-------|--------|
| Merge remaining PRs | Review | PR #2 (prompts), #3 (physician actions) merged ✅ |
| Joel Landau phone number | Jeff to provide | BLOCKED |
| Claude Code re-auth | Jeff to run `claude /login` | BLOCKED |
| Multi-agent architecture | Jeff greenlight | ON HOLD — current single-agent works |

## 🔮 Backlog (Prioritized)

### High Priority
1. **Fix domain routing** — clawmd.ai = hero/marketing, app.clawmd.ai = physician portal
2. **Seed production DB** — demo patients on Vercel/Neon (currently empty)
3. **Integrate Manus hero page** — deploy to clawmd.ai
4. **Page-level design polish** — patients list, patient detail, settings
5. **Brave API key** — reconfigure for web search

### Medium Priority
6. **Patient risk score trends** — chart showing risk over time
7. **Medication interaction checker** — flag drug-drug interactions
8. **CCM billing dashboard** — revenue tracking visualization
9. **Figma/Pencil MCP workflow** — for ongoing design iteration
10. **Voice calls** — ElevenLabs integration strategy (waiting on Manus)

### Future / Jeff Decision Needed
11. **Multi-agent architecture** — 1 OpenClaw agent per patient
12. **NanoClaw containers** — isolated patient environments
13. **Landau Health Portal integration** — portal template + AI agents
14. **Epic EHR automation** — VPN/Citrix access needed
