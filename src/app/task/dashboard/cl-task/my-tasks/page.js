import { redirect } from "next/navigation";

/** Legacy path — CL Task list lives at /task/dashboard/cl-tasks */
export default function MyClTasksRedirectPage() {
  redirect("/task/dashboard/cl-tasks");
}
