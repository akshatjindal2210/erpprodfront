import JobCardBoardPage from "@/apps/production/modules/job-card-board/Page";

export const metadata = {
  title: "Job Card Calendar",
};

/** Same module as Board — opens Calendar view. */
export default function Page() {
  return <JobCardBoardPage initialView="calendar" />;
}
