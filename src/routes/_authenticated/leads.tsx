import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — CoreEgin Sales OS" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  return (
    <>
      <PageHeader
        title="Leads"
        description="Every conversation, one list."
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New lead
          </Button>
        }
      />
      <div className="p-6 md:p-8">
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          Lead list & filters ship in iteration 2.
        </div>
      </div>
    </>
  );
}