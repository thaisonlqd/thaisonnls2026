import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlanData } from "../types";

let apiKey = "";
let selectedModel = "gemini-2.5-flash";

export const getApiKey = () => {
  return apiKey || localStorage.getItem("gemini_api_key") || "";
};

export const setApiKey = (key: string) => {
  apiKey = key;
  localStorage.setItem("gemini_api_key", key);
};

export const getSelectedModel = () => {
  return selectedModel || localStorage.getItem("gemini_selected_model") || "gemini-2.5-flash";
};

export const setSelectedModel = (model: string) => {
  selectedModel = model;
  localStorage.setItem("gemini_selected_model", model);
};

export const analyzeLessonPlan = async (content: string): Promise<LessonPlanData> => {
  const key = getApiKey();
  if (!key) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: key });
  const model = getSelectedModel();

  const response = await ai.models.generateContent({
    model: model,
    contents: `Phân tích KHBD sau và đề xuất cách tích hợp năng lực số (và năng lực AI nếu phù hợp).
    QUAN TRỌNG: Tuyệt đối lấy ĐÚNG mã chỉ thị năng lực số (frameworkRef) chính xác đối với từng bài học dựa trên nội dung Phụ lục / Phân phối chương trình được cung cấp. Bạn phải tìm chính xác tên bài học trong PPCT và lấy đúng TẤT CẢ các mã năng lực số tương ứng (ví dụ: nếu bài học có mã 1.1.TC1a, 1.1.TC1c, 2.1.TC1a thì phải lấy đủ và ghép lại thành chuỗi, ví dụ "1.1.TC1a, 1.1.TC1c, 2.1.TC1a"). Không tự bịa ra mã chỉ thị nếu không có trong PPCT.
    
    ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Tiêu đề KHBD" },
          summary: { type: Type.STRING, description: "Tóm tắt ngắn gọn" },
          digitalGoals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                frameworkRef: { type: Type.STRING, description: "Mã chỉ thị năng lực số (VD: 2.1.TC1b, 2.2.TC1a, 1.1.TC1a, ...)" }
              }
            }
          },
          disabilityGoals: {
            type: Type.ARRAY,
            description: "Mục tiêu năng lực dành cho học sinh khuyết tật (nếu có yêu cầu). Yêu cầu: Viết thật ngắn gọn, súc tích.",
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "Mô tả mục tiêu ngắn gọn, súc tích" },
                frameworkRef: { type: Type.STRING, description: "Mã chỉ thị (nếu có)" }
              }
            }
          },
          aiGoals: {
            type: Type.ARRAY,
            description: "Mục tiêu năng lực trí tuệ nhân tạo (nếu có yêu cầu)",
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                frameworkRef: { type: Type.STRING, description: "Mã chỉ thị (nếu có)" }
              }
            }
          },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Tên hoạt động" },
                nlsType: { type: Type.STRING, description: "Loại năng lực số" },
                digitalActivity: { type: Type.STRING, description: "Mô tả hoạt động số" },
                digitalTools: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          },
          recommendedTools: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "digitalGoals", "activities"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as LessonPlanData;
};
