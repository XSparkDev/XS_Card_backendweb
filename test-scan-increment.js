const { db, admin } = require('./firebase.js');

/**
 * Script to test manually incrementing scan count for a specific user
 */

const USER_ID = 'BPxFmmG6SVXvbwwRJ0YjBnuI8e73';
const CARD_INDEX = 0; // First card

async function testScanIncrement() {
    try {
        console.log('🧪 Testing scan count increment for user:', USER_ID);
        console.log('=====================================');

        // Get current card data
        const cardRef = db.collection('cards').doc(USER_ID);
        const cardDoc = await cardRef.get();
        
        if (!cardDoc.exists) {
            console.log('❌ No cards found for user:', USER_ID);
            return;
        }

        const cardData = cardDoc.data();
        const cards = cardData.cards || [];
        
        if (!cards[CARD_INDEX]) {
            console.log(`❌ Card index ${CARD_INDEX} not found`);
            return;
        }

        const currentCard = cards[CARD_INDEX];
        console.log('📋 Current card state:');
        console.log(`   Name: ${currentCard.name || 'N/A'}`);
        console.log(`   Current scanCount: ${currentCard.scanCount || 0}`);
        console.log(`   Last Scanned: ${currentCard.lastScanned ? currentCard.lastScanned.toDate().toISOString() : 'Never'}`);

        // Simulate the scan tracking logic
        console.log('\n🔄 Simulating scan tracking...');
        
        // Initialize scan count if it doesn't exist
        if (!cards[CARD_INDEX].scanCount) {
            cards[CARD_INDEX].scanCount = 0;
        }
        
        // Increment scan count
        const oldCount = cards[CARD_INDEX].scanCount;
        cards[CARD_INDEX].scanCount += 1;
        
        // Update last scanned timestamp
        cards[CARD_INDEX].lastScanned = admin.firestore.Timestamp.now();
        
        console.log(`   Old scanCount: ${oldCount}`);
        console.log(`   New scanCount: ${cards[CARD_INDEX].scanCount}`);
        console.log(`   Updated lastScanned: ${cards[CARD_INDEX].lastScanned.toDate().toISOString()}`);

        // Update the card document
        await cardRef.update({
            cards: cards,
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        console.log('✅ Card document updated successfully');

        // Verify the update
        const updatedDoc = await cardRef.get();
        const updatedData = updatedDoc.data();
        const updatedCards = updatedData.cards || [];
        const updatedCard = updatedCards[CARD_INDEX];
        
        console.log('\n📋 Updated card state:');
        console.log(`   scanCount: ${updatedCard.scanCount || 0}`);
        console.log(`   Last Scanned: ${updatedCard.lastScanned ? updatedCard.lastScanned.toDate().toISOString() : 'Never'}`);
        console.log(`   Document updatedAt: ${updatedData.updatedAt ? updatedData.updatedAt.toDate().toISOString() : 'N/A'}`);

        console.log('\n=====================================');
        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing scan increment:', error);
    }
}

// Run the script
if (require.main === module) {
    testScanIncrement()
        .then(() => {
            console.log('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testScanIncrement };

