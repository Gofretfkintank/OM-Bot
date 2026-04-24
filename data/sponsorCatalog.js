// data/sponsorCatalog.js
// OM Sponsor Catalog — 25 sponsors, 4 tiers
// ─────────────────────────────────────────────────────────────────────────────
//
// TIER SYSTEM:
//   rookie   → Beginners (0-5 races, low performance)
//   midfield → Midfield (5+ races, reasonable stats)
//   top      → High performance (wins, podiums, low DNF)
//   elite    → Season champions, dominant drivers
//
// SCORE CALCULATION (sponsorScore):
//   A score between 0-100 is calculated for each driver:
//   - Win rate  × 35
//   - Podium rate × 25
//   - (1 - DNF rate) × 20
//   - Last 5 races trend × 20 (Better performance in recent races?)
//
// OFFER WEIGHTING:
//   Determines which tier offers a driver can receive based on their score.
//   The weight of each tier changes based on the driver's score.
//   Top-tier sponsors appear rarely (surprise factor).
//
// SPONSOR INCOME:
//   basePerRace   → Fixed coins per GP
//   winBonus      → Extra coins for 1st place
//   podiumBonus   → Extra coins for Top 3
//   sprintBonus   → Extra coins for Pole in Sprint
// ─────────────────────────────────────────────────────────────────────────────

const SPONSOR_CATALOG = [

    // ══════════════════════════════════════════════════════════════
    // TIER: rookie — Score: 0-30
    // Small brands for new drivers
    // ══════════════════════════════════════════════════════════════
    {
        id: 'go_energy',
        name: 'GO Energy',
        logo: '🔋',
        tier: 'rookie',
        description: 'Small energy drink brand. They heard of you and wish you luck.',
        basePerRace: 800,
        winBonus: 600,
        podiumBonus: 300,
        sprintBonus: 150,
        color: 0x00ff88,
        minScore: 0,
        maxScore: 45,
        weight: 100
    },
    {
        id: 'apex_gear',
        name: 'Apex Gear',
        logo: '⚙️',
        tier: 'rookie',
        description: 'Sim racing equipment brand. They believe in simulator players.',
        basePerRace: 700,
        winBonus: 500,
        podiumBonus: 250,
        sprintBonus: 100,
        color: 0x888888,
        minScore: 0,
        maxScore: 40,
        weight: 100
    },
    {
        id: 'turbo_snack',
        name: 'TurboSnack',
        logo: '🍔',
        tier: 'rookie',
        description: 'Fast snack chain. Supporting you even if you don\'t reach the podium.',
        basePerRace: 650,
        winBonus: 450,
        podiumBonus: 200,
        sprintBonus: 100,
        color: 0xff9900,
        minScore: 0,
        maxScore: 35,
        weight: 90
    },
    {
        id: 'grid_motors',
        name: 'Grid Motors',
        logo: '🚗',
        tier: 'rookie',
        description: 'Local car dealership. They watch every race live.',
        basePerRace: 750,
        winBonus: 550,
        podiumBonus: 280,
        sprintBonus: 120,
        color: 0x3399ff,
        minScore: 0,
        maxScore: 42,
        weight: 95
    },
    {
        id: 'pit_stop_cafe',
        name: 'Pit Stop Café',
        logo: '☕',
        tier: 'rookie',
        description: 'Motorsport themed cafe. They make your coffee in the team garage.',
        basePerRace: 600,
        winBonus: 400,
        podiumBonus: 200,
        sprintBonus: 80,
        color: 0x8B4513,
        minScore: 0,
        maxScore: 38,
        weight: 85
    },
    {
        id: 'slipstream_tech',
        name: 'Slipstream Tech',
        logo: '💻',
        tier: 'rookie',
        description: 'Small software company. Obsessed with telemetry analysis.',
        basePerRace: 850,
        winBonus: 650,
        podiumBonus: 320,
        sprintBonus: 160,
        color: 0x6600cc,
        minScore: 5,
        maxScore: 50,
        weight: 80
    },

    // ══════════════════════════════════════════════════════════════
    // TIER: midfield — Score: 20-60
    // Recognized brands, stable drivers
    // ══════════════════════════════════════════════════════════════
    {
        id: 'racefuel_pro',
        name: 'RaceFuel Pro',
        logo: '⛽',
        tier: 'midfield',
        description: 'Professional fuel additive brand. By your side during pit stops.',
        basePerRace: 1300,
        winBonus: 1000,
        podiumBonus: 550,
        sprintBonus: 250,
        color: 0xff4400,
        minScore: 20,
        maxScore: 70,
        weight: 90
    },
    {
        id: 'velocity_wear',
        name: 'Velocity Wear',
        logo: '👕',
        tier: 'midfield',
        description: 'Motorsport apparel brand. They design your racing gear.',
        basePerRace: 1200,
        winBonus: 900,
        podiumBonus: 500,
        sprintBonus: 220,
        color: 0xff0066,
        minScore: 18,
        maxScore: 65,
        weight: 90
    },
    {
        id: 'carbon_tech',
        name: 'Carbon Tech',
        logo: '🔩',
        tier: 'midfield',
        description: 'Lightweight carbon fiber parts manufacturer. Focused on performance.',
        basePerRace: 1400,
        winBonus: 1100,
        podiumBonus: 600,
        sprintBonus: 280,
        color: 0x222222,
        minScore: 25,
        maxScore: 72,
        weight: 85
    },
    {
        id: 'omega_tyres',
        name: 'Omega Tyres',
        logo: '🏎️',
        tier: 'midfield',
        description: 'Tire simulation company optimized for professional simulators.',
        basePerRace: 1500,
        winBonus: 1200,
        podiumBonus: 650,
        sprintBonus: 300,
        color: 0xffcc00,
        minScore: 22,
        maxScore: 68,
        weight: 85
    },
    {
        id: 'delta_drinks',
        name: 'Delta Drinks',
        logo: '🥤',
        tier: 'midfield',
        description: 'Mid-sized beverage brand. Wants to appear in podium photos.',
        basePerRace: 1250,
        winBonus: 950,
        podiumBonus: 520,
        sprintBonus: 240,
        color: 0x0066ff,
        minScore: 20,
        maxScore: 66,
        weight: 88
    },
    {
        id: 'hyperline_bet',
        name: 'Hyperline',
        logo: '📊',
        tier: 'midfield',
        description: 'Motorsport analytics platform. Your data is valuable to them.',
        basePerRace: 1450,
        winBonus: 1150,
        podiumBonus: 620,
        sprintBonus: 270,
        color: 0x33ccff,
        minScore: 28,
        maxScore: 75,
        weight: 82
    },
    {
        id: 'torque_bank',
        name: 'Torque Bank',
        logo: '🏦',
        tier: 'midfield',
        description: 'Motorsport-focused financial services. They expect an ROI.',
        basePerRace: 1600,
        winBonus: 1300,
        podiumBonus: 700,
        sprintBonus: 320,
        color: 0x006633,
        minScore: 30,
        maxScore: 78,
        weight: 80
    },

    // ══════════════════════════════════════════════════════════════
    // TIER: top — Score: 45-85
    // Major brands, winning drivers
    // ══════════════════════════════════════════════════════════════
    {
        id: 'red_lightning',
        name: 'Red Lightning',
        logo: '⚡',
        tier: 'top',
        description: 'Major energy drink brand. Sponsors only winners.',
        basePerRace: 2200,
        winBonus: 1800,
        podiumBonus: 900,
        sprintBonus: 450,
        color: 0xff0000,
        minScore: 45,
        maxScore: 100,
        weight: 75
    },
    {
        id: 'black_arrow',
        name: 'Black Arrow',
        logo: '🏹',
        tier: 'top',
        description: 'Luxury watch brand. Chose you for your podium visibility.',
        basePerRace: 2400,
        winBonus: 2000,
        podiumBonus: 1000,
        sprintBonus: 500,
        color: 0x111111,
        minScore: 48,
        maxScore: 100,
        weight: 72
    },
    {
        id: 'kronos_auto',
        name: 'Kronos Auto',
        logo: '🚘',
        tier: 'top',
        description: 'Premium automobile brand. Seeking prestige on the racetrack.',
        basePerRace: 2600,
        winBonus: 2200,
        podiumBonus: 1100,
        sprintBonus: 550,
        color: 0xcc9900,
        minScore: 50,
        maxScore: 100,
        weight: 70
    },
    {
        id: 'neon_hypertech',
        name: 'Neon HyperTech',
        logo: '🌐',
        tier: 'top',
        description: 'Technology giant expanding its sponsorship portfolio.',
        basePerRace: 2500,
        winBonus: 2100,
        podiumBonus: 1050,
        sprintBonus: 520,
        color: 0x00ffcc,
        minScore: 47,
        maxScore: 100,
        weight: 73
    },
    {
        id: 'axiom_finance',
        name: 'Axiom Finance',
        logo: '💎',
        tier: 'top',
        description: 'International investment fund looking for track visibility.',
        basePerRace: 2800,
        winBonus: 2400,
        podiumBonus: 1200,
        sprintBonus: 600,
        color: 0x4444ff,
        minScore: 52,
        maxScore: 100,
        weight: 68
    },
    {
        id: 'phantom_racing',
        name: 'Phantom Racing Parts',
        logo: '👻',
        tier: 'top',
        description: 'High-performance sim parts manufacturer funding elite drivers.',
        basePerRace: 2700,
        winBonus: 2300,
        podiumBonus: 1150,
        sprintBonus: 570,
        color: 0x9900ff,
        minScore: 49,
        maxScore: 100,
        weight: 70
    },

    // ══════════════════════════════════════════════════════════════
    // TIER: elite — Score: 70-100
    // For the very best, rare offers
    // ══════════════════════════════════════════════════════════════
    {
        id: 'scuderia_prime',
        name: 'Scuderia Prime',
        logo: '🐎',
        tier: 'elite',
        description: 'Italian motorsports foundation. Opens doors only to champions.',
        basePerRace: 4000,
        winBonus: 3500,
        podiumBonus: 1750,
        sprintBonus: 800,
        color: 0xff2200,
        minScore: 70,
        maxScore: 100,
        weight: 60
    },
    {
        id: 'zenith_global',
        name: 'Zenith Global',
        logo: '🌍',
        tier: 'elite',
        description: 'Globally recognized brand. Interested only if stats are perfect.',
        basePerRace: 4500,
        winBonus: 4000,
        podiumBonus: 2000,
        sprintBonus: 900,
        color: 0x0033cc,
        minScore: 72,
        maxScore: 100,
        weight: 55
    },
    {
        id: 'apex_one',
        name: 'APEX ONE',
        logo: '🏆',
        tier: 'elite',
        description: 'The most prestigious sponsor in motorsports. Congratulations.',
        basePerRace: 5000,
        winBonus: 4500,
        podiumBonus: 2250,
        sprintBonus: 1000,
        color: 0xffd700,
        minScore: 75,
        maxScore: 100,
        weight: 50
    },
    {
        id: 'stellar_motorsport',
        name: 'Stellar Motorsport',
        logo: '⭐',
        tier: 'elite',
        description: 'Choice of world champions. Let your performance speak.',
        basePerRace: 4800,
        winBonus: 4200,
        podiumBonus: 2100,
        sprintBonus: 950,
        color: 0xffaa00,
        minScore: 73,
        maxScore: 100,
        weight: 52
    },
    {
        id: 'dominion_racing',
        name: 'Dominion Racing',
        logo: '👑',
        tier: 'elite',
        description: 'Oldest foundation in motorsport history. They only sponsor legends.',
        basePerRace: 6000,
        winBonus: 5000,
        podiumBonus: 2500,
        sprintBonus: 1200,
        color: 0xcc0000,
        minScore: 78,
        maxScore: 100,
        weight: 45
    }
];

// ── Tier colors (for embeds) ──────────────────────────────────────────────
const TIER_COLORS = {
    rookie:   0x888888,
    midfield: 0x3399ff,
    top:      0xff9900,
    elite:    0xffd700
};

const TIER_LABELS = {
    rookie:   '⚪ Rookie',
    midfield: '🔵 Midfield',
    top:      '🟠 Top Team',
    elite:    '🟡 Elite'
};

// ── Score Calculation ─────────────────────────────────────────────────────────
// Driver model: races, wins, podiums, poles, dnf, wdc, doty
// raceHistory: Positions of the last 5 races
//
// SCORE (0-100):
//   Win rate:    (wins / races) * 35        → max 35 points
//   Podium rate: (podiums / races) * 25     → max 25 points
//   DNF Penalty: (1 - dnf/races) * 20      → max 20 points
//   Trend:       Last 5 race trend * 20     → max 20 points
//   WDC bonus:   +5 (if champion)
//   DOTY bonus:  +3 (if doty winner)
// ─────────────────────────────────────────────────────────────────────────────

function calcDriverScore(driver) {
    const races = driver.races || 0;

    // New driver → minimum score
    if (races === 0) return 0;

    const winRate    = (driver.wins    || 0) / races;
    const podiumRate = (driver.podiums || 0) / races;
    const dnfRate    = (driver.dnf     || 0) / races;

    let score = 0;
    score += winRate    * 35;
    score += podiumRate * 25;
    score += (1 - Math.min(dnfRate, 1)) * 20;

    // Trend: Positions of last 5 races (1=Best, 10=Worst, 99=DNF)
    const history = (driver.raceHistory || []).slice(-5);
    if (history.length > 0) {
        // Position score mapping
        const posScore = (pos) => {
            if (pos === 1)  return 10;
            if (pos === 2)  return 8;
            if (pos === 3)  return 7;
            if (pos <= 5)   return 4;
            if (pos <= 10)  return 2;
            return 0; // DNF or out of points
        };

        const avgTrend = history.reduce((sum, r) => sum + posScore(r.pos), 0) / history.length;
        score += (avgTrend / 10) * 20; // Normalize
    }

    // Bonuses
    if ((driver.wdc || 0) > 0) score += 5;
    if ((driver.doty || 0) > 0) score += 3;

    return Math.min(100, Math.max(0, score));
}

// ── Offer Generation ───────────────────────────────────────────────────────
// Choose 3 weighted random sponsors based on driver score
function generateOffers(driver) {
    const score = calcDriverScore(driver);

    // Evaluate each sponsor: is it in range and what is the weight?
    const eligible = SPONSOR_CATALOG.map(sponsor => {
        const inRange = score >= sponsor.minScore;

        if (!inRange) return null;

        const tierOrder = ['rookie', 'midfield', 'top', 'elite'];
        const sponsorTierIdx = tierOrder.indexOf(sponsor.tier);

        // Determine driver's tier level
        let driverTierIdx;
        if (score < 25)      driverTierIdx = 0; // rookie
        else if (score < 50) driverTierIdx = 1; // midfield
        else if (score < 72) driverTierIdx = 2; // top
        else                 driverTierIdx = 3; // elite

        const tierDiff = sponsorTierIdx - driverTierIdx;

        let adjustedWeight = sponsor.weight;
        if (tierDiff === 1)  adjustedWeight *= 0.25; // Next tier: 25% chance
        if (tierDiff >= 2)   adjustedWeight *= 0.05; // 2+ tiers up: 5% chance
        if (tierDiff < 0)    adjustedWeight *= 0.60; // Lower tier: 60% weight

        return { sponsor, weight: adjustedWeight };
    }).filter(Boolean);

    if (eligible.length === 0) return [];

    // Weighted random selection (3 unique sponsors)
    const selected = [];
    const remaining = [...eligible];

    for (let i = 0; i < 3 && remaining.length > 0; i++) {
        const totalWeight = remaining.reduce((s, e) => s + e.weight, 0);
        let rand = Math.random() * totalWeight;

        for (let j = 0; j < remaining.length; j++) {
            rand -= remaining[j].weight;
            if (rand <= 0) {
                selected.push(remaining[j].sponsor);
                remaining.splice(j, 1);
                break;
            }
        }
    }

    return selected;
}

// ── Find Sponsor by ID ─────────────────────────────────────────────
function getSponsorById(id) {
    return SPONSOR_CATALOG.find(s => s.id === id) ?? null;
}

module.exports = {
    SPONSOR_CATALOG,
    TIER_COLORS,
    TIER_LABELS,
    calcDriverScore,
    generateOffers,
    getSponsorById
};
