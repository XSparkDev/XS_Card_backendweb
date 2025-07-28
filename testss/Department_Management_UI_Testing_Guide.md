# Department Management - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Department Management endpoints during end-to-end testing. All endpoints require Firebase authentication and are scoped to specific enterprises.

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

### Enterprise Context
All department endpoints are scoped to a specific enterprise:
```
/enterprise/{enterpriseId}/departments/{departmentId}/...
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

## 2. Department CRUD Operations

### 2.1 Get All Departments
```javascript
const getAllDepartments = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Departments:', result);
    return result.departments;
  } catch (error) {
    console.error('Failed to get departments:', error);
  }
};
```

**Usage:**
```javascript
const departments = await getAllDepartments(token, 'x-spark-test');
```

**Expected Response:**
```javascript
{
  success: true,
  departments: [
    {
      id: "testdep",
      name: "testDep",
      description: "",
      parentDepartmentId: null,
      createdAt: { _seconds: 1753364278, _nanoseconds: 22000000 },
      updatedAt: { _seconds: 1753364278, _nanoseconds: 22000000 },
      managers: [/* Firestore references */],
      memberCount: 1
    }
  ]
}
```

### 2.2 Get Department by ID
```javascript
const getDepartmentById = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Details:', result);
    return result.department;
  } catch (error) {
    console.error('Failed to get department:', error);
  }
};
```

### 2.3 Create Department
```javascript
const createDepartment = async (token, enterpriseId, departmentData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(departmentData)
    });
    
    const result = await response.json();
    console.log('Department Created:', result);
    return result.department;
  } catch (error) {
    console.error('Failed to create department:', error);
  }
};
```

**Usage:**
```javascript
const newDepartment = await createDepartment(token, 'x-spark-test', {
  name: "UI Test Department",
  description: "Department created via UI testing",
  parentDepartmentId: null
});
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Department created successfully",
  department: {
    id: "ui-test-department",
    name: "UI Test Department",
    description: "Department created via UI testing",
    parentDepartmentId: null,
    createdAt: "2025-07-24T19:35:39.607Z",
    updatedAt: "2025-07-24T19:35:39.607Z",
    memberCount: 0,
    managers: []
  },
  managersAddedAsEmployees: {},
  employeesCollectionPath: "enterprise/x-spark-test/departments/ui-test-department/employees"
}
```

### 2.4 Update Department
```javascript
const updateDepartment = async (token, enterpriseId, departmentId, updateData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log('Department Updated:', result);
    return result.department;
  } catch (error) {
    console.error('Failed to update department:', error);
  }
};
```

**Usage:**
```javascript
const updatedDepartment = await updateDepartment(token, 'x-spark-test', 'ui-test-department', {
  name: "Updated UI Test Department",
  description: "Updated description via UI testing"
});
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Department updated successfully",
  managersAdded: {},
  managersRemoved: {},
  managersRoleChanged: {},
  department: {
    id: "ui-test-department",
    name: "Updated UI Test Department",
    description: "Updated description via UI testing",
    updatedAt: "2025-07-24T19:36:26.148Z"
  }
}
```

### 2.5 Delete Department
```javascript
const deleteDepartment = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Deleted:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete department:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Department deleted successfully",
  departmentId: "ui-test-department"
}
```

---

## 3. Employee Management

### 3.1 Get Department Employees
```javascript
const getDepartmentEmployees = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Employees:', result);
    return result.employees;
  } catch (error) {
    console.error('Failed to get department employees:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  employees: {},
  message: "No employees found in this department"
}
```

### 3.2 Add Employee to Department
```javascript
const addEmployee = async (token, enterpriseId, departmentId, employeeData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(employeeData)
    });
    
    const result = await response.json();
    console.log('Employee Added:', result);
    return result.employee;
  } catch (error) {
    console.error('Failed to add employee:', error);
  }
};
```

**Usage:**
```javascript
const newEmployee = await addEmployee(token, 'x-spark-test', 'ui-test-department', {
  name: "John Doe",
  email: "john.doe@uitest.com",
  phone: "+1234567890",
  position: "Software Engineer",
  role: "employee"
});
```

### 3.3 Get Employee by ID
```javascript
const getEmployeeById = async (token, enterpriseId, departmentId, employeeId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees/${employeeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Employee Details:', result);
    return result.employee;
  } catch (error) {
    console.error('Failed to get employee:', error);
  }
};
```

### 3.4 Update Employee
```javascript
const updateEmployee = async (token, enterpriseId, departmentId, employeeId, updateData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees/${employeeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log('Employee Updated:', result);
    return result.employee;
  } catch (error) {
    console.error('Failed to update employee:', error);
  }
};
```

### 3.5 Delete Employee
```javascript
const deleteEmployee = async (token, enterpriseId, departmentId, employeeId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees/${employeeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Employee Deleted:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete employee:', error);
  }
};
```

### 3.6 Get All Enterprise Employees
```javascript
const getAllEnterpriseEmployees = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/employees`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Enterprise Employees:', result);
    return result.employees;
  } catch (error) {
    console.error('Failed to get enterprise employees:', error);
  }
};
```

### 3.7 Get Department Managers
```javascript
const getDepartmentManagers = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/managers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Managers:', result);
    return result.managers;
  } catch (error) {
    console.error('Failed to get department managers:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  managers: {},
  message: "No managers found for this department"
}
```

### 3.8 Get Employee Card
```javascript
const getEmployeeCard = async (token, enterpriseId, departmentId, employeeId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/employees/${employeeId}/card`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Employee Card:', result);
    return result.card;
  } catch (error) {
    console.error('Failed to get employee card:', error);
  }
};
```

### 3.9 Query Employee
```javascript
const queryEmployee = async (token, enterpriseId, departmentId, queryParams) => {
  try {
    const queryString = new URLSearchParams(queryParams).toString();
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/query-employee?${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Employee Query Result:', result);
    return result.employees;
  } catch (error) {
    console.error('Failed to query employees:', error);
  }
};
```

**Usage:**
```javascript
const employees = await queryEmployee(token, 'x-spark-test', 'ui-test-department', {
  name: "John",
  role: "employee"
});
```

---

## 4. Team Management

### 4.1 Get All Teams in Department
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

**Expected Response:**
```javascript
{
  success: true,
  teams: {},
  message: "No teams found in this department"
}
```

### 4.2 Create Team
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
const newTeam = await createTeam(token, 'x-spark-test', 'ui-test-department', {
  name: "UI Test Team",
  description: "Team created via UI testing"
});
```

### 4.3 Get Team by ID
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

### 4.4 Update Team
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

### 4.5 Patch Team
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

### 4.6 Delete Team
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

### 4.7 Get Team Members
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

---

## 5. Enterprise Cards

### 5.1 Get All Enterprise Cards
```javascript
const getAllEnterpriseCards = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/cards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Enterprise Cards:', result);
    return result.cards;
  } catch (error) {
    console.error('Failed to get enterprise cards:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  cards: {},
  count: 0
}
```

### 5.2 Get Department Cards
```javascript
const getDepartmentCards = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/cards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Cards:', result);
    return result.cards;
  } catch (error) {
    console.error('Failed to get department cards:', error);
  }
};
```

### 5.3 Get Team Cards
```javascript
const getTeamCards = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/teams/${teamId}/cards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Team Cards:', result);
    return result.cards;
  } catch (error) {
    console.error('Failed to get team cards:', error);
  }
};
```

---

## 6. Export Functionality

### 6.1 Export Teams from Department
```javascript
const exportTeams = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/exports/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Teams Export:', result);
    return result;
  } catch (error) {
    console.error('Failed to export teams:', error);
  }
};
```

### 6.2 Export Individual Team
```javascript
const exportIndividualTeam = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/exports/teams/${teamId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Individual Team Export:', result);
    return result;
  } catch (error) {
    console.error('Failed to export individual team:', error);
  }
};
```

### 6.3 Export All Enterprise Teams
```javascript
const exportAllEnterpriseTeams = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/exports/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Enterprise Teams Export:', result);
    return result;
  } catch (error) {
    console.error('Failed to export all enterprise teams:', error);
  }
};
```

---

## 7. Complete UI Testing Workflow

### 7.1 Setup Function
```javascript
const setupDepartmentTesting = async () => {
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

### 7.2 Department CRUD Testing Workflow
```javascript
const testDepartmentCRUD = async (token, enterpriseId) => {
  console.log('🧪 Testing Department CRUD Operations...');
  
  // 1. Get all departments
  const departments = await getAllDepartments(token, enterpriseId);
  console.log('📋 Found', Object.keys(departments).length, 'departments');
  
  // 2. Create new department
  const newDepartment = await createDepartment(token, enterpriseId, {
    name: "UI CRUD Test Department",
    description: "Testing CRUD operations",
    parentDepartmentId: null
  });
  console.log('✅ Created department:', newDepartment.id);
  
  // 3. Get department by ID
  const retrievedDepartment = await getDepartmentById(token, enterpriseId, newDepartment.id);
  console.log('✅ Retrieved department:', retrievedDepartment.name);
  
  // 4. Update department
  const updatedDepartment = await updateDepartment(token, enterpriseId, newDepartment.id, {
    description: "Updated via CRUD test",
    name: "Updated UI CRUD Test Department"
  });
  console.log('✅ Updated department');
  
  // 5. Delete department
  const deleteResult = await deleteDepartment(token, enterpriseId, newDepartment.id);
  console.log('✅ Deleted department');
  
  return {
    created: newDepartment.id,
    deleted: deleteResult.departmentId
  };
};
```

### 7.3 Employee Management Testing
```javascript
const testEmployeeManagement = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Employee Management...');
  
  // 1. Get department employees
  const employees = await getDepartmentEmployees(token, enterpriseId, departmentId);
  console.log('✅ Department employees retrieved');
  
  // 2. Add employee
  const newEmployee = await addEmployee(token, enterpriseId, departmentId, {
    name: "Test Employee",
    email: "test.employee@uitest.com",
    phone: "+1234567890",
    position: "Developer",
    role: "employee"
  });
  console.log('✅ Employee added:', newEmployee.id);
  
  // 3. Get employee by ID
  const retrievedEmployee = await getEmployeeById(token, enterpriseId, departmentId, newEmployee.id);
  console.log('✅ Employee retrieved');
  
  // 4. Update employee
  const updatedEmployee = await updateEmployee(token, enterpriseId, departmentId, newEmployee.id, {
    position: "Senior Developer"
  });
  console.log('✅ Employee updated');
  
  // 5. Get department managers
  const managers = await getDepartmentManagers(token, enterpriseId, departmentId);
  console.log('✅ Department managers retrieved');
  
  // 6. Get all enterprise employees
  const allEmployees = await getAllEnterpriseEmployees(token, enterpriseId);
  console.log('✅ All enterprise employees retrieved');
  
  // 7. Delete employee
  const deleteResult = await deleteEmployee(token, enterpriseId, departmentId, newEmployee.id);
  console.log('✅ Employee deleted');
  
  return { employeeId: newEmployee.id };
};
```

### 7.4 Team Management Testing
```javascript
const testTeamManagement = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Team Management...');
  
  // 1. Get all teams
  const teams = await getAllTeams(token, enterpriseId, departmentId);
  console.log('✅ Teams retrieved');
  
  // 2. Create team
  const newTeam = await createTeam(token, enterpriseId, departmentId, {
    name: "UI Test Team",
    description: "Team for UI testing"
  });
  console.log('✅ Team created:', newTeam.id);
  
  // 3. Get team by ID
  const retrievedTeam = await getTeamById(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Team retrieved');
  
  // 4. Update team
  const updatedTeam = await updateTeam(token, enterpriseId, departmentId, newTeam.id, {
    description: "Updated team description"
  });
  console.log('✅ Team updated');
  
  // 5. Get team members
  const members = await getTeamMembers(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Team members retrieved');
  
  // 6. Delete team
  const deleteResult = await deleteTeam(token, enterpriseId, departmentId, newTeam.id);
  console.log('✅ Team deleted');
  
  return { teamId: newTeam.id };
};
```

### 7.5 Enterprise Cards Testing
```javascript
const testEnterpriseCards = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Enterprise Cards...');
  
  // 1. Get all enterprise cards
  const enterpriseCards = await getAllEnterpriseCards(token, enterpriseId);
  console.log('✅ Enterprise cards retrieved');
  
  // 2. Get department cards
  const departmentCards = await getDepartmentCards(token, enterpriseId, departmentId);
  console.log('✅ Department cards retrieved');
  
  return { enterpriseCards, departmentCards };
};
```

### 7.6 Export Testing
```javascript
const testExportFunctionality = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Export Functionality...');
  
  // 1. Export teams from department
  const departmentTeamsExport = await exportTeams(token, enterpriseId, departmentId);
  console.log('✅ Department teams export completed');
  
  // 2. Export all enterprise teams
  const enterpriseTeamsExport = await exportAllEnterpriseTeams(token, enterpriseId);
  console.log('✅ Enterprise teams export completed');
  
  return { departmentTeamsExport, enterpriseTeamsExport };
};
```

### 7.7 Complete Test Suite
```javascript
const runCompleteDepartmentTest = async () => {
  console.log('🚀 Starting Complete Department Management Test Suite...');
  
  try {
    // Setup
    const token = await setupDepartmentTesting();
    if (!token) return;
    
    const enterpriseId = 'x-spark-test';
    
    // Run all test suites
    const crudResults = await testDepartmentCRUD(token, enterpriseId);
    
    // Create a test department for other tests
    const testDepartment = await createDepartment(token, enterpriseId, {
      name: "UI Test Department",
      description: "Department for comprehensive testing",
      parentDepartmentId: null
    });
    
    const employeeResults = await testEmployeeManagement(token, enterpriseId, testDepartment.id);
    const teamResults = await testTeamManagement(token, enterpriseId, testDepartment.id);
    const cardResults = await testEnterpriseCards(token, enterpriseId, testDepartment.id);
    const exportResults = await testExportFunctionality(token, enterpriseId, testDepartment.id);
    
    // Cleanup
    await deleteDepartment(token, enterpriseId, testDepartment.id);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      crud: crudResults,
      employee: employeeResults,
      team: teamResults,
      cards: cardResults,
      export: exportResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 8. Error Handling Examples

### 8.1 Department Not Found
```javascript
const handleDepartmentNotFound = (error) => {
  if (error.status === 404) {
    console.error('Department not found');
    // Show appropriate UI message
  }
};
```

### 8.2 Employee Not Found
```javascript
const handleEmployeeNotFound = (error) => {
  if (error.status === 404) {
    console.error('Employee not found');
    // Show appropriate UI message
  }
};
```

### 8.3 Validation Error
```javascript
const handleValidationError = (error) => {
  if (error.status === 400) {
    console.error('Validation failed:', error.message);
    // Show validation errors in UI
  }
};
```

---

## 9. UI Integration Notes

### 9.1 Loading States
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchDepartments = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const departments = await getAllDepartments(token, enterpriseId);
    setDepartments(departments);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 9.2 Real-time Updates
```javascript
// Refresh data after CRUD operations
const refreshData = async () => {
  const departments = await getAllDepartments(token, enterpriseId);
  setDepartments(departments);
};

// After creating/updating/deleting
await createDepartment(token, enterpriseId, data);
await refreshData(); // Refresh the list
```

### 9.3 Hierarchical Department Structure
```javascript
const buildDepartmentTree = (departments) => {
  const departmentMap = {};
  const rootDepartments = [];
  
  // Create map of all departments
  departments.forEach(dept => {
    departmentMap[dept.id] = { ...dept, children: [] };
  });
  
  // Build tree structure
  departments.forEach(dept => {
    if (dept.parentDepartmentId && departmentMap[dept.parentDepartmentId]) {
      departmentMap[dept.parentDepartmentId].children.push(departmentMap[dept.id]);
    } else {
      rootDepartments.push(departmentMap[dept.id]);
    }
  });
  
  return rootDepartments;
};
```

---

## 10. Testing Checklist

### ✅ Pre-Testing Setup
- [ ] Server running on localhost:8383
- [ ] Firebase authentication configured
- [ ] Test user credentials available
- [ ] Enterprise ID available (x-spark-test)
- [ ] Network connectivity confirmed

### ✅ Authentication Testing
- [ ] Sign-in endpoint working
- [ ] Token retrieval successful
- [ ] Token validation working

### ✅ Department CRUD Operations Testing
- [ ] Get all departments
- [ ] Get department by ID
- [ ] Create department
- [ ] Update department
- [ ] Delete department

### ✅ Employee Management Testing
- [ ] Get department employees
- [ ] Add employee to department
- [ ] Get employee by ID
- [ ] Update employee
- [ ] Delete employee
- [ ] Get all enterprise employees
- [ ] Get department managers
- [ ] Get employee card
- [ ] Query employees

### ✅ Team Management Testing
- [ ] Get all teams in department
- [ ] Create team
- [ ] Get team by ID
- [ ] Update team
- [ ] Patch team
- [ ] Delete team
- [ ] Get team members

### ✅ Enterprise Cards Testing
- [ ] Get all enterprise cards
- [ ] Get department cards
- [ ] Get team cards

### ✅ Export Functionality Testing
- [ ] Export teams from department
- [ ] Export individual team
- [ ] Export all enterprise teams

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Department not found
- [ ] Employee not found
- [ ] Team not found
- [ ] Validation errors
- [ ] Network errors

### ✅ Performance Testing
- [ ] Response time measurements
- [ ] Large department handling
- [ ] Concurrent request handling

---

This guide provides comprehensive coverage for testing all Department Management endpoints. Use the provided code examples and workflows to ensure thorough end-to-end testing of the department management system. 