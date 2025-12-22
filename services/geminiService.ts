
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult } from "../types";

const SYSTEM_PROMPT = `你是一位拥有高级数学和科学背景的金牌教师。请分析用户提供的作业（图片或文字）。

核心要求：
1. 识别：识别题目、学生答案。
2. 验证：对于任何数学计算、科学公式或逻辑推理，你必须利用内置的 Python 代码执行工具进行模拟或计算，以确保答案的绝对准确。
3. 结构化输出：
   - 必须在所有 Python 代码运行完毕后，输出最终的 JSON 结果。
   - 为每道题返回准确的 [ymin, xmin, ymax, xmax] 坐标（0-1000 归一化）。
   - 将验证时使用的 Python 代码放入 verificationCode 字段。
   - **极其重要**：所有数学公式、符号、甚至单独的变量（如 $x$, $\pi$）必须使用标准的 LaTeX 格式并包裹在 $ 或 $$ 中。确保 correctAnswer 字段也是 LaTeX 格式。
   - **步骤规范**：solutionSteps 数组中的每个字符串应只包含纯描述和公式。**严禁**包含“步骤 1”、“1.”、“Step 1”等前缀，因为 UI 会自动添加序号。
4. 严格输出定义的 JSON 结构。不要在 JSON 外包含任何文字。`;

const JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          subject: { type: Type.STRING },
          questionText: { type: Type.STRING },
          studentAnswer: { type: Type.STRING },
          isCorrect: { type: Type.BOOLEAN },
          correctAnswer: { type: Type.STRING },
          verificationCode: { type: Type.STRING, description: "用于验证答案的 Python 代码内容" },
          hint: { type: Type.STRING },
          solutionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          boundingBox: {
            type: Type.OBJECT,
            properties: { ymin: { type: Type.NUMBER }, xmin: { type: Type.NUMBER }, ymax: { type: Type.NUMBER }, xmax: { type: Type.NUMBER } },
            required: ["ymin", "xmin", "ymax", "xmax"]
          }
        },
        required: ["id", "subject", "questionText", "studentAnswer", "isCorrect", "correctAnswer", "hint", "solutionSteps", "boundingBox"]
      }
    },
    overallSummary: { type: Type.STRING }
  },
  required: ["problems", "overallSummary"]
};

/**
 * 健壮的 JSON 解析逻辑
 * 处理包含 codeExecutionParts 的复杂响应
 */
const parseGeminiResponse = (response: GenerateContentResponse): AnalysisResult => {
  // 手动提取所有 text parts。由于启用了代码执行，response.text 可能会触发警告。
  // 我们直接从 candidates 结构中读取。
  const parts = response.candidates?.[0]?.content?.parts || [];
  
  // 过滤并合并所有文本部分。通常 JSON 会出现在最后一个文本部分。
  const textContent = parts
    .filter(part => 'text' in part)
    .map(part => (part as any).text)
    .join('\n');

  if (!textContent) {
    throw new Error("模型未返回任何文本内容。");
  }
  
  try {
    // 尝试寻找文本中的 JSON 块（处理可能存在的 Markdown 代码块或杂质）
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const targetJson = jsonMatch ? jsonMatch[0] : textContent;
    
    return JSON.parse(targetJson);
  } catch (e) {
    console.error("JSON 解析失败。原始文本：", textContent);
    throw new Error("响应格式非法：模型未能生成有效的 JSON 结构。");
  }
};

export const analyzeHomeworkImage = async (base64: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: "请批改这张作业。如果是数学或理科题，请务必使用 Python 工具进行验算以确保结果正确。请框出每道题的位置。" }
      ],
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: JSON_SCHEMA,
      tools: [{ codeExecution: {} }], 
      temperature: 1
    },
  });
  
  return parseGeminiResponse(response);
};

export const analyzeHomeworkText = async (text: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: `请解答以下题目，并使用 Python 验证你的计算过程：\n${text}` }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: JSON_SCHEMA,
      tools: [{ codeExecution: {} }],
      temperature: 1
    },
  });
  return parseGeminiResponse(response);
};
