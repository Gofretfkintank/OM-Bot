//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder } = require('discord.js');

//--------------------------------
// SABIT: Yarış saati (PKT = UTC+5)
// Her zaman 18:00 PKT = 13:00 UTC
//--------------------------------
const RACE_HOUR_UTC = 13; // 18:00 PKT

//--------------------------------
// ÜLKE → IANA TIMEZONE EŞLEŞMELERİ
//--------------------------------
const COUNTRY_TIMEZONES = {
    // A
    afghanistan: 'Asia/Kabul',
    albania: 'Europe/Tirane',
    algeria: 'Africa/Algiers',
    andorra: 'Europe/Andorra',
    angola: 'Africa/Luanda',
    'antigua and barbuda': 'America/Antigua',
    argentina: 'America/Argentina/Buenos_Aires',
    armenia: 'Asia/Yerevan',
    australia: 'Australia/Sydney',
    austria: 'Europe/Vienna',
    azerbaijan: 'Asia/Baku',

    // B
    bahamas: 'America/Nassau',
    bahrain: 'Asia/Bahrain',
    bangladesh: 'Asia/Dhaka',
    barbados: 'America/Barbados',
    belarus: 'Europe/Minsk',
    belgium: 'Europe/Brussels',
    belize: 'America/Belize',
    benin: 'Africa/Porto-Novo',
    bhutan: 'Asia/Thimphu',
    bolivia: 'America/La_Paz',
    'bosnia and herzegovina': 'Europe/Sarajevo',
    botswana: 'Africa/Gaborone',
    brazil: 'America/Sao_Paulo',
    brunei: 'Asia/Brunei',
    bulgaria: 'Europe/Sofia',
    'burkina faso': 'Africa/Ouagadougou',
    burundi: 'Africa/Bujumbura',

    // C
    'cabo verde': 'Atlantic/Cape_Verde',
    'cape verde': 'Atlantic/Cape_Verde',
    cambodia: 'Asia/Phnom_Penh',
    cameroon: 'Africa/Douala',
    canada: 'America/Toronto',
    'central african republic': 'Africa/Bangui',
    chad: 'Africa/Ndjamena',
    chile: 'America/Santiago',
    china: 'Asia/Shanghai',
    colombia: 'America/Bogota',
    comoros: 'Indian/Comoro',
    congo: 'Africa/Brazzaville',
    'costa rica': 'America/Costa_Rica',
    croatia: 'Europe/Zagreb',
    cuba: 'America/Havana',
    cyprus: 'Asia/Nicosia',
    'czech republic': 'Europe/Prague',
    czechia: 'Europe/Prague',
    czech: 'Europe/Prague',

    // D
    denmark: 'Europe/Copenhagen',
    djibouti: 'Africa/Djibouti',
    dominica: 'America/Dominica',
    'dominican republic': 'America/Santo_Domingo',
    'dr congo': 'Africa/Kinshasa',

    // E
    ecuador: 'America/Guayaquil',
    egypt: 'Africa/Cairo',
    'el salvador': 'America/El_Salvador',
    'equatorial guinea': 'Africa/Malabo',
    eritrea: 'Africa/Asmara',
    estonia: 'Europe/Tallinn',
    eswatini: 'Africa/Mbabane',
    ethiopia: 'Africa/Addis_Ababa',

    // F
    fiji: 'Pacific/Fiji',
    finland: 'Europe/Helsinki',
    france: 'Europe/Paris',

    // G
    gabon: 'Africa/Libreville',
    gambia: 'Africa/Banjul',
    georgia: 'Asia/Tbilisi',
    germany: 'Europe/Berlin',
    ghana: 'Africa/Accra',
    greece: 'Europe/Athens',
    grenada: 'America/Grenada',
    guatemala: 'America/Guatemala',
    guinea: 'Africa/Conakry',
    'guinea-bissau': 'Africa/Bissau',
    guyana: 'America/Guyana',

    // H
    haiti: 'America/Port-au-Prince',
    honduras: 'America/Tegucigalpa',
    hungary: 'Europe/Budapest',
    'hong kong': 'Asia/Hong_Kong',

    // I
    iceland: 'Atlantic/Reykjavik',
    india: 'Asia/Kolkata',
    indonesia: 'Asia/Jakarta',
    iran: 'Asia/Tehran',
    iraq: 'Asia/Baghdad',
    ireland: 'Europe/Dublin',
    israel: 'Asia/Jerusalem',
    italy: 'Europe/Rome',
    'ivory coast': 'Africa/Abidjan',

    // J
    jamaica: 'America/Jamaica',
    japan: 'Asia/Tokyo',
    jordan: 'Asia/Amman',

    // K
    kazakhstan: 'Asia/Almaty',
    kenya: 'Africa/Nairobi',
    kiribati: 'Pacific/Tarawa',
    kuwait: 'Asia/Kuwait',
    kyrgyzstan: 'Asia/Bishkek',
    kosovo: 'Europe/Belgrade',

    // L
    laos: 'Asia/Vientiane',
    latvia: 'Europe/Riga',
    lebanon: 'Asia/Beirut',
    lesotho: 'Africa/Maseru',
    liberia: 'Africa/Monrovia',
    libya: 'Africa/Tripoli',
    liechtenstein: 'Europe/Vaduz',
    lithuania: 'Europe/Vilnius',
    luxembourg: 'Europe/Luxembourg',

    // M
    madagascar: 'Indian/Antananarivo',
    malawi: 'Africa/Blantyre',
    malaysia: 'Asia/Kuala_Lumpur',
    maldives: 'Indian/Maldives',
    mali: 'Africa/Bamako',
    malta: 'Europe/Malta',
    'marshall islands': 'Pacific/Majuro',
    mauritania: 'Africa/Nouakchott',
    mauritius: 'Indian/Mauritius',
    mexico: 'America/Mexico_City',
    micronesia: 'Pacific/Pohnpei',
    moldova: 'Europe/Chisinau',
    monaco: 'Europe/Monaco',
    mongolia: 'Asia/Ulaanbaatar',
    montenegro: 'Europe/Podgorica',
    morocco: 'Africa/Casablanca',
    mozambique: 'Africa/Maputo',
    myanmar: 'Asia/Rangoon',
    macau: 'Asia/Macau',

    // N
    namibia: 'Africa/Windhoek',
    nauru: 'Pacific/Nauru',
    nepal: 'Asia/Kathmandu',
    netherlands: 'Europe/Amsterdam',
    'new zealand': 'Pacific/Auckland',
    nicaragua: 'America/Managua',
    niger: 'Africa/Niamey',
    nigeria: 'Africa/Lagos',
    'north korea': 'Asia/Pyongyang',
    northkorea: 'Asia/Pyongyang',
    'north macedonia': 'Europe/Skopje',
    norway: 'Europe/Oslo',

    // O
    oman: 'Asia/Muscat',

    // P
    pakistan: 'Asia/Karachi',
    palestine: 'Asia/Gaza',
    palau: 'Pacific/Palau',
    panama: 'America/Panama',
    'papua new guinea': 'Pacific/Port_Moresby',
    paraguay: 'America/Asuncion',
    peru: 'America/Lima',
    philippines: 'Asia/Manila',
    poland: 'Europe/Warsaw',
    portugal: 'Europe/Lisbon',

    // Q
    qatar: 'Asia/Qatar',

    // R
    romania: 'Europe/Bucharest',
    russia: 'Europe/Moscow',
    rwanda: 'Africa/Kigali',

    // S
    'saint kitts and nevis': 'America/St_Kitts',
    'saint lucia': 'America/St_Lucia',
    'saint vincent and the grenadines': 'America/St_Vincent',
    samoa: 'Pacific/Apia',
    'san marino': 'Europe/San_Marino',
    'sao tome and principe': 'Africa/Sao_Tome',
    'saudi arabia': 'Asia/Riyadh',
    senegal: 'Africa/Dakar',
    serbia: 'Europe/Belgrade',
    seychelles: 'Indian/Mahe',
    'sierra leone': 'Africa/Freetown',
    singapore: 'Asia/Singapore',
    slovakia: 'Europe/Bratislava',
    slovenia: 'Europe/Ljubljana',
    'solomon islands': 'Pacific/Guadalcanal',
    somalia: 'Africa/Mogadishu',
    'south africa': 'Africa/Johannesburg',
    'south korea': 'Asia/Seoul',
    southkorea: 'Asia/Seoul',
    'south sudan': 'Africa/Juba',
    spain: 'Europe/Madrid',
    'sri lanka': 'Asia/Colombo',
    sudan: 'Africa/Khartoum',
    suriname: 'America/Paramaribo',
    sweden: 'Europe/Stockholm',
    switzerland: 'Europe/Zurich',
    syria: 'Asia/Damascus',

    // T
    taiwan: 'Asia/Taipei',
    tajikistan: 'Asia/Dushanbe',
    tanzania: 'Africa/Dar_es_Salaam',
    thailand: 'Asia/Bangkok',
    'timor-leste': 'Asia/Dili',
    togo: 'Africa/Lome',
    tonga: 'Pacific/Tongatapu',
    'trinidad and tobago': 'America/Port_of_Spain',
    tunisia: 'Africa/Tunis',
    turkey: 'Europe/Istanbul',
    turkiye: 'Europe/Istanbul',
    'türkiye': 'Europe/Istanbul',
    turkmenistan: 'Asia/Ashgabat',
    tuvalu: 'Pacific/Funafuti',

    // U
    uganda: 'Africa/Kampala',
    ukraine: 'Europe/Kyiv',
    'united arab emirates': 'Asia/Dubai',
    uae: 'Asia/Dubai',
    'united kingdom': 'Europe/London',
    uk: 'Europe/London',
    england: 'Europe/London',
    scotland: 'Europe/London',
    wales: 'Europe/London',
    'united states': 'America/New_York',
    usa: 'America/New_York',
    uruguay: 'America/Montevideo',
    uzbekistan: 'Asia/Tashkent',

    // V
    vanuatu: 'Pacific/Efate',
    venezuela: 'America/Caracas',
    vietnam: 'Asia/Ho_Chi_Minh',
    vatican: 'Europe/Rome',

    // W
    'western sahara': 'Africa/El_Aaiun',

    // Y
    yemen: 'Asia/Aden',

    // Z
    zambia: 'Africa/Lusaka',
    zimbabwe: 'Africa/Harare',
};

//--------------------------------
// YARDIMCI: Ülke/timezone inputundan IANA timezone çöz
// Hem COUNTRY_TIMEZONES map'ini hem IANA isimlerini destekler
//--------------------------------
function resolveTimezone(input) {
    const lower = input.trim().toLowerCase();

    // 1) Direkt ülke map'i
    if (COUNTRY_TIMEZONES[lower]) return COUNTRY_TIMEZONES[lower];

    // 2) Partial ülke eşleşmesi
    const countryMatch = Object.keys(COUNTRY_TIMEZONES)
        .find(k => k.includes(lower) || lower.includes(k));
    if (countryMatch) return COUNTRY_TIMEZONES[countryMatch];

    // 3) IANA timezone adı olarak dene (örn. "Europe/Istanbul", "UTC+3", "EST" vb.)
    //    Intl.DateTimeFormat ile doğrula
    const ianaCandidate = input.trim(); // orijinal büyük/küçük harfleri koru
    try {
        Intl.DateTimeFormat('en-US', { timeZone: ianaCandidate });
        return ianaCandidate; // geçerliyse direkt kullan
    } catch {
        // geçersiz IANA adı
    }

    // 4) UTC±X formatı (örn. "utc+3", "gmt-5", "+05:30")
    const utcMatch = lower.match(/^(?:utc|gmt)?([+-]\d{1,2}(?::\d{2})?)$/);
    if (utcMatch) {
        // Intl.DateTimeFormat UTC offset'i direkt desteklemez,
        // Etc/GMT±X ile yaklaşık map'le (dakika offsetleri desteklenmez)
        const offsetStr = utcMatch[1];
        const hourMatch = offsetStr.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
        if (hourMatch) {
            const sign = hourMatch[1];
            const hours = parseInt(hourMatch[2], 10);
            // Etc/GMT işareti ters çalışır (Etc/GMT+5 = UTC-5)
            const etcSign = sign === '+' ? '-' : '+';
            const etcName = `Etc/GMT${etcSign}${hours}`;
            try {
                Intl.DateTimeFormat('en-US', { timeZone: etcName });
                return etcName;
            } catch {
                // geçersiz
            }
        }
    }

    return null;
}

//--------------------------------
// YARDIMCI: Belirli bir timezone'da saati formatla
//--------------------------------
function getTimeInZone(utcHour, utcMinute, timezone) {
    const now = new Date();
    const raceUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        utcHour,
        utcMinute,
        0
    ));

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        weekday: 'short'
    });

    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset'
    });

    const parts = offsetFormatter.formatToParts(raceUTC);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const offsetMatch = tzName.match(/GMT([+-]\d{1,2}(?::\d{2})?)?/);

    let offsetStr = 'UTC+0';
    if (offsetMatch) {
        offsetStr = offsetMatch[0].replace('GMT', 'UTC');
        if (offsetStr === 'UTC') offsetStr = 'UTC+0';
    }

    return {
        localTime: formatter.format(raceUTC),
        offset: offsetStr,
        timestamp: Math.floor(raceUTC.getTime() / 1000)
    };
}

//--------------------------------
// KOMUT
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('racetime')
        .setDescription('Shows the race time (6 PM PKT) in any country\'s local time')
        .addStringOption(opt =>
            opt.setName('country')
                .setDescription('Country name (e.g. italy, germany, usa)')
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName('hour')
                .setDescription('Custom PKT hour (default: 18)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(23)
        )
        .addIntegerOption(opt =>
            opt.setName('minute')
                .setDescription('Custom PKT minute (default: 0)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(59)
        )
        .addStringOption(opt =>
            opt.setName('to_tz')
                .setDescription('Also show time in another timezone (country name, IANA zone, or UTC offset e.g. UTC+3)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const countryInput = interaction.options.getString('country').trim().toLowerCase();
        const pktHour = interaction.options.getInteger('hour') ?? 18;
        const pktMinute = interaction.options.getInteger('minute') ?? 0;
        const toTzInput = interaction.options.getString('to_tz');

        const utcHour = ((pktHour - 5) % 24 + 24) % 24;
        const utcMinute = pktMinute;

        // Ana ülke timezone'u çöz
        let timezone = resolveTimezone(countryInput);

        if (!timezone) {
            const suggestions = Object.keys(COUNTRY_TIMEZONES)
                .filter(k => k.startsWith(countryInput[0]))
                .slice(0, 5)
                .map(k => `\`${k}\``)
                .join(', ');

            return interaction.reply({
                content: `❌ **"${countryInput}"** not found.\n${suggestions ? `💡 Maybe: ${suggestions}` : ''}`,
                ephemeral: true
            });
        }

        let timeData;
        try {
            timeData = getTimeInZone(utcHour, utcMinute, timezone);
        } catch {
            return interaction.reply({
                content: `⚠️ Could not calculate time for **${countryInput}**.`,
                ephemeral: true
            });
        }

        const displayCountry = countryInput
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        const pktDisplay = `${String(pktHour).padStart(2, '0')}:${String(pktMinute).padStart(2, '0')} PKT`;

        // Embed fields oluştur
        const fields = [
            {
                name: '🕐 Local Time',
                value: `**${timeData.localTime}**`,
                inline: true
            },
            {
                name: '🌍 Timezone',
                value: `\`${timeData.offset}\``,
                inline: true
            },
            {
                name: '⏰ Discord Timestamp',
                value: `<t:${timeData.timestamp}:t> (<t:${timeData.timestamp}:R>)`,
                inline: false
            }
        ];

        // to_tz opsiyonu varsa ekle
        if (toTzInput) {
            const toTzResolved = resolveTimezone(toTzInput);

            if (!toTzResolved) {
                // to_tz bulunamadıysa uyarı ver ama ana sonucu yine de göster
                fields.push({
                    name: '⚠️ to_tz Not Found',
                    value: `\`${toTzInput}\` could not be resolved. Try a country name, IANA zone (e.g. \`Europe/Berlin\`), or offset (e.g. \`UTC+3\`).`,
                    inline: false
                });
            } else {
                let toTzData;
                try {
                    toTzData = getTimeInZone(utcHour, utcMinute, toTzResolved);
                } catch {
                    fields.push({
                        name: '⚠️ to_tz Error',
                        value: `Could not calculate time for \`${toTzInput}\`.`,
                        inline: false
                    });
                }

                if (toTzData) {
                    // to_tz display adı: orijinal input'u güzelleştir
                    const displayToTz = toTzInput.trim()
                        .split(' ')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');

                    fields.push(
                        { name: '\u200b', value: '─────────────────', inline: false },
                        {
                            name: `🌐 Also in ${displayToTz}`,
                            value: `**${toTzData.localTime}**`,
                            inline: true
                        },
                        {
                            name: '🌍 Timezone',
                            value: `\`${toTzData.offset}\``,
                            inline: true
                        }
                    );
                }
            }
        }

        await interaction.reply({
            embeds: [{
                color: 0xe8003d,
                title: '🏁 Race Time Converter',
                description: `The race starts at **${pktDisplay}** (Pakistan Time)\nFor **${displayCountry}**:`,
                fields,
                footer: {
                    text: 'Default: 6:00 PM PKT (UTC+5)'
                }
            }]
        });
    }
};
