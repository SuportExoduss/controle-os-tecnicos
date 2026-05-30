import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateIndividualPDF = async (technicianName, reportData, elementId) => {
  try {
    const element = document.getElementById(elementId);
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${technicianName}-${reportData.date}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF individual:', error);
  }
};

export const generateGeneralPDF = async (allReports, elementId) => {
  try {
    const element = document.getElementById(elementId);
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    pdf.save(`relatorio-geral-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF geral:', error);
  }
};
