const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/enterprise/departmentsController');
const { authenticateUser } = require('../middleware/auth');

// Apply authentication to all department routes
router.use(authenticateUser);

// Enterprise department routes
router.get('/enterprise/:enterpriseId/departments', departmentsController.getAllDepartments);
router.get('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.getDepartmentById);
router.post('/enterprise/:enterpriseId/departments', departmentsController.createDepartment);
router.put('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.updateDepartment);
router.delete('/enterprise/:enterpriseId/departments/:departmentId', departmentsController.deleteDepartment);

// Enterprise employees routes
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.getDepartmentEmployees);
router.post('/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.addEmployee); // New route to add employee
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.getEmployeeById);
router.get('/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/card', departmentsController.getEmployeeCard);
router.get('/enterprise/:enterpriseId/departments/:departmentId/query-employee', departmentsController.queryEmployee);

module.exports = router;
