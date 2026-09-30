import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Allow sufficient time for multimodal AI processing

interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

interface RawRubricLevel {
  label: string;
  points: number;
  descriptor: string;
}

interface RawRubricCriterion {
  id?: string;
  title: string;
  maxMarks: number;
  description: string;
  levels?: RawRubricLevel[];
}

interface RawGeneratedQuestion {
  prompt: string;
  type?: "MCQ" | "TRUE_FALSE" | "SHORT_ESSAY" | "LONG_ESSAY";
  difficulty?: "simple" | "intermediate" | "hard";
  section?: string;
  citation?: string;
  explanation?: string;
  marks?: number;
  options?: QuestionOption[];
  minWords?: number;
  maxWords?: number;
  modelAnswer?: string;
  keyTerms?: string[];
  rubric?: {
    name?: string;
    totalMarks?: number;
    criteria?: RawRubricCriterion[];
  };
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
    const formatMode = (formData.get("formatMode") as string) || "hybrid"; // pure_mcq | hybrid | pure_essay
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

    // Build Assessment Format Instruction
    let formatInstruction = "";
    if (formatMode === "pure_mcq") {
      formatInstruction = `
Format Requirement: Pure Multiple Choice Assessment
- 100% of questions must be type "MCQ" (or occasionally "TRUE_FALSE" where conceptually elegant).
- Every MCQ must have exactly 4 choices with exactly one choice marked isCorrect: true.
- Default marks: 1.0 to 2.0.`;
    } else if (formatMode === "pure_essay") {
      formatInstruction = `
Format Requirement: Pure Theory, Short & Long Essay Assessment
- Generate a combination of:
  1. "SHORT_ESSAY" (definitions, concise explanations, proofs, 20–100 words, 5 marks each).
  2. "LONG_ESSAY" (comprehensive thesis, multi-perspective synthesis, case analysis, 150–800 words, 15 marks each).
- For EVERY SHORT_ESSAY, provide 'modelAnswer' (standard benchmark solution) and 'keyTerms' (essential keywords array).
- For EVERY LONG_ESSAY, provide 'modelAnswer' (comprehensive essay outline) AND an automated 'rubric' object containing 3 to 4 weighted criteria with titles, maxMarks, descriptions, and performance levels.`;
    } else {
      // Default: Hybrid Mix
      formatInstruction = `
Format Requirement: Hybrid Assessment (Creative Mix of MCQs, Short Essays, and Long Essays)
Out of the total ${count} questions:
1. Approximately 60-70% MUST be "MCQ" (Multiple choice with 4 options, 1 correct, 1-2 marks each).
2. Approximately 20% MUST be "SHORT_ESSAY" (Concise conceptual/analytical questions, 20–100 words, 5 marks each). Must include 'modelAnswer', 'keyTerms', 'minWords' (20), 'maxWords' (100).
3. Approximately 10-20% MUST be "LONG_ESSAY" (Deep synthesis, case study, or composition, 150–800 words, 15 marks each). Must include 'modelAnswer', 'minWords' (150), 'maxWords' (800), and an automated 'rubric' object with 3-4 scoring criteria.
Organize questions into appropriate sections (e.g. "Section A: Multiple Choice", "Section B: Short Answers", "Section C: Extended Essay").`;
    }

    const systemPrompt = `
You are an expert psychometrician and academic exam author for the ParaLearn CBT Computer-Based Testing platform.
Your task is to analyze the provided source material (lecture notes, document, presentation slides, or audio/video recording) and author ${count} high-quality, rigorous examination questions for the subject: "${subject}".

${difficultyInstruction}
${formatInstruction}

General Rules:
1. Grounding: Every question must be strictly derived from the provided content. Do not invent unrelated trivia.
2. Option Quality for MCQs: Exactly one option is marked as correct (isCorrect: true). The other options must have isCorrect: false. Never use lazy options like "All of the above" or "None of the above".
3. Citations: Provide a concise 'citation' string identifying where in the material the answer is found (e.g., "Page 3", "Slide 12", "Section 2.1", or "Audio/Video ~03:45").
4. Explanation: Provide a clear, educational explanation explaining why the correct answer is right and why key distractors are incorrect.
5. Language: Maintain standard academic English and clear pedagogical phrasing.

Return the result STRICTLY as a valid JSON object matching this schema:
{
  "questions": [
    {
      "prompt": "string (the question statement)",
      "type": "MCQ" | "SHORT_ESSAY" | "LONG_ESSAY" | "TRUE_FALSE",
      "section": "string (e.g. 'Section A: Multiple Choice' or 'Section B: Theory')",
      "difficulty": "simple" | "intermediate" | "hard",
      "citation": "string (e.g. 'Slide 4' or '05:20')",
      "explanation": "string (brief justification)",
      "marks": number,
      "options": [ // Required ONLY for MCQ / TRUE_FALSE
        { "text": "Option A text", "isCorrect": true },
        { "text": "Option B text", "isCorrect": false }
      ],
      "minWords": number, // For SHORT_ESSAY (e.g. 20) or LONG_ESSAY (e.g. 150)
      "maxWords": number, // For SHORT_ESSAY (e.g. 100) or LONG_ESSAY (e.g. 800)
      "modelAnswer": "string (benchmark answer for examiners and AI evaluation)",
      "keyTerms": ["keyword1", "keyword2"], // For SHORT_ESSAY
      "rubric": { // For LONG_ESSAY
        "name": "string (e.g. 'Institutional Essay Scoring Scheme')",
        "totalMarks": number,
        "criteria": [
          {
            "id": "crit_1",
            "title": "Content & Knowledge Depth",
            "maxMarks": 5,
            "description": "Factual accuracy, thesis mastery, and depth of explanation",
            "levels": [
              { "label": "Excellent", "points": 5, "descriptor": "Comprehensive, flawless understanding" },
              { "label": "Satisfactory", "points": 3, "descriptor": "Adequate grasp with minor omissions" }
            ]
          }
        ]
      }
    }
  ]
}
`;

    // Initialize Gemini model with structured JSON configuration
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2, // Low temperature for high factual accuracy
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
      text: `\nGenerate now the array of ${count} questions in accordance with difficulty: "${difficulty}" and format mode: "${formatMode}".`,
    });

    // Generate content using Gemini 3
    let result;
    try {
      result = await model.generateContent(promptParts);
    } catch (err: any) {
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
      const cleaned = rawResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(cleaned);
    }

    const rawQuestions = parsedData.questions || (Array.isArray(parsedData) ? parsedData : []);

    // Format and sanitize output to match CBT Studio standards
    const formattedQuestions = rawQuestions.map((q: any, idx: number) => {
      const rawType = (q.type || "").toUpperCase();
      let qType: "MCQ" | "SHORT_ESSAY" | "LONG_ESSAY" | "TRUE_FALSE" = "MCQ";

      if (rawType.includes("SHORT")) qType = "SHORT_ESSAY";
      else if (rawType.includes("LONG") || rawType === "ESSAY") qType = "LONG_ESSAY";
      else if (rawType.includes("TRUE") || rawType.includes("FALSE")) qType = "TRUE_FALSE";
      else qType = "MCQ";

      const defaultMarks = qType === "LONG_ESSAY" ? 15.0 : qType === "SHORT_ESSAY" ? 5.0 : 1.0;

      let options = undefined;
      if (qType === "MCQ" || qType === "TRUE_FALSE") {
        options = Array.isArray(q.options)
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

        if (!options.some((o) => o.isCorrect)) {
          options[0].isCorrect = true;
        }
      }

      // Rubric normalization if present
      let formattedRubric = undefined;
      if (q.rubric && Array.isArray(q.rubric.criteria)) {
        const critList = q.rubric.criteria.map((c: any, cIdx: number) => ({
          id: c.id || `crit_${Date.now()}_${idx}_${cIdx}`,
          title: c.title || `Criterion ${cIdx + 1}`,
          maxMarks: typeof c.maxMarks === "number" ? c.maxMarks : 5,
          description: c.description || "",
          levels: c.levels || [],
        }));
        const totalRMarks = critList.reduce((sum: number, c: any) => sum + c.maxMarks, 0);

        formattedRubric = {
          id: `rub_${Date.now()}_${idx}`,
          name: q.rubric.name || "Auto-Generated ParaLearn Rubric",
          source: "AUTO_GENERATED",
          criteria: critList,
          totalMarks: totalRMarks > 0 ? totalRMarks : (q.marks || defaultMarks),
        };
      }

      return {
        id: `pln_ai_q_${Date.now()}_${idx}`,
        prompt: q.prompt || q.question || `Question ${idx + 1}`,
        type: qType,
        section: q.section || (qType === "LONG_ESSAY" ? "Section C: Long Essay" : qType === "SHORT_ESSAY" ? "Section B: Short Answers" : "Section A: Multiple Choice"),
        marks: q.marks || (formattedRubric ? formattedRubric.totalMarks : defaultMarks),
        difficulty: q.difficulty || difficulty,
        citation: q.citation || "",
        explanation: q.explanation || "",
        options,
        minWords: q.minWords || (qType === "LONG_ESSAY" ? 150 : qType === "SHORT_ESSAY" ? 20 : undefined),
        maxWords: q.maxWords || (qType === "LONG_ESSAY" ? 800 : qType === "SHORT_ESSAY" ? 100 : undefined),
        modelAnswer: q.modelAnswer || "",
        keyTerms: Array.isArray(q.keyTerms) ? q.keyTerms : [],
        rubric: formattedRubric,
      };
    });

    return NextResponse.json({
      success: true,
      engine: "ParaLearn AI Engine",
      modelUsed: modelName,
      difficulty,
      formatMode,
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
