import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPrincipal } from "@/lib/cbtAuth";

export const maxDuration = 45;

interface RubricCriterionPayload {
  id: string;
  title: string;
  maxMarks: number;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    // Examiners and API keys only: every call spends the AI quota
    if (!(await getPrincipal(req))) {
      return NextResponse.json({ error: "Please sign in to your CBT workspace." }, { status: 401 });
    }
    const rawApiKey =
      process.env.CBT_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/^["']|["']$/g, "") : "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "ParaLearn AI isn't set up on this server yet (GEMINI_API_KEY is missing)." },
        { status: 503 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Send the essay details as JSON." }, { status: 400 });
    }
    const { questionPrompt, studentResponse, modelAnswer, rubricCriteria } = body || {};
    const maxMarks = Number(body?.maxMarks) > 0 ? Number(body.maxMarks) : 10;
    const keyTerms: string[] = (Array.isArray(body?.keyTerms) ? body.keyTerms : String(body?.keyTerms || "").split(","))
      .map((t: unknown) => String(t).trim())
      .filter(Boolean);

    if (!questionPrompt || !studentResponse) {
      return NextResponse.json(
        { error: "questionPrompt and studentResponse are required." },
        { status: 400 }
      );
    }

    const modelName = process.env.CBT_GEMINI_MODEL || "gemini-3-flash-preview";
    const genAI = new GoogleGenerativeAI(apiKey);

    // Default criteria split the question's marks 50/30/20 (in half marks) and always add up to them
    const half = (x: number) => Math.round(x * 2) / 2;
    const content = half(maxMarks * 0.5);
    const clarity = Math.min(maxMarks - content, half(maxMarks * 0.3));
    const criteriaList: RubricCriterionPayload[] = (
      Array.isArray(rubricCriteria) && rubricCriteria.length > 0
        ? rubricCriteria
        : [
            { id: "c1", title: "Conceptual Understanding & Content Accuracy", maxMarks: content, description: "Accurate grasp of core concepts and factual details." },
            { id: "c2", title: "Clarity, Coherence & Structure", maxMarks: clarity, description: "Logical flow and articulation of ideas." },
            { id: "c3", title: "Key Terminology & Mechanics", maxMarks: maxMarks - content - clarity, description: "Proper usage of academic vocabulary and technical conventions." },
          ]
    ).filter((c: RubricCriterionPayload) => Number(c.maxMarks) > 0);

    const criteriaDescription = criteriaList
      .map(
        (c) => `- Criterion ID "${c.id}": "${c.title}" (Max Marks: ${c.maxMarks}). Guidance: ${c.description}`
      )
      .join("\n");

    const systemPrompt = `
You are an expert academic examiner and psychometric grader for the ParaLearn CBT Assessment Platform.
Your task is to evaluate a candidate's written essay answer objectively, fairly, and constructively based on the provided Question Prompt, Model Benchmark Answer, and Rubric Criteria.

Question Prompt:
"""
${String(questionPrompt).slice(0, 10000)}
"""

Grading Criteria to score:
${criteriaDescription}

${modelAnswer ? `Benchmark Model Answer:\n"${modelAnswer}"` : ""}
${keyTerms && keyTerms.length > 0 ? `Essential Key Terms / Concepts that should ideally be mentioned:\n${keyTerms.join(", ")}` : ""}

Candidate's Submitted Response:
"""
${studentResponse}
"""

Instructions:
1. Carefully compare the student's answer against the prompt and benchmark.
2. For each criterion in the list above, assign a fair numeric score between 0 and maxMarks. Do not award more than maxMarks.
3. Provide a brief, supportive feedback sentence explaining the rationale for the criterion score.
4. Provide an overall constructive commentary summarizing the candidate's strengths and clear recommendations for improvement.

Return the result STRICTLY as valid JSON matching this schema:
{
  "criteriaScores": [
    {
      "criterionId": "string",
      "score": number,
      "maxMarks": number,
      "feedback": "string"
    }
  ],
  "totalScore": number,
  "maxScore": number,
  "overallComment": "string",
  "strengths": ["string"],
  "areasForImprovement": ["string"]
}
`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for consistent, objective grading
      },
    });

    let result;
    try {
      result = await model.generateContent([{ text: systemPrompt }]);
    } catch (err: any) {
      console.warn(`Primary grading model failed (${err?.message}), using fallback gemini-3.8-flash...`);
      try {
        const fallback = genAI.getGenerativeModel({
          model: "gemini-3.8-flash",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        result = await fallback.generateContent([{ text: systemPrompt }]);
      } catch (fbErr: any) {
        console.warn(`Secondary grading model failed (${fbErr?.message}), using fallback gemini-flash-latest...`);
        const tertiary = genAI.getGenerativeModel({
          model: "gemini-flash-latest",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        result = await tertiary.generateContent([{ text: systemPrompt }]);
      }
    }

    const responseText = (await result.response).text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Never trust model arithmetic: keep each score within its criterion and recompute the total
    const limits = new Map(criteriaList.map((c) => [c.id, Number(c.maxMarks) || 0]));
    const criteriaScores = (Array.isArray(parsed?.criteriaScores) ? parsed.criteriaScores : []).map((c: any) => {
      const max = limits.get(c?.criterionId) ?? (Number(c?.maxMarks) || 0);
      const score = Math.min(max, Math.max(0, Number(c?.score) || 0));
      return { ...c, score, maxMarks: max };
    });
    parsed = {
      ...parsed,
      criteriaScores,
      totalScore: Math.min(
        maxMarks,
        criteriaScores.reduce((sum: number, c: any) => sum + c.score, 0)
      ),
      maxScore: maxMarks,
    };

    return NextResponse.json({
      success: true,
      engine: "ParaLearn AI Grading Engine",
      modelUsed: modelName,
      evaluation: parsed,
    });
  } catch (error: any) {
    console.error("ParaLearn AI Essay Grading Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to grade essay response with ParaLearn AI." },
      { status: 500 }
    );
  }
}
