
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// Fixed: Escaped backticks inside the system instruction string to prevent syntax errors
const SYSTEM_INSTRUCTION = `
You are an expert Universal Homework Tutor. Your goal is to analyze homework across ALL SUBJECTS (Math, Physics, Chemistry, Biology, History, English, Geography, etc.). You may receive an IMAGE or TEXT input.

CRITICAL: ALL OUTPUT FIELDS (hint, overallSummary, solutionSteps) MUST BE IN SIMPLIFIED CHINESE (简体中文).

RULES:

1. **Analysis**: 
   - If IMAGE: Identify questions and student answers.
   - If TEXT: Analyze the provided question text as the "questionText" and treat "studentAnswer" as empty/null if not provided.

2. **Verification Strategy (Subject Aware)**:
   - **Math / Physics / Chemistry / Logic**: You MUST write and execute **Python code** to calculate the correct answer. The \`verificationCode\` field is REQUIRED.
   - **Humanities / Languages**: Use your internal knowledge base. The \`verificationCode\` field is OPTIONAL.

3. **Comparison**: 
   - Compare the correct result with the student's answer (if any). Mark \`isCorrect\` appropriately.

4. **Feedback**:
   - \`hint\` (思路点拨): Explain logic/theory in text. "Why" and "How to think".
   - \`solutionSteps\` (标准解答):
     - **For Math/Physics/Chem**: Provide STANDARD EXAM-STYLE SOLUTION. Include UNITS in parentheses and a final "答：..." statement.
     - **For Humanities**: Provide bullet points of analysis.

5. **Output**: Return a strict JSON object matching the defined schema.
6. **Bounding Boxes**: 
   - For IMAGE: Return coordinates normalized to 0-1000 scale.
   - For TEXT-ONLY: Return all coordinates as 0.
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
          subject: { type: Type.STRING, description: "The subject of the question" },
          questionText: { type: Type.STRING, description: "The question text" },
          studentAnswer: { type: Type.STRING, description: "Student's answer or empty" },
          isCorrect: { type: Type.BOOLEAN },
          correctAnswer: { type: Type.STRING, description: "Verified correct answer" },
          verificationCode: { type: Type.STRING, description: "Python code for verification" },
          hint: { type: Type.STRING, description: "Logic/Theory explanation" },
          solutionSteps: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Step-by-step solution"
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
    overallSummary: { type: Type.STRING, description: "A brief summary in Simplified Chinese." },
  },
  required: ["problems", "overallSummary"],
};

export const analyzeHomeworkImage = async (base64Image: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  // Initialize Gemini AI with the provided API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this homework image. For Math: include units and 'Answer:' statement. Simplified Chinese." }
        ],
      },
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION, 
        // Using snake_case for tool configuration as per GenAI standards
        tools: [{ codeExecution: {} }], 
        responseMimeType: "application/json", 
        responseSchema: RESPONSE_SCHEMA, 
        temperature: 0.1 
      },
    });
    // response.text is a getter property, not a function
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    throw error;
  }
};

export const analyzeHomeworkText = async (question: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ text: `Solve this homework question: "${question}". For Math: include units and 'Answer:' statement. Simplified Chinese.` }],
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
    console.error("Gemini Text Analysis Error:", error);
    throw error;
  }
};
