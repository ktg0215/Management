import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
export const validateUUID = (field: string) => 
  param(field).isUUID().withMessage(`${field} must be a valid UUID`);

export const validateYear = () =>
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030');

export const validateMonth = () =>
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12');

export const validateStoreId = () =>
  query('storeId').isUUID().withMessage('Store ID must be a valid UUID');

// Employee validation
export const validateEmployeeCreation = [
  body('employeeId').trim().isLength({ min: 1, max: 20 }).withMessage('Employee ID is required (1-20 characters)'),
  body('fullName').trim().isLength({ min: 1, max: 100 }).withMessage('Full name is required (1-100 characters)'),
  body('nickname').trim().isLength({ min: 1, max: 50 }).withMessage('Nickname is required (1-50 characters)'),
  body('storeId').isUUID().withMessage('Store ID must be a valid UUID'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
  handleValidationErrors
];

// Store validation
export const validateStoreCreation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Store name is required (1-100 characters)'),
  body('businessTypeId').isUUID().withMessage('Business type ID must be a valid UUID'),
  handleValidationErrors
];

// Sales data validation
export const validateSalesData = [
  validateYear(),
  validateMonth(),
  validateStoreId(),
  body('dailyData').isObject().withMessage('Daily data must be an object'),
  handleValidationErrors
];

// Payment validation
export const validatePayment = [
  body('companyId').isUUID().withMessage('Company ID must be a valid UUID'),
  body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
  body('amount').isNumeric().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('storeId').optional().isUUID().withMessage('Store ID must be a valid UUID'),
  handleValidationErrors
];

// Company validation
export const validateCompany = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Company name is required (1-100 characters)'),
  body('category').trim().isLength({ min: 1, max: 50 }).withMessage('Category is required'),
  body('paymentType').isIn(['regular', 'irregular']).withMessage('Payment type must be regular or irregular'),
  body('storeId').isUUID().withMessage('Store ID must be a valid UUID'),
  body('regularAmount').optional().isNumeric().withMessage('Regular amount must be numeric'),
  body('specificMonths').optional().isArray().withMessage('Specific months must be an array'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
  handleValidationErrors
];