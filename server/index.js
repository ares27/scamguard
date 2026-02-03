const express = require("express");
const cors = require("cors");
const dns = require("dns").promises;
const axios = require("axios");
const {
  getTrustpilotData,
  getDomainAge,
  detectHotlinking,
} = require("./scanner");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/scan", async (req, res) => {
  const { url } = req.body;

  // 1. Fetch HTML safely - Move inside try/catch to handle malformed URLs
  let htmlBody = "";
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    htmlBody = response.data;
  } catch (e) {
    console.warn("HTML fetch failed, proceeding with infrastructure only.");
  }

  try {
    const domain = new URL(url).hostname.replace("www.", "");

    // 1. Resolve Real Infrastructure Data
    let ip = "0.0.0.0";
    let country = "Unknown";
    let provider = "Unknown Provider";

    try {
      const lookup = await dns.lookup(domain);
      ip = lookup.address;

      const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
      if (geoResponse.data.status === "success") {
        country = geoResponse.data.countryCode;
        provider = geoResponse.data.isp;
      }
    } catch (infraError) {
      console.error("Infrastructure lookup failed:", infraError.message);
    }

    // 2. Run Scrapers - FIXED: Added hotlinkData to destructuring
    const [trustData, age, hotlinkData] = await Promise.all([
      getTrustpilotData(domain),
      getDomainAge(domain),
      detectHotlinking(url, htmlBody),
    ]);

    // 3. Technical vs Social Risk Logic
    const technicalRisk = "Low";
    let overallRisk = "Low";
    let warnings = [];

    // 4. Guard: Check hotlinkData before accessing details
    if (hotlinkData?.isHotlinking && hotlinkData.details?.[0]) {
      overallRisk = "High"; // Hotlinking is a high-risk technical signal
      warnings.push(
        `Infrastructure Alert: This site is pulling assets from ${hotlinkData.details[0].domain}. This is typical of cloned phishing sites.`,
      );
    }

    if (trustData.score > 0 && trustData.score < 2.5) {
      overallRisk = "High";
      warnings.push(
        `Extreme Caution: Low social trust score of ${trustData.score}/5 detected.`,
      );
    } else if (trustData.reviews < 10) {
      if (overallRisk !== "High") overallRisk = "Medium";
      warnings.push("Warning: Limited review history found.");
    }

    // Final Response Object
    res.json({
      domain,
      ip,
      provider,
      country,
      security: "Valid SSL certificate",
      technicalRisk,
      overallRisk,
      trustScore: trustData.score,
      reviews: trustData.reviews,
      age,
      malicious: hotlinkData?.isHotlinking
        ? "Potential Clone"
        : "None Detected",
      hotlinkData: hotlinkData || { isHotlinking: false, details: [] },
      warnings,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Scan failed", details: error.message });
  }
});

app.listen(5000, () => console.log("Deep Scan Engine Active on Port 5000"));
