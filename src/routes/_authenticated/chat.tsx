import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — CoreEgin Sales OS" }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <>
      <PageHeader title="Team chat" description="Fast coordination. Nothing more." />
      <div className="p-6 md:p-8">
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          Real-time chat ships in iteration 3.
        </div>
      </div>
    </>
  );
}