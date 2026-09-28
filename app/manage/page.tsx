import { redirect } from "next/navigation";
import { getSettings, isUnlocked } from "@/lib/session";
import { ManageTasks } from "@/components/manage-tasks";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  if (!(await isUnlocked())) redirect("/unlock");
  const settings = await getSettings();
  return <ManageTasks hasPasscode={settings.hasPasscode} />;
}
