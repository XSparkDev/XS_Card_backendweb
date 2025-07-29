const { db, admin } = require('../firebase');

/**
 * Script to artificially inflate scan counts for environmental impact demonstration
 * This simulates the impact of digital cards vs paper cards
 */

const ENTERPRISE_ID = 'x-spark-test';
const SCAN_RANGES = {
  low: { min: 50, max: 200 },      // 50-200 scans per card
  medium: { min: 200, max: 1000 },  // 200-1000 scans per card  
  high: { min: 1000, max: 5000 },   // 1000-5000 scans per card
  extreme: { min: 5000, max: 25000 } // 5000-25000 scans per card
};

/**
 * Generate realistic scan activities with proper date distribution
 * This creates activity logs with different timestamps for growth visualization
 */
async function createRealisticScanActivities() {
  try {
    console.log('📅 Creating realistic scan activities with date distribution...');
    
    // Get enterprise users
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc(`enterprise/${ENTERPRISE_ID}`))
      .get();
    
    if (enterpriseUsersSnapshot.empty) {
      console.log('❌ No users found for enterprise:', ENTERPRISE_ID);
      return;
    }
    
    const enterpriseUserIds = enterpriseUsersSnapshot.docs.map(doc => doc.id);
    let totalActivitiesCreated = 0;
    
    // Create activities for each user
    for (const userId of enterpriseUserIds) {
      // Get user's current scan count
      const cardDoc = await db.collection('cards').doc(userId).get();
      if (!cardDoc.exists) continue;
      
      const cardData = cardDoc.data();
      const cards = cardData.cards || [];
      
      for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
        const card = cards[cardIndex];
        const scanCount = card.scanCount || 0;
        
        if (scanCount > 0) {
          console.log(`📊 Creating ${scanCount} activities for user ${userId}, card ${cardIndex}`);
          
          // Create activities distributed over the last 6 months
          const activities = [];
          const now = new Date();
          const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
          
          for (let i = 0; i < Math.min(scanCount, 100); i++) { // Limit to 100 activities per card to avoid overwhelming
            // Distribute activities over time with some randomness
            const progress = i / Math.min(scanCount, 100);
            const baseTime = sixMonthsAgo.getTime() + (progress * (now.getTime() - sixMonthsAgo.getTime()));
            
            // Add some randomness to the distribution
            const randomOffset = (Math.random() - 0.5) * (24 * 60 * 60 * 1000); // ±1 day
            const activityTime = new Date(baseTime + randomOffset);
            
            // Ensure we don't create future timestamps
            if (activityTime > now) {
              activityTime.setTime(now.getTime() - Math.random() * (24 * 60 * 60 * 1000));
            }
            
            const activityData = {
              action: 'scan',
              resource: 'CARD',
              userId: userId,
              resourceId: userId,
              timestamp: admin.firestore.Timestamp.fromDate(activityTime),
              status: 'success',
              details: {
                scanType: 'save',
                cardIndex: cardIndex,
                sessionId: `growth_sim_${Date.now()}_${i}`,
                timestamp: activityTime.toISOString(),
                userAgent: 'Environmental Impact Growth Simulation',
                ipAddress: '127.0.0.1'
              }
            };
            
            activities.push(activityData);
          }
          
          // Batch write activities (Firestore batch limit is 500)
          const batchSize = 500;
          for (let i = 0; i < activities.length; i += batchSize) {
            const batch = db.batch();
            const batchActivities = activities.slice(i, i + batchSize);
            
            batchActivities.forEach(activity => {
              const activityRef = db.collection('activityLogs').doc();
              batch.set(activityRef, activity);
            });
            
            await batch.commit();
            totalActivitiesCreated += batchActivities.length;
          }
        }
      }
    }
    
    console.log(`✅ Created ${totalActivitiesCreated} realistic scan activities`);
    console.log('📈 Contact growth data now has proper date distribution');
    
  } catch (error) {
    console.error('❌ Error creating realistic scan activities:', error);
  }
}

/**
 * Generate random scan count within a range
 */
function getRandomScanCount(range) {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Generate random timestamp within last 6 months
 */
function getRandomTimestamp() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
  const randomTime = new Date(sixMonthsAgo.getTime() + Math.random() * (now.getTime() - sixMonthsAgo.getTime()));
  return admin.firestore.Timestamp.fromDate(randomTime);
}

/**
 * Inflate scan counts for enterprise users
 */
async function inflateScanCounts() {
  try {
    console.log('🚀 Starting scan count inflation for environmental impact demo...');
    
    // Get all enterprise users
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc(`enterprise/${ENTERPRISE_ID}`))
      .get();
    
    if (enterpriseUsersSnapshot.empty) {
      console.log('❌ No users found for enterprise:', ENTERPRISE_ID);
      return;
    }
    
    console.log(`📊 Found ${enterpriseUsersSnapshot.docs.length} users in enterprise`);
    
    const updatePromises = [];
    let totalCards = 0;
    let totalScans = 0;
    
    // Process each user
    for (const userDoc of enterpriseUsersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`👤 Processing user: ${userData.name || 'Unknown'} (${userId})`);
      
      // Get user's cards
      const cardDoc = await db.collection('cards').doc(userId).get();
      if (!cardDoc.exists) {
        console.log(`⚠️ No cards found for user ${userId}`);
        continue;
      }
      
      const cardData = cardDoc.data();
      const cards = cardData.cards || [];
      
      console.log(`📇 Found ${cards.length} cards for user ${userId}`);
      
      // Update each card with inflated scan counts
      const updatedCards = cards.map((card, cardIndex) => {
        // Assign different scan ranges based on card index
        let scanRange;
        if (cardIndex === 0) {
          scanRange = SCAN_RANGES.high; // Primary card gets high scans
        } else if (cardIndex === 1) {
          scanRange = SCAN_RANGES.medium; // Secondary card gets medium scans
        } else {
          scanRange = SCAN_RANGES.low; // Additional cards get low scans
        }
        
        const newScanCount = getRandomScanCount(scanRange);
        const lastScanned = getRandomTimestamp();
        
        totalScans += newScanCount;
        totalCards++;
        
        console.log(`  📊 Card ${cardIndex}: ${card.name || 'Unknown'} - ${newScanCount} scans`);
        
        return {
          ...card,
          scanCount: newScanCount,
          lastScanned: lastScanned
        };
      });
      
      // Update the cards document
      const updatePromise = db.collection('cards').doc(userId).update({
        cards: updatedCards,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      updatePromises.push(updatePromise);
    }
    
    // Execute all updates
    console.log('⏳ Updating scan counts...');
    await Promise.all(updatePromises);
    
    console.log('✅ Scan count inflation completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Total cards updated: ${totalCards}`);
    console.log(`  - Total scans added: ${totalScans.toLocaleString()}`);
    console.log(`  - Average scans per card: ${Math.round(totalScans / totalCards)}`);
    
    // Calculate environmental impact
    const paperCardsSaved = totalScans;
    const treesSaved = Math.round(paperCardsSaved / 1000); // Rough estimate: 1000 cards = 1 tree
    const co2Saved = Math.round(paperCardsSaved * 0.5); // Rough estimate: 0.5kg CO2 per paper card
    
    console.log(`🌱 Environmental Impact:`);
    console.log(`  - Paper cards saved: ${paperCardsSaved.toLocaleString()}`);
    console.log(`  - Trees saved: ~${treesSaved}`);
    console.log(`  - CO2 emissions saved: ~${co2Saved.toLocaleString()} kg`);
    
    // Test the analytics endpoint
    console.log('\n🔍 Testing analytics endpoint...');
    const testResponse = await fetch(`http://localhost:8383/logs/analytics/cards/${ENTERPRISE_ID}`, {
      headers: {
        'Authorization': 'Bearer test_token_1753784007345',
        'Content-Type': 'application/json'
      }
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log(`✅ Analytics endpoint working:`);
      console.log(`  - Total cards: ${testData.summary.totalCards}`);
      console.log(`  - Total scans: ${testData.summary.totalScans.toLocaleString()}`);
      console.log(`  - Average scans: ${testData.summary.averageScans}`);
    } else {
      console.log('❌ Analytics endpoint test failed');
    }
    
  } catch (error) {
    console.error('❌ Error inflating scan counts:', error);
  }
}

/**
 * Create additional test users with cards for more realistic data
 */
async function createTestUsers() {
  try {
    console.log('👥 Creating additional test users...');
    
    const testUsers = [
      { name: 'John', surname: 'Marketing', email: 'john.marketing@xspark.com', company: 'x-spark-test', occupation: 'Marketing Manager' },
      { name: 'Sarah', surname: 'Sales', email: 'sarah.sales@xspark.com', company: 'x-spark-test', occupation: 'Sales Director' },
      { name: 'Mike', surname: 'Engineering', email: 'mike.engineering@xspark.com', company: 'x-spark-test', occupation: 'Senior Developer' },
      { name: 'Lisa', surname: 'HR', email: 'lisa.hr@xspark.com', company: 'x-spark-test', occupation: 'HR Manager' },
      { name: 'David', surname: 'Finance', email: 'david.finance@xspark.com', company: 'x-spark-test', occupation: 'Finance Director' }
    ];
    
    const userPromises = testUsers.map(async (userData, index) => {
      const userId = `test_user_${Date.now()}_${index}`;
      
      // Create user document
      const userDoc = {
        name: userData.name,
        surname: userData.surname,
        email: userData.email,
        company: userData.company,
        occupation: userData.occupation,
        plan: 'enterprise',
        enterpriseRef: db.doc(`enterprise/${ENTERPRISE_ID}`),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      // Create cards document
      const cardsDoc = {
        userId: userId,
        cards: [
          {
            name: userData.name,
            surname: userData.surname,
            email: userData.email,
            phone: '+1234567890',
            company: userData.company,
            occupation: userData.occupation,
            scanCount: 0, // Will be inflated by main function
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          }
        ],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      // Save to database
      await db.collection('users').doc(userId).set(userDoc);
      await db.collection('cards').doc(userId).set(cardsDoc);
      
      console.log(`✅ Created test user: ${userData.name} ${userData.surname}`);
    });
    
    await Promise.all(userPromises);
    console.log('✅ All test users created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  }
}

// Run the script
async function main() {
  try {
    console.log('🌱 Environmental Impact Demo - Digital Cards vs Paper Cards');
    console.log('========================================================');
    
    // Create additional test users first
    await createTestUsers();
    
    // Then inflate scan counts
    await inflateScanCounts();
    
    // Create realistic scan activities with proper date distribution
    await createRealisticScanActivities();
    
    console.log('\n🎉 Demo setup completed!');
    console.log('📊 You can now test the analytics endpoints with inflated data.');
    console.log('📈 Contact growth visualization now has proper date distribution.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { inflateScanCounts, createTestUsers };