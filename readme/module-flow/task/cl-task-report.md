# CL Task Report

CL daily / calendar scoreboard. Super Admin can upsert management review / score / red-flag.

|               |                                                                         |
|---------------|-------------------------------------------------------------------------|
| UI            | `/task/dashboard/cl-task/report`                                        |
| Permission    | `task_report`                                                           |
| FE            | `modules/cl-task/report/`                                               |
| BE            | `modules/reports/`                                                      |
| API           | `POST /api/task/reports/` (`daily|instance|review`)                     |
| Table         | `task_report_reviews`, `task_mis_score_ledger` (reads CL + red tickets) |

**Files**

|               |                                                                                           |
|---------------|-------------------------------------------------------------------------------------------|
| FE            | `frontend/src/apps/task/modules/cl-task/report/`, `lib/services/reportApi.js`             |
| BE            | `backend/src/apps/task/modules/reports/` — `report.route.js`, `reportPanel.controller.js` |

**CRUD**

|                 |                                                                                                        |
|-----------------|--------------------------------------------------------------------------------------------------------|
| Create / Update | `upsertReportReview` (Super Admin). May UPDATE instance score; rewrite MIS `source_type=report_review` |
| Read            | date range, org scope                                                                                  |
| Delete          | no review-delete API                                                                                   |

**Linking**

Review rows CASCADE when instance / assigned task is hard-deleted.

**Table impact**

| Action        | Writes                                                                       |
|---------------|------------------------------------------------------------------------------|
| Read          | SELECT CL instances, reviews, MIS, red tickets                               |
| Review        | `task_report_reviews` upsert; maybe `task_cl_tasks.score`; MIS delete+insert |
