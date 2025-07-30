const { db } = require('../firebase.js');

// Random company names for variety
const randomCompanies = [
    'TechCorp Solutions',
    'Global Innovations Inc',
    'Digital Dynamics',
    'Creative Studios',
    'Future Systems',
    'Smart Solutions',
    'Innovation Hub',
    'Digital Creations',
    'Tech Pioneers',
    'Creative Minds',
    'Digital Ventures',
    'Innovation Labs',
    'Tech Solutions',
    'Creative Agency',
    'Digital Partners',
    'Innovation Works',
    'Tech Studio',
    'Creative Solutions',
    'Digital Innovations',
    'Tech Hub'
];

function getRandomCompany() {
    return randomCompanies[Math.floor(Math.random() * randomCompanies.length)];
}

async function addRandomCompaniesToContacts() {
    try {
        console.log('🔄 Adding random companies to existing contacts...');
        
        // Get all contacts documents
        const contactsSnapshot = await db.collection('contacts').get();
        
        let updatedCount = 0;
        let totalContacts = 0;
        
        for (const doc of contactsSnapshot.docs) {
            const contactData = doc.data();
            const contactList = contactData.contactList || [];
            
            let hasChanges = false;
            
            // Check each contact in the list
            for (let i = 0; i < contactList.length; i++) {
                const contact = contactList[i];
                totalContacts++;
                
                // If contact doesn't have a company field, add one
                if (!contact.company) {
                    contactList[i] = {
                        ...contact,
                        company: getRandomCompany()
                    };
                    hasChanges = true;
                    updatedCount++;
                    console.log(`✅ Added company "${contactList[i].company}" to ${contact.name} ${contact.surname}`);
                }
            }
            
            // Update the document if there were changes
            if (hasChanges) {
                await doc.ref.update({
                    contactList: contactList
                });
                console.log(`📝 Updated contact document for user: ${doc.id}`);
            }
        }
        
        console.log(`\n🎉 Successfully updated ${updatedCount} contacts with random companies!`);
        console.log(`📊 Total contacts processed: ${totalContacts}`);
        console.log(`📊 Contacts updated: ${updatedCount}`);
        console.log(`📊 Contacts already had companies: ${totalContacts - updatedCount}`);
        
    } catch (error) {
        console.error('❌ Error adding random companies:', error);
    }
}

// Run the script
addRandomCompaniesToContacts()
    .then(() => {
        console.log('✅ Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }); 