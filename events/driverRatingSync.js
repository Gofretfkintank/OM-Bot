// events/driverRatingSync.js
// Bot ayağa kalktığında mevcut tüm Driver kayıtlarını tarar.
// DriverRating dokümanı olmayanlar için boş bir kayıt oluşturur.

const Driver = require('../models/Driver');
const DriverRating = require('../models/DriverRating');

module.exports = (client) => {
    client.once('ready', async () => {
        try {
            const allDrivers = await Driver.find({});

            if (allDrivers.length === 0) {
                console.log('[RATING SYNC] No drivers found, skipping.');
                return;
            }

            let created = 0;
            let skipped = 0;

            for (const driver of allDrivers) {
                const exists = await DriverRating.findOne({ userId: driver.userId });

                if (!exists) {
                    // Discord'dan username çekmeye çalış, yoksa boş bırak
                    let username = '';
                    try {
                        const user = await client.users.fetch(driver.userId);
                        username = user.username;
                    } catch {
                        // kullanıcı sunucudan ayrılmış olabilir, sorun değil
                    }

                    await DriverRating.create({ userId: driver.userId, username });
                    created++;
                } else {
                    skipped++;
                }
            }

            console.log(`[RATING SYNC] Done. Created: ${created} | Already existed: ${skipped}`);

        } catch (err) {
            console.error('[RATING SYNC] Error during startup sync:', err);
        }
    });
};
