const { db, admin } = require('./firebase.js');

/**
 * Script to check a specific user's scan count and card structure
 */

const USER_ID = 'BPxFmmG6SVXvbwwRJ0YjBnuI8e73';

async function checkSpecificUserScans() {
    try {
        console.log('🔍 Checking scans for user:', USER_ID);
        console.log('=====================================');

        // Get user's cards
        const cardDoc = await db.collection('cards').doc(USER_ID).get();
        
        if (!cardDoc.exists) {
            console.log('❌ No cards found for user:', USER_ID);
            return;
        }

        const cardData = cardDoc.data();
        const cards = cardData.cards || [];

        console.log(`📱 Found ${cards.length} cards for user`);
        console.log('=====================================');

        // Check each card
        cards.forEach((card, index) => {
            console.log(`\n📋 Card ${index + 1}:`);
            console.log(`   Name: ${card.name || 'N/A'}`);
            console.log(`   Surname: ${card.surname || 'N/A'}`);
            console.log(`   Email: ${card.email || 'N/A'}`);
            console.log(`   scanCount: ${card.scanCount || 0}`);
            console.log(`   numberOfScan: ${card.numberOfScan || 'Not stored'}`);
            console.log(`   Last Scanned: ${card.lastScanned ? card.lastScanned.toDate().toISOString() : 'Never'}`);
            console.log(`   Created: ${card.createdAt ? (typeof card.createdAt.toDate === 'function' ? card.createdAt.toDate().toISOString() : card.createdAt) : 'N/A'}`);
        });

        // Check if user exists in users collection
        const userDoc = await db.collection('users').doc(USER_ID).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('\n👤 User Info:');
            console.log(`   Email: ${userData.email || 'N/A'}`);
            console.log(`   Name: ${userData.name || 'N/A'}`);
            console.log(`   Company: ${userData.company || 'N/A'}`);
        }

        // Check recent activity logs for this user
        console.log('\n📊 Recent Activity Logs:');
        const activityLogs = await db.collection('activityLogs')
            .where('userId', '==', USER_ID)
            .where('action', '==', 'scan')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        if (activityLogs.empty) {
            console.log('   No scan activity logs found');
        } else {
            activityLogs.forEach(doc => {
                const log = doc.data();
                console.log(`   ${log.timestamp ? log.timestamp.toDate().toISOString() : 'N/A'} - ${log.details?.scanType || 'unknown'} scan`);
            });
        }

        console.log('\n=====================================');
        console.log('✅ Analysis complete!');

    } catch (error) {
        console.error('❌ Error checking user scans:', error);
    }
}

// Run the script
if (require.main === module) {
    checkSpecificUserScans()
        .then(() => {
            console.log('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { checkSpecificUserScans };

