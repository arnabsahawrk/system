import { redirect } from "next/navigation";
import { getSettings, isUnlocked } from "@/lib/session";
import { InsightsView } from "@/components/insights-view";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  if (!(await isUnlocked())) redirect("/unlock");
  const settings = await getSettings();
  return <InsightsView hasPasscode={settings.hasPasscode} />;
}
