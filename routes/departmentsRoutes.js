const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/enterprise/departmentsController');
const teamsController = require('../controllers/enterprise/teamsController');
const exportController = require('../controllers/enterprise/exportController'); // Added exportController
const { authenticateUser } = require('../middleware/auth');

// Apply authentication to all department routes
router.use(authenticateUser);

// Enterprise department routes
router.get('/enterprise/:enterpriseId/departments', departmentsController.getAllDepartments);
router.get('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.getDepartmentById);
router.post('/enterprise/:enterpriseId/departments', departmentsController.createDepartment);
router.put('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.updateDepartment);
router.delete('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.deleteDepartment);

// Enterprise teams routes
router.get('/enterprise/:enterpriseId/departments/:departmentId/teams', teamsController.getAllTeams);
router.post('/enterprise/:enterpriseId/departments/:departmentId/teams', teamsController.createTeam);
router.get('/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.getTeamById);
router.put('/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.updateTeam);
router.patch('/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.patchTeam); // Add PATCH endpoint
router.delete('/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.deleteTeam);
router.get('/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/members', teamsController.getTeamMembers);

// Export routes
router.get('/enterprise/:enterpriseId/departments/:departmentId/exports/teams', exportController.exportTeams);
router.get('/enterprise/:enterpriseId/departments/:departmentId/exports/teams/:teamId', exportController.exportIndividualTeam);
router.get('/enterprise/:enterpriseId/exports/teams', exportController.exportTeams);

// Enterprise employees routes
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.getDepartmentEmployees);
router.post('/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.addEmployee);
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.getEmployeeById);
router.put('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.updateEmployee);
router.delete('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.deleteEmployee);
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/card', departmentsController.getEmployeeCard);
router.get('/enterprise/:enterpriseId/departments/:departmentId/query-employee', departmentsController.queryEmployee);

module.exports = router;
