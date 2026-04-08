// events/driverRatingSync.js
// Bot ayağa kalktığında:
// 1) Driver kaydı olan ama DriverRating'i olmayanlar için boş kayıt oluşturur
// 2) Driver kaydı silinmiş ama DriverRating'i kalan orphan kayıtları temizler

const Driver = require('../models/Driver');
const DriverRating = require('../models/DriverRating');

module.exports = (client) => {
    client.once('ready', async () => {
        try {
            const allDrivers  = await Driver.find({}).lean();
            const allRatings  = await DriverRating.find({}).lean();

            const driverIds = new Set(allDrivers.map(d => d.userId));
            const ratingIds = new Set(allRatings.map(r => r.userId));

            let created = 0;
            let cleaned = 0;
            let skipped = 0;

            // 1) Driver var, DriverRating yok → oluştur
            for (const driver of allDrivers) {
                if (!ratingIds.has(driver.userId)) {
                    let username = '';
                    try {
                        const user = await client.users.fetch(driver.userId);
                        username = user.username;
                    } catch {
                        // kullanıcı sunucudan ayrılmış olabilir
                    }
                    await DriverRating.create({ userId: driver.userId, username });
                    created++;
                } else {
                    skipped++;
                }
            }

            // 2) DriverRating var, Driver yok → orphan, sil
            for (const rating of allRatings) {
                if (!driverIds.has(rating.userId)) {
                    await DriverRating.deleteOne({ userId: rating.userId });
                    console.log(`[RATING SYNC] Orphan cleaned: ${rating.userId} (${rating.username || 'no username'})`);
                    cleaned++;
                }
            }

            console.log(`[RATING SYNC] Done. Created: ${created} | Skipped: ${skipped} | Orphans cleaned: ${cleaned}`);

        } catch (err) {
            console.error('[RATING SYNC] Error during startup sync:', err);
        }
    });
};
