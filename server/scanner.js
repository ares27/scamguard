const axios = require("axios");
const cheerio = require("cheerio");
const whoiser = require("whoiser");

async function getTrustpilotData(domain) {
  try {
    const url = `https://www.trustpilot.com/review/${domain}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(data);
    let score = 0;
    let reviews = 0;

    // STRATEGY A: Parse JSON-LD (The most reliable "Internal" data)
    try {
      const jsonData = $('script[type="application/ld+json"]')
        .map((i, el) => JSON.parse($(el).html()))
        .get()
        .find(
          (obj) =>
            obj["@type"] === "AggregateRating" ||
            (obj["@graph"] &&
              obj["@graph"].find((o) => o["@type"] === "AggregateRating")),
        );

      const ratingObj =
        jsonData?.["@type"] === "AggregateRating"
          ? jsonData
          : jsonData?.["@graph"]?.find((o) => o["@type"] === "AggregateRating");

      if (ratingObj) {
        score = parseFloat(ratingObj.ratingValue);
        reviews = parseInt(ratingObj.reviewCount);
      }
    } catch (e) {
      console.warn("JSON-LD parse failed, trying selectors...");
    }

    // STRATEGY B: Selector Fallback (If JSON-LD fails)
    if (score === 0) {
      const scoreText =
        $('span[data-rating-typography="true"]').first().text().trim() ||
        $('p[data-rating-typography="true"]').first().text().trim();
      score = parseFloat(scoreText) || 0;
    }

    if (reviews === 0) {
      const reviewCountText =
        $('span[data-reviews-count-typography="true"]').first().text().trim() ||
        $('p[data-reviews-count-typography="true"]').first().text().trim();
      reviews = parseInt(reviewCountText.replace(/[^0-9]/g, "")) || 0;
    }

    // STRATEGY C: Regex Fallback (The "Nuclear" option)
    if (score === 0) {
      const regexMatch = data.match(/"ratingValue":\s?"(\d+\.\d+|\d+)"/);
      if (regexMatch) score = parseFloat(regexMatch[1]);
    }

    console.log(`Final Extraction -> Score: ${score}, Reviews: ${reviews}`);
    return { score, reviews };
  } catch (error) {
    console.error("Trustpilot Scrape Error:", error.message);
    return { score: 0, reviews: 0 };
  }
}

async function getDomainAge(domain) {
  try {
    // FIX: Call whoiser.domain or whoiser.whoisDomain depending on your version
    // Modern whoiser uses .domain() for parsed results
    const domainInfo = await whoiser.whoisDomain(domain);

    // Fallback logic to find the date in the nested object
    let rawDate = null;
    for (const registrar in domainInfo) {
      const data = domainInfo[registrar];
      rawDate =
        data["Created Date"] ||
        data["Creation Date"] ||
        data["created"] ||
        data["Domain Name Data"]?.["Creation Date"];
      if (rawDate) break;
    }

    if (!rawDate) return "New Domain / Private";

    const createdDate = new Date(rawDate);
    if (isNaN(createdDate.getTime())) return "New Domain / Private";

    const now = new Date();
    let years = now.getFullYear() - createdDate.getFullYear();
    let months = now.getMonth() - createdDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} Years, ${months} Months`;
  } catch (error) {
    console.error("WHOIS Error:", error.message);
    return "New Domain / Private";
  }
}

async function detectHotlinking(url, htmlContent) {
  try {
    const $ = cheerio.load(htmlContent);
    const targetHostname = new URL(url).hostname.replace("www.", "");

    let externalAssets = [];
    let hotlinkScore = 0;

    $("img").each((i, el) => {
      const src = $(el).attr("src");
      if (!src) return;

      try {
        const assetUrl = new URL(src, url); // Handles relative paths automatically
        const assetHostname = assetUrl.hostname.replace("www.", "");

        // If the image is hosted on a DIFFERENT domain and it's not a common CDN
        if (assetHostname !== targetHostname && !isCommonCDN(assetHostname)) {
          externalAssets.push({
            src: src,
            provider: assetHostname,
          });
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });

    // A site with > 3 images hotlinked from a single external
    // authority domain is highly suspicious of being a clone.
    const providers = externalAssets.map((a) => a.provider);
    const uniqueProviders = [...new Set(providers)];

    return {
      isHotlinking: externalAssets.length > 3,
      details: uniqueProviders
        .map((p) => ({
          domain: p,
          count: providers.filter((x) => x === p).length,
        }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (err) {
    return { isHotlinking: false, details: [] };
  }
}

// Simple helper to avoid flagging Google/Amazon/FB tracking pixels
function isCommonCDN(hostname) {
  const cdns = [
    "google.com",
    "gstatic.com",
    "facebook.com",
    "cloudfront.net",
    "akamaihd.net",
  ];
  return cdns.some((cdn) => hostname.includes(cdn));
}

module.exports = { getTrustpilotData, getDomainAge, detectHotlinking };
