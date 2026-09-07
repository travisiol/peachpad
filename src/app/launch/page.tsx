import type { Metadata } from "next";
import { site } from "@/lib/site";
import { LaunchForm } from "@/components/LaunchForm";

export const metadata: Metadata = {
  title: `Launch a token - ${site.name}`,
  description: `Launch on ${site.firstPad} through ${site.name}. Keep 90% of creator fees; add tools when you need them.`,
};

export default function LaunchPage() {
  return <LaunchForm />;
}
