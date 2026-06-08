"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { userService } from "@/features/apps/task/services/userApi";
import UnauthorizedBanner from "@/features/apps/task/components/UnauthorizedBanner";

// ── Shared components
import DashboardHeader  from "@/features/apps/task/components/dashboard/DashboardHeader";
import QuickActions     from "@/features/apps/task/components/dashboard/QuickActions";

// ── Staff components
import UsersSection        from "@/features/apps/task/components/dashboard/UsersSection";
import TasksSection        from "@/features/apps/task/components/dashboard/TasksSection";
import TaskChartRow        from "@/features/apps/task/components/dashboard/TaskChartRow";
import DeptAndRemindersRow from "@/features/apps/task/components/dashboard/DeptAndRemindersRow";
import TasksAndUsersRow    from "@/features/apps/task/components/dashboard/TasksAndUsersRow";

// ── User components (shown when HIDE_DASHBOARD_FROM_USERS = false)
import UserTasksSection  from "@/features/apps/task/components/dashboard/UserTasksSection";
import UserChartsRow     from "@/features/apps/task/components/dashboard/UserChartsRow";
import UserAssignedTasks from "@/features/apps/task/components/dashboard/UserAssignedTasks";
import { canViewTaskDashboard } from "@/features/apps/task/config/appConfig";
import ActivityLogList from "@/features/shared/dashboard/components/ActivityLogList";

// ── API Mappers ───────────────────────────────────────────────────────────────
function mapStaffResponse(apiData) {
  const ov = apiData?.overview   ?? {};
  const ch = apiData?.charts     ?? {};
  const rd = apiData?.recentData ?? {};
  return {
    rootUsers:     { total: ov.users?.total ?? 0, active: ov.users?.active ?? 0, inactive: ov.users?.inactive ?? 0, suspended: ov.users?.suspended ?? 0, admins: ov.users?.admins ?? 0, regular: ov.users?.regular ?? 0 },
    tasks:         { total: ov.tasks?.total ?? 0, pending: ov.tasks?.pending ?? 0, inProgress: ov.tasks?.inProgress ?? 0, completed: ov.tasks?.completed ?? 0, onHold: ov.tasks?.onHold ?? 0, overdue: ov.tasks?.overdue ?? 0, highPriority: ov.tasks?.highPriority ?? 0, completedToday: ov.tasks?.completedToday ?? 0 },
    usersByDept:   ch.usersByDept   ?? [],
    usersByStatus: ch.usersByStatus ?? [],
    recentUsers:   rd.recentUsers   ?? [],
    topTasks:      rd.topTasks      ?? [],
    reminderTasks: rd.reminderTasks ?? [],
    totalDepts:    ov.departments   ?? 0,
    totalUsers:    ov.users?.total       ?? 0,
    activeUsers:   ov.users?.active      ?? 0,
    inactiveUsers: ov.users?.inactive    ?? 0,
    suspendedUsers:ov.users?.suspended   ?? 0,
    newThisMonth:  ov.users?.newThisMonth ?? 0,
  };
}

function mapUserResponse(apiData) {
  const ov = apiData?.overview   ?? {};
  const rd = apiData?.recentData ?? {};
  return {
    tasks:         { total: ov.tasks?.total ?? 0, pending: ov.tasks?.pending ?? 0, inProgress: ov.tasks?.inProgress ?? 0, completed: ov.tasks?.completed ?? 0, overdue: ov.tasks?.overdue ?? 0, completedToday: ov.tasks?.completedToday ?? 0 },
    assignedTasks: rd.assignedTasks ?? [],
    reminders:     rd.reminders     ?? [],
  };
}

const EMPTY_STAFF = mapStaffResponse({});
const EMPTY_USER  = mapUserResponse({});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RootDashboard() {
  const router     = useRouter();
  const userRole   = useSelector((state) => state.auth.role);
  const isStaff    = userRole === "super_admin" || userRole === "admin";
  const showDashboard = canViewTaskDashboard(userRole);
  const params     = useSearchParams();

  const [data,     setData]    = useState(isStaff ? EMPTY_STAFF : EMPTY_USER);
  const [loading,  setLoading] = useState(true);
  const [lastSync, setLastSync]= useState(new Date());

  useEffect(() => {
    if (!showDashboard) {
      router.replace("/task/dashboard/tasks");
    }
  }, [showDashboard, router]);

  const fetchStats = async () => {
    if (!showDashboard) return;
    setLoading(true);
    try {
      const res = await userService.getStats();
      if (res.data?.data)
        setData(isStaff ? mapStaffResponse(res.data.data) : mapUserResponse(res.data.data));
      setLastSync(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (showDashboard) fetchStats(); }, [showDashboard]);

  if (!showDashboard) return null;

  const userPieData = isStaff ? [
    { name: "Active",    value: data.activeUsers    ?? 0 },
    { name: "Inactive",  value: data.inactiveUsers  ?? 0 },
    { name: "Suspended", value: data.suspendedUsers ?? 0 },
    { name: "New",       value: data.newThisMonth   ?? 0 },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-4 md:p-5 bg-slate-100 min-h-screen text-slate-800 space-y-5">

      {/* Unauthorized banner — shown when RouteGuard redirects here */}
      {params.get("unauthorized") === "true" && <UnauthorizedBanner />}

      <DashboardHeader loading={loading} lastSync={lastSync} onRefresh={fetchStats} userRole={userRole} />
      <QuickActions />

      {/* Staff Dashboard — admin / super_admin */}
      {isStaff && (
        <>
          <UsersSection rootUsers={data.rootUsers} loading={loading} />
          <TasksSection tasks={data.tasks} loading={loading} />
          <TaskChartRow tasks={data.tasks} userPieData={userPieData} loading={loading} />
          <DeptAndRemindersRow
            usersByDept={data.usersByDept}
            usersByStatus={data.usersByStatus}
            reminderTasks={data.reminderTasks}
            totalUsers={data.totalUsers}
            totalDepts={data.totalDepts}
            loading={loading}
          />
          <TasksAndUsersRow topTasks={data.topTasks} recentUsers={data.recentUsers} loading={loading} />
        </>
      )}

      {/* User Dashboard — only when HIDE_DASHBOARD_FROM_USERS = false */}
      {!isStaff && (
        <>
          <UserTasksSection tasks={data.tasks} loading={loading} />
          <UserChartsRow    tasks={data.tasks} loading={loading} />
          <UserAssignedTasks
            assignedTasks={data.assignedTasks}
            reminders={data.reminders}
            loading={loading}
          />
        </>
      )}

      <div className="mt-8">
        <ActivityLogList appType="task" title="Task Activity Logs" />
      </div>

    </div>
  );
}
