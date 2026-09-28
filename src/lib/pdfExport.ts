import jsPDF from "jspdf";
// @ts-ignore - jspdf-autotable extends jsPDF
import autoTable from "jspdf-autotable";

export interface StudentData {
  userCode?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianInfo?: string;
  // Backward compatibility fields
  id?: string;
  name?: string;
  dateOfBirth?: string;
  address?: string;
  phoneNumber?: string;
}

export interface TeacherData {
  userCode?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  // Backward compatibility fields
  id?: string;
  name?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: string;
}

/**
 * Formats guardian name and phone into a multi-line or clean string representation
 */
export const formatGuardianInfo = (name?: string, phone?: string): string => {
  const cleanName = (name || "").trim();
  const cleanPhone = (phone || "").trim();
  if (cleanName && cleanPhone) {
    return `${cleanName}\n${cleanPhone}`;
  }
  return cleanName || cleanPhone || "N/A";
};

/**
 * Exports students list to PDF
 * Columns: User Code, First Name, Last Name, Email Address, Guardian Info
 * Sized and formatted to ensure no column or page overflow.
 */
export const exportStudentsToPDF = (students: StudentData[], schoolName?: string) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm for A4 landscape
  const title = schoolName ? `${schoolName} — Students Directory` : "Students Directory";

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(100, 27, 196); // Brand violet
  doc.text(title, 14, 18);

  // Subtitle / metadata
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated on: ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}   •   Total Students: ${students.length}`,
    14,
    25
  );

  // Prepare table data
  const tableData = students.map((student) => {
    const userCode = student.userCode || student.id || "—";
    let firstName = student.firstName || "";
    let lastName = student.lastName || "";
    if (!firstName && !lastName && student.name) {
      const parts = student.name.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }
    const email = student.email || "—";
    const gInfo =
      student.guardianInfo ||
      formatGuardianInfo(student.guardianName, student.guardianPhone);

    return [userCode, firstName || "—", lastName || "—", email, gInfo];
  });

  // Usable width: 297 - 28 = 269mm
  // Column distribution:
  // User Code: 38mm
  // First Name: 48mm
  // Last Name: 48mm
  // Email Address: 70mm
  // Guardian Info: 65mm
  // Sum = 269mm (Exactly matches margins, zero horizontal overflow)
  autoTable(doc, {
    head: [["User Code", "First Name", "Last Name", "Email Address", "Guardian Info"]],
    body: tableData,
    startY: 32,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      lineColor: [230, 230, 235],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [100, 27, 196],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 247, 254],
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "normal" }, // User Code
      1: { cellWidth: 48 }, // First Name
      2: { cellWidth: 48 }, // Last Name
      3: { cellWidth: 70 }, // Email Address
      4: { cellWidth: 65 }, // Guardian Info
    },
    margin: { top: 32, right: 14, bottom: 18, left: 14 },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    },
  });

  doc.save(`students-list-${new Date().toISOString().split("T")[0]}.pdf`);
};

/**
 * Exports teachers list to PDF
 * Columns: User Code, First Name, Last Name, Email Address
 * Sized and formatted to ensure clean portrait presentation with zero overflow.
 */
export const exportTeachersToPDF = (teachers: TeacherData[], schoolName?: string) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm for A4 portrait
  const title = schoolName ? `${schoolName} — Teachers Directory` : "Teachers Directory";

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(100, 27, 196);
  doc.text(title, 14, 18);

  // Subtitle / metadata
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated on: ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}   •   Total Teachers: ${teachers.length}`,
    14,
    25
  );

  // Prepare table data
  const tableData = teachers.map((teacher) => {
    const userCode = teacher.userCode || teacher.id || "—";
    let firstName = teacher.firstName || "";
    let lastName = teacher.lastName || "";
    if (!firstName && !lastName && teacher.name) {
      const parts = teacher.name.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }
    const email = teacher.email || "—";

    return [userCode, firstName || "—", lastName || "—", email];
  });

  // Usable width: 210 - 28 = 182mm
  // Column distribution:
  // User Code: 32mm
  // First Name: 42mm
  // Last Name: 42mm
  // Email Address: 66mm
  // Sum = 182mm (Exactly matches margins, zero horizontal overflow)
  autoTable(doc, {
    head: [["User Code", "First Name", "Last Name", "Email Address"]],
    body: tableData,
    startY: 32,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      lineColor: [230, 230, 235],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [100, 27, 196],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 247, 254],
    },
    columnStyles: {
      0: { cellWidth: 32 }, // User Code
      1: { cellWidth: 42 }, // First Name
      2: { cellWidth: 42 }, // Last Name
      3: { cellWidth: 66 }, // Email Address
    },
    margin: { top: 32, right: 14, bottom: 18, left: 14 },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    },
  });

  doc.save(`teachers-list-${new Date().toISOString().split("T")[0]}.pdf`);
};

/**
 * Escapes a cell value for CSV formatting
 */
const escapeCSVCell = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Exports students list to CSV
 */
export const exportStudentsToCSV = (students: StudentData[]) => {
  const headers = ["User Code", "First Name", "Last Name", "Email Address", "Guardian Info"];
  const rows = students.map((student) => {
    const userCode = student.userCode || student.id || "";
    let firstName = student.firstName || "";
    let lastName = student.lastName || "";
    if (!firstName && !lastName && student.name) {
      const parts = student.name.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }
    const email = student.email || "";
    const gInfo =
      student.guardianInfo ||
      [student.guardianName, student.guardianPhone].filter(Boolean).join(" - ");

    return [
      escapeCSVCell(userCode),
      escapeCSVCell(firstName),
      escapeCSVCell(lastName),
      escapeCSVCell(email),
      escapeCSVCell(gInfo),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `students-list-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports teachers list to CSV
 */
export const exportTeachersToCSV = (teachers: TeacherData[]) => {
  const headers = ["User Code", "First Name", "Last Name", "Email Address"];
  const rows = teachers.map((teacher) => {
    const userCode = teacher.userCode || teacher.id || "";
    let firstName = teacher.firstName || "";
    let lastName = teacher.lastName || "";
    if (!firstName && !lastName && teacher.name) {
      const parts = teacher.name.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }
    const email = teacher.email || "";

    return [
      escapeCSVCell(userCode),
      escapeCSVCell(firstName),
      escapeCSVCell(lastName),
      escapeCSVCell(email),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `teachers-list-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
