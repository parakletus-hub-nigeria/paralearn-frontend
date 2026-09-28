import jsPDF from "jspdf";
// @ts-ignore - jspdf-autotable extends jsPDF
import autoTable from "jspdf-autotable";

interface StudentData {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  address: string;
  phoneNumber: string;
  guardianName: string;
  guardianPhone: string;
}

interface TeacherData {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
}

export const exportStudentsToPDF = (students: StudentData[]) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });
  
  // Add title
  doc.setFontSize(18);
  doc.setTextColor(100, 27, 196); // Purple color
  doc.text("Students List", 14, 20);
  
  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
  
  // Add total count
  doc.text(`Total Students: ${students.length}`, 14, 34);
  
  // Prepare table data
  const tableData = students.map((student) => [
    student.id || "N/A",
    student.name || "N/A",
    student.email || "N/A",
    student.dateOfBirth || "N/A",
    student.phoneNumber || "N/A",
    student.address || "N/A",
    student.guardianName || "N/A",
    student.guardianPhone || "N/A",
  ]);
  
  // Add table
  autoTable(doc, {
    head: [["ID", "Name", "Email", "Date of Birth", "Phone", "Address", "Guardian Name", "Guardian Phone"]],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [100, 27, 196], // Purple header
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    columnStyles: {
      0: { cellWidth: 25 }, // ID
      1: { cellWidth: 35 }, // Name
      2: { cellWidth: 45 }, // Email
      3: { cellWidth: 25 }, // Date of Birth
      4: { cellWidth: 30 }, // Phone
      5: { cellWidth: 45 }, // Address
      6: { cellWidth: 35 }, // Guardian Name
      7: { cellWidth: 30 }, // Guardian Phone
    },
    margin: { top: 40, right: 14, bottom: 20, left: 14 },
  });
  
  // Save the PDF
  doc.save(`students-list-${new Date().toISOString().split("T")[0]}.pdf`);
};

export const exportTeachersToPDF = (teachers: TeacherData[]) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.setTextColor(100, 27, 196); // Purple color
  doc.text("Teachers List", 14, 20);
  
  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
  
  // Add total count
  doc.text(`Total Teachers: ${teachers.length}`, 14, 34);
  
  // Prepare table data
  const tableData = teachers.map((teacher) => [
    teacher.id || "N/A",
    teacher.name || "N/A",
    teacher.email || "N/A",
    teacher.dateOfBirth || "N/A",
    teacher.phoneNumber || "N/A",
    teacher.address || "N/A",
  ]);
  
  // Add table
  autoTable(doc, {
    head: [["ID", "Name", "Email", "Date of Birth", "Phone", "Address"]],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [100, 27, 196], // Purple header
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    columnStyles: {
      0: { cellWidth: 30 }, // ID
      1: { cellWidth: 50 }, // Name
      2: { cellWidth: 60 }, // Email
      3: { cellWidth: 40 }, // Date of Birth
      4: { cellWidth: 40 }, // Phone
      5: { cellWidth: 60 }, // Address
    },
    margin: { top: 40, right: 14, bottom: 20, left: 14 },
  });
  
  // Save the PDF
  doc.save(`teachers-list-${new Date().toISOString().split("T")[0]}.pdf`);
};
