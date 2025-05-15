# CloudflareDumper

This Node.js script exports various settings from one or more Cloudflare accounts, including DNS records, page rules, firewall rules, SSL/TLS settings, caching settings, Workers, and more. It's useful for auditing or backing up Cloudflare configurations across zones and accounts.

## Features

- Authenticates using either API Token or Email + Global API Key
- Supports multiple Cloudflare accounts
- Dumps settings for:
  - DNS Records
  - Page Rules
  - Firewall Rules
  - Workers (Account + Zone level)
  - SSL/TLS Settings
  - Caching Settings
  - All Zone Settings
- Optional filtering by zone names
- Saves structured JSON files per zone

## Output

All exported data is saved in the `cloudflare-settings/` directory. Each zone gets its own subfolder containing relevant JSON files.

Example structure:
```
cloudflare-settings/
├── example_com/
│   ├── dns_records_ACCOUNTID_example_com.json
│   ├── page_rules_ACCOUNTID_example_com.json
│   ├── firewall_rules_ACCOUNTID_example_com.json
│   ├── workers_ACCOUNTID_example_com.json
│   ├── ssl_settings_ACCOUNTID_example_com.json
│   ├── caching_settings_ACCOUNTID_example_com.json
│   └── all_settings_ACCOUNTID_example_com.json
```

## Prerequisites

- Node.js (v14+ recommended)
- A `.env` file containing your Cloudflare API credentials and optional filters

## .env File

Create a `.env` file in the root directory with the following variables:

```
# Prefer using API Token
CF_API_TOKEN=your_cloudflare_api_token

# If using Global API Key (less secure)
CF_EMAIL=your_email@example.com
CF_KEY=your_global_api_key

# One or more account IDs (comma-separated)
CF_ACCOUNT_IDS=123abc456def,789ghi012jkl

# Optional: specify zones to export (comma-separated domain names)
ZONES_TO_EXPORT=example.com,anotherdomain.com
```

## Usage

Install dependencies:
```
npm install dotenv
```

Run the script:
```
node cloudflare-dump.js
```

## How It Works

1. Loads Cloudflare credentials from `.env`
2. Authenticates with the Cloudflare API
3. Fetches all zones for specified accounts
4. Optionally filters zones based on `ZONES_TO_EXPORT`
5. For each zone:
   - Retrieves and saves settings in individual JSON files
   - Logs progress and saves everything under `cloudflare-settings/`

## API Endpoints Used

- GET /zones
- GET /zones/:id/dns_records
- GET /zones/:id/pagerules
- GET /zones/:id/firewall/rules
- GET /zones/:id/settings
- GET /zones/:id/settings/ssl
- GET /zones/:id/settings/cache_level
- GET /zones/:id/workers/scripts
- GET /accounts/:id/workers/scripts

## Security Notice

Avoid committing your `.env` file to version control. It contains sensitive API credentials. Use `.gitignore` to protect it:

```
echo ".env" >> .gitignore
```

## License

MIT License. This project is provided as-is with no warranty.
