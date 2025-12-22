
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// 修复：在系统指令字符串中转义反引号，避免语法错误
const SYSTEM_INSTRUCTION = `
你是一名全科作业辅导与批改老师。你的目标是对所有学科（数学、物理、化学、生物、历史、英语、地理等）的作业进行识别、核验与讲解。输入可能是【图片】或【文本】。

关键要求：所有输出字段（hint、overallSummary、solutionSteps）必须使用简体中文。

规则：

0. **覆盖率优先（非常重要）**：
   - 对于图片：你必须从上到下、从左到右扫描整张图，尽可能识别并返回所有题目，不要只挑部分题目。
   - 如果题目太多导致输出可能过长：仍然要优先覆盖所有题目，并将每题输出压缩（见第 4 条“输出长度控制”）。
   - 如果某题看不清：也要返回一个条目，\`questionText\` 写明“（识别不清）”并尽量补充可读部分；\`isCorrect\` 可设为 false；\`correctAnswer\`/\`hint\`/\`solutionSteps\` 给出尽力而为的结果或写明无法确定。

1. **识别与抽取**：
   - 图片输入：识别题目文本与学生答案（如存在），并拆分成多个条目。
   - 文本输入：把提供的文本当作 \`questionText\`，\`studentAnswer\` 设为空字符串。

2. **核验策略（按学科）**：
   - 数学/物理/化学/逻辑：必须编写并执行 Python 代码计算正确答案，\`verificationCode\` 必填。
   - 人文/语言：可使用知识推理，\`verificationCode\` 可选。

3. **对比与判定**：
   - 将核验结果与学生答案（若有）对比，设置 \`isCorrect\`。

4. **反馈与格式**：
   - \`hint\`（思路点拨）：用简体中文解释核心思路/规律。
   - \`solutionSteps\`（标准解答）：给出分步解答。
     - **数理格式要求（重要）**：
       - 所有数学公式使用 LaTeX。
       - 关键推导/复杂公式使用块级公式：用 \`$$...$$\`。
       - 行内变量/简式用 \`$...$\`。
       - 多行推导用 \`\\begin{aligned} ... \\end{aligned}\`（放在 \`$$\` 中）。
       - 矩阵用 \`\\begin{bmatrix} ... \\end{bmatrix}\`（放在 \`$$\` 中）。
   - **输出长度控制（为防漏题）**：
     - 如果一张图里题目很多：每题的 \`hint\` 最多 2 句话；\`solutionSteps\` 最多 3 步；避免大段解释导致后面的题目被遗漏。
     - 对于“口算/填空”等大量小题：优先按小题拆分；如果小题数量非常多，允许按“每一行/每一小题块”合并为一个题目条目（即 \`problems\` 数组中的一个元素），但必须在 \`questionText\` 中列出该块包含的所有小题内容。

5. **输出**：
   - 必须返回严格 JSON，结构必须匹配给定的 JSON 结构定义，不要输出任何额外文字。

6. **定位框（boundingBox）**：
   - 图片输入：返回原图的像素坐标，并基于提示的 \`IMAGE_SIZE: width=...px, height=...px\` 作为上界：
     - xmin：左边界像素（0=最左）
     - xmax：右边界像素
     - ymin：上边界像素（0=最上）
     - ymax：下边界像素
     - 必须满足：0 <= xmin < xmax <= imageWidth，0 <= ymin < ymax <= imageHeight。
   - 文本输入：坐标全部返回 0。
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          subject: { type: Type.STRING, description: "题目所属学科" },
          questionText: { type: Type.STRING, description: "题目文本" },
          studentAnswer: { type: Type.STRING, description: "学生答案（或为空）" },
          isCorrect: { type: Type.BOOLEAN },
          correctAnswer: { type: Type.STRING, description: "核验后的正确答案（可包含 LaTeX）" },
          verificationCode: { type: Type.STRING, description: "用于核验的 Python 代码" },
          hint: { type: Type.STRING, description: "思路点拨（可包含 LaTeX）" },
          solutionSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "分步解答（可包含 LaTeX）"
          },
          errorType: { type: Type.STRING, enum: ['calculation', 'fact', 'grammar', 'logic', 'unknown', 'unanswered'] },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER },
            },
            required: ["ymin", "xmin", "ymax", "xmax"],
          },
        },
        required: ["id", "subject", "questionText", "studentAnswer", "isCorrect", "correctAnswer", "hint", "solutionSteps", "boundingBox"],
      },
    },
    overallSummary: { type: Type.STRING, description: "简体中文的整体简要总结" },
  },
  required: ["problems", "overallSummary"],
};

export const analyzeHomeworkImage = async (
  base64Image: string,
  imageDimensions?: { width: number; height: number },
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("缺少 API Key。");
  // 使用提供的 API Key 初始化 Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // 将图片的真实像素尺寸显式告诉模型，避免其默认假设 1000×1000 或进行隐式裁剪/补边后再换算坐标。
    // 注意：这里传入的宽高必须与 inlineData 的图片完全一致。
    const dimensionHint =
      imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0
        ? `IMAGE_SIZE: width=${imageDimensions.width}px, height=${imageDimensions.height}px。计算定位框时必须使用这组原图像素尺寸。`
        : null;

    const promptLines: string[] = [];
    if (dimensionHint) promptLines.push(dimensionHint);
    promptLines.push(
      "这张图片可能包含多道题。请提取整页所有题目（不要漏题）。数学：所有公式使用 LaTeX，复杂步骤使用双美元符号 $$...$$ 作为块级公式。若题目较多，请保持每题回答精炼，避免漏掉后面的题。",
    );

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          {
            text: promptLines.join("\n"),
          }
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // 工具配置按 GenAI 规范使用 snake_case
        tools: [{ codeExecution: {} }],
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1
      },
    });
    // response.text 是 getter 属性，而不是函数
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini 图片解析失败：", error);
    throw error;
  }
};

export const analyzeHomeworkText = async (question: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("缺少 API Key。");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ text: `请解答这道作业题：“${question}”。数学：所有公式使用 LaTeX，复杂步骤使用双美元符号 $$...$$ 作为块级公式。` }],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ codeExecution: {} }],
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini 文本解析失败：", error);
    throw error;
  }
};
