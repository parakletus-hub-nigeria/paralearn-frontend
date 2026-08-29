"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Mail, Loader2, CheckCircle2 } from "lucide-react";
import {
  useShareReportCardWhatsappMutation,
  useShareReportCardEmailMutation,
} from "@/reduxToolKit/api/endpoints/reports";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportCardId: string;
  studentName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
}

export function ShareReportModal({
  open,
  onOpenChange,
  reportCardId,
  studentName,
  defaultPhone = "",
  defaultEmail = "",
}: Props) {
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [successMsg, setSuccessMsg] = useState("");

  const [shareWhatsapp, { isLoading: isSendingWhatsapp }] = useShareReportCardWhatsappMutation();
  const [shareEmail, { isLoading: isSendingEmail }] = useShareReportCardEmailMutation();

  const sending = isSendingWhatsapp || isSendingEmail;

  const handleSend = async () => {
    setSuccessMsg("");
    try {
      if (channel === "whatsapp") {
        if (!phone.trim()) return toast.error("Please enter a WhatsApp phone number");
        await shareWhatsapp({
          reportCardId,
          phone: phone.trim(),
        }).unwrap();
        setSuccessMsg(`Report card link dispatched via WhatsApp to ${phone}`);
        toast.success("Dispatched via WhatsApp");
      } else {
        if (!email.trim()) return toast.error("Please enter an email address");
        await shareEmail({
          reportCardId,
          email: email.trim(),
        }).unwrap();
        setSuccessMsg(`Report card PDF dispatched via email to ${email}`);
        toast.success("Dispatched via Email");
      }
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || `Failed to send via ${channel}`);
    }
  };

  const handleClose = () => {
    setSuccessMsg("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Report Card</DialogTitle>
          {studentName && (
            <p className="text-xs text-muted-foreground">Recipient: {studentName}</p>
          )}
        </DialogHeader>

        {successMsg ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="font-semibold text-lg text-emerald-800">Successfully Sent!</p>
            <p className="text-sm text-muted-foreground">{successMsg}</p>
            <Button className="w-full mt-2" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Channel selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                  channel === "whatsapp"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                  channel === "email"
                    ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Mail className="h-4 w-4 text-blue-600" /> Email
              </button>
            </div>

            {channel === "whatsapp" ? (
              <div className="space-y-1.5">
                <Label>Parent/Guardian WhatsApp Number</Label>
                <Input
                  placeholder="e.g. +234 801 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Includes secure verified link (https://pln.ng/verify/...)
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Parent/Guardian Email Address</Label>
                <Input
                  type="email"
                  placeholder="parent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sends verified PDF attachment and preview link.
                </p>
              </div>
            )}
          </div>
        )}

        {!successMsg && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2 bg-primary text-primary-foreground font-semibold">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Report Card
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
