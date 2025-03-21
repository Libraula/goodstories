import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;
  console.log("API Request:", { prompt });

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const genAI = new GoogleGenerativeAI("AIzaSyAVub03nGqao06vXO_bCAlBVrU1Sc-Y91U");

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Real model for text; images handled separately
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8000,
    },
  });

  try {
    console.log("Generating story text...");
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "I want you to create a short story based on a writing prompt." }] },
        { role: "model", parts: [{ text: "I'd be happy to create a short story based on your writing prompt. Please share the prompt with me, and I'll craft a story from it." }] },
      ],
    });

    const storyResult = await chat.sendMessage(
      `Based on the following writing prompt, create a short story with exactly 5 distinct sections/pages. Each page should advance the narrative and have a clear scene that could be illustrated. The complete story should have a beginning, middle, and end.
      
      Separate each page with the marker [PAGE_BREAK] so I can split them for display.
      
      Writing Prompt: ${prompt}
      
      Make each page approximately 200-250 words. Create a compelling narrative arc across all pages.`
    );

    const fullStory = storyResult.response.text();
    const storyPages = fullStory.split("[PAGE_BREAK]").map((page) => page.trim());
    const finalPages = storyPages.slice(0, 5);
    while (finalPages.length < 5) {
      finalPages.push("(This page is blank. The story concludes here.)");
    }

    console.log("Sending response with", finalPages.length, "pages");
    return res.status(200).json({
      success: true,
      storyPages: finalPages,
    });
  } catch (error) {
    console.error("Error generating story:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate story",
    });
  }
}