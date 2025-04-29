const { db, admin } = require('../firebase');

/**
 * Get all enterprises
 */
exports.getAllEnterprises = async (req, res) => {
  try {
    const snapshot = await db.collection('enterprise').get();
    
    if (snapshot.empty) {
      return res.status(200).send({ enterprises: [] });
    }

    const enterprises = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).send({ enterprises });
  } catch (error) {
    console.error('Error getting enterprises:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to get enterprises', 
      error: error.message 
    });
  }
};

/**
 * Get enterprise by ID
 */
exports.getEnterpriseById = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    const doc = await db.collection('enterprise').doc(enterpriseId).get();
    
    if (!doc.exists) {
      return res.status(404).send({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    const enterprise = {
      id: doc.id,
      ...doc.data()
    };

    res.status(200).send({ enterprise });
  } catch (error) {
    console.error('Error getting enterprise:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to get enterprise', 
      error: error.message 
    });
  }
};

/**
 * Create a new enterprise
 */
exports.createEnterprise = async (req, res) => {
  try {
    const { 
      name, description, industry, website, logoUrl, 
      colorScheme, companySize, address 
    } = req.body;

    if (!name) {
      return res.status(400).send({ 
        success: false, 
        message: 'Enterprise name is required' 
      });
    }

    // Use name as document ID after sanitizing it
    // Replace spaces with dashes and remove special characters
    const docId = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    
    // Check if enterprise with this name already exists
    const existingDoc = await db.collection('enterprise').doc(docId).get();
    if (existingDoc.exists) {
      return res.status(409).send({
        success: false,
        message: 'Enterprise with this name already exists'
      });
    }

    const enterpriseData = {
      name,
      description: description || '',
      industry: industry || '',
      website: website || '',
      logoUrl: logoUrl || '',
      colorScheme: colorScheme || '',
      companySize: companySize || '',
      address: address || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Use set with document ID instead of add
    await db.collection('enterprise').doc(docId).set(enterpriseData);
    
    const newEnterprise = {
      id: docId,
      ...enterpriseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).send({
      success: true,
      message: 'Enterprise created successfully',
      enterprise: newEnterprise
    });
  } catch (error) {
    console.error('Error creating enterprise:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to create enterprise', 
      error: error.message 
    });
  }
};

/**
 * Update an enterprise
 */
exports.updateEnterprise = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { 
      name, description, industry, website, logoUrl, 
      colorScheme, companySize, address 
    } = req.body;

    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const doc = await enterpriseRef.get();

    if (!doc.exists) {
      return res.status(404).send({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (industry !== undefined) updates.industry = industry;
    if (website !== undefined) updates.website = website;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (colorScheme !== undefined) updates.colorScheme = colorScheme;
    if (companySize !== undefined) updates.companySize = companySize;
    if (address !== undefined) updates.address = address;
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await enterpriseRef.update(updates);

    const updatedDoc = await enterpriseRef.get();
    const updatedEnterprise = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).send({
      success: true,
      message: 'Enterprise updated successfully',
      enterprise: updatedEnterprise
    });
  } catch (error) {
    console.error('Error updating enterprise:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to update enterprise', 
      error: error.message 
    });
  }
};

/**
 * Delete an enterprise
 */
exports.deleteEnterprise = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const doc = await enterpriseRef.get();

    if (!doc.exists) {
      return res.status(404).send({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    await enterpriseRef.delete();

    res.status(200).send({
      success: true,
      message: 'Enterprise deleted successfully',
      id: enterpriseId
    });
  } catch (error) {
    console.error('Error deleting enterprise:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to delete enterprise', 
      error: error.message 
    });
  }
};

/**
 * Get enterprise statistics
 * Note: This is a placeholder for the stats endpoint
 */
exports.getEnterpriseStats = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    const doc = await db.collection('enterprise').doc(enterpriseId).get();
    
    if (!doc.exists) {
      return res.status(404).send({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    // This is a placeholder - implement actual stats logic as needed
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      departments: 0,
      lastActivity: new Date().toISOString()
    };

    res.status(200).send({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error('Error getting enterprise stats:', error);
    res.status(500).send({ 
      success: false, 
      message: 'Failed to get enterprise stats', 
      error: error.message 
    });
  }
}; 