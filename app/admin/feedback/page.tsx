import type { Metadata } from "next"
import { FeedbackAdmin } from "@/components/admin/feedback-admin"

export const metadata: Metadata = {
  title: "Feedback admin",
  robots: { index: false, follow: false },
}

export default function AdminFeedbackPage() {
  return <FeedbackAdmin />
}
