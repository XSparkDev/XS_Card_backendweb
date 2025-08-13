const { db } = require('./firebase');

/**
 * Test script to check current scan properties across all cards
 */
const checkScanProperties = async () => {
  try {
    console.log('🔍 Checking current scan properties across all cards...');
    
    const cardsSnapshot = await db.collection('cards').get();
    console.log(`📊 Found ${cardsSnapshot.size} card documents`);
    
    if (cardsSnapshot.empty) {
      console.log('✅ No card documents found');
      return;
    }
    
    let totalCards = 0;
    let cardsWithScans = 0;
    let cardsWithScanCount = 0;
    let cardsWithNumberOfScan = 0;
    let cardsWithMultipleProperties = 0;
    
    const scanPropertyExamples = [];
    
    cardsSnapshot.forEach(doc => {
      const cardData = doc.data();
      const cards = cardData.cards || [];
      
      cards.forEach((card, cardIndex) => {
        totalCards++;
        
        const hasScans = card.hasOwnProperty('scans') && card.scans !== undefined;
        const hasScanCount = card.hasOwnProperty('scanCount') && card.scanCount !== undefined;
        const hasNumberOfScan = card.hasOwnProperty('numberOfScan') && card.numberOfScan !== undefined;
        
        if (hasScans) {
          cardsWithScans++;
          scanPropertyExamples.push({
            userId: doc.id,
            cardIndex,
            property: 'scans',
            value: card.scans,
            name: card.name || 'Unknown'
          });
        }
        
        if (hasScanCount) {
          cardsWithScanCount++;
        }
        
        if (hasNumberOfScan) {
          cardsWithNumberOfScan++;
          scanPropertyExamples.push({
            userId: doc.id,
            cardIndex,
            property: 'numberOfScan',
            value: card.numberOfScan,
            name: card.name || 'Unknown'
          });
        }
        
        // Count cards with multiple scan properties
        const propertyCount = [hasScans, hasScanCount, hasNumberOfScan].filter(Boolean).length;
        if (propertyCount > 1) {
          cardsWithMultipleProperties++;
          console.log(`⚠️ User ${doc.id}, Card ${cardIndex} (${card.name || 'Unknown'}): Multiple scan properties found:`, {
            scans: card.scans,
            scanCount: card.scanCount,
            numberOfScan: card.numberOfScan
          });
        }
      });
    });
    
    console.log('\n📊 Scan Properties Summary:');
    console.log(`   • Total cards: ${totalCards}`);
    console.log(`   • Cards with 'scans': ${cardsWithScans}`);
    console.log(`   • Cards with 'scanCount': ${cardsWithScanCount}`);
    console.log(`   • Cards with 'numberOfScan': ${cardsWithNumberOfScan}`);
    console.log(`   • Cards with multiple properties: ${cardsWithMultipleProperties}`);
    
    if (scanPropertyExamples.length > 0) {
      console.log('\n📋 Examples of cards with old scan properties:');
      scanPropertyExamples.slice(0, 10).forEach(example => {
        console.log(`   • ${example.name} (${example.userId}, card ${example.cardIndex}): ${example.property} = ${example.value}`);
      });
      
      if (scanPropertyExamples.length > 10) {
        console.log(`   • ... and ${scanPropertyExamples.length - 10} more`);
      }
    }
    
    if (cardsWithScans > 0 || cardsWithNumberOfScan > 0) {
      console.log('\n⚠️ Found cards with old scan properties that need consolidation');
      console.log('💡 Run the migration script: node migrations/consolidate-scan-properties.js');
    } else {
      console.log('\n✅ All cards already use consistent scanCount property');
    }
    
  } catch (error) {
    console.error('❌ Error checking scan properties:', error);
  }
};

// Run the check if this file is executed directly
if (require.main === module) {
  checkScanProperties()
    .then(() => {
      console.log('\n✨ Scan properties check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = {
  checkScanProperties
};
