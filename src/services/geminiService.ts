import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { AnalysisResult } from '@/types';

const SYSTEM_PROMPT = `你是一位拥有高级数学和科学背景的金牌教师，具备极强的视觉空间感知能力。请分析用户提供的作业图片或文字。

核心要求：
1. **精准识别与定位**：
   - 识别出图片中的每一道题目。
   - **坐标规范**：为每道题返回极其精确的 [ymin, xmin, ymax, xmax] 坐标。
   - 坐标系：基于 0-1000 的归一化坐标，[0, 0] 为左上角，[1000, 1000] 为右下角。
   - **覆盖范围**：框选区域必须**完美包含**题目编号、完整的题目正文、以及学生书写答案的区域。严禁包含无关的页面边缘、多余的空白或其他题目的内容。

2. **逻辑验证**：
   - 对于任何涉及数学计算、公式推导或逻辑判断的内容，你必须使用内置的 Python 代码工具进行验算，确保批改结果（isCorrect）和正确答案（correctAnswer）绝对无误。

3. **结构化输出要求**：
   - 在所有 Python 验算完成后，输出唯一的 JSON 结果。
   - 所有数学公式、变量（如 $x$, $\\pi$）必须使用标准的 LaTeX 格式并包裹在 $ 或 $$ 中。
   - **步骤规范**：solutionSteps 数组中只包含纯描述和公式，禁止包含“步骤 1”等序号前缀。

4. 严格遵守定义的 JSON 结构。`;

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
          verificationCode: { type: Type.STRING, description: '用于验证答案的 Python 代码内容' },
          hint: { type: Type.STRING },
          solutionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER, description: '0-1000 归一化的顶部坐标' },
              xmin: { type: Type.NUMBER, description: '0-1000 归一化的左侧坐标' },
              ymax: { type: Type.NUMBER, description: '0-1000 归一化的底部坐标' },
              xmax: { type: Type.NUMBER, description: '0-1000 归一化的右侧坐标' },
            },
            required: ['ymin', 'xmin', 'ymax', 'xmax'],
          },
        },
        required: [
          'id',
          'subject',
          'questionText',
          'studentAnswer',
          'isCorrect',
          'correctAnswer',
          'hint',
          'solutionSteps',
          'boundingBox',
        ],
      },
    },
    overallSummary: { type: Type.STRING },
  },
  required: ['problems', 'overallSummary'],
};

const parseGeminiResponse = (response: GenerateContentResponse): AnalysisResult => {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const textContent = parts
    .filter((part) => 'text' in part)
    .map((part) => (part as any).text)
    .join('\n');

  if (!textContent) {
    throw new Error('模型未返回任何文本内容。');
  }

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const targetJson = jsonMatch ? jsonMatch[0] : textContent;
    return JSON.parse(targetJson);
  } catch (e) {
    console.error('JSON 解析失败。原始文本：', textContent);
    throw new Error('响应格式非法：模型未能生成有效的 JSON 结构。');
  }
};

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 VITE_GEMINI_API_KEY（请在 .env.local 中设置）。');
  }
  return apiKey;
};

export const analyzeHomeworkImage = async (base64: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        {
          text: '请精准识别并批改这张作业。请重点确保题目框选 (boundingBox) 的准确性，完整包裹题目内容及答题区。使用 Python 验算所有理科题目。',
        },
      ],
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: JSON_SCHEMA,
      tools: [{ codeExecution: {} }],
      temperature: 1,
    },
  });

  return parseGeminiResponse(response);
};

export const analyzeHomeworkText = async (text: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: `请解答以下题目，并使用 Python 验证你的计算过程：\n${text}` }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: JSON_SCHEMA,
      tools: [{ codeExecution: {} }],
      temperature: 1,
    },
  });
  return parseGeminiResponse(response);
};
