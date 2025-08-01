const { db, admin } = require('../firebase.js');
const QRCode = require('qrcode');
const axios = require('axios');
const config = require('../config/config');
const { formatDate } = require('../utils/dateFormatter');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

// Shared error response helper
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        message,
        ...(error && { error: error.message })
    });
};

// Shared validation helper
const validateUserAccess = async (userId, userUid) => {
    if (userUid !== userId) {
        throw new Error('Unauthorized access');
    }
};

// Add this function at the top with other helper functions
const logPasscreatorConfig = () => {
  console.log('=== Passcreator Configuration ===');
  console.log('PASSCREATOR_BASE_URL:', process.env.PASSCREATOR_BASE_URL || 'Not set');
  console.log('PASSCREATOR_TEMPLATE_ID:', process.env.PASSCREATOR_TEMPLATE_ID || 'Not set');
  console.log('PASSCREATOR_API_KEY:', process.env.PASSCREATOR_API_KEY ? '✓ Present' : '✗ Missing');
  console.log('PASSCREATOR_PUBLIC_URL:', config.PASSCREATOR_PUBLIC_URL || 'Not set');
  console.log('==============================');
};

exports.getAllCards = async (req, res) => {
    try {
        console.log('Fetching all cards...');
        const cardsRef = db.collection('cards');
        const snapshot = await cardsRef.get();
        
        if (snapshot.empty) {
            console.log('No cards found in collection');
            return res.status(404).send({ message: 'No cards found' });
        }

        const cards = [];
        snapshot.forEach(doc => {
            cards.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Found ${cards.length} cards`);
        res.status(200).send(cards);
    } catch (error) {
        sendError(res, 500, 'Error fetching cards', error);
    }
};

exports.getCardById = async (req, res) => {
    const { id } = req.params;
    try {
        const cardRef = db.collection('cards').doc(id);
        const doc = await cardRef.get();
        
        if (!doc.exists || !doc.data().cards) {
            return res.status(404).send({ message: 'No cards found for this user' });
        }

        // Convert Firestore timestamps to readable dates
        const data = doc.data();
        if (data.cards) {
            data.cards = data.cards.map(card => ({
                ...card,
                createdAt: formatDate(card.createdAt) // Format for display
            }));
        }
        
        res.status(200).send(data.cards);
    } catch (error) {
        console.error('Error fetching card:', error);
        res.status(500).send({ message: 'Error fetching card', error: error.message });
    }
};

exports.addCard = async (req, res) => {
    try {
        const userId = req.user.uid;
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized access - no user ID' 
            });
        }

        // Enhanced debug logging
        console.log('Request headers:', req.headers);
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);

        const { 
            company, 
            email, 
            phone, 
            title, 
            name,
            surname,
            socials,
            ...otherFields
        } = req.body;

        // Validate fields are not only present but also have values
        const requiredFields = ['company', 'email', 'phone', 'title'];
        const missingFields = requiredFields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || value === '';
        });
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields', 
                missingFields,
                receivedFields: req.body // Add this to see what fields were actually received
            });
        }

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        // Handle file URLs from Firebase Storage
        let profileImageUrl = null;
        let companyLogoUrl = null;

        if (req.firebaseStorageUrls) {
            profileImageUrl = req.firebaseStorageUrls.profileImage || null;
            companyLogoUrl = req.firebaseStorageUrls.companyLogo || null;
        }

        // Handle socials normalization (same logic as updateCard)
        let normalizedSocials = {};
        if (socials) {
            if (typeof socials === 'string') {
                try {
                    // Parse JSON string to object
                    const parsedSocials = JSON.parse(socials);
                    Object.keys(parsedSocials).forEach(platform => {
                        const socialData = parsedSocials[platform];
                        if (socialData && typeof socialData === 'object' && socialData.link && socialData.title) {
                            normalizedSocials[platform] = {
                                link: socialData.link,
                                title: socialData.title
                            };
                        }
                    });
                } catch (e) {
                    console.warn('Failed to parse socials JSON string:', e.message);
                }
            } else if (typeof socials === 'object') {
                // Already an object, normalize it
                Object.keys(socials).forEach(platform => {
                    const socialData = socials[platform];
                    if (socialData && typeof socialData === 'object' && socialData.link && socialData.title) {
                        normalizedSocials[platform] = {
                            link: socialData.link,
                            title: socialData.title
                        };
                    }
                });
            }
        }
        
        // Also handle individual social media fields (for backward compatibility)
        const socialPlatforms = ['linkedin', 'twitter', 'github', 'facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp', 'telegram', 'snapchat', 'pinterest'];
        const individualSocials = {};
        
        socialPlatforms.forEach(platform => {
            if (otherFields[platform] && typeof otherFields[platform] === 'object' && otherFields[platform].link && otherFields[platform].title) {
                individualSocials[platform] = {
                    link: otherFields[platform].link,
                    title: otherFields[platform].title
                };
            }
        });
        
        // Merge individual socials into the main socials object
        const finalSocials = {
            ...normalizedSocials,
            ...individualSocials
        };

        const newCard = {
            company,
            email,
            phone,
            occupation: title,
            name: name || '',
            surname: surname || '',
            socials: finalSocials, // Store all socials in the socials object
            colorScheme: '#1B2B5B',
            createdAt: admin.firestore.Timestamp.now(), // Store as Firestore Timestamp
            profileImage: profileImageUrl,
            companyLogo: companyLogoUrl
        };

        console.log('Creating new card:', newCard); // Debug log

        if (cardDoc.exists) {
            await cardRef.update({
                cards: admin.firestore.FieldValue.arrayUnion(newCard)
            });
        } else {
            await cardRef.set({
                cards: [newCard]
            });
        }
        
        // Ensure this runs before sending the response
        // Add try/catch to prevent errors from breaking the response
        try {
            await logActivity({
                action: ACTIONS.CREATE,
                resource: RESOURCES.CARD,
                userId: userId,
                resourceId: cardRef.id,
                details: {
                    cardType: title || 'Business Card',
                    company: company,
                    colorScheme: '#1B2B5B'
                }
            });
            console.log('Card creation logged successfully');
        } catch (logError) {
            console.error('Error logging card creation:', logError);
        }
        
        // Format the response
        const responseCard = {
            ...newCard,
            createdAt: formatDate(newCard.createdAt) // Format for display
        };
        
        res.status(201).json({ 
            success: true,
            message: 'Card added successfully',
            cardData: responseCard
        });
    } catch (error) {
        console.error('Error in addCard:', error); // Debug log
        
        // Log error activity - use try/catch to ensure error handling continues
        try {
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.CARD,
                userId: req.user?.uid || 'unknown',
                status: 'error',
                details: {
                    error: error.message,
                    operation: 'create_card'
                }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        res.status(500).json({
            success: false,
            message: 'Error adding card',
            error: error.message
        });
    }
};

// Update the updateCard function to handle both JSON and multipart/form-data
exports.updateCard = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex = 0 } = req.query;

    try {
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: 'User cards not found',
                error: 'Cards not found'
            });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return res.status(404).json({
                success: false,
                message: 'Card not found at specified index',
                error: 'Card not found'
            });
        }

        let updateData = {};

        // Handle file upload using Firebase Storage
        if (req.file && req.file.firebaseUrl) {
            if (req.body.imageType === 'profileImage') {
                updateData.profileImage = req.file.firebaseUrl;
            } else if (req.body.imageType === 'companyLogo') {
                updateData.companyLogo = req.file.firebaseUrl;
            }
        } else if (req.body) {
            // If no file but has body data, it's a regular update
            updateData = JSON.parse(JSON.stringify(req.body));
            
            // Handle socials normalization for updates (same logic as addCard)
            if (req.body.socials) {
                let normalizedSocials = {};
                
                if (typeof req.body.socials === 'string') {
                    try {
                        // Parse JSON string to object
                        const parsedSocials = JSON.parse(req.body.socials);
                        Object.keys(parsedSocials).forEach(platform => {
                            const socialData = parsedSocials[platform];
                            if (socialData && typeof socialData === 'object' && socialData.link && socialData.title) {
                                normalizedSocials[platform] = {
                                    link: socialData.link,
                                    title: socialData.title
                                };
                            }
                        });
                    } catch (e) {
                        console.warn('Failed to parse socials JSON string:', e.message);
                    }
                } else if (typeof req.body.socials === 'object') {
                    // Already an object, normalize it
                    Object.keys(req.body.socials).forEach(platform => {
                        const socialData = req.body.socials[platform];
                        if (socialData && typeof socialData === 'object' && socialData.link && socialData.title) {
                            normalizedSocials[platform] = {
                                link: socialData.link,
                                title: socialData.title
                            };
                        }
                    });
                }
                
                updateData.socials = normalizedSocials;
            }
            
            // Also handle individual social media fields (for backward compatibility)
            const socialPlatforms = ['linkedin', 'twitter', 'github', 'facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp', 'telegram', 'snapchat', 'pinterest'];
            const individualSocials = {};
            
            socialPlatforms.forEach(platform => {
                if (req.body[platform] && typeof req.body[platform] === 'object' && req.body[platform].link && req.body[platform].title) {
                    individualSocials[platform] = {
                        link: req.body[platform].link,
                        title: req.body[platform].title
                    };
                }
            });
            
            // Merge individual socials into the main socials object
            if (Object.keys(individualSocials).length > 0) {
                updateData.socials = {
                    ...(updateData.socials || {}),
                    ...individualSocials
                };
            }
        }

        // Update the specific card in the array
        const updatedCards = [...cardsData.cards];
        updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            ...updateData
        };

        // Update the document
        await cardRef.update({
            cards: updatedCards
        });

        // Log card update activity
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.CARD,
            userId: userId,
            resourceId: cardRef.id,
            details: {
                cardIndex: parseInt(cardIndex),
                updatedFields: Object.keys(updateData),
                company: updatedCards[cardIndex].company
            }
        });

        // Format response to match EditCardResponse interface
        const responseData = {
            id: cardIndex.toString(), // Use card index as ID
            name: updatedCards[cardIndex].name || '',
            surname: updatedCards[cardIndex].surname || '',
            occupation: updatedCards[cardIndex].occupation || '',
            email: updatedCards[cardIndex].email || '',
            phone: updatedCards[cardIndex].phone || '',
            colorScheme: updatedCards[cardIndex].colorScheme || '#1B2B5B',
            departmentName: updatedCards[cardIndex].departmentName || undefined,
            employeeTitle: updatedCards[cardIndex].employeeTitle || undefined,
            profileImage: updatedCards[cardIndex].profileImage || undefined,
            companyLogo: updatedCards[cardIndex].companyLogo || undefined,
            numberOfScan: updatedCards[cardIndex].scanCount || 0, // Map scanCount to numberOfScan
            // Include socials object with normalized structure
            socials: updatedCards[cardIndex].socials || {}
        };

        res.status(200).json({
            success: true,
            message: 'Card updated successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Update card error:', error);
        
        // Log error activity
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CARD,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_card',
                cardIndex: cardIndex
            }
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to update card',
            error: error.message
        });
    }
};

exports.deleteCard = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex } = req.query;
    
    try {
        console.log('Delete request received:', { userId, cardIndex }); // Debug log

        // Ensure proper content type is set
        res.setHeader('Content-Type', 'application/json');

        // Validate cardIndex
        const parsedIndex = parseInt(cardIndex);
        if (isNaN(parsedIndex)) {
            console.log('Invalid card index:', cardIndex); // Debug log
            return res.status(400).json({ 
                success: false,
                message: 'Invalid card index'
            });
        }

        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();
        
        if (!doc.exists) {
            console.log('User cards not found for:', userId); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'User cards not found' 
            });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !Array.isArray(cardsData.cards)) {
            console.log('No cards array found for user:', userId); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'No cards found for user' 
            });
        }

        if (parsedIndex < 0 || parsedIndex >= cardsData.cards.length) {
            console.log('Card index out of range:', { parsedIndex, totalCards: cardsData.cards.length }); // Debug log
            return res.status(404).json({ 
                success: false,
                message: 'Card index out of range' 
            });
        }

        // Remove the card at the specified index
        const updatedCards = cardsData.cards.filter((_, index) => index !== parsedIndex);

        // Update the document with the modified array
        await cardRef.update({
            cards: updatedCards
        });

        // Log card deletion activity
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.CARD,
            userId: userId,
            resourceId: cardRef.id,
            details: {
                cardIndex: parsedIndex,
                remainingCards: updatedCards.length,
                deletedCardName: cardsData.cards[parsedIndex]?.name || 'Unknown'
            }
        });

        // Format the cards before sending
        const formattedCards = updatedCards.map(card => ({
            ...card,
            createdAt: {
                _seconds: card.createdAt?._seconds || 0,
                _nanoseconds: card.createdAt?._nanoseconds || 0
            }
        }));

        console.log('Card deleted successfully:', { userId, cardIndex, remainingCards: updatedCards.length }); // Debug log

        // Return success response with formatted cards array
        const response = {
            success: true,
            message: 'Card deleted successfully',
            cards: formattedCards,
            deletedCardIndex: parsedIndex
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Delete card error:', error);
        
        // Log error activity
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CARD,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'delete_card',
                cardIndex: cardIndex
            }
        });
        
        return res.status(500).json({
            success: false,
            message: 'Failed to delete card',
            error: error.message
        });
    }
};

exports.generateQR = async (req, res) => {
    const { userId, cardIndex } = req.params;
    
    try {
        await validateUserAccess(userId, req.user.uid);

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();
        
        if (!cardDoc.exists) {
            return sendError(res, 404, 'User cards not found');
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return sendError(res, 404, 'Card not found at specified index');
        }

        // Create URL with both userId and cardIndex
        const redirectUrl = `${req.protocol}://${req.get('host')}/saveContact?userId=${userId}&cardIndex=${cardIndex}`;
        
        // Generate QR code with better quality settings
        const qrCodeBuffer = await QRCode.toBuffer(redirectUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Removed QR code generation logging - no need to track this high-volume action

        res.setHeader('Content-Type', 'image/png');
        res.status(200).send(qrCodeBuffer);
    } catch (error) {
        // Keep error logging for debugging purposes
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.QR_CODE,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'generate_qr',
                cardIndex: cardIndex
            }
        });
        
        sendError(res, error.message === 'Unauthorized access' ? 403 : 500, 
            'Failed to generate QR code', error);
    }
};

exports.updateCardColor = async (req, res) => {
    const { id: userId } = req.params;
    const { cardIndex } = req.query;
    const { color } = req.body;
    
    if (!cardIndex && cardIndex !== 0) {
        return res.status(400).send({ message: 'Card index is required' });
    }

    if (!color) {
        return res.status(400).send({ message: 'Color is required' });
    }

    try {
        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = doc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        // Update the color of the specific card
        const updatedCards = [...cardsData.cards];
        updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            colorScheme: color
        };

        // Update the document with the modified array
        await cardRef.update({
            cards: updatedCards
        });

        // Log card color update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.CARD,
            userId: userId,
            resourceId: cardRef.id,
            details: {
                cardIndex: parseInt(cardIndex),
                updateType: 'color',
                oldColor: cardsData.cards[cardIndex].colorScheme,
                newColor: color
            }
        });

        res.status(200).send({ 
            message: 'Card color updated successfully',
            color,
            cardIndex: cardIndex
        });
    } catch (error) {
        // Log error activity
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.CARD,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_card_color',
                cardIndex: cardIndex
            }
        });
        
        sendError(res, 500, 'Failed to update card color', error);
    }
};

exports.createWalletPass = async (req, res) => {
    const { userId, cardIndex = 0 } = req.params;
    const { skipImages } = req.query;

    try {
        // Log configuration before making the request
        logPasscreatorConfig();
        console.log('\nCreating wallet pass for:', { userId, cardIndex });

        // Validate required environment variables
        if (!process.env.PASSCREATOR_BASE_URL || 
            !process.env.PASSCREATOR_TEMPLATE_ID || 
            !process.env.PASSCREATOR_API_KEY || 
            !config.PASSCREATOR_PUBLIC_URL) {
            throw new Error('Missing required Passcreator configuration');
        }

        const cardRef = db.collection('cards').doc(userId);
        const cardDoc = await cardRef.get();

        if (!cardDoc.exists) {
            console.log('Card document not found for userId:', userId);
            return res.status(404).send({ message: 'User cards not found' });
        }

        const cardsData = cardDoc.data();
        if (!cardsData.cards || !cardsData.cards[cardIndex]) {
            console.log('Card not found at index:', cardIndex);
            return res.status(404).send({ message: 'Card not found at specified index' });
        }

        const card = cardsData.cards[cardIndex];
        
        // Check if we should skip images
        const isLocalIp = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(config.PASSCREATOR_PUBLIC_URL);
        const shouldSkipImages = skipImages === 'true' || isLocalIp;
        const environment = isLocalIp ? 'development' : 'production';
        
        // Prepare pass data
        const passData = {
            name: `${card.name} ${card.surname}`,
            company: card.company,
            jobTitle: card.occupation,
            barcodeValue: `${config.PASSCREATOR_PUBLIC_URL}/queries.html?userId=${userId}&cardIndex=${cardIndex}`
        };

        // Add images only if we shouldn't skip them
        if (!shouldSkipImages) {
            if (card.profileImage) {
                passData.urlToThumbnail = `${config.PASSCREATOR_PUBLIC_URL}${card.profileImage}`;
            }
            if (card.companyLogo) {
                passData.urlToLogo = `${config.PASSCREATOR_PUBLIC_URL}${card.companyLogo}`;
            }
        }

        // Make a single API call with the correct data
        const response = await axios.post(
            `${process.env.PASSCREATOR_BASE_URL}/api/pass?passtemplate=${process.env.PASSCREATOR_TEMPLATE_ID}&zapierStyle=true`,
            passData,
            {
                headers: {
                    'Authorization': process.env.PASSCREATOR_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Passcreator API Response:', {
            uri: response.data.uri,
            fileUrl: response.data.linkToPassFile,
            pageUrl: response.data.linkToPassPage,
            identifier: response.data.identifier
        });

        // Enhanced wallet pass creation logging
        await logActivity({
            action: ACTIONS.CREATE,
            resource: RESOURCES.WALLET_PASS,
            userId: userId,
            resourceId: response.data.identifier || `${userId}_${cardIndex}`,
            details: {
                cardIndex: parseInt(cardIndex),
                passUri: response.data.uri,
                imagesIncluded: !shouldSkipImages,
                environment: environment,
                imageSkipReason: skipImages === 'true' ? 'explicit_skip' : (isLocalIp ? 'local_environment' : null),
                cardName: card.name,
                company: card.company
            }
        });

        res.status(200).send({
            message: 'Wallet pass created successfully',
            passUri: response.data.uri,
            passFileUrl: response.data.linkToPassFile,
            passPageUrl: response.data.linkToPassPage,
            identifier: response.data.identifier,
            cardIndex: cardIndex,
            imagesIncluded: !shouldSkipImages,
            warning: shouldSkipImages ? 'Images were skipped due to local development environment or query parameter.' : null
        });

    } catch (error) {
        console.error('Error creating wallet pass:', {
            message: error.message,
            response: error.response?.data,
            config: error.config
        });

        // Enhanced error logging
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.WALLET_PASS,
            userId: userId,
            status: 'error',
            details: {
                error: error.message,
                operation: 'create_wallet_pass',
                cardIndex: cardIndex,
                environment: /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(config.PASSCREATOR_PUBLIC_URL) ? 'development' : 'production',
                errorResponse: error.response?.data?.ErrorMessage || 'Unknown error'
            }
        });

        // Check if error is due to image access issue
        if (error.response?.data?.ErrorMessage === 'Thumbnail could not be imported from given URL') {
            try {
                // Try again without images
                console.log('Retrying without images...');
                
                const card = (await db.collection('cards').doc(userId).get()).data().cards[cardIndex];
                
                const passData = {
                    name: `${card.name} ${card.surname}`,
                    company: card.company,
                    jobTitle: card.occupation,
                    barcodeValue: `${config.PASSCREATOR_PUBLIC_URL}/queries.html?userId=${userId}&cardIndex=${cardIndex}`
                };
                
                const response = await axios.post(
                    `${process.env.PASSCREATOR_BASE_URL}/api/pass?passtemplate=${process.env.PASSCREATOR_TEMPLATE_ID}&zapierStyle=true`,
                    passData,
                    {
                        headers: {
                            'Authorization': process.env.PASSCREATOR_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                return res.status(200).send({
                    message: 'Wallet pass created successfully without images',
                    passUri: response.data.uri,
                    passFileUrl: response.data.linkToPassFile,
                    passPageUrl: response.data.linkToPassPage,
                    identifier: response.data.identifier,
                    cardIndex: cardIndex,
                    imagesIncluded: false,
                    warning: 'Images could not be accessed by the wallet service and were omitted.'
                });
                
            } catch (retryError) {
                console.error('Error retrying without images:', retryError);
                return res.status(500).send({
                    message: 'Failed to create wallet pass after retrying without images',
                    error: retryError.message,
                    details: 'Please try again later or contact support.'
                });
            }
        }

        // Extract specific error message if available
        let errorMessage = 'Failed to create wallet pass';
        let detailedError = 'No additional details available';
        
        if (error.response?.data) {
            if (error.response.data.ErrorMessage) {
                errorMessage = error.response.data.ErrorMessage;
                detailedError = 'Please try again or contact support.';
            } else {
                detailedError = JSON.stringify(error.response.data);
            }
        }

        // Send a more user-friendly error response
        res.status(500).send({
            message: errorMessage,
            error: error.message,
            details: detailedError
        });
    }
};
