/**
 * Script to retroactively add location data to existing contacts
 * Uses random locations from specified South African areas:
 * - Constantia Hotel, Midrand
 * - 1st May Street, Tembisa
 * - 1 Breerivier Street, Norkem Park
 */

const { admin, db } = require('./firebase');

// Predefined locations in the specified areas
const OFFICE_LOCATIONS = [
    {
        name: "Constantia Hotel Area, Midrand",
        latitude: -25.9895,
        longitude: 28.1279,
        city: "Midrand",
        region: "Gauteng",
        country: "South Africa",
        countryCode: "ZA",
        timezone: "Africa/Johannesburg",
        provider: "retroactive_assignment",
        area: "midrand"
    },
    {
        name: "1st May Street, Tembisa",
        latitude: -25.9957,
        longitude: 28.2293,
        city: "Tembisa",
        region: "Gauteng", 
        country: "South Africa",
        countryCode: "ZA",
        timezone: "Africa/Johannesburg",
        provider: "retroactive_assignment",
        area: "tembisa"
    },
    {
        name: "1 Breerivier Street, Norkem Park",
        latitude: -26.0327,
        longitude: 28.3473,
        city: "Kempton Park",
        region: "Gauteng",
        country: "South Africa", 
        countryCode: "ZA",
        timezone: "Africa/Johannesburg",
        provider: "retroactive_assignment",
        area: "norkem_park"
    }
];

/**
 * Generate random coordinates within ~2km radius of a base location
 */
function generateRandomLocation(baseLocation) {
    // Random offset within ~2km radius (approximately 0.018 degrees)
    const maxOffset = 0.018;
    const latOffset = (Math.random() - 0.5) * 2 * maxOffset;
    const lngOffset = (Math.random() - 0.5) * 2 * maxOffset;
    
    return {
        ...baseLocation,
        latitude: baseLocation.latitude + latOffset,
        longitude: baseLocation.longitude + lngOffset,
        createdAt: new Date(),
        assignedAt: new Date().toISOString(),
        randomized: true
    };
}

/**
 * Get a random office location
 */
function getRandomOfficeLocation() {
    const randomIndex = Math.floor(Math.random() * OFFICE_LOCATIONS.length);
    const baseLocation = OFFICE_LOCATIONS[randomIndex];
    return generateRandomLocation(baseLocation);
}

/**
 * Update contacts with location data
 */
async function addLocationToContacts() {
    try {
        console.log('🌍 Starting retroactive location assignment...');
        console.log(`📍 Using ${OFFICE_LOCATIONS.length} office locations:`);
        OFFICE_LOCATIONS.forEach(loc => {
            console.log(`   - ${loc.name} (${loc.latitude}, ${loc.longitude})`);
        });
        
        let totalContactsProcessed = 0;
        let contactsUpdated = 0;
        let contactsAlreadyHaveLocation = 0;
        let documentsProcessed = 0;
        
        // Get all contact documents
        const contactsSnapshot = await db.collection('contacts').get();
        
        console.log(`📊 Found ${contactsSnapshot.size} contact documents to process`);
        
        // Process each contact document
        for (const contactDoc of contactsSnapshot.docs) {
            documentsProcessed++;
            const contactData = contactDoc.data();
            const userId = contactDoc.id;
            
            if (!contactData.contactList || !Array.isArray(contactData.contactList)) {
                console.log(`⚠️  User ${userId} has no contact list, skipping...`);
                continue;
            }
            
            let documentUpdated = false;
            const updatedContactList = [];
            
            // Process each contact in the list
            for (let i = 0; i < contactData.contactList.length; i++) {
                const contact = contactData.contactList[i];
                totalContactsProcessed++;
                
                // Check if contact already has location data
                if (contact.location && contact.location.latitude && contact.location.longitude) {
                    console.log(`✅ Contact ${contact.name || 'Unknown'} ${contact.surname || ''} already has location data`);
                    contactsAlreadyHaveLocation++;
                    updatedContactList.push(contact);
                } else {
                    // Add random location data
                    const randomLocation = getRandomOfficeLocation();
                    const updatedContact = {
                        ...contact,
                        location: randomLocation
                    };
                    
                    console.log(`📍 Added location to ${contact.name || 'Unknown'} ${contact.surname || ''}: ${randomLocation.name}`);
                    contactsUpdated++;
                    documentUpdated = true;
                    updatedContactList.push(updatedContact);
                }
            }
            
            // Update the document if any contacts were modified
            if (documentUpdated) {
                await db.collection('contacts').doc(userId).update({
                    contactList: updatedContactList,
                    locationUpdatedAt: admin.firestore.Timestamp.now()
                });
                console.log(`💾 Updated contact document for user ${userId}`);
            }
            
            // Progress update every 10 documents
            if (documentsProcessed % 10 === 0) {
                console.log(`⏳ Progress: ${documentsProcessed}/${contactsSnapshot.size} documents processed`);
            }
        }
        
        console.log('\n🎉 Retroactive location assignment completed!');
        console.log('📊 Summary:');
        console.log(`   - Documents processed: ${documentsProcessed}`);
        console.log(`   - Total contacts processed: ${totalContactsProcessed}`);
        console.log(`   - Contacts updated with location: ${contactsUpdated}`);
        console.log(`   - Contacts already had location: ${contactsAlreadyHaveLocation}`);
        console.log(`   - Office areas used: ${OFFICE_LOCATIONS.map(l => l.area).join(', ')}`);
        
        // Show distribution of locations assigned
        const locationCounts = {};
        OFFICE_LOCATIONS.forEach(loc => {
            locationCounts[loc.area] = 0;
        });
        
        console.log('\n📈 Estimated location distribution (based on random assignment):');
        const expectedPerArea = Math.floor(contactsUpdated / OFFICE_LOCATIONS.length);
        OFFICE_LOCATIONS.forEach(loc => {
            console.log(`   - ${loc.name}: ~${expectedPerArea} contacts`);
        });
        
    } catch (error) {
        console.error('❌ Error adding location data to contacts:', error);
        throw error;
    }
}

/**
 * Test the location generation
 */
async function testLocationGeneration() {
    console.log('🧪 Testing location generation...');
    
    for (let i = 0; i < 5; i++) {
        const location = getRandomOfficeLocation();
        console.log(`Test ${i + 1}: ${location.name} - (${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)})`);
    }
}

/**
 * Preview what will be updated without making changes
 */
async function previewUpdates() {
    try {
        console.log('👀 Previewing what will be updated...');
        
        let totalContacts = 0;
        let contactsNeedingLocation = 0;
        let documentsWithContacts = 0;
        
        const contactsSnapshot = await db.collection('contacts').get();
        
        for (const contactDoc of contactsSnapshot.docs) {
            const contactData = contactDoc.data();
            const userId = contactDoc.id;
            
            if (contactData.contactList && Array.isArray(contactData.contactList)) {
                documentsWithContacts++;
                
                for (const contact of contactData.contactList) {
                    totalContacts++;
                    
                    if (!contact.location || !contact.location.latitude) {
                        contactsNeedingLocation++;
                    }
                }
            }
        }
        
        console.log('📊 Preview Results:');
        console.log(`   - Total contact documents: ${contactsSnapshot.size}`);
        console.log(`   - Documents with contact lists: ${documentsWithContacts}`);
        console.log(`   - Total contacts: ${totalContacts}`);
        console.log(`   - Contacts needing location data: ${contactsNeedingLocation}`);
        console.log(`   - Contacts already have location: ${totalContacts - contactsNeedingLocation}`);
        
    } catch (error) {
        console.error('❌ Error previewing updates:', error);
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'preview';
    
    try {
        switch (command) {
            case 'test':
                await testLocationGeneration();
                break;
            case 'preview':
                await previewUpdates();
                break;
            case 'update':
                console.log('⚠️  This will modify your database. Are you sure? (This script will proceed in 5 seconds)');
                console.log('⚠️  Press Ctrl+C to cancel...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                await addLocationToContacts();
                break;
            default:
                console.log('Usage: node add-location-to-contacts.js [command]');
                console.log('Commands:');
                console.log('  test     - Test location generation');
                console.log('  preview  - Preview what will be updated (default)');
                console.log('  update   - Actually update the contacts with location data');
        }
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    addLocationToContacts,
    testLocationGeneration,
    previewUpdates,
    OFFICE_LOCATIONS
};