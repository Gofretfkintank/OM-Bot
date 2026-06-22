// services/learner.js
// ─────────────────────────────────────────────────────────────────────────────
// Ommy Active Learning — Claude Sonnet 4.6 ile kanal taraması
//
// • Kanalları tarar, mesajları Claude'a gönderir
// • Claude yapılandırılmış JSON döndürür (kategori + fact + confidence)
// • OmKnowledge MongoDB koleksiyonuna yazar (upsert + merge)
// • getKnowledgeContext() → ommy.js system prompt'una inject için
// ─────────────────────────────────────────────────────────────────────────────

const OmKnowledge = require('../models/OmKnowledge');
const { ChannelType } = require('discord.js');

const MAX_MESSAGES_PER_CHANNEL = 80;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// ── Claude API çağrısı (native fetch, SDK gerektirmez) ─────────────────────
async function callClaude(systemPrompt, userPrompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY env var eksik.');

    const res = await fetch(CLAUDE_API_URL, {
        method:  'POST',
        headers: {
            'Content-Type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model:      'claude-sonnet-4-6',
            max_tokens: 2048,
            system:     systemPrompt,
            messages:   [{ role: 'user', content: userPrompt }],
        }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
}

// ── Tek kanaldan bilgi çıkar ────────────────────────────────────────────────
async function learnFromMessages(channelName, channelId, messages) {
    if (messages.length === 0) return [];

    const messagesText = messages
        .slice(0, 60)
        .map(m => `[${m.isStaff ? 'STAFF' : 'ÜYE'}] ${m.author}: ${m.content}`)
        .join('\n');

    const system = `Sen Olzhasstik Motorsports (OM) Discord sunucusu için bilgi çıkarma asistanısın.
Discord kanallarındaki mesajlardan sunucu hakkında kalıcı, yapılandırılmış bilgiler çıkarıyorsun.

ÇIKAR:
- Kayıt / katılım süreci
- Yarış formatı ve nasıl işlediği
- Sunucu / yarış kuralları, ceza sistemi
- Etkinlik programı, yarış günleri
- Roller ve anlamları
- Kanalların amaçları
- Puan/ekonomi sistemi
- Genel sunucu bilgisi

ÇIKARMA:
- Günlük sohbet, selamlama, geçici tartışmalar
- Yarış sonuçları veya anlık haberler
- Kişisel mesajlar

KURALLAR:
- Sadece mesajlarda açıkça söylenen şeyleri yaz, yorum yapma
- Her fact Türkçe, net, 1-3 cümle max
- Confidence: staffin yazdıysa 0.9+, üyenin yazdıysa 0.7
- Öğrenilecek kalıcı bilgi yoksa boş dizi döndür

SADECE geçerli JSON döndür, başka hiçbir şey yazma:
{
  "knowledge": [
    {
      "category": "registration",
      "key": "how_to_register",
      "fact": "Sunucuya katılmak için sunucudaki #kayıt kanalına gidip /register komutunu kullanmanız gerekiyor.",
      "confidence": 0.9
    }
  ]
}

Kategoriler: registration | race_format | rules | schedule | roles | channels | economy | general`;

    const user = `Kanal: #${channelName}\n\nMesajlar:\n${messagesText}`;

    try {
        const raw  = await callClaude(system, user);
        // JSON bloğunu çıkar (markdown fence varsa temizle)
        const json = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(json);

        return (parsed.knowledge || []).map(item => ({
            ...item,
            sources: [{
                channelId,
                channelName,
                messageSnippet: messages[0]?.content?.slice(0, 120) || '',
            }],
        }));
    } catch (err) {
        console.error(`[LEARNER] #${channelName} parse hatası:`, err.message);
        return [];
    }
}

// ── Knowledge'ı MongoDB'ye yaz (upsert + merge) ────────────────────────────
async function saveKnowledge(guildId, items) {
    let saved = 0, updated = 0;

    for (const item of items) {
        if (!item.key || !item.fact || !item.category) continue;

        const compositeKey = `${item.category}:${item.key}`;

        try {
            const existing = await OmKnowledge.findOne({ guildId, key: compositeKey });

            if (existing) {
                // Yüksek confidence varsa fact'i güncelle
                if ((item.confidence || 0.7) >= (existing.confidence || 0)) {
                    existing.fact       = item.fact;
                    existing.confidence = item.confidence || 0.7;
                }
                // Kaynakları merge et (duplicate'siz)
                const incoming = item.sources || [];
                for (const src of incoming) {
                    if (!existing.sources.find(s => s.channelId === src.channelId)) {
                        existing.sources.push(src);
                    }
                }
                existing.sources = existing.sources.slice(0, 5);
                await existing.save();
                updated++;
            } else {
                await OmKnowledge.create({
                    guildId,
                    category:   item.category,
                    key:        compositeKey,
                    fact:       item.fact,
                    confidence: item.confidence || 0.7,
                    sources:    item.sources || [],
                    active:     true,
                });
                saved++;
            }
        } catch (err) {
            if (err.code === 11000) {
                // Race condition: unique index çakışması — güvenle atla
            } else {
                console.error('[LEARNER] Kayıt hatası:', err.message);
            }
        }
    }

    return { saved, updated };
}

// ── Ana öğrenme fonksiyonu ──────────────────────────────────────────────────
// @param guild         Discord Guild objesi
// @param channelFilter "all" veya kanal ismi substring'i
// @param onProgress    (string) => void  — ilerleme callback'i
async function learnFromGuild(guild, channelFilter = 'all', onProgress = null) {
    if (!process.env.CLAUDE_API_KEY) {
        if (onProgress) onProgress('❌ `CLAUDE_API_KEY` Railway env\'de tanımlı değil.');
        return { error: 'CLAUDE_API_KEY missing' };
    }

    await guild.channels.fetch().catch(() => {});

    // Öncelikli kanallar: kural, duyuru, bilgi, kayıt, rehber kanalları öne al
    const priorityKeywords = [
        'kural', 'rule', 'bilgi', 'info', 'duyuru', 'announce',
        'kayıt', 'register', 'rehber', 'guide', 'hakkında', 'about',
        'genel', 'general', 'takvim', 'schedule', 'format', 'nasıl', 'how', 'faq',
    ];

    let targetChannels = [...guild.channels.cache.values()].filter(c =>
        c.isTextBased() && !c.isThread()
    );

    if (channelFilter !== 'all') {
        targetChannels = targetChannels.filter(c =>
            c.name.toLowerCase().includes(channelFilter.toLowerCase())
        );
    }

    // Öncelikli kanallar öne al, max 15
    targetChannels.sort((a, b) => {
        const aP = priorityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 0 : 1;
        const bP = priorityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 0 : 1;
        return aP - bP;
    });
    targetChannels = targetChannels.slice(0, 15);

    if (targetChannels.length === 0) {
        if (onProgress) onProgress('❌ Taranacak kanal bulunamadı.');
        return { error: 'No channels found' };
    }

    if (onProgress) onProgress(`📡 ${targetChannels.length} kanal taranacak...`);

    let totalSaved = 0, totalUpdated = 0, channelsScanned = 0;

    for (const channel of targetChannels) {
        try {
            const fetched = await channel.messages.fetch({ limit: MAX_MESSAGES_PER_CHANNEL });
            const entries = [];

            for (const [, msg] of fetched) {
                if (!msg.content || msg.content.length < 15) continue;
                entries.push({
                    author:  msg.author.username,
                    content: msg.content.slice(0, 500),
                    isStaff: !!(msg.member?.permissions.has(8n)), // Administrator
                });
            }

            if (entries.length < 3) continue;

            // Staff mesajları öne al (daha güvenilir bilgi kaynağı)
            const ordered = [
                ...entries.filter(e => e.isStaff),
                ...entries.filter(e => !e.isStaff),
            ];

            const items = await learnFromMessages(channel.name, channel.id, ordered);

            if (items.length > 0) {
                const { saved, updated } = await saveKnowledge(guild.id, items);
                totalSaved   += saved;
                totalUpdated += updated;
                channelsScanned++;
                if (onProgress) {
                    onProgress(`✅ #${channel.name} — ${items.length} bilgi (${saved} yeni, ${updated} güncellendi)`);
                }
            } else {
                if (onProgress) onProgress(`⬛ #${channel.name} — kalıcı bilgi bulunamadı`);
            }

            // Claude API rate limit koruması
            await new Promise(r => setTimeout(r, 700));

        } catch (err) {
            console.error(`[LEARNER] Kanal ${channel.name}:`, err.message);
            if (onProgress) onProgress(`❌ #${channel.name} — hata: ${err.message.slice(0, 60)}`);
        }
    }

    return { channelsScanned, totalSaved, totalUpdated };
}

// ── Knowledge context → ommy.js system prompt injection ────────────────────
async function getKnowledgeContext(guildId) {
    try {
        const items = await OmKnowledge.find({ guildId, active: true })
            .sort({ confidence: -1 })
            .limit(40)
            .lean();

        if (!items.length) return '';

        const catLabels = {
            registration: 'KAYIT & KATILIM',
            race_format:  'YARIŞ FORMATI',
            rules:        'KURALLAR & CEZA',
            schedule:     'PROGRAM & TAKVİM',
            roles:        'ROLLER',
            channels:     'KANALLAR',
            economy:      'EKONOMİ & PUANLAR',
            general:      'GENEL',
        };

        const grouped = {};
        for (const item of items) {
            const cat = item.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item.fact);
        }

        let ctx = '\n\n---\n🧠 SUNUCU HAKKINDA ÖĞRENILEN BİLGİLER (kanal taramasından):\n';
        for (const [cat, facts] of Object.entries(grouped)) {
            ctx += `\n[${catLabels[cat] || cat.toUpperCase()}]\n`;
            for (const f of facts) ctx += `• ${f}\n`;
        }
        ctx += '\nBu bilgileri kullan. Hardcode /register referansları artık bu öğrenilen bilgilerle değiştirilmiştir.\n---\n';

        return ctx;
    } catch (err) {
        console.error('[LEARNER] getKnowledgeContext hatası:', err.message);
        return '';
    }
}

module.exports = { learnFromGuild, getKnowledgeContext, saveKnowledge };
