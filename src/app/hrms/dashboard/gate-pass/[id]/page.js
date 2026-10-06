import GatePassViewPage from "@/apps/hrms/modules/gate-pass/GatePassViewPage";

export default async function Page({ params }) {
  const { id } = await params;
  return <GatePassViewPage passId={id} />;
}
