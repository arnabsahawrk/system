import { redirect } from "next/navigation";
import { getSettings, isUnlocked } from "@/lib/session";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

/** The only gate in the app. If a passcode is set and this request isn't
 * carrying a cookie that matches it, send it to /unlock first. */
export default async function HomePage() {
  if (!(await isUnlocked())) redirect("/unlock");

  const settings = await getSettings();
  return <Dashboard initialSettings={settings} />;
}
