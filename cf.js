// Cloudflare Settings Dumper
// This script uses Node.js to extract various settings from your Cloudflare account

const fs = require("fs");
const path = require("path");
const https = require("https");
const dotenv = require("dotenv");

// Load environment variables from a .env file
dotenv.config();

// Cloudflare API credentials
const CF_API_TOKEN = process.env.CF_API_TOKEN; // Prefer API token over email/key
const CF_EMAIL = process.env.CF_EMAIL; // Only needed if using Global API Key
const CF_KEY = process.env.CF_KEY; // Global API Key (less secure)

// Account IDs to process (comma-separated in .env)
const ACCOUNT_IDS = (process.env.CF_ACCOUNT_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
// If no account IDs specified, use the single account ID if available
if (ACCOUNT_IDS.length === 0 && process.env.CF_ACCOUNT_ID) {
  ACCOUNT_IDS.push(process.env.CF_ACCOUNT_ID.trim());
}

// List of zone names to export (domains)
// If empty, will export all zones in the specified accounts
const ZONES_TO_EXPORT = (process.env.ZONES_TO_EXPORT || "")
  .split(",")
  .filter((zone) => zone.trim() !== "");

// Create output directory
const OUTPUT_DIR = path.join(__dirname, "cloudflare-settings");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get auth headers based on available credentials
function getAuthHeaders() {
  if (CF_API_TOKEN) {
    return {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    };
  } else {
    return {
      "X-Auth-Email": CF_EMAIL,
      "X-Auth-Key": CF_KEY,
      "Content-Type": "application/json",
    };
  }
}

// Helper function to make API requests to Cloudflare
function makeRequest(endpoint, method = "GET") {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.cloudflare.com",
      path: `/client/v4${endpoint}`,
      method: method,
      headers: getAuthHeaders(),
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          if (!parsedData.success) {
            reject(
              new Error(
                `API request failed: ${JSON.stringify(parsedData.errors)}`
              )
            );
            return;
          }
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// Helper function to save data to JSON file
// async function saveToFile(filename, data) {
//   const filePath = path.join(OUTPUT_DIR, filename);
//   await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
//   console.log(`Saved ${filePath}`);
// }
async function saveToFile(zoneFolder, filename, data) {
  const dirPath = path.join(OUTPUT_DIR, zoneFolder);
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  const filePath = path.join(dirPath, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filePath}`);
}

// Get all zones for a specific account, with pagination
async function getZonesForAccount(accountId) {
  const allZones = [];
  let page = 1;
  const perPage = 50; // Cloudflare allows up to 50 per page

  try {
    while (true) {
      const response = await makeRequest(
        `/zones?account.id=${accountId}&page=${page}&per_page=${perPage}`
      );
      const zones = response.result;
      allZones.push(...zones);

      if (zones.length < perPage) {
        break; // Last page reached
      }

      page++;
    }

    console.log(
      `Zones found in account ${accountId}:`,
      allZones.map((z) => z.name)
    );

    // Filter zones if specific zones are requested
    let filteredZones = allZones;
    if (ZONES_TO_EXPORT.length > 0) {
      const zoneFilters = ZONES_TO_EXPORT.map((z) => z.toLowerCase());
      filteredZones = allZones.filter((zone) =>
        zoneFilters.includes(zone.name.toLowerCase())
      );
      console.log(
        `Account ${accountId}: Filtered from ${allZones.length} zones to ${filteredZones.length} zones based on your criteria`
      );
    }

    //await saveToFile(`zones_account_${accountId}.json`, filteredZones);
    return filteredZones;
  } catch (error) {
    console.error(
      `Error fetching zones for account ${accountId}:`,
      error.message
    );
    return [];
  }
}

// Get DNS records for a zone
async function getDnsRecords(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/dns_records`);
    const records = response.result;
    await saveToFile(zoneName, `dns_records_${accountId}_${zoneName}.json`, records);
    return records;
  } catch (error) {
    console.error(`Error fetching DNS records for ${zoneName}:`, error.message);
    return [];
  }
}

// Get Page Rules for a zone
async function getPageRules(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/pagerules`);
    const rules = response.result;
    await saveToFile(zoneName, `page_rules_${accountId}_${zoneName}.json`, rules);
    return rules;
  } catch (error) {
    console.error(`Error fetching page rules for ${zoneName}:`, error.message);
    return [];
  }
}

// Get WAF (Firewall) settings
async function getFirewallRules(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/firewall/rules`);
    const rules = response.result;
    await saveToFile(zoneName, `firewall_rules_${accountId}_${zoneName}.json`, rules);
    return rules;
  } catch (error) {
    console.error(
      `Error fetching firewall rules for ${zoneName}:`,
      error.message
    );
    return [];
  }
}

// Get Workers for a zone
async function getZoneWorkers(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/workers/scripts`);
    const workers = response.result;
    await saveToFile(zoneName, `workers_${accountId}_${zoneName}.json`, workers);
    return workers;
  } catch (error) {
    console.error(`Error fetching workers for ${zoneName}:`, error.message);
    return [];
  }
}

// Get Workers for an account
async function getAccountWorkers(accountId) {
  try {
    const response = await makeRequest(
      `/accounts/${accountId}/workers/scripts`
    );
    const workers = response.result;
    //await saveToFile(`account_workers_${accountId}.json`, workers);
    return workers;
  } catch (error) {
    console.error(
      `Error fetching workers for account ${accountId}:`,
      error.message
    );
    return [];
  }
}

// Get SSL/TLS settings for a zone
async function getSslSettings(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/settings/ssl`);
    const sslSettings = response.result;
    await saveToFile(zoneName, `ssl_settings_${accountId}_${zoneName}.json`, sslSettings);
    return sslSettings;
  } catch (error) {
    console.error(
      `Error fetching SSL settings for ${zoneName}:`,
      error.message
    );
    return [];
  }
}

// Get caching settings for a zone
async function getCachingSettings(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/settings/cache_level`);
    const cachingSettings = response.result;
    await saveToFile(zoneName, 
      `caching_settings_${accountId}_${zoneName}.json`,
      cachingSettings
    );
    return cachingSettings;
  } catch (error) {
    console.error(
      `Error fetching caching settings for ${zoneName}:`,
      error.message
    );
    return [];
  }
}

// Get all zone settings at once
async function getAllZoneSettings(zoneId, zoneName, accountId) {
  try {
    const response = await makeRequest(`/zones/${zoneId}/settings`);
    const allSettings = response.result;
    await saveToFile(zoneName, `all_settings_${accountId}_${zoneName}.json`, allSettings);
    return allSettings;
  } catch (error) {
    console.error(
      `Error fetching all settings for ${zoneName}:`,
      error.message
    );
    return [];
  }
}

// Main function to dump all settings
async function dumpAllSettings() {
  console.log("Starting Cloudflare settings dump...");

  if (ACCOUNT_IDS.length === 0) {
    console.error(
      "No account IDs specified. Please add CF_ACCOUNT_IDS to your .env file."
    );
    process.exit(1);
  }

  console.log(
    `Processing ${ACCOUNT_IDS.length} account(s): ${ACCOUNT_IDS.join(", ")}`
  );
  console.log(
    ZONES_TO_EXPORT.length > 0
      ? `Exporting only specified zones: ${ZONES_TO_EXPORT.join(", ")}`
      : "Exporting all zones in each account"
  );

  // Process each account
  for (const accountId of ACCOUNT_IDS) {
    console.log(`\n=== Processing Account ${accountId} ===`);

    // Get account-level Workers
    await getAccountWorkers(accountId);

    // Get zones for this account and their settings
    const zones = await getZonesForAccount(accountId);

    for (const zone of zones) {
      const zoneId = zone.id;
      const zoneName = zone.name.replace(/\./g, "_");

      console.log(`Processing zone: ${zone.name} (${zoneId})`);

      // Get all settings for this zone
      await getAllZoneSettings(zoneId, zoneName, accountId);

      // Get specific settings
      await getDnsRecords(zoneId, zoneName, accountId);
      await getPageRules(zoneId, zoneName, accountId);
      await getFirewallRules(zoneId, zoneName, accountId);
      await getZoneWorkers(zoneId, zoneName, accountId);
      await getSslSettings(zoneId, zoneName, accountId);
      await getCachingSettings(zoneId, zoneName, accountId);
    }
  }

  console.log("\nCompleted Cloudflare settings dump!");
  console.log(`All files saved to: ${OUTPUT_DIR}`);
}

// Run the script
dumpAllSettings().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});
