import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 45;

interface RubricCriterionPayload {
  id: string;
  title: string;
  maxMarks: number;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CBT_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "CBT_GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const { 
      questionPrompt, 
      studentResponse, 
      modelAnswer, 
      keyTerms, 
      rubricCriteria, 
      maxMarks 
    } = await req.json();

    if (!questionPrompt || !studentResponse) {
      return NextResponse.json(
        { error: "questionPrompt and studentResponse are required." },
        { status: 400 }
      );
    }

    const modelName = process.env.CBT_GEMINI_MODEL || "gemini-3-flash-preview";
    const genAI = new GoogleGenerativeAI(apiKey);

    const criteriaList: RubricCriterionPayload[] = Array.isArray(rubricCriteria) && rubricCriteria.length > 0
      ? rubricCriteria
      : [
          { id: "c1", title: "Conceptual Understanding & Content Accuracy", maxMarks: Math.ceil((maxMarks || 10) * 0.5), description: "Accurate grasp of core concepts and factual details." },
          { id: "c2", title: "Clarity, Coherence & Structure", maxMarks: Math.floor((maxMarks || 10) * 0.3), description: "Logical flow and articulation of ideas." },
          { id: "c3", title: "Key Terminology & Mechanics", maxMarks: Math.max(1, (maxMarks || 10) - Math.ceil((maxMarks || 10) * 0.5) - Math.floor((maxMarks || 10) * 0.3)), description: "Proper usage of academic vocabulary and technical conventions." }
        ];

    const criteriaDescription = criteriaList
      .map(
        (c) => `- Criterion ID "${c.id}": "${c.title}" (Max Marks: ${c.maxMarks}). Guidance: ${c.description}`
      )
      .join("\n");

    const systemPrompt = `
You are an expert academic examiner and psychometric grader for the ParaLearn CBT Assessment Platform.
Your task is to evaluate a candidate's written essay answer objectively, fairly, and constructively based on the provided Question Prompt, Model Benchmark Answer, and Rubric Criteria.

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
      console.warn("Primary grading model failed, using fallback gemini-2.5-flash:", err?.message);
      const fallback = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      result = await fallback.generateContent([{ text: systemPrompt }]);
    }

    const responseText = (await result.response).text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

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
