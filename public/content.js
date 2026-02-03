// content.js
console.log("ScamGuard Content Script Active"); // Debugging: Check if this appears in the Web Console

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getPageText") {
    try {
      // Improved selector: Try to get main content first, fallback to body
      const mainContent = document.querySelector("main") || document.body;
      const pageText = mainContent.innerText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000); // 2026 era LLMs can handle 10k easily

      sendResponse({ text: pageText, success: true });
    } catch (error) {
      console.error("ScamGuard Content Error:", error);
      sendResponse({ text: "Error extracting page text.", success: false });
    }
  }
  return true;
});
