"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Award } from "lucide-react";
import {
  PsychomotorRatingForm,
  DEFAULT_AFFECTIVE_KEYS,
  DEFAULT_PSYCHOMOTOR_KEYS,
} from "@/components/finance/PsychomotorRatingInput";
import {
  useSavePsychomotorRatingsMutation,
  useGetPsychomotorRatingsQuery,
} from "@/reduxToolKit/api/endpoints/psychomotor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportCardId: string;
  studentId?: string;
  studentName?: string;
  onSavedSuccess?: () => void;
}

export function PsychomotorEvaluationModal({
  open,
  onOpenChange,
  reportCardId,
  studentId,
  studentName,
  onSavedSuccess,
}: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const { data: existingData, isLoading: isFetchingRatings } = useGetPsychomotorRatingsQuery(
    { reportCardId, studentId },
    { skip: !open || !reportCardId }
  );

  const [saveRatings, { isLoading: isSaving }] = useSavePsychomotorRatingsMutation();

  useEffect(() => {
    if (existingData?.ratings) {
      setRatings(existingData.ratings);
    } else {
      // Default empty structure
      const initial: Record<string, number> = {};
      [...DEFAULT_AFFECTIVE_KEYS, ...DEFAULT_PSYCHOMOTOR_KEYS].forEach((k) => {
        initial[k] = 0;
      });
      setRatings(initial);
    }
  }, [existingData, open]);

  const handleChange = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!reportCardId) return toast.error("Report Card ID is required");

    try {
      await saveRatings({
        reportCardId,
        studentId,
        ratings,
      }).unwrap();

      toast.success("Psychomotor & Affective ratings saved successfully");
      onSavedSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to save domain ratings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Psychomotor &amp; Affective Evaluation
          </DialogTitle>
          {studentName && (
            <p className="text-xs text-muted-foreground">Student: {studentName}</p>
          )}
        </DialogHeader>

        {isFetchingRatings ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="py-2">
            <PsychomotorRatingForm
              ratings={ratings}
              onChange={handleChange}
            />
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isFetchingRatings}
            className="gap-2 bg-primary font-semibold text-primary-foreground text-xs"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save &amp; Update Report Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
