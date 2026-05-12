import { z } from 'zod';

// Custom error messages
const ERROR_MESSAGES = {
  email: {
    required: 'Email is required',
    invalid: 'Please enter a valid email address',
    tooLong: 'Email is too long (max 255 characters)',
  },
  password: {
    required: 'Password is required',
    tooShort: 'Password must be at least 6 characters',
    tooLong: 'Password is too long (max 128 characters)',
  },
  otp: {
    required: 'OTP is required',
    invalid: 'OTP must be 6 digits',
  },
  name: {
    required: 'Name is required',
    tooShort: 'Name must be at least 2 characters',
    tooLong: 'Name is too long (max 100 characters)',
  },
  phone: {
    required: 'Phone number is required',
    invalid: 'Please enter a valid phone number',
  },
};

// Base schemas for reusability
export const emailSchema = z
  .string()
  .min(1, ERROR_MESSAGES.email.required)
  .email(ERROR_MESSAGES.email.invalid)
  .max(255, ERROR_MESSAGES.email.tooLong)
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(1, ERROR_MESSAGES.password.required)
  .min(6, ERROR_MESSAGES.password.tooShort)
  .max(128, ERROR_MESSAGES.password.tooLong);

export const otpSchema = z
  .string()
  .min(1, ERROR_MESSAGES.otp.required)
  .regex(/^\d{6}$/, ERROR_MESSAGES.otp.invalid);

export const nameSchema = z
  .string()
  .min(1, ERROR_MESSAGES.name.required)
  .min(2, ERROR_MESSAGES.name.tooShort)
  .max(100, ERROR_MESSAGES.name.tooLong)
  .trim();

export const phoneSchema = z
  .string()
  .min(1, ERROR_MESSAGES.phone.required)
  .regex(/^[\+]?[1-9][\d]{0,15}$/, ERROR_MESSAGES.phone.invalid)
  .trim();

// Login schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  otp: otpSchema.optional(),
  deviceInfo: z.object({
    deviceName: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    screenResolution: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    platform: z.string().optional(),
    userAgent: z.string().optional(),
    canvasFingerprint: z.string().optional(),
    webglFingerprint: z.string().optional(),
    audioFingerprint: z.string().optional(),
    fonts: z.array(z.string()).optional(),
    plugins: z.array(z.string()).optional(),
    hardwareConcurrency: z.number().optional(),
    deviceMemory: z.number().optional(),
    maxTouchPoints: z.number().optional(),
    cookieEnabled: z.boolean().optional(),
    doNotTrack: z.string().optional(),
    adBlockDetected: z.boolean().optional(),
    rememberDevice: z.boolean().optional(),
    ipAddress: z.string().optional(),
    deviceId: z.string().optional(),
  }).optional(),
});

export const login2FASchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  otp: otpSchema,
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    deviceId: z.string().optional(),
  }).optional(),
});

// Password change schemas
export const passwordChangeSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  otp: otpSchema.optional(),
});

export const passwordChange2FASchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  otp: otpSchema,
});

// User schemas
export const userCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN', 'SUPER_DUPER_ADMIN']),
  shopId: z.number().optional(),
});

export const userUpdateSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN', 'SUPER_DUPER_ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

// Shop schemas
export const shopCreateSchema = z.object({
  name: z.string().min(1, 'Shop name is required').max(100, 'Shop name is too long'),
  location: z.string().min(1, 'Location is required').max(200, 'Location is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  contactPerson: nameSchema.optional(),
  contactPhone: phoneSchema.optional(),
  contactEmail: emailSchema.optional(),
});

export const shopUpdateSchema = z.object({
  name: z.string().min(1, 'Shop name is required').max(100, 'Shop name is too long').optional(),
  location: z.string().min(1, 'Location is required').max(200, 'Location is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional(),
  contactPerson: nameSchema.optional(),
  contactPhone: phoneSchema.optional(),
  contactEmail: emailSchema.optional(),
  isActive: z.boolean().optional(),
});

// Product schemas
export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  categoryId: z.number().positive('Category is required'),
  unit: z.string().min(1, 'Unit is required').max(20, 'Unit is too long'),
  price: z.number().positive('Price must be positive'),
  minStock: z.number().min(0, 'Minimum stock cannot be negative'),
  currentStock: z.number().min(0, 'Current stock cannot be negative'),
  damagedQuantity: z.number().min(0, 'Damaged quantity cannot be negative').default(0),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional(),
  categoryId: z.number().positive('Category is required').optional(),
  unit: z.string().min(1, 'Unit is required').max(20, 'Unit is too long').optional(),
  price: z.number().positive('Price must be positive').optional(),
  minStock: z.number().min(0, 'Minimum stock cannot be negative').optional(),
  currentStock: z.number().min(0, 'Current stock cannot be negative').optional(),
  damagedQuantity: z.number().min(0, 'Damaged quantity cannot be negative').optional(),
});

// Sale schemas
export const saleItemSchema = z.object({
  productId: z.number().positive('Product is required'),
  name: z.string().min(1, 'Product name is required'),
  stockType: z.enum(['normal', 'damaged']),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.number().positive('Quantity must be positive'),
  price_per_unit: z.number().positive('Price must be positive'),
});

export const saleCreateSchema = z.object({
  shopId: z.number().positive('Shop is required'),
  customerId: z.number().positive('Customer is required'),
  saleDate: z.string().datetime('Invalid sale date'),
  totalAmount: z.string().min(1, 'Total amount is required'),
  finalAmount: z.string().min(1, 'Final amount is required'),
  paidAmount: z.string().min(1, 'Paid amount is required'),
  dueAmount: z.string().min(1, 'Due amount is required'),
  discount: z.string().default('0'),
  taxAmount: z.string().default('0'),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']),
  notes: z.string().max(500, 'Notes are too long').optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

// Cash sale schemas
export const customerInfoSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100, 'Customer name is too long'),
  phone: phoneSchema,
  address: z.string().max(200, 'Address is too long').optional(),
});

export const cashSaleSchema = z.object({
  shopId: z.number().positive('Shop is required'),
  customerInfo: customerInfoSchema,
  saleDate: z.string().datetime('Invalid sale date'),
  totalAmount: z.string().min(1, 'Total amount is required'),
  finalAmount: z.string().min(1, 'Final amount is required'),
  discount: z.string().default('0'),
  taxAmount: z.string().default('0'),
  notes: z.string().max(500, 'Notes are too long').optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  payment_type: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']).default('CASH'),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
  search: z.string().max(100, 'Search term is too long').optional(),
  sortBy: z.string().max(50, 'Sort field is too long').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filters: z.record(z.any()).optional(),
});

// Search schemas
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Search query is too long'),
  type: z.enum(['products', 'customers', 'sales', 'all']).default('all'),
  limit: z.number().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(10),
});

// Filter schemas
export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Start date must be before or equal to end date',
  path: ['endDate'],
});

export const stockFilterSchema = z.object({
  minStock: z.number().min(0, 'Minimum stock cannot be negative').optional(),
  maxStock: z.number().min(0, 'Maximum stock cannot be negative').optional(),
  lowStock: z.boolean().optional(),
  outOfStock: z.boolean().optional(),
});

export const priceFilterSchema = z.object({
  minPrice: z.number().min(0, 'Minimum price cannot be negative').optional(),
  maxPrice: z.number().min(0, 'Maximum price cannot be negative').optional(),
}).refine((data) => {
  if (data.minPrice && data.maxPrice) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: 'Minimum price must be less than or equal to maximum price',
  path: ['maxPrice'],
});

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type Login2FAInput = z.infer<typeof login2FASchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordChange2FAInput = z.infer<typeof passwordChange2FASchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ShopCreateInput = z.infer<typeof shopCreateSchema>;
export type ShopUpdateInput = z.infer<typeof shopUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
export type CashSaleInput = z.infer<typeof cashSaleSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type StockFilterInput = z.infer<typeof stockFilterSchema>;
export type PriceFilterInput = z.infer<typeof priceFilterSchema>;

// Validation helper functions
export const validateInput = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
};

export const validateInputSafe = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

// Performance-optimized validation (for frequently used schemas)
export const validateLogin = (data: unknown) => validateInput(loginSchema, data);
export const validatePasswordChange = (data: unknown) => validateInput(passwordChangeSchema, data);
export const validatePagination = (data: unknown) => validateInput(paginationSchema, data);
export const validateSearch = (data: unknown) => validateInput(searchSchema, data); 