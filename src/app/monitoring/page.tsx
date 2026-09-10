import type { Metadata } from "next";

import { MonitoringScreen } from "@/components/monitoring/MonitoringScreen";

export const metadata: Metadata = {
  title: "Monitoring paneli",
};

/**
 * `/monitoring` - ish maydoni qobig'idan (`(workspace)` guruhi) tashqarida:
 * o'zining kuzatuv ro'yxati bor, shuning uchun `AppShell` ni `MonitoringScreen`
 * o'zi chizadi. Bu yerda faqat metadata qoladi (server komponenti).
 */
export default function MonitoringPage() {
  return <MonitoringScreen />;
}
