import fs from "fs/promises";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { page: pageParam, refresh } = req.query;
  const page = parseInt(pageParam) || 0;
  const shouldRefresh = refresh === "true";

  try {
    // Define the path to the downloaded top.json file
    const filePath = path.join(process.cwd(), "data", "top.json");
    console.log("Attempting to read file from:", filePath);

    // Read the JSON file
    const fileContents = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(fileContents);

    // Validate the JSON structure
    if (!data?.kind || data.kind !== "Listing" || !data?.data?.children) {
      throw new Error("Invalid JSON structure in top.json. Expected a Reddit Listing format.");
    }

    // Extract and filter prompts
    let prompts = data.data.children
      .filter((post) => post.kind === "t3" && post.data.title.startsWith("[WP]")) // Only [WP] posts
      .map((post) => ({
        id: post.data.id,
        title: post.data.title.replace("[WP]", "").trim(),
        score: post.data.score,
        url: post.data.url,
      }));

    const promptsPerPage = 24;

    if (shouldRefresh) {
      // Shuffle prompts for "refresh" effect
      prompts = [...prompts].sort(() => Math.random() - 0.5);
    } else if (page > 0) {
      // Paginate by slicing the array
      const start = page * promptsPerPage;
      prompts = prompts.slice(start, start + promptsPerPage);
    }

    // Limit to promptsPerPage
    prompts = prompts.slice(0, promptsPerPage);

    console.log(`Returning ${prompts.length} prompts for page ${page}, refresh=${shouldRefresh}`);
    return res.status(200).json({
      success: true,
      prompts,
    });
  } catch (error) {
    console.error("Error loading Reddit prompts:", {
      message: error.message,
      stack: error.stack,
      query: req.query,
    });
    return res.status(500).json({
      success: false,
      error: "Failed to load Reddit prompts",
      details: error.message,
    });
  }
}