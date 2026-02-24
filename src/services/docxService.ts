import { LessonPlanData } from '../types';

// Declare global types for CDN libraries
declare global {
  interface Window {
    JSZip: any;
    saveAs: (blob: Blob, filename: string) => void;
  }
}

/**
 * Escape XML special characters
 */
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Tạo XML paragraph với text màu đỏ (NLS) hoặc màu khác - KHÔNG có namespace declaration
 * Namespace đã được định nghĩa ở root element của document.xml
 */
const createColoredParagraphXml = (text: string, indent: number = 720, color: string = 'FF0000'): string => {
  const escaped = escapeXml(text);
  return `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:left="${indent}" w:firstLine="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="${color}"/><w:b/></w:rPr><w:t>${escaped}</w:t></w:r></w:p>`;
};

/**
 * Tạo paragraph con với bullet point màu đỏ (hoặc màu khác) - bao gồm mã chỉ thị
 */
const createColoredBulletParagraphXml = (text: string, frameworkRef?: string, color: string = 'FF0000'): string => {
  const escaped = escapeXml(text);
  const refText = frameworkRef ? `[${escapeXml(frameworkRef)}] ` : '';
  return `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:left="1080" w:firstLine="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="${color}"/></w:rPr><w:t>+ ${refText}${escaped}</w:t></w:r></w:p>`;
};

/**
 * Tạo nội dung NLS cho phần MỤC TIÊU dưới dạng XML để chèn vào DOCX
 */
const generateNLSXmlContent = (data: LessonPlanData, includeAI: boolean, includeDisabilities: boolean): string => {
  let xmlContent = '';

  // Header Năng lực số
  xmlContent += createColoredParagraphXml('- Năng lực số:');

  // Các mục tiêu NLS - bao gồm mã chỉ thị
  if (data.digitalGoals && data.digitalGoals.length > 0) {
    data.digitalGoals.forEach((goal) => {
      xmlContent += createColoredBulletParagraphXml(goal.description, goal.frameworkRef);
    });
  } else {
    xmlContent += createColoredBulletParagraphXml('Khai thác và sử dụng các công cụ số trong học tập');
    xmlContent += createColoredBulletParagraphXml('Hợp tác và giao tiếp qua môi trường số');
    xmlContent += createColoredBulletParagraphXml('Đánh giá và chọn lọc thông tin số');
  }

  // Năng lực AI nếu được bật (tô màu xanh lam)
  if (includeAI) {
    xmlContent += createColoredParagraphXml('- Năng lực trí tuệ nhân tạo (AI):', 720, '0070C0');
    if (data.aiGoals && data.aiGoals.length > 0) {
      data.aiGoals.forEach((goal) => {
        xmlContent += createColoredBulletParagraphXml(goal.description, goal.frameworkRef, '0070C0');
      });
    } else {
      xmlContent += createColoredBulletParagraphXml('Sử dụng công cụ AI hỗ trợ học tập có trách nhiệm', '6.1', '0070C0');
      xmlContent += createColoredBulletParagraphXml('Đánh giá và kiểm chứng thông tin từ AI', '6.2', '0070C0');
    }
  }

  // Năng lực cho học sinh khuyết tật (tô màu tím)
  if (includeDisabilities) {
    xmlContent += createColoredParagraphXml('- Năng lực dành cho học sinh khuyết tật:', 720, '7030A0');
    if (data.disabilityGoals && data.disabilityGoals.length > 0) {
      data.disabilityGoals.forEach((goal) => {
        xmlContent += createColoredBulletParagraphXml(goal.description, goal.frameworkRef, '7030A0');
      });
    } else {
      xmlContent += createColoredBulletParagraphXml('Sử dụng công cụ hỗ trợ tiếp cận phù hợp với nhu cầu cá nhân', undefined, '7030A0');
      xmlContent += createColoredBulletParagraphXml('Tham gia các hoạt động học tập số một cách bình đẳng', undefined, '7030A0');
    }
  }

  return xmlContent;
};

/**
 * Tạo XML paragraph cho NLS tại mỗi hoạt động
 */
const generateActivityNLSXml = (activityIndex: number, nlsType: string, digitalActivity: string): string => {
  let xml = '';
  const label = `* ${nlsType}:`;
  const isAI = nlsType.toLowerCase().includes('ai') || nlsType.toLowerCase().includes('trí tuệ nhân tạo');
  const isDisability = nlsType.toLowerCase().includes('khuyết tật');
  const color = isDisability ? '7030A0' : (isAI ? '0070C0' : 'FF0000');
  
  xml += createColoredParagraphXml(label, 720, color);
  xml += `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:left="1080" w:firstLine="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="${color}"/></w:rPr><w:t>- ${escapeXml(digitalActivity)}</w:t></w:r></w:p>`;
  return xml;
};

/**
 * Tìm tất cả vị trí các Hoạt động trong XML (Hoạt động 1, 2, 3, 4...)
 */
const findActivityPositions = (xmlContent: string): { index: number; position: number }[] => {
  const results: { index: number; position: number }[] = [];

  // Patterns cho các hoạt động phổ biến trong KHBD Việt Nam
  const activityPatterns = [
    /hoạt\s*động\s*(\d+)/gi,
    /HOẠT\s*ĐỘNG\s*(\d+)/gi,
    /HĐ\s*(\d+)/gi,
  ];

  const foundPositions = new Map<number, number>(); // activityIndex -> position

  for (const pattern of activityPatterns) {
    let match;
    while ((match = pattern.exec(xmlContent)) !== null) {
      const actIdx = parseInt(match[1], 10) - 1; // 0-indexed
      if (!foundPositions.has(actIdx)) {
        // Tìm </w:p> gần nhất sau match
        const closingTag = xmlContent.indexOf('</w:p>', match.index);
        if (closingTag !== -1 && closingTag - match.index < 3000) {
          foundPositions.set(actIdx, closingTag + '</w:p>'.length);
        }
      }
    }
  }

  // Sắp xếp theo vị trí
  for (const [index, position] of foundPositions) {
    results.push({ index, position });
  }
  results.sort((a, b) => a.position - b.position);

  return results;
};

/**
 * Tìm tất cả các vị trí chứa pattern trong XML  
 */
const findAllMatches = (xmlContent: string, pattern: RegExp): number[] => {
  const positions: number[] = [];
  let match;
  const globalPattern = new RegExp(pattern.source, 'gi');
  while ((match = globalPattern.exec(xmlContent)) !== null) {
    positions.push(match.index);
  }
  return positions;
};

/**
 * Tìm vị trí chèn NLS - ưu tiên tìm "Năng lực" trong mục tiêu
 */
const findInsertPosition = (xmlContent: string): { position: number; found: boolean } => {
  // Pattern ưu tiên theo thứ tự: cụ thể -> chung
  const priorityPatterns = [
    /năng\s*lực\s*đặc\s*thù/i,     // "Năng lực đặc thù"
    /năng\s*lực\s*chung/i,          // "Năng lực chung"  
    /về\s*năng\s*lực/i,             // "Về năng lực"
    /2[.)]\s*Năng\s*lực/i,          // "2. Năng lực" hoặc "2) Năng lực"
    /năng\s*lực\s*:/i,              // "Năng lực:"
  ];

  for (const pattern of priorityPatterns) {
    const matches = findAllMatches(xmlContent, pattern);
    if (matches.length > 0) {
      // Lấy match đầu tiên
      const matchPos = matches[0];

      // Tìm </w:p> SAU vị trí match này (kết thúc của paragraph chứa text)
      // Nhưng cần tìm </w:p> gần nhất phía sau, không phải quá xa
      let searchStart = matchPos;
      let closingTag = xmlContent.indexOf('</w:p>', searchStart);

      // Giới hạn tìm kiếm trong 2000 ký tự
      if (closingTag !== -1 && closingTag - matchPos < 2000) {
        return { position: closingTag + '</w:p>'.length, found: true };
      }
    }
  }

  // Fallback pattern rộng hơn
  const fallbackPatterns = [
    /MỤC\s*TIÊU/i,
    /I[.)]\s*MỤC\s*TIÊU/i
  ];

  for (const pattern of fallbackPatterns) {
    const matches = findAllMatches(xmlContent, pattern);
    if (matches.length > 0) {
      const matchPos = matches[0];
      // Tìm paragraph tiếp theo sau đoạn mục tiêu
      let closingTag = xmlContent.indexOf('</w:p>', matchPos);
      if (closingTag !== -1) {
        return { position: closingTag + '</w:p>'.length, found: true };
      }
    }
  }

  return { position: -1, found: false };
};

/**
 * Lấy tên file output từ tên file gốc
 */
const getOutputFileName = (originalFileName: string): string => {
  if (!originalFileName) {
    return 'GiaoAn_NLS.docx';
  }
  const lastDotIndex = originalFileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    const nameWithoutExt = originalFileName.substring(0, lastDotIndex);
    return `${nameWithoutExt}_NLS.docx`;
  }
  return `${originalFileName}_NLS.docx`;
};

/**
 * Download file DOCX với NLS được chèn vào, giữ nguyên định dạng gốc
 */
export const downloadAsDocx = async (
  data: LessonPlanData,
  includeAI: boolean,
  includeDisabilities: boolean,
  originalContent?: string,
  originalFile?: ArrayBuffer,
  originalFileName?: string,
  preventDownload: boolean = false
): Promise<Blob | void> => {
  try {
    if (!window.JSZip) {
      console.error('JSZip not loaded');
      alert('Lỗi: Thư viện JSZip chưa được tải. Vui lòng refresh trang.');
      return;
    }

    if (originalFile && originalFileName?.toLowerCase().endsWith('.docx')) {
      return await modifyOriginalDocx(originalFile, data, includeAI, includeDisabilities, originalFileName, preventDownload);
    } else {
      return await downloadAsTxt(data, includeAI, includeDisabilities, originalFileName, preventDownload);
    }
  } catch (error) {
    console.error('Error downloading:', error);
    alert('Có lỗi xảy ra khi tải file. Vui lòng thử lại.');
  }
};

/**
 * Chỉnh sửa file DOCX gốc bằng XML injection - GIỮ NGUYÊN ĐỊNH DẠNG
 */
const modifyOriginalDocx = async (
  originalFile: ArrayBuffer,
  data: LessonPlanData,
  includeAI: boolean,
  includeDisabilities: boolean,
  originalFileName: string,
  preventDownload: boolean = false
): Promise<Blob> => {
  const JSZip = window.JSZip;

  // Đọc file DOCX gốc (là file ZIP)
  const zip = await JSZip.loadAsync(originalFile);

  // Lấy document.xml - nội dung chính
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Không thể đọc nội dung file DOCX');
  }

  let documentXml: string = await documentXmlFile.async('string');

  // === BƯỚC 1: Chèn NLS vào phần Mục tiêu ===
  const nlsXmlContent = generateNLSXmlContent(data, includeAI, includeDisabilities);
  const insertResult = findInsertPosition(documentXml);

  let modifiedXml: string;

  if (insertResult.found && insertResult.position > 0) {
    modifiedXml =
      documentXml.slice(0, insertResult.position) +
      nlsXmlContent +
      documentXml.slice(insertResult.position);
    console.log('Đã chèn NLS Mục tiêu vào vị trí:', insertResult.position);
  } else {
    const bodyEnd = documentXml.lastIndexOf('</w:body>');
    if (bodyEnd !== -1) {
      modifiedXml =
        documentXml.slice(0, bodyEnd) +
        nlsXmlContent +
        documentXml.slice(bodyEnd);
      console.log('Fallback: chèn NLS Mục tiêu vào cuối body');
    } else {
      throw new Error('Không thể tìm vị trí chèn nội dung');
    }
  }

  // === BƯỚC 2: Chèn NLS vào từng Hoạt động ===
  if (data.activities && data.activities.length > 0) {
    const activityPositions = findActivityPositions(modifiedXml);
    console.log(`Tìm thấy ${activityPositions.length} hoạt động trong DOCX`);

    // Chèn từ cuối lên đầu để không bị lệch vị trí
    const sortedDesc = [...activityPositions].sort((a, b) => b.position - a.position);

    for (const actPos of sortedDesc) {
      const activity = data.activities[actPos.index];
      if (activity) {
        const nlsType = activity.nlsType || 'TỔ CHỨC NLS';
        const activityNlsXml = generateActivityNLSXml(actPos.index, nlsType, activity.digitalActivity);
        modifiedXml =
          modifiedXml.slice(0, actPos.position) +
          activityNlsXml +
          modifiedXml.slice(actPos.position);
        console.log(`Đã chèn NLS vào Hoạt động ${actPos.index + 1} - ${nlsType}`);
      }
    }
  }

  // Cập nhật document.xml
  zip.file('word/document.xml', modifiedXml);

  // Tạo file DOCX mới - GIỮ NGUYÊN tất cả file khác (styles, fonts, images...)
  const newDocxBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const outputFileName = getOutputFileName(originalFileName);

  if (!preventDownload) {
    if (window.saveAs) {
      window.saveAs(newDocxBlob, outputFileName);
    } else {
      const url = URL.createObjectURL(newDocxBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  return newDocxBlob;
};

/**
 * Fallback: Download dưới dạng TXT
 */
const downloadAsTxt = async (
  data: LessonPlanData,
  includeAI: boolean,
  includeDisabilities: boolean,
  originalFileName?: string,
  preventDownload: boolean = false
): Promise<Blob> => {
  let content = '════════════════════════════════════════════════════════\n';
  content += '    NỘI DUNG NĂNG LỰC SỐ CẦN CHÈN VÀO GIÁO ÁN\n';
  content += '════════════════════════════════════════════════════════\n\n';

  if (data.title) {
    content += `Bài học: ${data.title}\n\n`;
  }

  content += '📌 CHÈN VÀO PHẦN "I. MỤC TIÊU" → mục "2. Về năng lực:"\n';
  content += '────────────────────────────────────────────────────────\n\n';

  content += '   - Năng lực số:\n';
  if (data.digitalGoals && data.digitalGoals.length > 0) {
    data.digitalGoals.forEach((goal) => {
      content += `      + ${goal.description}\n`;
    });
  }

  if (includeAI) {
    content += '   - Năng lực trí tuệ nhân tạo:\n';
    content += '      + Sử dụng công cụ AI hỗ trợ học tập có trách nhiệm\n';
    content += '      + Đánh giá và kiểm chứng thông tin từ AI\n';
  }

  if (includeDisabilities) {
    content += '   - Năng lực dành cho học sinh khuyết tật:\n';
    if (data.disabilityGoals && data.disabilityGoals.length > 0) {
      data.disabilityGoals.forEach((goal) => {
        content += `      + ${goal.description}\n`;
      });
    } else {
      content += '      + Sử dụng công cụ hỗ trợ tiếp cận phù hợp với nhu cầu cá nhân\n';
      content += '      + Tham gia các hoạt động học tập số một cách bình đẳng\n';
    }
  }

  const outputFileName = originalFileName
    ? originalFileName.replace(/\.[^.]+$/, '_NLS.txt')
    : 'Noi_dung_NLS.txt';

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

  if (!preventDownload) {
    if (window.saveAs) {
      window.saveAs(blob, outputFileName);
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  return blob;
};

/**
 * Tạo nội dung NLS để copy vào clipboard - bao gồm mã chỉ thị
 */
export const generateNLSContent = (data: LessonPlanData, includeAI: boolean, includeDisabilities: boolean): string => {
  let content = '--- MỤC TIÊU TÍCH HỢP ---\n\n';

  // Mục tiêu NLS
  content += '- Năng lực số:\n';
  if (data.digitalGoals && data.digitalGoals.length > 0) {
    data.digitalGoals.forEach((goal) => {
      const ref = goal.frameworkRef ? `[${goal.frameworkRef}] ` : '';
      content += `  + ${ref}${goal.description}\n`;
    });
  } else {
    content += '  + Khai thác và sử dụng các công cụ số trong học tập\n';
    content += '  + Hợp tác và giao tiếp qua môi trường số\n';
    content += '  + Đánh giá và chọn lọc thông tin số\n';
  }

  if (includeAI) {
    content += '\n- Năng lực trí tuệ nhân tạo (AI):\n';
    if (data.aiGoals && data.aiGoals.length > 0) {
      data.aiGoals.forEach((goal) => {
        const ref = goal.frameworkRef ? `[${goal.frameworkRef}] ` : '';
        content += `  + ${ref}${goal.description}\n`;
      });
    } else {
      content += '  + [6.1] Sử dụng công cụ AI hỗ trợ học tập có trách nhiệm\n';
      content += '  + [6.2] Đánh giá và kiểm chứng thông tin từ AI\n';
    }
  }

  if (includeDisabilities) {
    content += '\n- Năng lực dành cho học sinh khuyết tật:\n';
    if (data.disabilityGoals && data.disabilityGoals.length > 0) {
      data.disabilityGoals.forEach((goal) => {
        content += `  + ${goal.description}\n`;
      });
    } else {
      content += '  + Sử dụng công cụ hỗ trợ tiếp cận phù hợp với nhu cầu cá nhân\n';
      content += '  + Tham gia các hoạt động học tập số một cách bình đẳng\n';
    }
  }

  // Hoạt động NLS
  if (data.activities && data.activities.length > 0) {
    content += '\n--- CÁC HOẠT ĐỘNG TÍCH HỢP ---\n\n';
    data.activities.forEach((act, idx) => {
      const nlsType = act.nlsType || 'TỔ CHỨC NLS';
      content += `[Hoạt động ${idx + 1}] ${act.name}\n`;
      content += `* ${nlsType}:\n`;
      content += `  - ${act.digitalActivity}\n\n`;
    });
  }

  return content;
};

/**
 * Copy nội dung NLS vào clipboard
 */
export const copyNLSToClipboard = async (
  data: LessonPlanData,
  includeAI: boolean,
  includeDisabilities: boolean
): Promise<boolean> => {
  try {
    const content = generateNLSContent(data, includeAI, includeDisabilities);
    await navigator.clipboard.writeText(content);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

export default { downloadAsDocx, copyNLSToClipboard };
