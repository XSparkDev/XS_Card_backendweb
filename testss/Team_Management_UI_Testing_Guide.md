# Team Management - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Team Management endpoints during end-to-end testing. All endpoints require Firebase authentication and are scoped to specific departments within enterprises.

## Base Configuration

### Server URL
```
Base URL: http://localhost:8383
```

### Authentication
All endpoints require Firebase ID token in the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${firebaseIdToken}`,
  'Content-Type': 'application/json'
}
```

### Response Format
All endpoints return standardized responses:
```javascript
{
  success: boolean,
  message?: string,
  data?: object,
  error?: string
}
```

### Enterprise & Department Context
All team endpoints are scoped to a specific department within an enterprise:
```
/enterprise/{enterpriseId}/departments/{departmentId}/teams/{teamId}/...
```

---

## 1. Authentication Setup

### Get Firebase ID Token
```javascript
// Using Firebase Auth
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(
  auth, 
  'testehakke@gufum.com', 
  '123456'
);

const idToken = await userCredential.user.getIdToken();
```

### Test Authentication
```javascript
const testAuth = async () => {
  try {
    const response = await fetch('http://localhost:8383/SignIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testehakke@gufum.com',
        password: '123456'
      })
    });
    
    const result = await response.json();
    console.log('Auth Result:', result);
    return result.token;
  } catch (error) {
    console.error('Authentication failed:', error);
  }
};
```

---

## 2. Team CRUD Operations

### 2.1 Get All Teams in Department
```javascript
const getAllTeams = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Teams:', result);
    return result.teams;
  } catch (error) {
    console.error('Failed to get teams:', error);
  }
};
```

**Usage:**
```javascript
const teams = await getAllTeams(token, 'x-spark-test', 'testdep');
```

**Expected Response:**
```javascript
{
  success: true,
  teams: {
    "ui-test-team": {
      id: "ui-test-team",
      name: "UI Test Team",
      description: "Team created via UI testing",
      departmentId: "testdep",
      departmentRef: {/* Firestore reference */},
      createdAt: {/* Firestore timestamp */},
      updatedAt: {/* Firestore timestamp */},
      leaderId: null,
      leaderRef: null,
      memberCount: 0
    }
  }
}
```

### 2.2 Get Team by ID
```javascript
const getTeamById = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Team Details:', result);
    return result.team;
  } catch (error) {
    console.error('Failed to get team:', error);
  }
};
```

**Usage:**
```javascript
const team = await getTeamById(token, 'x-spark-test', 'testdep', 'ui-test-team');
```

### 2.3 Create Team
```javascript
const createTeam = async (token, enterpriseId, departmentId, teamData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(teamData)
    });
    
    const result = await response.json();
    console.log('Team Created:', result);
    return result.team;
  } catch (error) {
    console.error('Failed to create team:', error);
  }
};
```

**Usage:**
```javascript
const newTeam = await createTeam(token, 'x-spark-test', 'testdep', {
  name: "Development Team",
  description: "Software development team",
  leaderId: null // Optional: ID of team leader employee
});
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Team created successfully",
  team: {
    id: "development-team",
    name: "Development Team",
    description: "Software development team",
    departmentId: "testdep",
    departmentRef: {/* Firestore reference */},
    createdAt: {/* Firestore timestamp */},
    updatedAt: {/* Firestore timestamp */},
    leaderId: null,
    leaderRef: null,
    memberCount: 0
  }
}
```

**Error Response (Duplicate Name):**
```javascript
{
  success: false,
  message: "A team with this name already exists in this department"
}
```

### 2.4 Update Team
```javascript
const updateTeam = async (token, enterpriseId, departmentId, teamId, updateData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log('Team Updated:', result);
    return result.team;
  } catch (error) {
    console.error('Failed to update team:', error);
  }
};
```

**Usage:**
```javascript
const updatedTeam = await updateTeam(token, 'x-spark-test', 'testdep', 'development-team', {
  name: "Updated Development Team",
  description: "Updated software development team description"
});
```

### 2.5 Patch Team
```javascript
const patchTeam = async (token, enterpriseId, departmentId, teamId, patchData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchData)
    });
    
    const result = await response.json();
    console.log('Team Patched:', result);
    return result.team;
  } catch (error) {
    console.error('Failed to patch team:', error);
  }
};
```

**Usage:**
```javascript
const patchedTeam = await patchTeam(token, 'x-spark-test', 'testdep', 'development-team', {
  description: "Patched description via PATCH method"
});
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Team updated successfully",
  team: {
    id: "development-team",
    name: "Updated Development Team",
    description: "Patched description via PATCH method",
    updatedAt: {/* Firestore timestamp */}
  }
}
```

### 2.6 Delete Team
```javascript
const deleteTeam = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Team Deleted:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete team:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Team deleted successfully",
  teamId: "development-team"
}
```

---

## 3. Team Member Management

### 3.1 Get Team Members
```javascript
const getTeamMembers = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}/members`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Team Members:', result);
    return result.members;
  } catch (error) {
    console.error('Failed to get team members:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  members: {},
  message: "No members found in this team"
}
```

---

## 4. Team Leadership Management

### 4.1 Assign Team Leader
```javascript
const assignTeamLeader = async (token, enterpriseId, departmentId, teamId, leaderId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leaderId: leaderId
      })
    });
    
    const result = await response.json();
    console.log('Team Leader Assigned:', result);
    return result.team;
  } catch (error) {
    console.error('Failed to assign team leader:', error);
  }
};
```

**Usage:**
```javascript
const teamWithLeader = await assignTeamLeader(token, 'x-spark-test', 'testdep', 'development-team', 'employee123');
```

---

## 5. Complete UI Testing Workflow

### 5.1 Setup Function
```javascript
const setupTeamTesting = async () => {
  // 1. Authenticate
  const token = await testAuth();
  if (!token) {
    console.error('Authentication failed');
    return null;
  }
  
  console.log('✅ Authentication successful');
  return token;
};
```

### 5.2 Team CRUD Testing Workflow
```javascript
const testTeamCRUD = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Team CRUD Operations...');
  
  // 1. Get all teams
  const teams = await getAllTeams(token, enterpriseId, departmentId);
  console.log('📋 Found', Object.keys(teams).length, 'teams');
  
  // 2. Create new team
  const newTeam = await createTeam(token, enterpriseId, departmentId, {
    name: "UI CRUD Test Team",
    description: "Testing CRUD operations",
    leaderId: null
  });
  console.log('✅ Created team:', newTeam.id);
  
  // 3. Get team by ID
  const retrievedTeam = await getTeamById(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Retrieved team:', retrievedTeam.name);
  
  // 4. Update team
  const updatedTeam = await updateTeam(token, enterpriseId, departmentId, newTeam.id, {
    description: "Updated via CRUD test",
    name: "Updated UI CRUD Test Team"
  });
  console.log('✅ Updated team');
  
  // 5. Patch team
  const patchedTeam = await patchTeam(token, enterpriseId, departmentId, newTeam.id, {
    description: "Patched description"
  });
  console.log('✅ Patched team');
  
  // 6. Get team members
  const members = await getTeamMembers(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Retrieved team members');
  
  // 7. Delete team
  const deleteResult = await deleteTeam(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Deleted team');
  
  return {
    created: newTeam.id,
    deleted: deleteResult.teamId
  };
};
```

### 5.3 Team Member Management Testing
```javascript
const testTeamMemberManagement = async (token, enterpriseId, departmentId, teamId) => {
  console.log('🧪 Testing Team Member Management...');
  
  // 1. Get team members
  const members = await getTeamMembers(token, enterpriseId, departmentId, teamId);
  console.log('✅ Team members retrieved');
  
  // 2. Assign team leader (if employees exist)
  // const teamWithLeader = await assignTeamLeader(token, enterpriseId, departmentId, teamId, 'employee123');
  // console.log('✅ Team leader assigned');
  
  return { members };
};
```

### 5.4 Error Handling Testing
```javascript
const testTeamErrorHandling = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Team Error Handling...');
  
  // 1. Try to create team with duplicate name
  try {
    await createTeam(token, enterpriseId, departmentId, {
      name: "UI Test Team", // This should already exist
      description: "Duplicate team test"
    });
  } catch (error) {
    console.log('✅ Duplicate name error handled correctly');
  }
  
  // 2. Try to get non-existent team
  try {
    await getTeamById(token, enterpriseId, departmentId, 'non-existent-team');
  } catch (error) {
    console.log('✅ Non-existent team error handled correctly');
  }
  
  // 3. Try to update non-existent team
  try {
    await updateTeam(token, enterpriseId, departmentId, 'non-existent-team', {
      description: "Update test"
    });
  } catch (error) {
    console.log('✅ Update non-existent team error handled correctly');
  }
};
```

### 5.5 Complete Test Suite
```javascript
const runCompleteTeamTest = async () => {
  console.log('🚀 Starting Complete Team Management Test Suite...');
  
  try {
    // Setup
    const token = await setupTeamTesting();
    if (!token) return;
    
    const enterpriseId = 'x-spark-test';
    const departmentId = 'testdep';
    
    // Run all test suites
    const crudResults = await testTeamCRUD(token, enterpriseId, departmentId);
    
    // Create a test team for member management
    const testTeam = await createTeam(token, enterpriseId, departmentId, {
      name: "UI Test Team",
      description: "Team for comprehensive testing"
    });
    
    const memberResults = await testTeamMemberManagement(token, enterpriseId, departmentId, testTeam.id);
    const errorResults = await testTeamErrorHandling(token, enterpriseId, departmentId);
    
    // Cleanup
    await deleteTeam(token, enterpriseId, departmentId, testTeam.id);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      crud: crudResults,
      member: memberResults,
      error: errorResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 6. Error Handling Examples

### 6.1 Team Not Found
```javascript
const handleTeamNotFound = (error) => {
  if (error.status === 404) {
    console.error('Team not found');
    // Show appropriate UI message
  }
};
```

### 6.2 Duplicate Team Name
```javascript
const handleDuplicateTeamName = (error) => {
  if (error.status === 409) {
    console.error('A team with this name already exists');
    // Show validation error in UI
  }
};
```

### 6.3 Department Not Found
```javascript
const handleDepartmentNotFound = (error) => {
  if (error.status === 404) {
    console.error('Department not found');
    // Show appropriate UI message
  }
};
```

### 6.4 Validation Error
```javascript
const handleValidationError = (error) => {
  if (error.status === 400) {
    console.error('Validation failed:', error.message);
    // Show validation errors in UI
  }
};
```

---

## 7. UI Integration Notes

### 7.1 Loading States
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchTeams = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const teams = await getAllTeams(token, enterpriseId, departmentId);
    setTeams(teams);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 7.2 Real-time Updates
```javascript
// Refresh data after CRUD operations
const refreshTeams = async () => {
  const teams = await getAllTeams(token, enterpriseId, departmentId);
  setTeams(teams);
};

// After creating/updating/deleting
await createTeam(token, enterpriseId, departmentId, data);
await refreshTeams(); // Refresh the list
```

### 7.3 Team Hierarchy Display
```javascript
const buildTeamHierarchy = (teams) => {
  return Object.values(teams).map(team => ({
    id: team.id,
    name: team.name,
    description: team.description,
    memberCount: team.memberCount,
    leader: team.leaderId,
    createdAt: team.createdAt
  }));
};
```

### 7.4 Team Member Management UI
```javascript
const TeamMemberManagement = ({ teamId, departmentId }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadMembers = async () => {
    setLoading(true);
    try {
      const teamMembers = await getTeamMembers(token, enterpriseId, departmentId, teamId);
      setMembers(Object.values(teamMembers));
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadMembers();
  }, [teamId]);
  
  return (
    <div>
      <h3>Team Members ({members.length})</h3>
      {loading ? (
        <p>Loading members...</p>
      ) : (
        <ul>
          {members.map(member => (
            <li key={member.id}>{member.name} - {member.role}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

---

## 8. Performance Testing

### 8.1 Team Operations Performance
```javascript
const testTeamPerformance = async (token, enterpriseId, departmentId) => {
  console.log('⚡ Testing Team Operations Performance...');
  
  const iterations = 10;
  const times = {
    create: [],
    read: [],
    update: [],
    delete: []
  };
  
  for (let i = 0; i < iterations; i++) {
    // Create performance
    const createStart = performance.now();
    const team = await createTeam(token, enterpriseId, departmentId, {
      name: `Performance Test Team ${i}`,
      description: `Team ${i} for performance testing`
    });
    const createEnd = performance.now();
    times.create.push(createEnd - createStart);
    
    // Read performance
    const readStart = performance.now();
    await getTeamById(token, enterpriseId, departmentId, team.id);
    const readEnd = performance.now();
    times.read.push(readEnd - readStart);
    
    // Update performance
    const updateStart = performance.now();
    await updateTeam(token, enterpriseId, departmentId, team.id, {
      description: `Updated team ${i}`
    });
    const updateEnd = performance.now();
    times.update.push(updateEnd - updateStart);
    
    // Delete performance
    const deleteStart = performance.now();
    await deleteTeam(token, enterpriseId, departmentId, team.id);
    const deleteEnd = performance.now();
    times.delete.push(deleteEnd - deleteStart);
  }
  
  // Calculate averages
  const avgCreate = times.create.reduce((a, b) => a + b, 0) / times.create.length;
  const avgRead = times.read.reduce((a, b) => a + b, 0) / times.read.length;
  const avgUpdate = times.update.reduce((a, b) => a + b, 0) / times.update.length;
  const avgDelete = times.delete.reduce((a, b) => a + b, 0) / times.delete.length;
  
  console.log(`📊 Performance Results:`);
  console.log(`📊 Create: ${avgCreate.toFixed(2)}ms average`);
  console.log(`📊 Read: ${avgRead.toFixed(2)}ms average`);
  console.log(`📊 Update: ${avgUpdate.toFixed(2)}ms average`);
  console.log(`📊 Delete: ${avgDelete.toFixed(2)}ms average`);
  
  return { avgCreate, avgRead, avgUpdate, avgDelete };
};
```

---

## 9. Testing Checklist

### ✅ Pre-Testing Setup
- [ ] Server running on localhost:8383
- [ ] Firebase authentication configured
- [ ] Test user credentials available
- [ ] Enterprise ID available (x-spark-test)
- [ ] Department ID available (testdep)
- [ ] Network connectivity confirmed

### ✅ Authentication Testing
- [ ] Sign-in endpoint working
- [ ] Token retrieval successful
- [ ] Token validation working

### ✅ Team CRUD Operations Testing
- [ ] Get all teams in department
- [ ] Get team by ID
- [ ] Create team
- [ ] Update team
- [ ] Patch team
- [ ] Delete team

### ✅ Team Member Management Testing
- [ ] Get team members
- [ ] Assign team leader
- [ ] Remove team leader

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Team not found
- [ ] Department not found
- [ ] Duplicate team name
- [ ] Validation errors
- [ ] Network errors

### ✅ Performance Testing
- [ ] Response time measurements
- [ ] Large team handling
- [ ] Concurrent request handling

### ✅ UI Integration Testing
- [ ] Loading states
- [ ] Error states
- [ ] Real-time updates
- [ ] Team hierarchy display
- [ ] Member management UI

---

## 10. Best Practices

### 10.1 Team Naming Conventions
```javascript
// Use descriptive team names
const teamNames = [
  "Frontend Development",
  "Backend Development", 
  "Quality Assurance",
  "DevOps",
  "Product Management"
];

// Avoid generic names
const avoidNames = [
  "Team 1",
  "Group A",
  "Test Team"
];
```

### 10.2 Team Description Guidelines
```javascript
// Good descriptions
const goodDescriptions = [
  "Responsible for user interface development and frontend architecture",
  "Handles server-side logic, APIs, and database management",
  "Ensures code quality through testing and code review processes"
];

// Avoid vague descriptions
const avoidDescriptions = [
  "Does stuff",
  "Team for work",
  "Development"
];
```

### 10.3 Error Handling Patterns
```javascript
const handleTeamOperation = async (operation, ...args) => {
  try {
    const result = await operation(...args);
    return { success: true, data: result };
  } catch (error) {
    console.error('Team operation failed:', error);
    return { 
      success: false, 
      error: error.message,
      status: error.status 
    };
  }
};
```

---

This guide provides comprehensive coverage for testing all Team Management endpoints. Use the provided code examples and workflows to ensure thorough end-to-end testing of the team management system. 