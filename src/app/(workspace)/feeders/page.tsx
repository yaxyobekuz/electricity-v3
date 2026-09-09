import type { Metadata } from "next";

import { FeederView } from "@/components/feeder/FeederView";

export const metadata: Metadata = { title: "Fiderlar" };

export default function FeedersPage() {
  return <FeederView />;
}
