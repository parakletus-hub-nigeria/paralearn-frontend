import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Allow sufficient time for multimodal AI processing

interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

interface RawGeneratedQuestion {
  prompt: string;
  type?: "MCQ" | "TRUE_FALSE";
  difficulty?: "simple" | "intermediate" | "hard";
  citation?: string;
  explanation?: string;
  marks?: number;
  options: QuestionOption[];
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in server environment." },
        { status: 500 }
      );
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const genAI = new GoogleGenerativeAI(apiKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const notesText = (formData.get("notes") as string) || "";
    const subject = (formData.get("subject") as string) || "General Subject";
    const difficulty = (formData.get("difficulty") as string) || "balanced"; // simple | intermediate | hard | balanced
    const count = Math.min(Math.max(parseInt((formData.get("count") as string) || "10", 10), 1), 50);

    if (!file && (!notesText || notesText.trim().length === 0)) {
      return NextResponse.json(
        { error: "Please provide either lecture notes, a document, slides, or an audio/video file." },
        { status: 400 }
      );
    }

    // Build Difficulty Calibration Prompt
    let difficultyInstruction = "";
    if (difficulty === "simple") {
      difficultyInstruction = `
All questions MUST be 'simple' difficulty:
- Focus on Bloom's Taxonomy Level 1 & 2: Direct factual recall, key definitions, fundamental laws, and terminology explicitly stated in the source.
- Distractors should be plausible but clearly distinguishable for any attentive student.`;
    } else if (difficulty === "intermediate") {
      difficultyInstruction = `
All questions MUST be 'intermediate' difficulty:
- Focus on Bloom's Taxonomy Level 3 & 4: Application of concepts, cause-and-effect relationships, situational problems, and interpreting data or methods presented in the material.
- Distractors should include common misconceptions and typical calculation/reasoning traps.`;
    } else if (difficulty === "hard") {
      difficultyInstruction = `
All questions MUST be 'hard' difficulty:
- Focus on Bloom's Taxonomy Level 5 & 6: Synthesis, multi-step critical thinking, evaluating contrasting assertions, edge cases, and subtle distinctions between related principles.
- Distractors must be sophisticated and plausible, requiring deep conceptual mastery to rule out.`;
    } else {
      difficultyInstruction = `
Generate a balanced distribution of questions across difficulty levels:
- ~35% Simple (Recall, core definitions, basic formulas)
- ~45% Intermediate (Application, analysis, scenario-based evaluation)
- ~20% Hard (Multi-step deduction, synthesis, subtle edge-case evaluation)
Assign the appropriate difficulty field ('simple', 'intermediate', or 'hard') to each question.`;
    }

    const systemPrompt = `
You are an expert psychometrician and academic exam author for the ParaLearn CBT Computer-Based Testing platform.
Your task is to analyze the provided source material (lecture notes, document, presentation slides, or audio/video recording) and author ${count} high-quality, rigorous examination questions for the subject: "${subject}".

${difficultyInstruction}

Rules for Question Authoring:
1. Grounding: Every question must be strictly derived from the provided content. Do not invent unrelated trivia.
2. Question Format: Multiple Choice Questions (MCQ) with 4 distinct options (or True/False with 2 options if appropriate).
3. Option Quality: Ensure exactly one option is marked as correct (isCorrect: true). The other options must have isCorrect: false. Never use lazy options like "All of the above" or "None of the above".
4. Citations: Provide a concise 'citation' string identifying where in the material the answer is found (e.g., "Page 3", "Slide 12", "Section 2.1", or "Audio/Video ~03:45").
5. Explanation: Provide a clear, educational explanation explaining why the correct answer is right and why the key distractors are incorrect.
6. Language: Maintain standard academic English and clear pedagogical phrasing.

Return the result STRICTLY as a valid JSON object matching this schema:
{
  "questions": [
    {
      "prompt": "string (the question statement)",
      "type": "MCQ",
      "difficulty": "simple" | "intermediate" | "hard",
      "citation": "string (e.g. 'Slide 4' or '05:20')",
      "explanation": "string (brief justification)",
      "marks": 1.0,
      "options": [
        { "text": "Option A text", "isCorrect": true },
        { "text": "Option B text", "isCorrect": false },
        { "text": "Option C text", "isCorrect": false },
        { "text": "Option D text", "isCorrect": false }
      ]
    }
  ]
}
`;

    // Initialize Gemini model with structured JSON configuration
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2, // Low temperature for high factual accuracy and adherence to material
      },
    });

    const promptParts: any[] = [{ text: systemPrompt }];

    // If text notes were provided
    if (notesText && notesText.trim().length > 0) {
      promptParts.push({
        text: `\n\n--- SOURCE MATERIAL (LECTURE NOTES / TRANSCRIPT) ---\n${notesText.trim()}`,
      });
    }

    // If a media or document file was uploaded
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Data = buffer.toString("base64");
      
      // Determine MIME type
      let mimeType = file.type || "application/octet-stream";
      const fileName = file.name.toLowerCase();

      // Normalize common extension MIME types if browser didn't supply them accurately
      if (fileName.endsWith(".pdf")) mimeType = "application/pdf";
      else if (fileName.endsWith(".txt")) mimeType = "text/plain";
      else if (fileName.endsWith(".md")) mimeType = "text/markdown";
      else if (fileName.endsWith(".mp3")) mimeType = "audio/mp3";
      else if (fileName.endsWith(".wav")) mimeType = "audio/wav";
      else if (fileName.endsWith(".m4a")) mimeType = "audio/m4a";
      else if (fileName.endsWith(".ogg")) mimeType = "audio/ogg";
      else if (fileName.endsWith(".mp4")) mimeType = "video/mp4";
      else if (fileName.endsWith(".webm")) mimeType = "video/webm";
      else if (fileName.endsWith(".mov")) mimeType = "video/quicktime";
      else if (fileName.endsWith(".csv")) mimeType = "text/csv";

      promptParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      });

      promptParts.push({
        text: `\n(The file attached above is titled "${file.name}"). Extract concepts directly from this uploaded file.`,
      });
    }

    promptParts.push({
      text: `\nGenerate now the array of ${count} questions in accordance with the specified difficulty: "${difficulty}".`,
    });

    // Generate content using Gemini 3
    let result;
    try {
      result = await model.generateContent(promptParts);
    } catch (err: any) {
      // If the preview model is temporarily rate limited or unavailable, fallback to gemini-2.5-flash
      console.warn(`Primary model ${modelName} failed, falling back to gemini-2.5-flash:`, err?.message);
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      result = await fallbackModel.generateContent(promptParts);
    }

    const response = await result.response;
    const rawResponseText = response.text();

    let parsedData: { questions?: RawGeneratedQuestion[] } = {};
    try {
      parsedData = JSON.parse(rawResponseText);
    } catch (parseError) {
      // Fallback regex cleaning if needed
      const cleaned = rawResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(cleaned);
    }

    const rawQuestions = parsedData.questions || (Array.isArray(parsedData) ? parsedData : []);

    // Format and sanitize output to match CBT Studio standards
    const formattedQuestions = rawQuestions.map((q: any, idx: number) => {
      const qType = q.type === "TRUE_FALSE" ? "TRUE_FALSE" : "MCQ";
      const options = Array.isArray(q.options)
        ? q.options.map((opt: any, oIdx: number) => ({
            id: `opt_${Date.now()}_${idx}_${oIdx}`,
            text: typeof opt === "string" ? opt : opt.text || `Option ${String.fromCharCode(65 + oIdx)}`,
            isCorrect: typeof opt === "object" ? !!opt.isCorrect : oIdx === 0,
          }))
        : [
            { id: `opt_${Date.now()}_${idx}_0`, text: "Option A", isCorrect: true },
            { id: `opt_${Date.now()}_${idx}_1`, text: "Option B", isCorrect: false },
            { id: `opt_${Date.now()}_${idx}_2`, text: "Option C", isCorrect: false },
            { id: `opt_${Date.now()}_${idx}_3`, text: "Option D", isCorrect: false },
          ];

      // Ensure at least one option is marked correct
      if (!options.some((o) => o.isCorrect)) {
        options[0].isCorrect = true;
      }

      return {
        id: `pln_ai_q_${Date.now()}_${idx}`,
        prompt: q.prompt || q.question || `Question ${idx + 1}`,
        type: qType,
        marks: q.marks || 1.0,
        difficulty: q.difficulty || difficulty,
        citation: q.citation || "",
        explanation: q.explanation || "",
        options,
      };
    });

    return NextResponse.json({
      success: true,
      engine: "ParaLearn AI Engine",
      modelUsed: modelName,
      difficulty,
      totalGenerated: formattedQuestions.length,
      questions: formattedQuestions,
    });
  } catch (error: any) {
    console.error("ParaLearn AI CBT Question Generation Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to generate questions using ParaLearn AI Engine.",
      },
      { status: 500 }
    );
  }
}
