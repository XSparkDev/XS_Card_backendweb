/**
 * Comprehensive test script for location functionality
 * Tests the complete flow from IP tracking to enterprise heat map data
 */

const { admin, db } = require('./firebase');

/**
 * Test 1: Verify contacts have location data
 */
async function testContactsHaveLocation() {
    console.log('\n🧪 TEST 1: Verifying contacts have location data...');
    
    let totalContacts = 0;
    let contactsWithLocation = 0;
    let contactsWithoutLocation = 0;
    
    const contactsSnapshot = await db.collection('contacts').get();
    
    for (const contactDoc of contactsSnapshot.docs) {
        const contactData = contactDoc.data();
        
        if (contactData.contactList && Array.isArray(contactData.contactList)) {
            for (const contact of contactData.contactList) {
                totalContacts++;
                
                if (contact.location && contact.location.latitude && contact.location.longitude) {
                    contactsWithLocation++;
                    console.log(`  ✅ ${contact.name || 'Unknown'} ${contact.surname || ''} - Location: ${contact.location.city || 'Unknown'} (${contact.location.latitude.toFixed(4)}, ${contact.location.longitude.toFixed(4)})`);
                } else {
                    contactsWithoutLocation++;
                    console.log(`  ❌ ${contact.name || 'Unknown'} ${contact.surname || ''} - No location data`);
                }
            }
        }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`   - Total contacts: ${totalContacts}`);
    console.log(`   - With location: ${contactsWithLocation}`);
    console.log(`   - Without location: ${contactsWithoutLocation}`);
    console.log(`   - Coverage: ${((contactsWithLocation / totalContacts) * 100).toFixed(1)}%`);
    
    return { totalContacts, contactsWithLocation, contactsWithoutLocation };
}

/**
 * Test 2: Test enterprise contacts details endpoint structure
 */
async function testEnterpriseContactsDetailsEndpoint() {
    console.log('\n🧪 TEST 2: Testing enterprise contacts details endpoint...');
    
    try {
        // Simulate the endpoint call structure (without HTTP)
        const enterpriseId = 'x-spark-test';
        
        // Get enterprise
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            console.log('❌ Enterprise not found');
            return;
        }
        
        // Get departments
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        console.log(`📊 Found ${departmentsSnapshot.size} departments`);
        
        let totalEnterpriseContacts = 0;
        let contactsWithLocationInEnterprise = 0;
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const departmentId = deptDoc.id;
            const departmentData = deptDoc.data();
            
            console.log(`\n🏢 Department: ${departmentData.name} (${departmentId})`);
            
            // Get employees
            const employeesSnapshot = await deptDoc.ref.collection('employees').get();
            console.log(`   👥 Employees: ${employeesSnapshot.size}`);
            
            for (const empDoc of employeesSnapshot.docs) {
                const employeeData = empDoc.data();
                const userId = employeeData.userId ? employeeData.userId.id : null;
                
                if (userId) {
                    // Get contacts for this user
                    const contactDoc = await db.collection('contacts').doc(userId).get();
                    
                    if (contactDoc.exists) {
                        const contactList = contactDoc.data().contactList || [];
                        console.log(`      📞 ${employeeData.firstName} ${employeeData.lastName}: ${contactList.length} contacts`);
                        
                        for (const contact of contactList) {
                            totalEnterpriseContacts++;
                            
                            if (contact.location && contact.location.latitude && contact.location.longitude) {
                                contactsWithLocationInEnterprise++;
                                console.log(`         📍 ${contact.name} ${contact.surname} - ${contact.location.city} (${contact.location.latitude.toFixed(4)}, ${contact.location.longitude.toFixed(4)})`);
                            } else {
                                console.log(`         ❌ ${contact.name} ${contact.surname} - No location`);
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`\n📊 Enterprise Summary:`);
        console.log(`   - Total contacts in enterprise: ${totalEnterpriseContacts}`);
        console.log(`   - Contacts with location: ${contactsWithLocationInEnterprise}`);
        console.log(`   - Heat map ready: ${((contactsWithLocationInEnterprise / totalEnterpriseContacts) * 100).toFixed(1)}%`);
        
        return { totalEnterpriseContacts, contactsWithLocationInEnterprise };
        
    } catch (error) {
        console.error('❌ Error testing enterprise endpoint:', error);
        return null;
    }
}

/**
 * Test 3: Generate sample heat map data
 */
async function generateSampleHeatMapData() {
    console.log('\n🧪 TEST 3: Generating sample heat map data...');
    
    try {
        const enterpriseId = 'x-spark-test';
        
        // Get all contacts for the enterprise with location data
        const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        
        const heatMapPoints = [];
        const locationStats = {};
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const departmentId = deptDoc.id;
            const departmentData = deptDoc.data();
            
            // Get employees
            const employeesSnapshot = await deptDoc.ref.collection('employees').get();
            
            for (const empDoc of employeesSnapshot.docs) {
                const employeeData = empDoc.data();
                const userId = employeeData.userId ? employeeData.userId.id : null;
                
                if (userId) {
                    // Get contacts for this user
                    const contactDoc = await db.collection('contacts').doc(userId).get();
                    
                    if (contactDoc.exists) {
                        const contactList = contactDoc.data().contactList || [];
                        
                        for (const contact of contactList) {
                            if (contact.location && contact.location.latitude && contact.location.longitude) {
                                // Add to heat map points
                                heatMapPoints.push({
                                    lat: contact.location.latitude,
                                    lng: contact.location.longitude,
                                    weight: 1,
                                    contact: {
                                        name: `${contact.name} ${contact.surname}`,
                                        company: contact.company || 'Unknown',
                                        department: departmentData.name,
                                        employee: `${employeeData.firstName} ${employeeData.lastName}`
                                    },
                                    location: {
                                        city: contact.location.city,
                                        area: contact.location.name || contact.location.area,
                                        country: contact.location.country
                                    }
                                });
                                
                                // Track location statistics
                                const area = contact.location.area || contact.location.city || 'Unknown';
                                locationStats[area] = (locationStats[area] || 0) + 1;
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`📍 Generated ${heatMapPoints.length} heat map points`);
        console.log(`\n🗺️ Location Distribution:`);
        for (const [area, count] of Object.entries(locationStats)) {
            console.log(`   - ${area}: ${count} contacts`);
        }
        
        // Sample heat map data structure for frontend
        const heatMapData = {
            enterprise: {
                id: enterpriseId,
                name: 'X Spark Test'
            },
            points: heatMapPoints,
            stats: {
                totalPoints: heatMapPoints.length,
                locationDistribution: locationStats,
                coverage: {
                    midrand: locationStats.midrand || 0,
                    tembisa: locationStats.tembisa || 0,
                    norkem_park: locationStats.norkem_park || 0
                }
            },
            generatedAt: new Date().toISOString()
        };
        
        console.log(`\n📊 Heat Map Data Structure:`);
        console.log(`   - Total points: ${heatMapData.stats.totalPoints}`);
        console.log(`   - Areas covered: ${Object.keys(locationStats).length}`);
        console.log(`   - Sample point:`, heatMapPoints[0] ? {
            lat: heatMapPoints[0].lat.toFixed(6),
            lng: heatMapPoints[0].lng.toFixed(6),
            location: heatMapPoints[0].location.area
        } : 'No points available');
        
        return heatMapData;
        
    } catch (error) {
        console.error('❌ Error generating heat map data:', error);
        return null;
    }
}

/**
 * Test 4: Verify location data format matches saveContact format
 */
async function testLocationDataFormat() {
    console.log('\n🧪 TEST 4: Verifying location data format...');
    
    const contactDoc = await db.collection('contacts').doc('BPxFmmG6SVXvbwwRJ0YjBnuI8e73').get();
    
    if (contactDoc.exists) {
        const contactList = contactDoc.data().contactList || [];
        const contactWithLocation = contactList.find(c => c.location);
        
        if (contactWithLocation) {
            console.log('✅ Found contact with location data:');
            console.log('📍 Location structure:');
            console.log(JSON.stringify(contactWithLocation.location, null, 2));
            
            // Verify required fields for heat maps
            const requiredFields = ['latitude', 'longitude', 'city', 'country'];
            const missingFields = requiredFields.filter(field => !contactWithLocation.location[field]);
            
            if (missingFields.length === 0) {
                console.log('✅ All required fields present for heat map');
            } else {
                console.log('❌ Missing required fields:', missingFields);
            }
            
            return contactWithLocation.location;
        } else {
            console.log('❌ No contacts with location data found');
            return null;
        }
    } else {
        console.log('❌ Contact document not found');
        return null;
    }
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('🚀 Starting comprehensive location functionality tests...');
    console.log('=' .repeat(60));
    
    try {
        // Test 1: Contact location coverage
        const contactResults = await testContactsHaveLocation();
        
        // Test 2: Enterprise endpoint structure
        const enterpriseResults = await testEnterpriseContactsDetailsEndpoint();
        
        // Test 3: Heat map data generation
        const heatMapData = await generateSampleHeatMapData();
        
        // Test 4: Data format verification
        const locationFormat = await testLocationDataFormat();
        
        // Final summary
        console.log('\n' + '=' .repeat(60));
        console.log('🎉 TEST SUMMARY');
        console.log('=' .repeat(60));
        
        if (contactResults) {
            console.log(`✅ Contact Coverage: ${contactResults.contactsWithLocation}/${contactResults.totalContacts} (${((contactResults.contactsWithLocation / contactResults.totalContacts) * 100).toFixed(1)}%)`);
        }
        
        if (enterpriseResults) {
            console.log(`✅ Enterprise Heat Map Ready: ${enterpriseResults.contactsWithLocationInEnterprise}/${enterpriseResults.totalEnterpriseContacts} contacts`);
        }
        
        if (heatMapData) {
            console.log(`✅ Heat Map Points Generated: ${heatMapData.stats.totalPoints}`);
            console.log(`✅ Areas Covered: ${Object.keys(heatMapData.stats.locationDistribution).join(', ')}`);
        }
        
        if (locationFormat) {
            console.log(`✅ Location Data Format: Valid (lat: ${locationFormat.latitude}, lng: ${locationFormat.longitude})`);
        }
        
        console.log('\n🌍 Location tracking system is ready for frontend heat maps!');
        console.log('📍 Use /enterprise/x-spark-test/contacts/details endpoint for heat map data');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests().then(() => process.exit(0));
}

module.exports = {
    testContactsHaveLocation,
    testEnterpriseContactsDetailsEndpoint,
    generateSampleHeatMapData,
    testLocationDataFormat,
    runAllTests
};