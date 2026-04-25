/**
 * commands/fastestlap.js  —  /fastestlap command
 * Olzhasstik Motorsports | OM-Bot
 *
 * Flow:
 *   1. User runs /fastestlap
 *   2. Bot replies: "Please reply to THIS message with your race video."
 *   3. Bot watches for a reply that contains a video attachment (60s window)
 *   4. Downloads video to /tmp, spawns analyze.py, collects JSON stdout lines
 *   5. Builds a styled embed with the finishing order
 *
 * Requirements:
 *   - Node.js 18+ (native fetch for download)
 *   - Python 3.9+ with analyze.py in project root
 *   - PYTHON_PATH env var (optional, defaults to "python3")
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const { spawn }   = require("child_process");
const fs          = require("fs");
const fsp         = fs.promises;
const path        = require("path");
const https       = require("https");
const http        = require("http");

// ── Config ──────────────────────────────────────────────────────────────────
const PYTHON_BIN      = process.env.PYTHON_PATH || "python3";
const SCRIPT_PATH     = path.join(__dirname, "..", "analyze.py");
const TMP_DIR         = "/tmp/om_race_videos";
const REPLY_TIMEOUT   = 60_000;   // ms to wait for the user to send a video
const ANALYZE_TIMEOUT = 300_000;  // 5 min max for analysis

// Supported video MIME types Discord uses
const VIDEO_MIMES = new Set([
  "video/mp4", "video/quicktime", "video/x-matroska",
  "video/webm", "video/avi", "video/x-msvideo",
]);

// ── Slash command definition ─────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName("fastestlap")
    .setDescription("Analyze a race video to extract the finishing order"),

  // ── Execute ────────────────────────────────────────────────────────────────
  async execute(interaction) {
    // Ensure /tmp dir exists
    await fsp.mkdir(TMP_DIR, { recursive: true });

    // ── Step 1: Send the "prompt" message that the user must reply to ─────
    const promptMsg = await interaction.reply({
      content: [
        "🎬 **Race Video Analysis**",
        "",
        "Please **reply to this message** with your race video.",
        `I'll detect all drivers crossing the finish line.`,
        `*(Waiting up to ${REPLY_TIMEOUT / 1000}s)*`,
      ].join("\n"),
      fetchReply: true,
    });

    // ── Step 2: Collect the reply containing a video ──────────────────────
    let videoAttachment = null;
    let replyMsg        = null;

    try {
      const collected = await interaction.channel.awaitMessages({
        filter: (msg) => {
          // Must be a reply to our prompt message
          if (msg.reference?.messageId !== promptMsg.id) return false;
          // Must be from the original user
          if (msg.author.id !== interaction.user.id) return false;
          // Must have a video attachment
          return msg.attachments.some(
            (a) => VIDEO_MIMES.has(a.contentType?.split(";")[0]) ||
                   /\.(mp4|mov|mkv|webm|avi)$/i.test(a.name)
          );
        },
        max:  1,
        time: REPLY_TIMEOUT,
        errors: ["time"],
      });

      replyMsg        = collected.first();
      videoAttachment = replyMsg.attachments.find(
        (a) => VIDEO_MIMES.has(a.contentType?.split(";")[0]) ||
               /\.(mp4|mov|mkv|webm|avi)$/i.test(a.name)
      );
    } catch {
      return interaction.editReply({
        content: "⏰ Timeout — no video received. Please run `/fastestlap` again.",
      });
    }

    // ── Step 3: Download the video to /tmp ────────────────────────────────
    await interaction.editReply({
      content: "⬇️ Downloading video… this may take a moment.",
    });

    const ext      = path.extname(videoAttachment.name) || ".mp4";
    const filename = `race_${Date.now()}${ext}`;
    const filepath = path.join(TMP_DIR, filename);

    try {
      await downloadFile(videoAttachment.url, filepath);
    } catch (err) {
      return interaction.editReply({
        content: `❌ Failed to download video: \`${err.message}\``,
      });
    }

    // ── Step 4: Spawn Python analyzer ────────────────────────────────────
    await interaction.editReply({
      content: "🔍 Analyzing video… detecting drivers at the finish line.",
    });

    let results;
    try {
      results = await runAnalyzer(filepath);
    } catch (err) {
      await cleanup(filepath);
      return interaction.editReply({
        content: `❌ Analysis failed: \`${err.message}\``,
      });
    }

    await cleanup(filepath);

    // ── Step 5: Build embed ───────────────────────────────────────────────
    if (results.length === 0) {
      return interaction.editReply({
        content: "⚠️ No drivers detected at the finish line. Try a clearer video.",
      });
    }

    const embed = buildResultEmbed(results, interaction.user);
    await interaction.editReply({ content: "", embeds: [embed] });
  },
};


// ═══════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Download a URL to a local file path.
 * Uses native http/https — no extra deps needed.
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(dest);

    proto.get(url, (res) => {
      // Follow one redirect (Discord CDN uses them)
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Spawn analyze.py and collect its JSON-line output.
 * Returns array of { driver, timestamp } objects.
 * Rejects on non-zero exit or timeout.
 */
function runAnalyzer(videoPath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let   stderr  = "";

    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH, videoPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Read JSON lines from stdout
    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.error) {
            // Python reported a structured error
            console.error("[analyze.py error]", obj.error);
          } else if (obj.driver && obj.timestamp) {
            results.push(obj);
          }
        } catch {
          // Non-JSON line from Python (shouldn't happen) — log and skip
          console.warn("[analyze.py stdout non-JSON]", trimmed);
        }
      }
    });

    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    // Safety timeout
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Analysis timed out after 5 minutes"));
    }, ANALYZE_TIMEOUT);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error("[analyze.py stderr]", stderr.slice(-1000));
        reject(new Error(`Python exited with code ${code}`));
      } else {
        resolve(results);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

/**
 * Build the finishing-order Discord embed.
 */
function buildResultEmbed(results, requestedBy) {
  // Position medals
  const medals = ["🥇", "🥈", "🥉"];

  const lines = results.map((r, i) => {
    const pos    = i + 1;
    const medal  = medals[i] ?? `**${pos}.**`;
    const gap    = i === 0 ? "WINNER" : `+${timeDiff(results[0].timestamp, r.timestamp)}`;
    return `${medal} \`${r.driver.padEnd(16)}\`  \`${r.timestamp}\`  *(${gap})*`;
  });

  return new EmbedBuilder()
    .setColor(0xE8000D)                        // OM racing red
    .setTitle("🏁  Race Finish — Analysis Complete")
    .setDescription(lines.join("\n"))
    .addFields(
      { name: "Drivers Detected", value: `${results.length}`, inline: true },
      { name: "Winner",           value: results[0].driver,   inline: true },
      { name: "Fastest Timestamp",value: results[0].timestamp,inline: true },
    )
    .setFooter({
      text: `Requested by ${requestedBy.username} • Olzhasstik Motorsports`,
      iconURL: requestedBy.displayAvatarURL(),
    })
    .setTimestamp();
}

/**
 * Calculate time difference between two MM:SS strings.
 * Returns "+MM:SS" string.
 */
function timeDiff(a, b) {
  const toSeconds = (ts) => {
    const [m, s] = ts.split(":").map(Number);
    return m * 60 + s;
  };
  const diff = Math.abs(toSeconds(b) - toSeconds(a));
  const m    = Math.floor(diff / 60);
  const s    = diff % 60;
  return `${m > 0 ? m + "m " : ""}${s}s`;
}

/** Remove temp file silently. */
async function cleanup(filepath) {
  try { await fsp.unlink(filepath); } catch { /* ignore */ }
}
