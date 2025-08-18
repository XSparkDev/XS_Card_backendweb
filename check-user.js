const { db } = require('./firebase.js');

async function checkUser() {
    try {
        console.log('Checking user: EccyMCv7uiS1eYHB3ZMu6zRR1DG2');
        const userDoc = await db.collection('users').doc('EccyMCv7uiS1eYHB3ZMu6zRR1DG2').get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User data:', JSON.stringify(userData, null, 2));
            
            if (userData.enterpriseRef) {
                console.log('User has enterprise association:', userData.enterpriseRef.id);
            } else {
                console.log('User has NO enterprise association');
            }
        } else {
            console.log('User not found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkUser();


async function checkUser() {
    try {
        console.log('Checking user: EccyMCv7uiS1eYHB3ZMu6zRR1DG2');
        const userDoc = await db.collection('users').doc('EccyMCv7uiS1eYHB3ZMu6zRR1DG2').get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User data:', JSON.stringify(userData, null, 2));
            
            if (userData.enterpriseRef) {
                console.log('User has enterprise association:', userData.enterpriseRef.id);
            } else {
                console.log('User has NO enterprise association');
            }
        } else {
            console.log('User not found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkUser();
