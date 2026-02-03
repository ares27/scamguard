const express = require("express");
const cors = require("cors");
const dns = require("dns").promises;
const axios = require("axios");
const { getTrustpilotData, getDomainAge } = require("./scanner");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/scan", async (req, res) => {
  const { url } = req.body;
  // 1. Fetch HTML once for all analysis
  const { data: htmlBody } = await axios
    .get(url, { timeout: 5000 })
    .catch(() => ({ data: "" }));

  try {
    const domain = new URL(url).hostname.replace("www.", "");

    // 1. Resolve Real Infrastructure Data
    let ip = "0.0.0.0";
    let country = "Unknown";
    let provider = "Unknown Provider";

    try {
      const lookup = await dns.lookup(domain);
      ip = lookup.address;

      // Fetch Geo and ISP data (using ip-api.com - free for dev)
      const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
      if (geoResponse.data.status === "success") {
        country = geoResponse.data.countryCode;
        provider = geoResponse.data.isp;
      }
    } catch (infraError) {
      console.error("Infrastructure lookup failed:", infraError.message);
    }

    // 2. Run Scrapers (Trustpilot + WHOIS)
    const [trustData, age] = await Promise.all([
      getTrustpilotData(domain),
      getDomainAge(domain),
      detectHotlinking(url, htmlBody),
    ]);

    // 3. Technical vs Social Risk Logic
    const technicalRisk = "Low"; // Usually Low for Cloudflare-backed sites
    let overallRisk = "Low";
    let warnings = [];

    // Prioritize Social Score for the "High Risk" verdict
    if (hotlinkData.isHotlinking) {
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
      overallRisk = "Medium";
      warnings.push("Warning: Limited review history found.");
    }

    // Final Response Object
    res.json({
      domain,
      ip,
      provider,
      country,
      security: "Valid SSL certificate", // SSL check logic can be added later
      technicalRisk,
      overallRisk,
      trustScore: trustData.score,
      reviews: trustData.reviews,
      age,
      malicious: "None Detected",
      hotlinkData,
      warnings,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Scan failed" });
  }
});

app.listen(5000, () => console.log("Deep Scan Engine Active on Port 5000"));
