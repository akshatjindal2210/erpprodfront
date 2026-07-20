import { redirect } from "next/navigation";

/** `/task` has no page — send users to the Task dashboard home. */
export default function TaskRootPage() {
  redirect("/task/dashboard");
}
