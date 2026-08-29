"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { ReportCardTable } from "./report-card-table";
import { ReportCardDetailView } from "./report-card-detail-view";
import { ReportCardTemplatePicker } from "./report-card-template-picker";
import { BulkShareReportModal } from "./BulkShareReportModal";
import { Button } from "@/components/ui/button";
import { Plus, Send } from "lucide-react";
import { useLazyQueueReportCardPdfQuery } from "@/reduxToolKit/api/endpoints/reports";
import { toast } from "sonner";

export function ReportCardAdminPage() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  // The selected report card row that triggered generation (studentId + classId)
  const [pendingGeneration, setPendingGeneration] = useState<{
    studentId: string;
    classId: string;
    session: string;
    term: string;
  } | null>(null);

  const [queuePdf] = useLazyQueueReportCardPdfQuery();

  const handleViewReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
    setSelectedReportId(null);
  };

  /** Opens the template picker. Pass report context if you have it, otherwise uses empty defaults. */
  const handleGenerateReport = (opts?: {
    studentId: string;
    classId: string;
    session: string;
    term: string;
  }) => {
    setPendingGeneration(opts ?? null);
    setTemplatePickerOpen(true);
  };

  const handleTemplateConfirmed = async (selectionId: string) => {
    if (!pendingGeneration) return;
    try {
      const result = await queuePdf({
        ...pendingGeneration,
        templateId: selectionId,
      }).unwrap();
      toast.success(`PDF queued! Job ID: ${result.jobId}`);
    } catch {
      toast.error("Failed to queue PDF generation. Please try again.");
    } finally {
      setPendingGeneration(null);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* <Sidebar activeItem="Report Cards" /> */}

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Good morning Admin!
            </h1>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Report Card Management
                </h2>
                <p className="text-muted-foreground mt-1">
                  Generate, preview, and publish student report cards
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setBulkShareOpen(true)}
                  className="gap-1.5"
                >
                  <Send className="w-4 h-4 text-emerald-600" />
                  Bulk Dispatch (WhatsApp &amp; Email)
                </Button>
                <Button
                  onClick={() => handleGenerateReport()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate New Report
                </Button>
              </div>
            </div>
          </div>

          {view === "list" ? (
            <ReportCardTable onViewReport={handleViewReport} />
          ) : (
            <ReportCardDetailView
              studentName="Jane Doe"
              className="1 South"
              onBack={handleBack}
            />
          )}
        </div>
      </main>

      <ReportCardTemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onConfirm={handleTemplateConfirmed}
      />

      <BulkShareReportModal
        open={bulkShareOpen}
        onOpenChange={setBulkShareOpen}
      />
    </div>
  );
}
