# Organizational Readiness data (ResilienceTwin v0.2)

Fully synthetic data copied from https://github.com/rolandomantilla/CGU_DTO
(`resiliencetwin.sqlite` and `human_factors.json`). It powers the
**Org Readiness** page of this app.

| File | Rows | What it holds |
|---|---|---|
| facilities.csv | 5 | Sites (Atlanta, Chicago, Denver, Washington DC, San Diego) |
| systems.csv | 10 | IT systems and the facility hosting each |
| employees.csv | 100 | Fictional employees, role, site, FTE, criticality |
| workflows.csv | 12 | Business workflows, criticality, reference task hours |
| employee_skills.csv | 543 | Skill proficiency (1–5) per employee |
| workflow_assignments.csv | 118 | Who works on which workflow, and allocation % |
| skill_requirements.csv | 24 | Skills each workflow needs, and how many qualified people |
| system_dependencies.csv | 22 | Systems each workflow depends on (Required / Supporting) |
| experience.csv | 118 | Years in role or similar tasks completed, per assignment |
| relationships.csv | 212 | Handoffs between colleagues over a 30-day window |

The app loads this data into its database through
`src/server/db/migrations/0005_org_twin_seed.sql`. These CSV files are a
readable copy; editing them does not change the app.
