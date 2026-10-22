import JobCardBoardPage from "@/apps/production/modules/job-card-board/Page";

export const metadata = {
  title: "Job Card Board",
};

export default function Page() {
  return <JobCardBoardPage initialView="board" />;
}
