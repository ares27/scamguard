// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageText") {
    try {
      // 2026 Best Practice: Clean text to save on LLM tokens
      const pageText = document.body.innerText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000); // Send a healthy chunk for analysis

      sendResponse({ text: pageText, success: true });
    } catch (error) {
      console.error("Content Script Error:", error);
      sendResponse({ text: "", success: false, error: error.message });
    }
  }
  return true; // CRITICAL: Keeps the message channel open for sendResponse
});
