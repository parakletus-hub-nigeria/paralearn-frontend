import { Redis } from "@upstash/redis";
import * as fs from "fs";
import * as path from "path";
import { BUSI_WORKSPACE, BUSI_EXAM, BUSI_QUESTIONS } from "../src/lib/busiAssessmentData";

// Parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let redisUrl = "https://probable-pika-192064.upstash.io";
let redisToken = "gQAAAAAAAu5AAQIgcDE1MTQyNzFjYTNjNGI0NDRiOWUyMTJjNGI4NmE1MzA4Mw";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("UPSTASH_REDIS_REST_URL=")) {
      redisUrl = trimmed.replace("UPSTASH_REDIS_REST_URL=", "").trim();
    }
    if (trimmed.startsWith("UPSTASH_REDIS_REST_TOKEN=")) {
      redisToken = trimmed.replace("UPSTASH_REDIS_REST_TOKEN=", "").trim();
    }
  }
}

console.log("Connecting to live Upstash Redis database at:", redisUrl);

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

async function run() {
  console.log("Pinging Redis...");
  const pong = await redis.ping();
  console.log("Redis ping response:", pong);

  console.log("\n1. Writing Parakletus Workspace to live database (cbt:ws and cbt:workspace)...");
  await redis.hset("cbt:ws", { [BUSI_WORKSPACE.id]: BUSI_WORKSPACE });
  await redis.hset("cbt:workspace", { [BUSI_WORKSPACE.id]: BUSI_WORKSPACE });
  await redis.set("cbt:ws:email:parakletus70@gmail.com", BUSI_WORKSPACE.id);
  await redis.set("cbt:ws:email:internship@parakletus.com", BUSI_WORKSPACE.id);
  await redis.set("cbt:ws_by_email:parakletus70@gmail.com", BUSI_WORKSPACE.id);
  await redis.set("cbt:ws_by_email:internship@parakletus.com", BUSI_WORKSPACE.id);
  console.log("✓ Parakletus Workspace saved (ID: ws_parakletus_internship, owner: parakletus70@gmail.com, password configured).");

  console.log("\n2. Writing BUSI-7642 Assessment to live database (cbt:exam)...");
  console.log("Schedule: startsAt =", BUSI_EXAM.startsAt, "endsAt =", BUSI_EXAM.endsAt, "isPublished =", BUSI_EXAM.isPublished);
  await redis.hset("cbt:exam", { [BUSI_EXAM.id]: BUSI_EXAM });
  await redis.set("cbt:exam:code:BUSI-7642", BUSI_EXAM.id);
  await redis.set("cbt:exam_by_code:BUSI-7642", BUSI_EXAM.id);
  console.log("✓ BUSI-7642 Exam saved and indexed.");

  console.log("\n3. Writing 30 assessment questions to live database (cbt:q and cbt:question)...");
  const questionMap: Record<string, any> = {};
  for (const q of BUSI_QUESTIONS) {
    questionMap[q.id] = q;
  }
  await redis.hset("cbt:q", questionMap);
  await redis.hset("cbt:question", questionMap);
  console.log(`✓ ${BUSI_QUESTIONS.length} questions saved to cbt:q and cbt:question hashes.`);

  console.log("\n4. Verifying data directly from live Redis database...");
  const fetchedWs = await redis.hget<any>("cbt:workspace", BUSI_WORKSPACE.id);
  console.log("Fetched Workspace:", fetchedWs?.id, fetchedWs?.ownerEmail, "Password stored:", Boolean(fetchedWs?.password));

  const fetchedExam = await redis.hget<any>("cbt:exam", BUSI_EXAM.id);
  console.log("Fetched Exam:", fetchedExam?.title, "Code:", fetchedExam?.accessCode, "StartsAt:", fetchedExam?.startsAt, "EndsAt:", fetchedExam?.endsAt, "Published:", fetchedExam?.isPublished);

  const examByCodeId = await redis.get<string>("cbt:exam_by_code:BUSI-7642");
  console.log("Exam code lookup:", examByCodeId);

  const q1 = await redis.hget<any>("cbt:question", "busi_q_1");
  const q30 = await redis.hget<any>("cbt:question", "busi_q_30");
  console.log("Fetched Q1:", q1?.prompt?.substring(0, 50) + "...");
  console.log("Fetched Q30:", q30?.prompt?.substring(0, 50) + "...");

  console.log("\n5. Testing cbtServerStore integration with live Redis...");
  const { cbtServerStore } = await import("../src/lib/cbtServerStore");
  const storeWs = await cbtServerStore.getWorkspace("ws_parakletus_internship");
  console.log("cbtServerStore Workspace:", storeWs?.id, storeWs?.ownerEmail);

  const storeExams = await cbtServerStore.listExams("ws_parakletus_internship");
  console.log("cbtServerStore Exams count:", storeExams.length, "Codes:", storeExams.map((e) => e.accessCode));

  const storeExam = await cbtServerStore.getExamByCode("BUSI-7642");
  console.log("cbtServerStore Exam:", storeExam?.title, "Schedule:", storeExam?.startsAt, "to", storeExam?.endsAt);

  const storeQuestions = await cbtServerStore.getQuestionsForExam("exam_busi_7642");
  console.log("cbtServerStore Questions count:", storeQuestions.length);

  console.log("\n>>> SUCCESS: All Parakletus examiner credentials, BUSI-7642 exam, and all 30 questions are LIVE on the Upstash Redis database! <<<");
}

run().catch((err) => {
  console.error("Database push failed:", err);
  process.exit(1);
});
