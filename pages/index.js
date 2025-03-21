import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, BookOpen, Download } from "lucide-react";
import Head from "next/head";
import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation

export async function getServerSideProps() {
  try {
    const res = await fetch("https://raw.githubusercontent.com/Libraula/goodstories/main/data/top.json", {
      headers: {
        "User-Agent": "GoodStories/0.1 (by /u/yourusername)", // Optional, good practice
      },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    const initialPrompts = data.data.children.map((child) => ({
      id: child.data.id,
      title: child.data.title,
    }));
    return {
      props: {
        initialPrompts,
      },
    };
  } catch (error) {
    console.error("Error in getServerSideProps:", error);
    return {
      props: {
        initialPrompts: [],
      },
    };
  }
}

export default function Home({ initialPrompts }) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [storyPages, setStoryPages] = useState([]);
  const [pageImages, setPageImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [currentPromptPage, setCurrentPromptPage] = useState(0);

  const PROMPTS_PER_PAGE = 12;
  const totalPromptPages = Math.ceil(prompts.length / PROMPTS_PER_PAGE);
  const displayedPrompts = prompts.slice(
    currentPromptPage * PROMPTS_PER_PAGE,
    (currentPromptPage + 1) * PROMPTS_PER_PAGE
  );

  const nextPromptPage = () => {
    if (currentPromptPage < totalPromptPages - 1) {
      setCurrentPromptPage((prev) => prev + 1);
    }
  };

  const prevPromptPage = () => {
    if (currentPromptPage > 0) {
      setCurrentPromptPage((prev) => prev - 1);
    }
  };

  const handlePromptSelect = async (prompt) => {
    setSelectedPrompt(prompt);
    setIsLoadingStory(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.title,
        }),
      });

      const data = await response.json();

      if (data.success && data.storyPages) {
        setStoryPages(data.storyPages);
        setPageImages(Array(data.storyPages.length).fill(null));
        setCurrentPage(0);
      } else {
        console.error("Failed to generate story:", data.error);
        alert("Failed to generate story. Please try again.");
      }
    } catch (error) {
      console.error("Error generating story:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsLoadingStory(false);
    }
  };

  const fetchImageForPage = async (pageIndex) => {
    if (pageImages[pageIndex] || isLoadingImage) return;

    setIsLoadingImage(true);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageText: storyPages[pageIndex],
        }),
      });

      const data = await response.json();
      if (data.success && data.imageData) {
        setPageImages((prev) => {
          const newImages = [...prev];
          newImages[pageIndex] = data.imageData;
          return newImages;
        });
      } else {
        console.error("Failed to generate image:", data.error);
      }
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsLoadingImage(false);
    }
  };

  useEffect(() => {
    if (storyPages.length > 0 && currentPage >= 0) {
      fetchImageForPage(currentPage);
    }
  }, [currentPage, storyPages]);

  const refreshPrompts = async () => {
    setIsLoadingStory(true);
    try {
      const response = await fetch("https://raw.githubusercontent.com/Libraula/goodstories/main/data/top.json", {
        headers: {
          "User-Agent": "GoodStories/0.1 (by /u/yourusername)",
        },
      });
      const data = await response.json();
      const newPrompts = data.data.children.map((child) => ({
        id: child.data.id,
        title: child.data.title,
      }));
      setPrompts(newPrompts);
      setCurrentPromptPage(0);
    } catch (error) {
      console.error("Error refreshing prompts:", error);
    } finally {
      setIsLoadingStory(false);
    }
  };

  const goToNextPage = () => {
    if (currentPage < storyPages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const backToPrompts = () => {
    setSelectedPrompt(null);
    setStoryPages([]);
    setPageImages([]);
    setCurrentPage(0);
  };

  const downloadStoryAsPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yOffset = margin;

    // Add title
    doc.setFontSize(18);
    doc.text(selectedPrompt.title, margin, yOffset, { maxWidth });
    yOffset += 20;

    // Add each page
    for (let i = 0; i < storyPages.length; i++) {
      if (yOffset > pageHeight - margin) {
        doc.addPage();
        yOffset = margin;
      }

      // Page header
      doc.setFontSize(12);
      doc.text(`Page ${i + 1}`, margin, yOffset);
      yOffset += 10;

      // Add image if available
      if (pageImages[i]) {
        try {
          const img = new Image();
          img.src = pageImages[i];
          await new Promise((resolve) => {
            img.onload = resolve;
          });
          const imgProps = doc.getImageProperties(img);
          const imgWidth = maxWidth;
          const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
          if (yOffset + imgHeight > pageHeight - margin) {
            doc.addPage();
            yOffset = margin;
          }
          doc.addImage(img, "PNG", margin, yOffset, imgWidth, imgHeight);
          yOffset += imgHeight + 10;
        } catch (error) {
          console.error("Error adding image to PDF:", error);
        }
      }

      // Add text
      doc.setFontSize(10);
      const textLines = doc.splitTextToSize(storyPages[i], maxWidth);
      if (yOffset + textLines.length * 12 > pageHeight - margin) {
        doc.addPage();
        yOffset = margin;
      }
      doc.text(textLines, margin, yOffset);
      yOffset += textLines.length * 12 + 10;
    }

    // Save the PDF
    doc.save(`${selectedPrompt.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
  };

  return (
    <>
      <Head>
        <title>Good Stories</title>
        <meta name="description" content="Generate stories from Reddit writing prompts" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 font-sans">
        <header className="bg-white shadow-sm py-4 sticky top-0 z-10 backdrop-blur-md bg-white/90">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
              Good Stories
            </h1>
            {!selectedPrompt && (
              <button
                onClick={refreshPrompts}
                disabled={isLoadingStory}
                className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-all disabled:bg-indigo-400 text-sm shadow-md disabled:shadow-none"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoadingStory ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
            {selectedPrompt && (
              <button
                onClick={backToPrompts}
                className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                All Prompts
              </button>
            )}
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {!selectedPrompt ? (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Writing Prompts</h2>
                <p className="text-gray-500 text-sm">Select a prompt to generate a story</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
                {displayedPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handlePromptSelect(prompt)}
                    className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 text-left h-full flex flex-col group transform hover:-translate-y-1"
                  >
                    <div className="w-full h-40 bg-gradient-to-br from-indigo-400 via-purple-500 to-indigo-600 rounded-lg mb-4 flex items-center justify-center text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-all duration-300"></div>
                      <BookOpen className="w-12 h-12 opacity-70 group-hover:opacity-100 transition-all duration-300" />
                    </div>
                    <h3 className="font-medium line-clamp-3 flex-grow text-gray-800 group-hover:text-indigo-700 transition-colors">
                      {prompt.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-3 font-medium">Reddit r/WritingPrompts</p>
                  </button>
                ))}
              </div>

              {prompts.length > PROMPTS_PER_PAGE && (
                <div className="flex justify-center items-center gap-4 mt-6 mb-12">
                  <button
                    onClick={prevPromptPage}
                    disabled={currentPromptPage === 0}
                    className="p-2 bg-white rounded-full shadow-sm disabled:opacity-50 hover:bg-gray-50 transition-colors border border-gray-100 disabled:border-gray-50"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    Page {currentPromptPage + 1} of {totalPromptPages}
                  </span>
                  <button
                    onClick={nextPromptPage}
                    disabled={currentPromptPage >= totalPromptPages - 1}
                    className="p-2 bg-white rounded-full shadow-sm disabled:opacity-50 hover:bg-gray-50 transition-colors border border-gray-100 disabled:border-gray-50"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="max-w-5xl mx-auto">
              {isLoadingStory ? (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl shadow-sm">
                  <div className="w-16 h-16 border-4 border-t-indigo-500 border-indigo-100 rounded-full animate-spin mb-6"></div>
                  <p className="text-gray-600 font-medium">Crafting your story...</p>
                  <p className="text-gray-400 text-sm mt-2">This may take a moment</p>
                </div>
              ) : storyPages.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                  <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 leading-tight">{selectedPrompt.title}</h2>
                    <button
                      onClick={downloadStoryAsPDF}
                      className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-all text-sm shadow-md"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download PDF
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row">
                    {/* Image column */}
                    <div className="w-full md:w-1/2 md:border-r border-gray-100">
                      <div className="relative aspect-square md:aspect-auto md:h-full bg-gray-50 flex items-center justify-center overflow-hidden">
                        {pageImages[currentPage] ? (
                          <img
                            src={pageImages[currentPage]}
                            alt={`Illustration for page ${currentPage + 1}`}
                            className="w-full h-full object-contain"
                          />
                        ) : isLoadingImage ? (
                          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center text-gray-400 p-8">
                            <div className="w-10 h-10 border-3 border-t-indigo-400 border-indigo-100 rounded-full animate-spin mb-4"></div>
                            <p className="text-center text-gray-500 font-medium">Creating illustration...</p>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-gray-400 p-8">
                            <p className="text-center font-medium text-gray-400">Illustration will appear here</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Text column */}
                    <div className="w-full md:w-1/2 flex flex-col">
                      <div className="px-6 py-4 text-right text-xs text-gray-400 font-medium border-b border-gray-100">
                        Page {currentPage + 1} of {storyPages.length}
                      </div>
                      <div className="p-6 flex-grow overflow-y-auto max-h-96 md:max-h-[70vh]">
                        <div className="prose prose-sm sm:prose md:prose-lg max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {storyPages[currentPage]}
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={goToPreviousPage}
                          disabled={currentPage === 0}
                          className="px-4 py-2 flex items-center disabled:opacity-40 bg-white rounded-full hover:bg-gray-50 disabled:hover:bg-white transition-colors border border-gray-200 text-gray-700 text-sm font-medium shadow-sm disabled:shadow-none"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </button>

                        <div className="hidden sm:flex items-center space-x-2">
                          {storyPages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentPage(idx)}
                              className={`w-2.5 h-2.5 rounded-full ${
                                currentPage === idx
                                  ? "bg-indigo-500"
                                  : "bg-gray-300 hover:bg-gray-400"
                              } transition-colors`}
                              aria-label={`Go to page ${idx + 1}`}
                            />
                          ))}
                        </div>

                        <button
                          onClick={goToNextPage}
                          disabled={currentPage === storyPages.length - 1}
                          className="px-4 py-2 flex items-center disabled:opacity-40 bg-white rounded-full hover:bg-gray-50 disabled:hover:bg-white transition-colors border border-gray-200 text-gray-700 text-sm font-medium shadow-sm disabled:shadow-none"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
                  <p className="text-gray-600">No story generated yet. Please try another prompt.</p>
                  <button
                    onClick={backToPrompts}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Browse Prompts
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}