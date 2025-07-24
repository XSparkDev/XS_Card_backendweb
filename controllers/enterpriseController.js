const { db, admin } = require('../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Get all enterprises
 */
exports.getAllEnterprises = async (req, res) => {
  try {
    const snapshot = await db.collection('enterprise').get();
    
    if (snapshot.empty) {
      return res.status(200).json({ 
        status: true,
        data: []
      });
    }

    const enterprises = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ 
      status: true,
      data: enterprises
    });
  } catch (error) {
    console.error('Error getting enterprises:', error);
    res.status(500).json({ 
      status: false, 
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
      return res.status(404).json({ 
        status: false, 
        message: 'Enterprise not found' 
      });
    }

    const enterprise = {
      id: doc.id,
      ...doc.data()
    };

    res.status(200).json({ 
      status: true,
      data: {
        enterprise
      }
    });
  } catch (error) {
    console.error('Error getting enterprise:', error);
    res.status(500).json({ 
      status: false, 
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
      return res.status(400).json({ 
        status: false, 
        message: 'Enterprise name is required' 
      });
    }

    // Use name as document ID after sanitizing it
    // Replace spaces with dashes and remove special characters
    const docId = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    
    // Check if enterprise with this name already exists
    const existingDoc = await db.collection('enterprise').doc(docId).get();
    if (existingDoc.exists) {
      return res.status(409).json({
        status: false,
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

    res.status(201).json({
      status: true,
      message: 'Enterprise created successfully',
      data: {
        enterprise: newEnterprise
      }
    });
  } catch (error) {
    console.error('Error creating enterprise:', error);
    res.status(500).json({ 
      status: false, 
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
      return res.status(404).json({ 
        status: false, 
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

    res.status(200).json({
      status: true,
      message: 'Enterprise updated successfully',
      data: {
        enterprise: updatedEnterprise
      }
    });
  } catch (error) {
    console.error('Error updating enterprise:', error);
    res.status(500).json({ 
      status: false, 
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
      return res.status(404).json({ 
        status: false, 
        message: 'Enterprise not found' 
      });
    }

    await enterpriseRef.delete();

    res.status(200).json({
      status: true,
      message: 'Enterprise deleted successfully',
      data: {
        id: enterpriseId
      }
    });
  } catch (error) {
    console.error('Error deleting enterprise:', error);
    res.status(500).json({ 
      status: false, 
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
      return res.status(404).json({ 
        status: false, 
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

    res.status(200).json({ 
      status: true,
      data: {
        stats
      }
    });
  } catch (error) {
    console.error('Error getting enterprise stats:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Failed to get enterprise stats', 
      error: error.message 
    });
  }
};

/**
 * Get enterprise invoices (for enterprise customers)
 */
exports.getEnterpriseInvoices = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get user's enterprise reference
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const enterpriseId = userData.enterpriseRef?.id;

    if (!enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'User is not associated with an enterprise'
      });
    }

    // Get enterprise invoices with fallback for missing index
    let invoicesSnapshot;
    try {
      // Try the optimized query first (requires composite index)
      invoicesSnapshot = await db.collection('enterpriseInvoices')
        .where('enterpriseId', '==', enterpriseId)
        .orderBy('date', 'desc')
        .get();
    } catch (indexError) {
      console.log('Composite index not available, using fallback query:', indexError.message);
      // Fallback: Get all invoices for enterprise without ordering
      invoicesSnapshot = await db.collection('enterpriseInvoices')
        .where('enterpriseId', '==', enterpriseId)
        .get();
    }

    const invoices = [];
    invoicesSnapshot.forEach(doc => {
      const invoiceData = doc.data();
      invoices.push({
        id: doc.id,
        waveAppsInvoiceId: invoiceData.waveAppsInvoiceId || null,
        number: invoiceData.number,
        date: invoiceData.date,
        dueDate: invoiceData.dueDate,
        amount: invoiceData.amount,
        currency: invoiceData.currency || 'ZAR',
        status: invoiceData.status,
        downloadUrl: `/api/billing/invoices/${doc.id}/download`,
        lineItems: invoiceData.lineItems || []
      });
    });

    // Sort manually by date if we used the fallback query
    if (invoices.length > 0) {
      invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    res.status(200).json({
      status: true,
      data: invoices
    });

  } catch (error) {
    console.error('Error getting enterprise invoices:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve enterprise invoices',
      error: error.message
    });
  }
};

/**
 * Download enterprise invoice PDF
 */
exports.downloadInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.uid;

    // Get user's enterprise reference
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const enterpriseId = userData.enterpriseRef?.id;

    if (!enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'User is not associated with an enterprise'
      });
    }

    // Get invoice document
    const invoiceDoc = await db.collection('enterpriseInvoices').doc(invoiceId).get();
    
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    const invoiceData = invoiceDoc.data();

    // Verify invoice belongs to user's enterprise
    if (invoiceData.enterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Unauthorized access to invoice'
      });
    }

    // For now, return a placeholder response
    // In a real implementation, you would:
    // 1. Generate PDF using a library like puppeteer or jsPDF
    // 2. Store PDFs in Firebase Storage
    // 3. Return the PDF file or signed URL
    
    res.status(200).json({
      status: true,
      message: 'Invoice PDF download functionality - placeholder implementation',
      data: {
        invoiceId: invoiceId,
        filename: `invoice-${invoiceData.number}.pdf`,
        note: 'PDF generation to be implemented with puppeteer or similar library'
      }
    });

    // Log the download attempt
    await logActivity({
      action: ACTIONS.VIEW,
      resource: 'ENTERPRISE_INVOICE',
      userId: userId,
      resourceId: invoiceId,
      details: {
        invoiceNumber: invoiceData.number,
        enterpriseId: enterpriseId
      }
    });

  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to download invoice',
      error: error.message
    });
  }
};

/**
 * Submit a demo request
 */
exports.submitDemoRequest = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      companyName,
      contactPersonName,
      email,
      phone,
      companySize,
      industry,
      estimatedUsers,
      specificRequirements,
      preferredContactTime,
      currentSolution,
      budget,
      timeline,
      inquiryType = 'demo',
      requestType = 'enterprise_demo',
      source = 'settings_billing_tab'
    } = req.body;

    // Validate required fields
    if (!companyName || !contactPersonName || !email) {
      return res.status(400).json({
        status: false,
        message: 'Company name, contact person name, and email are required'
      });
    }

    // Create demo request document
    const demoRequestData = {
      userId: userId,
      companyName,
      contactPersonName,
      email,
      phone: phone || null,
      companySize: companySize || null,
      industry: industry || null,
      estimatedUsers: estimatedUsers || null,
      specificRequirements: specificRequirements || null,
      preferredContactTime: preferredContactTime || null,
      currentSolution: currentSolution || null,
      budget: budget || null,
      timeline: timeline || null,
      inquiryType,
      requestType,
      submittedAt: new Date().toISOString(),
      source,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('demoRequests').add(demoRequestData);

    // Log the demo request
    await logActivity({
      action: ACTIONS.CREATE,
      resource: 'DEMO_REQUEST',
      userId: userId,
      resourceId: docRef.id,
      details: {
        companyName,
        contactPersonName,
        email,
        requestType,
        estimatedUsers
      }
    });

    res.status(200).json({
      status: true,
      message: 'Demo request submitted successfully',
      data: {
        inquiryId: `demo_${docRef.id}`,
        expectedResponse: 'within 24 hours'
      }
    });

  } catch (error) {
    console.error('Error submitting demo request:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to submit demo request',
      error: error.message
    });
  }
};

/**
 * Submit a general enterprise inquiry
 */
exports.submitEnterpriseInquiry = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      companyName,
      contactPersonName,
      email,
      phone,
      companySize,
      industry,
      estimatedUsers,
      specificRequirements,
      preferredContactTime,
      inquiryType = 'pricing',
      currentSolution,
      budget,
      timeline
    } = req.body;

    // Validate required fields
    if (!companyName || !contactPersonName || !email) {
      return res.status(400).json({
        status: false,
        message: 'Company name, contact person name, and email are required'
      });
    }

    // Create enterprise inquiry document
    const inquiryData = {
      userId: userId,
      companyName,
      contactPersonName,
      email,
      phone: phone || null,
      companySize: companySize || null,
      industry: industry || null,
      estimatedUsers: estimatedUsers || null,
      specificRequirements: specificRequirements || null,
      preferredContactTime: preferredContactTime || null,
      inquiryType,
      currentSolution: currentSolution || null,
      budget: budget || null,
      timeline: timeline || null,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('enterpriseInquiries').add(inquiryData);

    // Log the inquiry
    await logActivity({
      action: ACTIONS.CREATE,
      resource: 'ENTERPRISE_INQUIRY',
      userId: userId,
      resourceId: docRef.id,
      details: {
        companyName,
        contactPersonName,
        email,
        inquiryType,
        estimatedUsers
      }
    });

    res.status(200).json({
      status: true,
      message: 'Enterprise inquiry submitted successfully',
      data: {
        inquiryId: `inquiry_${docRef.id}`,
        expectedResponse: 'within 2 business days'
      }
    });

  } catch (error) {
    console.error('Error submitting enterprise inquiry:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to submit enterprise inquiry',
      error: error.message
    });
  }
};

/**
 * Helper function to create sample enterprise invoices for testing
 * This is for development/testing purposes only
 */
exports.createSampleInvoices = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    // Verify enterprise exists
    const enterpriseDoc = await db.collection('enterprise').doc(enterpriseId).get();
    if (!enterpriseDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Enterprise not found'
      });
    }

    // Create sample invoices
    const sampleInvoices = [
      {
        enterpriseId: enterpriseId,
        waveAppsInvoiceId: 'WA_INV_001',
        number: 'INV-2025-001',
        date: '2025-01-01',
        dueDate: '2025-01-31',
        amount: 12000.00,
        currency: 'ZAR',
        status: 'paid',
        lineItems: [
          {
            description: 'XSCard Enterprise License - January 2025',
            quantity: 1,
            rate: 12000.00,
            amount: 12000.00
          }
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        enterpriseId: enterpriseId,
        waveAppsInvoiceId: 'WA_INV_002',
        number: 'INV-2025-002',
        date: '2025-02-01',
        dueDate: '2025-02-28',
        amount: 12000.00,
        currency: 'ZAR',
        status: 'pending',
        lineItems: [
          {
            description: 'XSCard Enterprise License - February 2025',
            quantity: 1,
            rate: 12000.00,
            amount: 12000.00
          }
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // Add sample invoices to database
    const batch = db.batch();
    sampleInvoices.forEach(invoice => {
      const invoiceRef = db.collection('enterpriseInvoices').doc();
      batch.set(invoiceRef, invoice);
    });
    
    await batch.commit();

    res.status(200).json({
      status: true,
      message: 'Sample invoices created successfully',
      data: {
        invoicesCreated: sampleInvoices.length,
        enterpriseId: enterpriseId
      }
    });

  } catch (error) {
    console.error('Error creating sample invoices:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to create sample invoices',
      error: error.message
    });
  }
}; 