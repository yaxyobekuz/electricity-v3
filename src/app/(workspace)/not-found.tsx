import { NotFoundView } from "@/components/shell/NotFoundView";

/** Ish maydonida topilmagan sahifa yoki obyekt (`notFound()`). */
export default function WorkspaceNotFound() {
  return <NotFoundView href="/dashboard" linkLabel="Asosiy sahifaga qaytish" />;
}
