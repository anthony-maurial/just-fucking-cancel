# Getting Started

Never used Claude Code before? This guide will get you running in 5 minutes.

## What is Claude Code?

Claude Code is a command-line tool that lets Claude (the AI) work directly with files on your computer. It can read your documents, write code, and even control a browser - all while keeping your data local.

## Step 1: Install Claude Code

1. Go to [claude.ai/download](https://claude.ai/download)
2. Download for your operating system (Mac, Windows, or Linux)
3. Follow the installer instructions
4. You'll need a Claude account (free tier works)

## Step 2: Export Your Transactions

Get a CSV export from your bank or card:

**Apple Card:**
- Open Wallet app → Apple Card → Card Balance → Export Transactions

**Chase:**
- Log in → Accounts → Download account activity → CSV

**Other banks:**
- Look for "Export" or "Download" in your transaction history
- Choose CSV format

Save the file(s) somewhere you can find them.

## Step 3: Run just-fucking-cancel

1. Open your terminal:
   - **Mac**: Press `Cmd + Space`, type "Terminal", hit Enter
   - **Windows**: Press `Win + R`, type "cmd", hit Enter

2. Navigate to a folder for this project:
   ```
   cd ~/Documents
   mkdir cancel-subscriptions
   cd cancel-subscriptions
   ```

3. Start Claude Code:
   ```
   claude
   ```

4. Tell Claude what you want:
   ```
   Help me cancel subscriptions. I have transaction CSVs to share.
   ```

5. When prompted, drag your CSV file(s) into the terminal window, or paste the file path.

6. Answer Claude's questions about which subscriptions you use.

7. Claude generates an HTML file - open it in your browser to see your audit.

## What Happens Next

Claude will:
- Identify recurring charges in your transactions
- Ask you questions to categorize them (keep vs cancel)
- Generate an interactive HTML report
- Help you cancel subscriptions via browser automation

## How to Cancel

1. Check the items you want to cancel in the HTML audit
2. Click the floating "Copy" button that appears
3. Paste the list back to Claude
4. Claude will help you cancel each one

## Privacy Note

Everything runs locally on your computer. Your transaction data is:
- **Not uploaded** to any server
- **Not shared** with anyone
- **Not stored** anywhere except your own machine

Only you and Claude (running on your device) can see your data.

## Troubleshooting

**"claude: command not found"**
- Make sure Claude Code is installed and restart your terminal

**"Permission denied"**
- On Mac, you may need to allow Claude Code in System Preferences → Security & Privacy

**CSV not recognized**
- Make sure it's a .csv file (not .xlsx or .pdf)
- Try opening in a text editor to verify it's comma-separated

## Questions?

Open an issue on this repo or check the [Claude Code documentation](https://docs.anthropic.com/claude-code).
