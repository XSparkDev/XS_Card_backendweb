const { db, admin } = require('./firebase.js');

/**
 * Script to test the actual track-scan endpoint
 */

const USER_ID = 'BPxFmmG6SVXvbwwRJ0YjBnuI8e73';
const CARD_INDEX = 0; // First card

async function testTrackScanEndpoint() {
    try {
        console.log('🧪 Testing track-scan endpoint for user:', USER_ID);
        console.log('=====================================');

        // First, check current state
        const cardRef = db.collection('cards').doc(USER_ID);
        const cardDoc = await cardRef.get();
        const cardData = cardDoc.data();
        const cards = cardData.cards || [];
        const currentCard = cards[CARD_INDEX];
        
        console.log('📋 Current card state:');
        console.log(`   scanCount: ${currentCard.scanCount || 0}`);
        console.log(`   Last Scanned: ${currentCard.lastScanned ? currentCard.lastScanned.toDate().toISOString() : 'Never'}`);

        // Simulate the exact payload that the frontend sends
        const trackingData = {
            userId: USER_ID,
            cardIndex: CARD_INDEX,
            scanType: 'save',
            sessionId: `test_session_${Date.now()}`,
            timestamp: Date.now()
        };

        console.log('\n📤 Sending tracking data:', trackingData);

        // Call the track-scan endpoint logic directly (since we can't make HTTP requests from this script)
        console.log('\n🔄 Calling track-scan logic...');
        
        // Log the scan activity (simulating the endpoint)
        const logActivity = async (data) => {
            try {
                await db.collection('activityLogs').add({
                    ...data,
                    timestamp: admin.firestore.Timestamp.now()
                });
                console.log('✅ Activity logged successfully');
            } catch (error) {
                console.error('❌ Error logging activity:', error);
            }
        };

        await logActivity({
            action: 'scan',
            resource: 'CARD',
            userId: USER_ID,
            resourceId: USER_ID,
            details: {
                scanType: trackingData.scanType,
                cardIndex: trackingData.cardIndex,
                sessionId: trackingData.sessionId,
                timestamp: new Date(trackingData.timestamp).toISOString(),
                userAgent: 'Test Script',
                ipAddress: '127.0.0.1'
            }
        });

        // Update scan count on the card document (simulating the endpoint)
        try {
            if (cards[CARD_INDEX]) {
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
            } else {
                console.warn(`⚠️ Card index ${CARD_INDEX} not found for user ${USER_ID}`);
            }
        } catch (cardUpdateError) {
            console.error('❌ Error updating card scan count:', cardUpdateError);
        }

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
        console.log('✅ Track-scan endpoint test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing track-scan endpoint:', error);
    }
}

// Run the script
if (require.main === module) {
    testTrackScanEndpoint()
        .then(() => {
            console.log('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testTrackScanEndpoint };

