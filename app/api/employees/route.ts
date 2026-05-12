import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - List all employees (filtered by user's shop access)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    console.log('🔍 [Employees API] GET request - shopId:', shopId, 'userRole:', decoded.role);

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    console.log('🔍 [Employees API] Shop filter:', shopFilter);
    
    // Build where clause with shop filter
    const whereClause: any = { isActive: true };
    
    // If shopId is provided, validate access and filter by it
    if (shopId) {
      const shopIdNum = parseInt(shopId);
      if (isNaN(shopIdNum)) {
        return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
      }
      
      // Handle default shop case (shopId = 0)
      if (shopIdNum === 0) {
        console.log('🔍 [Employees API] Default shop requested (shopId=0), getting all accessible shops');
        if (Object.keys(shopFilter).length > 0) {
          Object.assign(whereClause, shopFilter);
        }
      } else {
        // Check if user has access to this shop
        if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
          const accessibleShopIds = shopFilter.shopId.in || [];
          console.log('🔍 [Employees API] Checking access - requested shopId:', shopIdNum, 'accessible:', accessibleShopIds);
          if (accessibleShopIds.length === 0) {
            console.log('🔍 [Employees API] Access denied - no accessible shops');
            return NextResponse.json({ success: false, message: 'No accessible shops found' }, { status: 403 });
          }
          if (!accessibleShopIds.includes(shopIdNum)) {
            console.log('🔍 [Employees API] Access denied - shopId not in accessible shops');
            return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
          }
        } else if (shopFilter.shopId && typeof shopFilter.shopId === 'number') {
          if (shopFilter.shopId !== shopIdNum) {
            console.log('🔍 [Employees API] Access denied - shopId mismatch');
            return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
          }
        } else if (Object.keys(shopFilter).length === 0) {
          // No shop filter means user has no shop access
          console.log('🔍 [Employees API] Access denied - no shop filter');
          return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
        }
        
        whereClause.shopId = BigInt(shopIdNum);
      }
    } else if (Object.keys(shopFilter).length > 0) {
      Object.assign(whereClause, shopFilter);
    }

    console.log('🔍 [Employees API] Final whereClause:', whereClause);

    const employees = await prisma.employee.findMany({ 
      where: whereClause,
      include: {
        shop: { select: { name: true, location: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get all employee payments
    const employeeIds = employees.map(e => e.id);
    console.log('🔍 [Employees API] Fetching payments for employees:', employeeIds);
    
    const payments = await prisma.employeePayment.findMany({
      where: {
        employeeId: { in: employeeIds },
        isActive: true
      },
      select: {
        employeeId: true,
        amount: true,
        paymentDate: true
      }
    });

    console.log('🔍 [Employees API] Found payments:', payments.length);

    // Group payments by employee
    const paymentsByEmployee: { [employeeId: number]: typeof payments } = {};
    for (const payment of payments) {
      const empId = Number(payment.employeeId);
      if (!paymentsByEmployee[empId]) paymentsByEmployee[empId] = [];
      paymentsByEmployee[empId].push(payment);
    }

    // Get current week range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const currentWeekStart = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0, 0);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);
    const currentWeekLabel = `${currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${currentWeekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    // Fetch attendance for the current week to calculate hours
    const attendances = await prisma.employeeAttendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: currentWeekStart, lte: currentWeekEnd }
      }
    });

    const attendanceByEmployee: { [employeeId: number]: typeof attendances } = {};
    for (const att of attendances) {
      const empId = Number(att.employeeId);
      if (!attendanceByEmployee[empId]) attendanceByEmployee[empId] = [];
      attendanceByEmployee[empId].push(att);
    }

    // Get current month's payments to determine if employee is paid this month
    const currentMonth = new Date();
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    
    console.log('🔍 [Employees API] Current month range:', currentMonthStart.toISOString(), 'to', currentMonthEnd.toISOString());
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedEmployees = employees.map(employee => {
      const employeeId = Number(employee.id);
      const employeePayments = paymentsByEmployee[employeeId] || [];
      const totalPaid = employeePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const lastPaymentDate = employeePayments.length > 0 
        ? employeePayments.reduce((latest, p) => new Date(p.paymentDate) > new Date(latest) ? p.paymentDate : latest, employeePayments[0].paymentDate)
        : null;
      
      // Check if employee has been paid this month or this week
      let hasPaidThisMonth = false;
      let hasPaidThisWeek = false;

      if (employee.salaryType === 'weekly' || employee.salaryType === 'hourly') {
        // For weekly, check if any payment notes contain the current week label, OR if there's a payment made this week
        hasPaidThisWeek = employeePayments.some(p => {
          // If notes are tracked, we could check notes, but we didn't fetch notes in the query!
          // So let's check if the payment date falls in the current week.
          const paymentDate = new Date(p.paymentDate);
          return paymentDate >= currentWeekStart && paymentDate <= currentWeekEnd;
        });
        hasPaidThisMonth = hasPaidThisWeek; // map it to the same prop for backward compatibility or ease of use
      } else {
        hasPaidThisMonth = employeePayments.some(p => {
          const paymentDate = new Date(p.paymentDate);
          return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd;
        });
      }

      // Calculate current week hours and salary
      let currentWeekHours = 0;
      let currentWeekSalary = 0;
      if (employee.salaryType === 'weekly' || employee.salaryType === 'hourly') {
        const empAttendances = attendanceByEmployee[employeeId] || [];
        currentWeekHours = empAttendances.reduce((sum, a) => sum + Number(a.hoursWorked || 0), 0);
        
        if (employee.salaryType === 'weekly') {
          currentWeekSalary = Number(employee.salary) || 0;
        } else {
          currentWeekSalary = currentWeekHours * (Number(employee.salary) || 0);
        }
      }

      console.log(`🔍 [Employees API] Employee ${employee.name} (${employeeId}): hasPaidThisMonth=${hasPaidThisMonth}, totalPaid=${totalPaid}, payments count=${employeePayments.length}, weeklyHours=${currentWeekHours}`);

      return {
        id: employeeId,
        name: employee.name,
        phone: employee.phone,
        email: employee.email,
        address: employee.address,
        position: employee.position,
        salary: employee.salary,
        joinDate: employee.joinDate,
        isActive: employee.isActive,
        salaryType: employee.salaryType,
        notes: employee.notes,
        shopId: employee.shopId ? Number(employee.shopId) : null,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
        totalPaid,
        lastPaymentDate,
        hasPaidThisMonth,
        currentWeekHours,
        currentWeekSalary
      };
    });
    
    return NextResponse.json({ success: true, data: { employees: serializedEmployees } });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST - Create a new employee
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }
    const body = await req.json();
    const { name, salary, shopId, phone, email, address, notes, salaryType, positions, joinDate } = body;
    if (!name || !salary || !shopId) {
      return NextResponse.json({ success: false, message: 'Missing required fields: name, salary, shopId' }, { status: 400 });
    }
    if (!Array.isArray(positions) || positions.length === 0 || positions.length > 2) {
      return NextResponse.json({ success: false, message: 'You must assign 1 or 2 roles to the employee.' }, { status: 400 });
    }

    // Validate shop access
    const shopFilter = await getShopFilter(token);
    const shopIdNum = parseInt(shopId);
    if (isNaN(shopIdNum)) {
      return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
    }

    // Check if user has access to this shop
    if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
      const accessibleShopIds = shopFilter.shopId.in || [];
      if (accessibleShopIds.length === 0) {
        return NextResponse.json({ success: false, message: 'No accessible shops found' }, { status: 403 });
      }
      if (!accessibleShopIds.includes(shopIdNum)) {
        return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (shopFilter.shopId && typeof shopFilter.shopId === 'number') {
      if (shopFilter.shopId !== shopIdNum) {
        return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (Object.keys(shopFilter).length === 0) {
      // No shop filter means user has no shop access
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        salary,
        shopId: BigInt(shopId),
        phone,
        email,
        address,
        notes,
        salaryType: salaryType || 'monthly',
        position: positions.join(','),
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        isActive: true
      }
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedEmployee = {
      id: Number(employee.id),
      name: employee.name,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      position: employee.position,
      salary: employee.salary,
      joinDate: employee.joinDate,
      salaryType: employee.salaryType,
      notes: employee.notes,
      isActive: employee.isActive,
      shopId: employee.shopId ? Number(employee.shopId) : null,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };
    
    return NextResponse.json({ success: true, data: { employee: serializedEmployee } });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create employee' }, { status: 500 });
  }
} 