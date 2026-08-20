# RM Rejection

QC fail or in-process rejection → register → Store Out return.

|               |                                                                                                                     |
|---------------|---------------------------------------------------------------------------------------------------------------------|
| UI            | `/rmstore/dashboard/rm-rejection`                                                                                   |
| Permission    | `rm_rejection`                                                                                                      |
| FE            | `modules/rm-rejection/`                                                                                             |
| BE            | `modules/rm-rejection/`                                                                                             |
| API           | `POST /api/rmstore/rm-rejections/` (`list|create|register-from-check|generate-store-out|approve-register|delete|…`) |
| Table         | `rmstore_rejection`                                                                                                 |

**Files**

|               |                                                   |
|---------------|---------------------------------------------------|
| FE            | `frontend/src/apps/rmstore/modules/rm-rejection/` |
| BE            | `backend/src/apps/rmstore/modules/rm-rejection/`  |

**CRUD**

|               |                                                         |
|---------------|---------------------------------------------------------|
| Create        | register from QC / IPR                                  |
| Read          | list / pending                                          |
| Update        | approve register / bill                                 |
| Delete        | **SOFT**. Blocked if `bill_no` set or Store Out started |

**Linking**

Coil `rm_uid`. Delete → `revertCoilsFromRejectionRegister` (clear `rm_uid`); reopen QC if not from IPR; clear `out_uid` link.

**Table impact**

| Action           | Writes                                       |
|------------------|----------------------------------------------|
| Create / approve | `rmstore_rejection` + coil `rm_uid` / status |
| Delete           | soft rejection + revert coil pointers        |
