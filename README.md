
Olzhasstik Motorsports Bot
A dedicated Discord bot designed for sim-racing league management, driver statistics tracking, and automated community operations.
Features
 * Statistics Management: Track driver wins, podiums, and championship points with MongoDB integration.
 * DOTY System: Automated "Driver of the Day" voting system with interactive buttons and real-time result calculation.
 * Automated Moderation: Advanced permission handling and security protocols to maintain server integrity.
 * League Tools: Specialized commands for managing racing seasons and driver rosters.
 * Remote Control: A secure control panel for cross-server management and emergency overrides.
Tech Stack
 * Runtime: Node.js
 * Library: Discord.js (v14+)
 * Database: MongoDB / Mongoose
 * Environment: Dotenv for secure configuration
Installation
 * Clone the repository:
   git clone https://github.com/gofretfkintank/OM-Bot.git

 * Install dependencies:
   npm install

 * Configure your .env file with the following:
   * TOKEN: Your Discord Bot Token
   * MONGO_URI: Your MongoDB connection string
   * GUILD_ID: Your primary server ID
 * Start the bot:
   node index.js

License
Distributed under the MIT License. See LICENSE for more information.

