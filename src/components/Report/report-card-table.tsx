"use client";

import { useState } from "react";
import { MoreVertical, Trash2, Eye, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { DeleteReportDialog } from "./delete-report-dialog";
import { PublishReportDialog } from "./publish-report-dialog";
import { PsychomotorEvaluationModal } from "./PsychomotorEvaluationModal";

interface ReportCard {
  id: string;
  studentId: string;
  name: string;
  class: string;
  lastUpdated: string;
  contact: string;
  status: "Published" | "Draft";
}

interface ReportCardTableProps {
  onViewReport?: (reportId: string) => void;
}

const mockReportCards: ReportCard[] = [
  {
    id: "S-101",
    studentId: "S-101",
    name: "John Doe",
    class: "1 South",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Published",
  },
  {
    id: "S-102",
    studentId: "S-101",
    name: "John Doe",
    class: "1 South",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Draft",
  },
  {
    id: "S-103",
    studentId: "S-101",
    name: "John Doe",
    class: "1 South",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Draft",
  },
  {
    id: "S-104",
    studentId: "S-101",
    name: "John Doe",
    class: "1 South",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Published",
  },
  {
    id: "S-105",
    studentId: "S-101",
    name: "John Doe",
    class: "1 North",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Published",
  },
  {
    id: "S-106",
    studentId: "S-101",
    name: "John Doe",
    class: "1 East",
    lastUpdated: "01/01/2001",
    contact: "+23456678904６",
    status: "Draft",
  },
  {
    id: "S-107",
    studentId: "S-101",
    name: "John Doe",
    class: "1 South",
    lastUpdated: "01/01/2001",
    contact: "+23456789045６",
    status: "Published",
  },
];

export function ReportCardTable({ onViewReport }: ReportCardTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("All Classes");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [psychomotorDialogOpen, setPsychomotorDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);

  const filteredCards = mockReportCards.filter((card) => {
    const matchesSearch = card.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesClass =
      selectedClass === "All Classes" || card.class === selectedClass;
    const matchesStatus =
      selectedStatus === "All Status" || card.status === selectedStatus;

    return matchesSearch && matchesClass && matchesStatus;
  });

  const handleDelete = (report: ReportCard) => {
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  const handlePublish = (report: ReportCard) => {
    setSelectedReport(report);
    setPublishDialogOpen(true);
  };

  const handleEvaluatePsychomotor = (report: ReportCard) => {
    setSelectedReport(report);
    setPsychomotorDialogOpen(true);
  };

  const classes = [
    "All Classes",
    "1 South",
    "1 North",
    "1 East",
    "1 West",
    "1 Central",
  ];
  const statuses = ["All Status", "Published", "Draft"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by student name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="flex gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
              <TableHead className="text-primary-foreground">ID</TableHead>
              <TableHead className="text-primary-foreground">Name</TableHead>
              <TableHead className="text-primary-foreground">Class</TableHead>
              <TableHead className="text-primary-foreground">
                Last Updated
              </TableHead>
              <TableHead className="text-primary-foreground">Contact</TableHead>
              <TableHead className="text-primary-foreground">Status</TableHead>
              <TableHead className="text-primary-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCards.map((card, index) => (
              <TableRow
                key={card.id}
                className={
                  index % 2 === 0 ? "bg-primary/5" : "bg-primary-foreground"
                }
              >
                <TableCell className="font-medium text-accent-foreground">
                  {card.studentId}
                </TableCell>
                <TableCell>{card.name}</TableCell>
                <TableCell>{card.class}</TableCell>
                <TableCell>{card.lastUpdated}</TableCell>
                <TableCell>{card.contact}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      card.status === "Published" ? "default" : "secondary"
                    }
                  >
                    {card.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewReport?.(card.id)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Report
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEvaluatePsychomotor(card)}>
                        <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                        Evaluate Psychomotor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePublish(card)}>
                        <FileText className="w-4 h-4 mr-2" />
                        Publish
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(card)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedReport && (
        <>
          <DeleteReportDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            report={selectedReport}
          />
          <PublishReportDialog
            open={publishDialogOpen}
            onOpenChange={setPublishDialogOpen}
            report={selectedReport}
          />
          <PsychomotorEvaluationModal
            open={psychomotorDialogOpen}
            onOpenChange={setPsychomotorDialogOpen}
            reportCardId={selectedReport.id}
            studentId={selectedReport.studentId}
            studentName={selectedReport.name}
          />
        </>
      )}
    </div>
  );
}
