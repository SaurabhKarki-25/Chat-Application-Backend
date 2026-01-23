import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function getAIResponse(messages) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant", // ✅ CURRENT FAST MODEL
    messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0].message.content;
}
