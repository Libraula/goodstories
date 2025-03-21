import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pageText } = req.body;
  console.log("Image API Request:", { pageText: pageText.substring(0, 50) + "..." });

  if (!pageText) {
    return res.status(400).json({ error: "Page text is required" });
  }

  const genAI = new GoogleGenerativeAI("AIzaSyAVub03nGqao06vXO_bCAlBVrU1Sc-Y91U");

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp-image-generation",
    generationConfig: {
      responseModalities: ["Text", "Image"],
    },
  });

  try {
    const generationContent = `Create a clear and beautiful black-and-white illustration that directly depicts the following story scene: "${pageText}". Use detailed, expressive line art in a consistent drawing style similar to manga, but without speech bubbles or text elements. Capture the key characters, actions, and setting described in this specific page, ensuring the image is contextually tied to the narrative and visually striking, suitable for a storybook.`;
    console.log("Using text-only prompt for image generation");

    console.log("Calling Gemini API for image...");
    const response = await model.generateContent(generationContent);
    console.log("Image API response received");

    const result = {
      success: true,
      imageData: null,
    };

    for (const part of response.response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        console.log("Received image data, length:", imageData.length);
        result.imageData = `data:image/png;base64,${imageData}`;
      }
      // Ignore text parts, as we only want the image
    }

    if (!result.imageData) {
      throw new Error("No image generated");
    }

    console.log("Sending successful image response");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error generating image:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image",
    });
  }
}