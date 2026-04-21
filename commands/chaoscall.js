const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ─────────────────────────────────────────────
//  CHAOS POOL  (100 scenarios)
//  Categories: Grid | Points | Rules | Race Format | Strategy & Psychology
// ─────────────────────────────────────────────
const CHAOS_POOL = [
  // ── GRID CHAOS ────────────────────────────
  {
    id: 1, category: '🔀 Grid Chaos',
    title: 'Full Reverse Grid',
    description: 'All drivers start in reverse championship order. The leader starts last, the last-place driver starts from pole!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 2, category: '🔀 Grid Chaos',
    title: 'Top 10 Reverse',
    description: 'Only the top 10\'s grid positions are reversed. P10 starts from pole, P1 starts P10.',
    intensity: '🔥🔥',
  },
  {
    id: 3, category: '🔀 Grid Chaos',
    title: 'Full Random Draw',
    description: 'All grid positions are determined by a random draw. Qualifying means nothing — pure luck!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 4, category: '🔀 Grid Chaos',
    title: 'Odd-Even Swap',
    description: 'Drivers in odd grid positions swap with drivers in even positions. The grid becomes a zigzag!',
    intensity: '🔥',
  },
  {
    id: 5, category: '🔀 Grid Chaos',
    title: 'Last Race Reversal',
    description: 'The finishing order of the previous race becomes this race\'s starting grid — but reversed!',
    intensity: '🔥🔥',
  },
  {
    id: 6, category: '🔀 Grid Chaos',
    title: 'Champion\'s Penalty',
    description: 'The championship leader starts from the very back of the grid. Prove your worth!',
    intensity: '🔥🔥',
  },
  {
    id: 7, category: '🔀 Grid Chaos',
    title: 'Top 3 to the Pit Lane',
    description: 'The top 3 in the championship start from the pit lane. Everyone else lines up normally.',
    intensity: '🔥🔥',
  },
  {
    id: 8, category: '🔀 Grid Chaos',
    title: 'Block Swap',
    description: 'The grid is split in half: the back half moves to the front, the front half moves to the back.',
    intensity: '🔥🔥',
  },
  {
    id: 9, category: '🔀 Grid Chaos',
    title: 'Rival Pick',
    description: 'Each driver nominates a rival they want to battle. The matchups determine grid order.',
    intensity: '🔥🔥',
  },
  {
    id: 10, category: '🔀 Grid Chaos',
    title: 'Points Gap Grid',
    description: 'Grid is determined not by championship points, but by the GAP to the leader. Smallest gap = pole!',
    intensity: '🔥🔥',
  },

  // ── POINTS SYSTEM ─────────────────────────
  {
    id: 11, category: '🏆 Points System',
    title: 'Double Points',
    description: 'All points are doubled for this race. Every single position matters more than ever!',
    intensity: '🔥🔥',
  },
  {
    id: 12, category: '🏆 Points System',
    title: 'Half Points',
    description: 'Points are halved for this race. Low pressure on paper, high risk in practice!',
    intensity: '🔥',
  },
  {
    id: 13, category: '🏆 Points System',
    title: 'Reversed Points',
    description: 'The points table is flipped: last place gets P1\'s points, first place gets last place\'s points!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 14, category: '🏆 Points System',
    title: 'Flat Points',
    description: 'Every driver receives the same number of points regardless of finishing position — but only if they finish!',
    intensity: '🔥',
  },
  {
    id: 15, category: '🏆 Points System',
    title: 'Gap Bonus',
    description: 'The closer P2 and P3 finish to the winner, the more bonus points they earn.',
    intensity: '🔥🔥',
  },
  {
    id: 16, category: '🏆 Points System',
    title: 'Mid-Race Checkpoint Points',
    description: 'The standings at a specific lap mid-race also award points. The first half counts too!',
    intensity: '🔥🔥',
  },
  {
    id: 17, category: '🏆 Points System',
    title: 'Zero Points for the Winner',
    description: 'First place earns zero points. All points are distributed from P2 downwards!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 18, category: '🏆 Points System',
    title: 'Overtake Bonus',
    description: 'The driver who gains the most positions during the race earns a +10 bonus.',
    intensity: '🔥',
  },
  {
    id: 19, category: '🏆 Points System',
    title: 'First Lap Leader Bonus',
    description: 'The driver leading after lap 1 earns an extra 5 points. Aggressive starts are a must!',
    intensity: '🔥',
  },
  {
    id: 20, category: '🏆 Points System',
    title: 'Final Lap Frenzy',
    description: 'Every driver who gains a position on the final lap earns +3 points per position gained.',
    intensity: '🔥🔥',
  },

  // ── RACE RULES ────────────────────────────
  {
    id: 21, category: '📋 Race Rule',
    title: 'Stay Close Rule',
    description: 'You must stay within 5 seconds of another driver at all times. Go solo and receive a +10s penalty!',
    intensity: '🔥🔥',
  },
  {
    id: 22, category: '📋 Race Rule',
    title: 'No Overtaking — First 3 Laps',
    description: 'Overtaking is banned for the first 3 laps. Hold your position and be patient!',
    intensity: '🔥',
  },
  {
    id: 23, category: '📋 Race Rule',
    title: 'No Overtaking — Last 5 Laps',
    description: 'No overtakes allowed in the final 5 laps. You better be in a good position before then!',
    intensity: '🔥🔥',
  },
  {
    id: 24, category: '📋 Race Rule',
    title: 'Red Flag Wildcard',
    description: 'The admin can throw a red flag mid-race and reshuffle the grid at any point. Expect the unexpected!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 25, category: '📋 Race Rule',
    title: 'Position Freeze',
    description: 'At a specified lap, the current standings are frozen and used as the points basis for the race.',
    intensity: '🔥🔥',
  },
  {
    id: 26, category: '📋 Race Rule',
    title: 'No Intra-Team Overtaking',
    description: 'Teammates cannot overtake each other. Team order must be maintained throughout the race!',
    intensity: '🔥',
  },
  {
    id: 27, category: '📋 Race Rule',
    title: 'Mandatory Slow Zone',
    description: 'The admin designates a specific section of the track as a "slow zone." Violations result in a penalty.',
    intensity: '🔥🔥',
  },
  {
    id: 28, category: '📋 Race Rule',
    title: 'Grid Penalty Lottery',
    description: 'A draw is held and 3 random drivers each receive a 5-place grid penalty. Who\'s name gets pulled?',
    intensity: '🔥🔥🔥',
  },
  {
    id: 29, category: '📋 Race Rule',
    title: 'Overtake Limit',
    description: 'A maximum of 5 overtakes per driver is allowed during the race. Every move counts — use them wisely!',
    intensity: '🔥🔥',
  },
  {
    id: 30, category: '📋 Race Rule',
    title: 'Mandatory Drop to Last',
    description: 'At a set lap, the championship leader must deliberately drop to the back of the field.',
    intensity: '🔥🔥🔥',
  },

  // ── RACE FORMAT ───────────────────────────
  {
    id: 31, category: '🏁 Race Format',
    title: 'Sprint + Feature Race',
    description: 'A short sprint race is held first. Its result determines the grid for the main feature race.',
    intensity: '🔥🔥',
  },
  {
    id: 32, category: '🏁 Race Format',
    title: 'Double Header',
    description: 'Two separate races on the same track! The first race result sets the grid for the second.',
    intensity: '🔥🔥',
  },
  {
    id: 33, category: '🏁 Race Format',
    title: 'Team Relay Race',
    description: 'Teams are formed. Each driver races for a set number of laps before the next teammate takes over.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 34, category: '🏁 Race Format',
    title: 'Half Distance',
    description: 'The race runs at half the normal lap count. Every second, every meter is critical!',
    intensity: '🔥',
  },
  {
    id: 35, category: '🏁 Race Format',
    title: '1.5x Extended Race',
    description: 'This race is 1.5 times longer than normal. Concentration and stamina are everything!',
    intensity: '🔥🔥',
  },
  {
    id: 36, category: '🏁 Race Format',
    title: 'Mystery Track',
    description: 'The race venue is revealed at the last moment by the admin. No time to prepare!',
    intensity: '🔥🔥',
  },
  {
    id: 37, category: '🏁 Race Format',
    title: 'Fastest Lap Race',
    description: 'The driver who sets the fastest lap earns an extra 5 points. The hotlap matters as much as the finish!',
    intensity: '🔥',
  },
  {
    id: 38, category: '🏁 Race Format',
    title: 'Custom Finish Point',
    description: 'The race doesn\'t end at the normal finish line — the admin designates a different checkpoint as the finish.',
    intensity: '🔥🔥',
  },
  {
    id: 39, category: '🏁 Race Format',
    title: 'Elimination Race',
    description: 'Every N laps, the last-placed driver is eliminated and must retire from the race!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 40, category: '🏁 Race Format',
    title: 'Double Track Weekend',
    description: 'Two races on two different tracks in the same week. Points from both are combined.',
    intensity: '🔥🔥',
  },

  // ── STRATEGY & PSYCHOLOGY ─────────────────
  {
    id: 41, category: '🧠 Strategy & Psychology',
    title: 'Secret Objective',
    description: 'Each driver is given a private secret objective (e.g., "gain 3 positions"). Complete it for +10 bonus points!',
    intensity: '🔥🔥',
  },
  {
    id: 42, category: '🧠 Strategy & Psychology',
    title: 'Rival Matchup',
    description: 'The admin randomly pairs up drivers. Beat your assigned rival in the race to earn +5 bonus points!',
    intensity: '🔥🔥',
  },
  {
    id: 43, category: '🧠 Strategy & Psychology',
    title: 'Team Championship',
    description: 'Random teams are formed. The team whose lead driver finishes highest also earns bonus points for the team.',
    intensity: '🔥🔥',
  },
  {
    id: 44, category: '🧠 Strategy & Psychology',
    title: 'Radio Silence',
    description: 'No strategy sharing is allowed in Discord during the race. No tips, no callouts — total radio silence!',
    intensity: '🔥',
  },
  {
    id: 45, category: '🧠 Strategy & Psychology',
    title: 'Blind Track',
    description: 'The track is revealed only 10 minutes before race start. No one has time to practice!',
    intensity: '🔥🔥',
  },
  {
    id: 46, category: '🧠 Strategy & Psychology',
    title: 'Fake Grid',
    description: 'The admin announces a false grid order. The real grid is only revealed when the race broadcast starts. Mind games!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 47, category: '🧠 Strategy & Psychology',
    title: 'Prediction Points',
    description: 'Before the race, each driver predicts their own finishing position. A correct prediction earns +5 bonus points!',
    intensity: '🔥',
  },
  {
    id: 48, category: '🧠 Strategy & Psychology',
    title: 'Championship Simulation',
    description: 'This race\'s points count double toward the championship simulation. Every position has amplified stakes.',
    intensity: '🔥🔥',
  },
  {
    id: 49, category: '🧠 Strategy & Psychology',
    title: 'Sign-Up Penalty',
    description: 'Drivers must register for this race in advance. Anyone who doesn\'t register in time starts from the back!',
    intensity: '🔥',
  },
  {
    id: 50, category: '🧠 Strategy & Psychology',
    title: 'Head-to-Head Bet',
    description: 'The two closest rivals in the championship face a special side bet. Whoever finishes ahead earns +8 points!',
    intensity: '🔥🔥',
  },

  // ── ADDITIONAL SCENARIOS (51–100) ─────────
  {
    id: 51, category: '🔀 Grid Chaos',
    title: 'Points Reset Threat',
    description: 'A draw is held — one random driver\'s points from this race could be wiped. Everyone has the same risk!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 52, category: '🏆 Points System',
    title: 'Points Transfer',
    description: 'The race winner can choose to give 5 points to — or take 5 points from — any other driver.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 53, category: '📋 Race Rule',
    title: 'Safety Laps',
    description: 'Certain designated laps are declared "safe laps." No overtaking is permitted — just hold your position.',
    intensity: '🔥',
  },
  {
    id: 54, category: '🏁 Race Format',
    title: 'Mandatory Slow Lap',
    description: 'At a mid-race point, all drivers must complete a full formation-pace slow lap together.',
    intensity: '🔥🔥',
  },
  {
    id: 55, category: '🧠 Strategy & Psychology',
    title: 'Veto Power',
    description: 'The winner of the previous race earns the right to veto one rule this weekend. Power is in their hands!',
    intensity: '🔥🔥',
  },
  {
    id: 56, category: '🔀 Grid Chaos',
    title: 'Grid Rotation',
    description: 'Every grid position shifts forward by 5 spots. P1 → P6, P6 → P11, and so on.',
    intensity: '🔥🔥',
  },
  {
    id: 57, category: '🏆 Points System',
    title: 'Negative Points Risk',
    description: 'The bottom 3 finishers don\'t just miss out on points — they LOSE 5 points each.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 58, category: '📋 Race Rule',
    title: 'Outside-Only Overtaking',
    description: 'Only overtakes made around the outside of a corner are valid. Inside passes don\'t count!',
    intensity: '🔥🔥',
  },
  {
    id: 59, category: '🏁 Race Format',
    title: 'Two-Part Race',
    description: 'The race is split into two halves. Each half is scored and points from both are combined.',
    intensity: '🔥🔥',
  },
  {
    id: 60, category: '🧠 Strategy & Psychology',
    title: 'Champion\'s Burden',
    description: 'The championship leader\'s points and losses are multiplied by 1.5x this race. Great power, great risk!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 61, category: '🔀 Grid Chaos',
    title: 'Favourites to the Back',
    description: 'The top 5 in the championship standings must start from the last 5 grid positions.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 62, category: '🏆 Points System',
    title: 'Podium Only',
    description: 'Only the top 3 finishers score points — but podium points are tripled for this race!',
    intensity: '🔥🔥',
  },
  {
    id: 63, category: '📋 Race Rule',
    title: 'Sequential Overtake Limit',
    description: 'You cannot overtake the same driver more than twice within 2 laps. Force your strategy!',
    intensity: '🔥',
  },
  {
    id: 64, category: '🏁 Race Format',
    title: 'Night Surprise',
    description: 'On race day, the admin may add one bonus chaos rule that was not announced beforehand.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 65, category: '🧠 Strategy & Psychology',
    title: 'Handicapped Favourite',
    description: 'The driver with the most championship points starts with a mandatory +15s time penalty.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 66, category: '🔀 Grid Chaos',
    title: 'Double Draw',
    description: 'The grid is determined by two separate draws. The second draw overrides the first!',
    intensity: '🔥🔥',
  },
  {
    id: 67, category: '🏆 Points System',
    title: 'Cumulative Winner',
    description: 'This race\'s points are stacked on top of the previous three races\' totals — a triple-race bonus!',
    intensity: '🔥🔥',
  },
  {
    id: 68, category: '📋 Race Rule',
    title: 'Clean Driver Award',
    description: 'Any driver who completes the race without incidents, spins, or track limit violations earns +7 points.',
    intensity: '🔥',
  },
  {
    id: 69, category: '🏁 Race Format',
    title: 'Time Trial Weekend',
    description: 'No race this week — the fastest single lap time is what\'s scored. Who has the best hotlap?',
    intensity: '🔥🔥',
  },
  {
    id: 70, category: '🧠 Strategy & Psychology',
    title: 'Community Vote',
    description: 'Drivers vote on which chaos rule to apply this race. The majority decides the format!',
    intensity: '🔥🔥',
  },
  {
    id: 71, category: '🔀 Grid Chaos',
    title: 'Alphabetical Grid',
    description: 'Grid positions are determined alphabetically by driver name. Your name might be your advantage!',
    intensity: '🔥',
  },
  {
    id: 72, category: '🏆 Points System',
    title: 'Gap-Based Points',
    description: 'Points are scaled based on your finishing gap to the winner. The closer you finish, the more you earn!',
    intensity: '🔥🔥',
  },
  {
    id: 73, category: '📋 Race Rule',
    title: 'Position Lock',
    description: 'Starting grid positions are locked for the first 5 laps. After that, everything is open!',
    intensity: '🔥',
  },
  {
    id: 74, category: '🏁 Race Format',
    title: 'Regional Teams',
    description: 'Drivers are split into regional teams. One representative races per team and team points are totaled.',
    intensity: '🔥🔥',
  },
  {
    id: 75, category: '🧠 Strategy & Psychology',
    title: 'Anonymous Grid',
    description: 'The grid is kept secret until the broadcast starts. Preparation disrupted!',
    intensity: '🔥🔥',
  },
  {
    id: 76, category: '🔀 Grid Chaos',
    title: 'Single File Start',
    description: 'The entire grid lines up in a single file — no side-by-side rows. First come, first served.',
    intensity: '🔥',
  },
  {
    id: 77, category: '🏆 Points System',
    title: 'Underdog Bonus',
    description: 'The bottom 3 drivers in the championship start this race with a +10 bonus points head start.',
    intensity: '🔥🔥',
  },
  {
    id: 78, category: '📋 Race Rule',
    title: 'Mandatory Position Defence',
    description: 'Every driver must actively defend their position for at least 3 consecutive laps during the race.',
    intensity: '🔥',
  },
  {
    id: 79, category: '🏁 Race Format',
    title: 'Head-to-Head Bracket',
    description: 'Drivers are split into 1v1 pairs. Each pair races independently, then winners meet in a final!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 80, category: '🧠 Strategy & Psychology',
    title: 'Detective Mode',
    description: 'After the race, the driver judged to have made the most tactical errors by the admin loses -5 points.',
    intensity: '🔥🔥',
  },
  {
    id: 81, category: '🔀 Grid Chaos',
    title: 'Last Week\'s Biggest Loser Gets Pole',
    description: 'The driver who lost the most positions in the previous race starts this race from pole!',
    intensity: '🔥🔥',
  },
  {
    id: 82, category: '🏆 Points System',
    title: 'No Points, Just Glory',
    description: 'This race awards zero championship points. But the winner\'s name is immortalised in OM history!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 83, category: '📋 Race Rule',
    title: 'No Early Retirement',
    description: 'Any driver who retires before lap 10 receives a 5-place grid penalty for the next race.',
    intensity: '🔥🔥',
  },
  {
    id: 84, category: '🏁 Race Format',
    title: 'Shuttle Race',
    description: 'Drivers race the track A → B, then B → A in reverse (if the game allows it). Back and forth chaos!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 85, category: '🧠 Strategy & Psychology',
    title: 'Silent Leader',
    description: 'The championship leader is banned from typing in Discord during the entire race. No comms for the top dog!',
    intensity: '🔥🔥',
  },
  {
    id: 86, category: '🔀 Grid Chaos',
    title: 'Roll the Dice',
    description: 'The admin rolls a live 1d20 dice. The result determines how many positions the top N drivers are shifted.',
    intensity: '🔥🔥🔥',
  },
  {
    id: 87, category: '🏆 Points System',
    title: 'Most Improved Bonus',
    description: 'The driver who gains the most championship points compared to last race earns a +10 bonus.',
    intensity: '🔥',
  },
  {
    id: 88, category: '📋 Race Rule',
    title: 'Zero Tolerance Track Limits',
    description: 'Any track limit violation results in an immediate position penalty this race. No steward review — instant action!',
    intensity: '🔥🔥',
  },
  {
    id: 89, category: '🏁 Race Format',
    title: 'Mystery Lap Count',
    description: 'The total number of laps is not revealed. The admin can wave the chequered flag at any moment!',
    intensity: '🔥🔥🔥',
  },
  {
    id: 90, category: '🧠 Strategy & Psychology',
    title: 'Captains Pick',
    description: 'The top 2 drivers in the championship become team captains and take turns picking their teammates.',
    intensity: '🔥🔥',
  },
  {
    id: 91, category: '🔀 Grid Chaos',
    title: 'Community Grid Vote',
    description: 'The community votes to determine the grid positions of 3 specific drivers. The rest line up normally.',
    intensity: '🔥🔥',
  },
  {
    id: 92, category: '🏆 Points System',
    title: 'First Blood Bonus',
    description: 'The driver who makes the first overtake of the race earns +8 bonus points. Who strikes first?',
    intensity: '🔥',
  },
  {
    id: 93, category: '📋 Race Rule',
    title: 'Sportsmanship Rule',
    description: 'Contact is not penalised during the race — but after the race, a community vote decides the "dirtiest" driver who loses -10 points.',
    intensity: '🔥🔥',
  },
  {
    id: 94, category: '🏁 Race Format',
    title: 'Mid-Season Opener',
    description: 'This race is officially declared the "Mid-Season Opener." The winner receives a special title and recognition!',
    intensity: '🔥',
  },
  {
    id: 95, category: '🧠 Strategy & Psychology',
    title: 'Rule Vote',
    description: 'Each driver proposes one rule. The most voted rule becomes law for this race!',
    intensity: '🔥🔥',
  },
  {
    id: 96, category: '🔀 Grid Chaos',
    title: 'Last-Minute Grid',
    description: 'The grid is only revealed exactly 2 minutes before the race starts. Are you ready?',
    intensity: '🔥🔥',
  },
  {
    id: 97, category: '🏆 Points System',
    title: 'Close Finish Bonus',
    description: 'If the gap between P1 and P2 is less than 5 seconds, both drivers earn an extra +5 bonus points!',
    intensity: '🔥',
  },
  {
    id: 98, category: '📋 Race Rule',
    title: 'Guardian Driver',
    description: 'The last-placed driver in the championship is assigned a "guardian." If the guardian leads them by more than 5 laps ahead, they earn +5 points.',
    intensity: '🔥🔥',
  },
  {
    id: 99, category: '🏁 Race Format',
    title: 'Mid-Season Finale',
    description: 'This race is the official "Mid-Season Finale." Hosted with a special announcement and prize ceremony!',
    intensity: '🔥',
  },
  {
    id: 100, category: '🧠 Strategy & Psychology',
    title: 'FULL CHAOS',
    description: '🎲 The admin randomly picks 3 rules from the pool and applies ALL OF THEM at once. Nobody is safe!',
    intensity: '🔥🔥🔥🔥',
  },
];

// Intensity → colour
function intensityColor(intensity) {
  const count = (intensity.match(/🔥/g) || []).length;
  if (count >= 4) return 0xFF0000; // red
  if (count === 3) return 0xFF6600; // orange-red
  if (count === 2) return 0xFFA500; // orange
  return 0xFFD700;                  // yellow
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chaoscall')
    .setDescription('🎲 Draws a random Chaos Call for the mid-season!')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('Pick a specific chaos ID (1-100). Leave empty for a random draw.')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('announce')
        .setDescription('Ping @everyone with the announcement? (default: false)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const chosenId   = interaction.options.getInteger('id');
    const shouldPing = interaction.options.getBoolean('announce') ?? false;

    // Pick chaos
    const chaos = chosenId
      ? CHAOS_POOL.find(c => c.id === chosenId)
      : CHAOS_POOL[Math.floor(Math.random() * CHAOS_POOL.length)];

    if (!chaos) {
      return interaction.reply({ content: '❌ Invalid chaos ID!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎲 CHAOS CALL #${chaos.id} — ${chaos.title}`)
      .setDescription(`> ${chaos.description}`)
      .addFields(
        { name: '📂 Category',  value: chaos.category, inline: true },
        { name: '🌡️ Intensity', value: chaos.intensity, inline: true },
        { name: '🏁 Season',    value: 'Mid-Season',    inline: true },
      )
      .setColor(intensityColor(chaos.intensity))
      .setFooter({ text: `Olzhasstik Motorsports • Chaos Pool: 100 scenarios` })
      .setTimestamp();

    const content = shouldPing ? '@everyone\n🚨 **CHAOS CALL ACTIVE!**' : '🚨 **CHAOS CALL ACTIVE!**';

    await interaction.reply({ content, embeds: [embed], allowedMentions: { parse: shouldPing ? ['everyone'] : [] } });
  },
};
