const { db } = require('../firebase');

/**
 * Migration script to consolidate scan properties across all cards
 * 
 * This script will:
 * 1. Find all cards with 'scans' property and move the value to 'scanCount'
 * 2. Find all cards with 'numberOfScan' property and move the value to 'scanCount'
 * 3. Remove the old properties to avoid confusion
 * 4. Preserve existing 'scanCount' values
 */
const consolidateScanProperties = async () => {
  try {
    console.log('🚀 Starting scan properties consolidation migration...');
    
    // Get all cards documents
    const cardsSnapshot = await db.collection('cards').get();
    console.log(`📊 Found ${cardsSnapshot.size} card documents to process`);
    
    if (cardsSnapshot.empty) {
      console.log('✅ No card documents found to migrate');
      return;
    }
    
    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let totalCardsProcessed = 0;
    let totalCardsUpdated = 0;
    
    const cardDocs = cardsSnapshot.docs;
    
    for (let i = 0; i < cardDocs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = cardDocs.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardDocs.length / batchSize)}`);
      
      batchDocs.forEach(doc => {
        const cardData = doc.data();
        const cards = cardData.cards || [];
        let hasChanges = false;
        
        // Process each card in the user's cards array
        const updatedCards = cards.map((card, cardIndex) => {
          const updatedCard = { ...card };
          let cardChanged = false;
          
          // Check if card has 'scans' property
          if (updatedCard.hasOwnProperty('scans') && updatedCard.scans !== undefined) {
            console.log(`  📊 User ${doc.id}, Card ${cardIndex}: Found 'scans' = ${updatedCard.scans}`);
            
            // If scanCount doesn't exist or is 0, use the scans value
            if (!updatedCard.scanCount || updatedCard.scanCount === 0) {
              updatedCard.scanCount = updatedCard.scans;
              console.log(`    ✅ Moved scans (${updatedCard.scans}) to scanCount`);
            } else {
              console.log(`    ⚠️ scanCount already exists (${updatedCard.scanCount}), keeping existing value`);
            }
            
            // Remove the old 'scans' property
            delete updatedCard.scans;
            cardChanged = true;
          }
          
          // Check if card has 'numberOfScan' property
          if (updatedCard.hasOwnProperty('numberOfScan') && updatedCard.numberOfScan !== undefined) {
            console.log(`  📊 User ${doc.id}, Card ${cardIndex}: Found 'numberOfScan' = ${updatedCard.numberOfScan}`);
            
            // If scanCount doesn't exist or is 0, use the numberOfScan value
            if (!updatedCard.scanCount || updatedCard.scanCount === 0) {
              updatedCard.scanCount = updatedCard.numberOfScan;
              console.log(`    ✅ Moved numberOfScan (${updatedCard.numberOfScan}) to scanCount`);
            } else {
              console.log(`    ⚠️ scanCount already exists (${updatedCard.scanCount}), keeping existing value`);
            }
            
            // Remove the old 'numberOfScan' property
            delete updatedCard.numberOfScan;
            cardChanged = true;
          }
          
          if (cardChanged) {
            totalCardsUpdated++;
          }
          
          return updatedCard;
        });
        
        // If any cards were updated, add to batch
        if (JSON.stringify(cards) !== JSON.stringify(updatedCards)) {
          const cardRef = db.collection('cards').doc(doc.id);
          batch.update(cardRef, {
            cards: updatedCards,
            updatedAt: new Date().toISOString()
          });
          hasChanges = true;
          updated++;
        } else {
          skipped++;
        }
        
        totalCardsProcessed += cards.length;
        processed++;
      });
      
      // Commit the batch if there are changes
      if (batchDocs.some(doc => {
        const cardData = doc.data();
        const cards = cardData.cards || [];
        return cards.some(card => card.hasOwnProperty('scans') || card.hasOwnProperty('numberOfScan'));
      })) {
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed successfully`);
      }
    }
    
    console.log('\n🎉 Scan properties consolidation completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • Total card documents processed: ${processed}`);
    console.log(`   • Card documents updated: ${updated}`);
    console.log(`   • Card documents skipped: ${skipped}`);
    console.log(`   • Total individual cards processed: ${totalCardsProcessed}`);
    console.log(`   • Individual cards updated: ${totalCardsUpdated}`);
    console.log(`   • All scan properties now consolidated to 'scanCount'`);
    
  } catch (error) {
    console.error('❌ Error during scan properties consolidation:', error);
    throw error;
  }
};

/**
 * Verification function to check if consolidation was successful
 */
const verifyConsolidation = async () => {
  try {
    console.log('🔍 Verifying scan properties consolidation...');
    
    const cardsSnapshot = await db.collection('cards').get();
    let totalCards = 0;
    let cardsWithOldProperties = 0;
    let cardsWithScanCount = 0;
    
    cardsSnapshot.forEach(doc => {
      const cardData = doc.data();
      const cards = cardData.cards || [];
      
      cards.forEach((card, cardIndex) => {
        totalCards++;
        
        // Check for old properties
        if (card.hasOwnProperty('scans') || card.hasOwnProperty('numberOfScan')) {
          cardsWithOldProperties++;
          console.log(`⚠️ Found old scan property in user ${doc.id}, card ${cardIndex}:`, {
            scans: card.scans,
            numberOfScan: card.numberOfScan,
            scanCount: card.scanCount
          });
        }
        
        // Check for scanCount
        if (card.hasOwnProperty('scanCount')) {
          cardsWithScanCount++;
        }
      });
    });
    
    console.log('\n📊 Verification Results:');
    console.log(`   • Total cards: ${totalCards}`);
    console.log(`   • Cards with scanCount: ${cardsWithScanCount}`);
    console.log(`   • Cards with old properties: ${cardsWithOldProperties}`);
    
    if (cardsWithOldProperties === 0) {
      console.log('✅ All scan properties successfully consolidated!');
    } else {
      console.log('⚠️ Some cards still have old scan properties');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  consolidateScanProperties()
    .then(() => {
      console.log('\n🔍 Running verification...');
      return verifyConsolidation();
    })
    .then(() => {
      console.log('\n✨ Migration and verification completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  consolidateScanProperties,
  verifyConsolidation
};
