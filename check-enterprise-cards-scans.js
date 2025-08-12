const { db, admin } = require('./firebase.js');

/**
 * Script to check all cards in the "x-spark-test" enterprise
 * and analyze their scan counts
 */

const ENTERPRISE_ID = 'x-spark-test';

async function checkEnterpriseCardsScans() {
    try {
        console.log('🔍 Checking cards in enterprise:', ENTERPRISE_ID);
        console.log('=====================================');

        // Get all users in the enterprise
        const enterpriseUsersSnapshot = await db.collection('users')
            .where('enterpriseRef', '==', db.doc(`enterprise/${ENTERPRISE_ID}`))
            .get();

        if (enterpriseUsersSnapshot.empty) {
            console.log('❌ No users found for enterprise:', ENTERPRISE_ID);
            return;
        }

        console.log(`📊 Found ${enterpriseUsersSnapshot.size} users in enterprise`);

        let totalCards = 0;
        let cardsWithScans = 0;
        let totalScans = 0;
        let scanDistribution = {
            '0': 0,
            '1-10': 0,
            '11-50': 0,
            '51-100': 0,
            '101-500': 0,
            '501-1000': 0,
            '1000+': 0
        };

        const userCardDetails = [];

        // Process each user
        for (const userDoc of enterpriseUsersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            
            // Get user's cards
            const cardDoc = await db.collection('cards').doc(userId).get();
            if (!cardDoc.exists) {
                console.log(`⚠️  No cards found for user: ${userData.email || userId}`);
                continue;
            }

            const cardData = cardDoc.data();
            const cards = cardData.cards || [];

            if (cards.length === 0) {
                console.log(`⚠️  User ${userData.email || userId} has no cards`);
                continue;
            }

            console.log(`\n👤 User: ${userData.email || userId}`);
            console.log(`   📱 Cards: ${cards.length}`);

            // Process each card
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const scanCount = card.scanCount || 0;
                
                totalCards++;
                
                if (scanCount > 0) {
                    cardsWithScans++;
                    totalScans += scanCount;
                }

                // Categorize scan count
                if (scanCount === 0) {
                    scanDistribution['0']++;
                } else if (scanCount <= 10) {
                    scanDistribution['1-10']++;
                } else if (scanCount <= 50) {
                    scanDistribution['11-50']++;
                } else if (scanCount <= 100) {
                    scanDistribution['51-100']++;
                } else if (scanCount <= 500) {
                    scanDistribution['101-500']++;
                } else if (scanCount <= 1000) {
                    scanDistribution['501-1000']++;
                } else {
                    scanDistribution['1000+']++;
                }

                console.log(`      Card ${i + 1}: ${scanCount} scans`);

                // Store detailed information
                userCardDetails.push({
                    userId: userId,
                    userEmail: userData.email || 'N/A',
                    cardIndex: i,
                    cardName: card.name || `Card ${i + 1}`,
                    scanCount: scanCount,
                    createdAt: formatTimestamp(card.createdAt)
                });
            }
        }

        // Display summary
        console.log('\n=====================================');
        console.log('📊 ENTERPRISE CARDS SCAN SUMMARY');
        console.log('=====================================');
        console.log(`🏢 Enterprise: ${ENTERPRISE_ID}`);
        console.log(`👥 Total Users: ${enterpriseUsersSnapshot.size}`);
        console.log(`📱 Total Cards: ${totalCards}`);
        console.log(`✅ Cards with Scans: ${cardsWithScans}`);
        console.log(`❌ Cards without Scans: ${totalCards - cardsWithScans}`);
        console.log(`🔢 Total Scans: ${totalScans.toLocaleString()}`);
        console.log(`📈 Average Scans per Card: ${totalCards > 0 ? (totalScans / totalCards).toFixed(2) : 0}`);
        console.log(`📈 Average Scans per Active Card: ${cardsWithScans > 0 ? (totalScans / cardsWithScans).toFixed(2) : 0}`);

        console.log('\n📊 SCAN DISTRIBUTION:');
        console.log('=====================================');
        Object.entries(scanDistribution).forEach(([range, count]) => {
            const percentage = totalCards > 0 ? ((count / totalCards) * 100).toFixed(1) : 0;
            console.log(`${range.padEnd(8)} scans: ${count.toString().padStart(3)} cards (${percentage}%)`);
        });

        // Show top performing cards
        if (userCardDetails.length > 0) {
            const sortedCards = userCardDetails
                .filter(card => card.scanCount > 0)
                .sort((a, b) => b.scanCount - a.scanCount)
                .slice(0, 10);

            if (sortedCards.length > 0) {
                console.log('\n🏆 TOP 10 CARDS BY SCAN COUNT:');
                console.log('=====================================');
                sortedCards.forEach((card, index) => {
                    console.log(`${(index + 1).toString().padStart(2)}. ${card.userEmail.padEnd(30)} | ${card.cardName.padEnd(20)} | ${card.scanCount.toString().padStart(6)} scans`);
                });
            }
        }

        // Show cards with no scans
        const cardsWithNoScans = userCardDetails.filter(card => card.scanCount === 0);
        if (cardsWithNoScans.length > 0) {
            console.log('\n❌ CARDS WITH NO SCANS:');
            console.log('=====================================');
            cardsWithNoScans.forEach((card, index) => {
                if (index < 20) { // Limit to first 20 to avoid overwhelming output
                    console.log(`${(index + 1).toString().padStart(2)}. ${card.userEmail.padEnd(30)} | ${card.cardName.padEnd(20)} | Created: ${card.createdAt}`);
                }
            });
            if (cardsWithNoScans.length > 20) {
                console.log(`   ... and ${cardsWithNoScans.length - 20} more cards with no scans`);
            }
        }

        console.log('\n=====================================');
        console.log('✅ Analysis complete!');

    } catch (error) {
        console.error('❌ Error checking enterprise cards:', error);
    }
}

// Run the script
if (require.main === module) {
    checkEnterpriseCardsScans()
        .then(() => {
            console.log('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { checkEnterpriseCardsScans };

// Helper function to format timestamps
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        // Handle Firestore Timestamp
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toISOString();
        }
        
        // Handle regular Date objects
        if (timestamp instanceof Date) {
            return timestamp.toISOString();
        }
        
        // Handle string timestamps
        if (typeof timestamp === 'string') {
            return timestamp;
        }
        
        // Handle numeric timestamps
        if (typeof timestamp === 'number') {
            return new Date(timestamp).toISOString();
        }
        
        return 'Invalid timestamp';
    } catch (error) {
        return 'Error parsing timestamp';
    }
}
